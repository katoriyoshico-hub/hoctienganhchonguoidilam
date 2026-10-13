import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createHash } from "node:crypto";
import { makeLessonQuestions, normalizeAnswer } from "../lesson-game.js";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { JSDOM } from "jsdom";
import { migrate } from "../server/migrate.js";
import { createApp } from "../server/app.js";
import { startServer } from "../server/index.js";
let admin, pool, server, origin;
const name = `ct_speak_test_${process.pid}`;
let cookie = "";
async function request(path, body, method = "GET", identity = cookie) {
  const response = await fetch(origin + path, {
    method,
    headers: { "Content-Type": "application/json", Cookie: identity },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.headers.get("set-cookie") && !identity)
    cookie = response.headers.get("set-cookie").split(";")[0];
  return { status: response.status, body: await response.json() };
}
before(async () => {
  assert.ok(
    process.env.DATABASE_URL,
    "Set DATABASE_URL for PostgreSQL integration tests",
  );
  admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  await admin.query(`CREATE DATABASE ${name}`);
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = "/" + name;
  pool = new pg.Pool({ connectionString: url.href });
  server = await startServer({ pool, port: 0, host: "0.0.0.0" });
  origin = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (pool) await pool.end();
  if (admin) {
    await admin.query(`DROP DATABASE IF EXISTS ${name}`);
    await admin.end();
  }
});
test("deployment starts on an empty database and restarts without reseeding", async () => {
  assert.equal(server.address().address, "0.0.0.0");
  assert.equal((await request("/api/health")).status, 200);
  const restarted = await startServer({ pool, port: 0, host: "0.0.0.0" });
  try {
    const response = await fetch(
      `http://127.0.0.1:${restarted.address().port}/api/catalog`,
    );
    assert.equal(response.status, 200);
    assert.equal((await response.json()).lessons.length, 39);
  } finally {
    await new Promise((resolve) => restarted.close(resolve));
  }
});
test("hosting stays externally reachable when HOST is set to loopback", async () => {
  const previousHost = process.env.HOST;
  const previousPort = process.env.PORT;
  let hosted;
  try {
    process.env.HOST = "127.0.0.1";
    process.env.PORT = "0";
    // Exercise defaults used by npm start, rather than explicitly fixing host.
    hosted = await startServer({ pool });
    assert.equal(hosted.address().address, "0.0.0.0");
    const response = await fetch(
      `http://127.0.0.1:${hosted.address().port}/api/health`,
    );
    assert.equal(response.status, 200);
  } finally {
    if (hosted) await new Promise((resolve) => hosted.close(resolve));
    if (previousHost === undefined) delete process.env.HOST;
    else process.env.HOST = previousHost;
    if (previousPort === undefined) delete process.env.PORT;
    else process.env.PORT = previousPort;
  }
});
test("all ten PRD tables exist; migrations repeat without duplicating content", async () => {
  await migrate(pool);
  const { rows } = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'",
  );
  for (const table of [
    "users",
    "modules",
    "lessons",
    "phrases",
    "scenarios",
    "scenario_turns",
    "practice_sessions",
    "session_turns",
    "flashcard_reviews",
    "user_progress",
  ])
    assert.ok(rows.some((r) => r.table_name === table));
  const result = await request("/api/catalog");
  assert.equal(result.body.lessons.length, 39);
  assert.equal(result.body.scenarios.length, 34);
  assert.equal(result.body.lessons.flatMap((l) => l.phrases).length, 390);
  assert.ok(
    result.body.scenarios.every(
      (s) => s.lines.length === 4 && s.hints.length === 4,
    ),
  );
});
test("API catalog reflects PostgreSQL edits rather than frontend constants", async () => {
  await pool.query(
    "UPDATE lessons SET title = 'Database-backed lesson' WHERE lesson_id = 101",
  );
  assert.equal(
    (await request("/api/catalog")).body.lessons[0].title,
    "Database-backed lesson",
  );
});
test("goal, progress and reviews survive reload; upserts do not duplicate records", async () => {
  assert.equal((await request("/api/state")).status, 200);
  await request("/api/state/goal", { goal: "travel" }, "PUT");
  for (let i = 0; i < 2; i++) {
    assert.equal(
      (await request("/api/state/progress", { lessonId: 101 }, "PUT")).status,
      200,
    );
    assert.equal(
      (
        await request(
          "/api/state/reviews",
          { lessonId: 101, phraseIndex: 0, rating: "good" },
          "PUT",
        )
      ).status,
      200,
    );
  }
  const state = (await request("/api/state")).body;
  assert.deepEqual(state.done, [101]);
  assert.equal(state.goal, "travel");
  assert.equal(state.reviews["101-0"].rating, "good");
  assert.ok(
    Math.abs(state.reviews["101-0"].due - Date.now() - 86400000) < 5000,
  );
  assert.equal(
    (await pool.query("SELECT repetition_count FROM flashcard_reviews")).rows[0]
      .repetition_count,
    2,
  );
});
test("sessions and transcripts persist; another anonymous profile cannot access them", async () => {
  const session = await request("/api/sessions", { scenarioId: 501 }, "POST");
  assert.equal(session.status, 201);
  const id = session.body.id;
  assert.equal(
    (
      await request(
        `/api/sessions/${id}/turns`,
        { turnIndex: 2, transcript: "Skipped" },
        "PUT",
      )
    ).status,
    400,
  );
  for (let i = 0; i < 4; i++)
    assert.equal(
      (
        await request(
          `/api/sessions/${id}/turns`,
          { turnIndex: i, transcript: "Hello " + i },
          "PUT",
        )
      ).status,
      200,
    );
  const saved = (await request(`/api/sessions/${id}`)).body;
  assert.ok(saved.completed_at);
  assert.equal(saved.turns.length, 4);
  assert.equal(saved.turns[0].user_speech_transcript, "Hello 0");
  const owner = cookie;
  await request("/api/state", undefined, "GET", "");
  assert.equal((await request(`/api/sessions/${id}`)).status, 404);
  assert.equal(
    (
      await request(
        `/api/sessions/${id}/turns`,
        { turnIndex: 0, transcript: "Intrusion" },
        "PUT",
      )
    ).status,
    404,
  );
  assert.equal((await request("/api/state")).body.done.length, 0);
  cookie = owner;
});
test("invalid state requests do not write; anonymous writes require a profile", async () => {
  assert.equal(
    (await request("/api/state/goal", { goal: "invalid" }, "PUT")).status,
    400,
  );
  assert.equal(
    (await request("/api/state/progress", { lessonId: 999 }, "PUT")).status,
    404,
  );
  assert.equal(
    (
      await request(
        "/api/state/reviews",
        { lessonId: 101, phraseIndex: -1, rating: "good" },
        "PUT",
      )
    ).status,
    400,
  );
  assert.equal(
    (await request("/api/state/goal", { goal: "work" }, "PUT", "")).status,
    401,
  );
});
async function waitFor(predicate) {
  for (let i = 0; i < 300; i++) {
    if (predicate()) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  assert.fail("UI condition timed out");
}
async function browser(identity) {
  const html = await readFile(
    new URL("../dist/index.html", import.meta.url),
    "utf8",
  );
  const path = html.match(/src="([^\"]+\.js)"/)[1];
  const code = await (await fetch(origin + path)).text();
  const dom = new JSDOM('<div id="root"></div>', {
    url: origin,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  dom.window.fetch = (path, options = {}) =>
    fetch(new URL(path, origin), {
      ...options,
      signal: undefined,
      headers: { ...options.headers, Cookie: identity },
    });
  dom.window.eval(code);
  await waitFor(() => dom.window.document.querySelector(".hero"));
  return dom;
}
function click(dom, text) {
  const button = [...dom.window.document.querySelectorAll("button")].find((b) =>
    b.textContent.includes(text),
  );
  assert.ok(button, "Button: " + text);
  const details = button.closest("details");
  if (details) details.open = true;
  button.click();
}
test("built frontend loads API content and saves learning changes without localStorage", async () => {
  const dom = await browser(cookie);
  try {
    const document = dom.window.document;
    assert.ok(document.body.textContent.includes("483"));
    click(dom, "Bài học");
    await waitFor(() => document.querySelector(".lesson-grid"));
    assert.ok(document.body.textContent.includes("Database-backed lesson"));
    click(dom, "Lắng nghe");
    await waitFor(() => document.querySelector(".lesson-detail"));
    click(dom, "Câu tiếp theo");
    await waitFor(() =>
      document.body.textContent.includes("What are you looking for?"),
    );
    click(dom, "Câu tiếp theo");
    await waitFor(() =>
      document.body.textContent.includes("Could you tell me more?"),
    );
    for (let step = 3; step < 10; step++) {
      click(dom, "Câu tiếp theo");
      await waitFor(() =>
        document
          .querySelector(".lesson-footer span")
          .textContent.trim()
          .startsWith(`${step + 1} /`),
      );
    }
    click(dom, "Hoàn thành bài học");
    await waitFor(() => document.querySelector(".lesson-game"));
    click(dom, "Về thư viện");
    await waitFor(() => document.querySelector(".lesson-grid"));
    assert.ok((await request("/api/state")).body.done.includes(102));
    click(dom, "Flashcards");
    await waitFor(() => document.querySelector(".flashcard"));
    click(dom, "Đã thuộc");
    await waitFor(() => document.body.textContent.includes("Thẻ 2 /"));
    assert.equal(
      (await request("/api/state")).body.reviews["101-0"].rating,
      "easy",
    );
    click(dom, "Tiến độ");
    await waitFor(() => document.querySelector("select"));
    document.querySelector("select").value = "work";
    document
      .querySelector("select")
      .dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    await waitFor(() => !document.querySelector("fieldset").disabled);
    assert.equal((await request("/api/state")).body.goal, "work");
    click(dom, "Hội thoại");
    await waitFor(() => document.querySelector(".chat-panel"));
    for (let turn = 0; turn < 3; turn++) {
      click(dom, "Tiếp tục");
      await waitFor(() =>
        document
          .querySelector(".chat-header small")
          .textContent.includes(`${turn + 2}/4`),
      );
    }
    click(dom, "Luyện lại");
    await waitFor(
      () =>
        document
          .querySelector(".chat-header small")
          .textContent.includes("1/4") &&
        !document.querySelector("fieldset").disabled,
    );
    assert.equal((await request("/api/state")).body.sessions.length, 2);
    click(dom, "Bài học");
    await waitFor(() => document.querySelector(".lesson-grid"));
    click(dom, "Gói quà và đóng gói");
    await waitFor(() => document.querySelector(".vocabulary"));
    assert.equal(document.querySelectorAll(".vocabulary-item").length, 3);
    assert.ok(
      document.querySelector(".vocabulary").textContent.includes("bubble wrap"),
    );
    assert.ok(
      document
        .querySelector(".vocabulary")
        .textContent.includes("màng bọc chống sốc"),
    );
    click(dom, "Hội thoại");
    await waitFor(() => document.querySelector(".chat-panel"));
    click(dom, "Hỏi người bản địa đường đến tháp Eiffel");
    await waitFor(() =>
      document.querySelector(".scenario-context").textContent.includes("Paris"),
    );
    assert.ok(
      document
        .querySelector(".scenario-context")
        .textContent.includes("Du khách"),
    );
    assert.ok(
      document
        .querySelector(".chat-bottom")
        .textContent.includes("Eiffel Tower"),
    );
    assert.equal(dom.window.localStorage.length, 0);
  } finally {
    dom.window.close();
  }
  const reloaded = await browser(cookie);
  try {
    click(reloaded, "Tiến độ");
    await waitFor(() => reloaded.window.document.querySelector("select"));
    assert.equal(
      reloaded.window.document.querySelector("select").value,
      "work",
    );
    assert.ok(reloaded.window.document.body.textContent.includes("Lắng nghe"));
  } finally {
    reloaded.window.close();
  }
});
test("database errors produce a failure response instead of false success", async () => {
  const broken = createApp({
    query: async () => {
      throw Object.assign(new Error("private connection info"), {
        code: "ECONNREFUSED",
      });
    },
  }).listen(0, "127.0.0.1");
  await once(broken, "listening");
  try {
    const response = await fetch(
      `http://127.0.0.1:${broken.address().port}/api/catalog`,
    );
    assert.equal(response.status, 503);
    assert.ok(!(await response.text()).includes("private connection info"));
  } finally {
    await new Promise((r) => broken.close(r));
  }
});

test("new content covers sales, landmarks and souvenirs with vocabulary and review persistence", async () => {
  const { body: catalog } = await request("/api/catalog");
  assert.equal(catalog.lessons.flatMap((l) => l.vocabulary).length, 93);
  for (const id of [
    105, 106, 107, 108, 109, 205, 206, 207, 208, 209, 210, 211, 212, 213, 214,
  ]) {
    const lesson = catalog.lessons.find((l) => l.id === id);
    assert.equal(lesson.phrases.length, 10);
    assert.equal(lesson.vocabulary.length, 3);
    assert.ok(
      lesson.phrases.every(
        (p) =>
          p.length === 3 &&
          p.every((value) => typeof value === "string" && value.length > 0),
      ),
    );
  }
  for (const landmark of ["Eiffel", "Louvre", "Colosseum", "Kyoto"])
    assert.ok(catalog.lessons.some((l) => l.title.includes(landmark)));
  assert.equal(catalog.lessons.find((l) => l.id === 105).cat, "work");
  assert.equal(catalog.lessons.find((l) => l.id === 214).cat, "travel");
  assert.equal(
    (
      await request(
        "/api/state/reviews",
        { lessonId: 214, phraseIndex: 3, rating: "good" },
        "PUT",
      )
    ).status,
    200,
  );
  assert.equal(
    (await request("/api/state")).body.reviews["214-3"].rating,
    "good",
  );
});

test("upgrading an existing database preserves previous lessons and learner progress", async () => {
  const upgradeName = `${name}_upgrade`;
  await admin.query(`CREATE DATABASE ${upgradeName}`);
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = "/" + upgradeName;
  const existing = new pg.Pool({ connectionString: url.href });
  let upgradedServer;
  try {
    await existing.query(
      "CREATE TABLE schema_migrations (name TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())",
    );
    for (const filename of [
      "001_schema.sql",
      "002_content.sql",
      "003_state_constraints.sql",
    ]) {
      const sql = await readFile(
        new URL(`../db/migrations/${filename}`, import.meta.url),
        "utf8",
      );
      await existing.query(sql);
      await existing.query(
        "INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)",
        [filename, createHash("sha256").update(sql).digest("hex")],
      );
    }
    const {
      rows: [user],
    } = await existing.query(
      "INSERT INTO users (full_name,email,primary_goal) VALUES ('Existing learner','existing@example.test','BOTH') RETURNING user_id",
    );
    await existing.query(
      "INSERT INTO user_progress (user_id,lesson_id,status,completion_percentage) VALUES ($1,101,'COMPLETED',100)",
      [user.user_id],
    );
    await existing.query(
      "UPDATE lessons SET title = 'Existing custom title' WHERE lesson_id = 101",
    );
    upgradedServer = await startServer({ pool: existing, port: 0 });
    await migrate(existing);
    assert.equal(
      (await existing.query("SELECT COUNT(*)::int AS n FROM lessons")).rows[0]
        .n,
      39,
    );
    assert.equal(
      (await existing.query("SELECT COUNT(*)::int AS n FROM phrases")).rows[0]
        .n,
      483,
    );
    assert.equal(
      (await existing.query("SELECT title FROM lessons WHERE lesson_id=101"))
        .rows[0].title,
      "Existing custom title",
    );
    assert.equal(
      (
        await existing.query(
          "SELECT status FROM user_progress WHERE user_id=$1 AND lesson_id=101",
          [user.user_id],
        )
      ).rows[0].status,
      "COMPLETED",
    );
  } finally {
    if (upgradedServer)
      await new Promise((resolve) => upgradedServer.close(resolve));
    await existing.end();
    await admin.query(`DROP DATABASE ${upgradeName}`);
  }
});

test("listening API returns 45 contextual exercises linked to vocabulary", async () => {
  const { body: catalog } = await request("/api/catalog");
  assert.equal(catalog.listeningExercises.length, 45);
  assert.equal(
    catalog.listeningExercises.filter((e) => e.cat === "work").length,
    15,
  );
  assert.equal(
    catalog.listeningExercises.filter((e) => e.cat === "travel").length,
    30,
  );
  for (const exercise of catalog.listeningExercises) {
    assert.ok(exercise.situation.startsWith("Giả sử"));
    assert.ok(
      exercise.spokenText.toLowerCase().includes(exercise.word.toLowerCase()),
    );
    assert.ok(
      catalog.lessons
        .find((l) => l.id === exercise.lessonId)
        .vocabulary.some(
          (v) => v[0] === exercise.word && v[1] === exercise.meaning,
        ),
    );
  }
});

test("listening quiz speaks the context, hides transcript, checks answers and resets by topic", async () => {
  const { body: catalog } = await request("/api/catalog");
  const dom = await browser(cookie);
  const spoken = [];
  dom.window.SpeechSynthesisUtterance = class {
    constructor(text) {
      this.text = text;
    }
  };
  dom.window.speechSynthesis = {
    cancel() {},
    speak(utterance) {
      spoken.push(utterance);
    },
  };
  try {
    const document = dom.window.document;
    click(dom, "Luyện nghe từ vựng");
    await waitFor(() => document.querySelector(".listening-practice"));
    assert.equal(document.querySelector(".listening-transcript"), null);
    assert.ok(
      [...document.querySelectorAll(".listening-choices button")].every(
        (b) => b.disabled,
      ),
    );
    click(dom, "Nghe chậm");
    await waitFor(() =>
      [...document.querySelectorAll(".listening-choices button")].every(
        (b) => !b.disabled,
      ),
    );
    assert.equal(spoken[0].rate, 0.65);
    assert.ok(
      spoken[0].text.includes(catalog.listeningExercises[0].spokenText),
    );
    assert.ok(spoken[0].text.includes("Key word: customer"));
    const wrong = [
      ...document.querySelectorAll(".listening-choices button"),
    ].find((b) => b.textContent !== catalog.listeningExercises[0].meaning);
    wrong.click();
    await waitFor(() => document.querySelector(".listening-feedback"));
    assert.ok(
      document
        .querySelector(".listening-feedback")
        .textContent.includes("Chưa đúng"),
    );
    assert.equal(
      document.querySelector(".listening-transcript").textContent,
      catalog.listeningExercises[0].spokenText,
    );
    assert.ok(
      document
        .querySelector(".answer-correct")
        .textContent.includes("khách hàng"),
    );
    click(dom, "Tình huống tiếp theo");
    await waitFor(() => !document.querySelector(".listening-feedback"));
    assert.ok(document.body.textContent.includes("Câu 2/45"));
    assert.ok(
      [...document.querySelectorAll(".listening-choices button")].every(
        (b) => b.disabled,
      ),
    );
    click(dom, "Tham quan & quà lưu niệm");
    await waitFor(() => document.body.textContent.includes("Câu 1/30"));
    assert.ok(document.body.textContent.includes("tháp Eiffel"));
    click(dom, "Bán hàng");
    await waitFor(() => document.body.textContent.includes("Câu 1/15"));
    const exercises = catalog.listeningExercises.filter(
      (e) => e.cat === "work",
    );
    for (let i = 0; i < exercises.length; i++) {
      click(dom, "Nghe tình huống");
      await waitFor(
        () => !document.querySelector(".listening-choices button").disabled,
      );
      const correct = [
        ...document.querySelectorAll(".listening-choices button"),
      ].find((b) => b.textContent === exercises[i].meaning);
      assert.ok(correct);
      correct.click();
      await waitFor(() => document.querySelector(".listening-feedback"));
      assert.ok(
        document
          .querySelector(".listening-feedback")
          .textContent.includes("Chính xác"),
      );
      click(
        dom,
        i === exercises.length - 1 ? "Xem kết quả" : "Tình huống tiếp theo",
      );
      await waitFor(() => !document.querySelector(".listening-feedback"));
    }
    assert.ok(document.body.textContent.includes("15/15"));
    click(dom, "Luyện lại chủ đề");
    await waitFor(() => document.querySelector(".listening-choices"));
    assert.ok(document.body.textContent.includes("Đúng 0/0"));
  } finally {
    dom.window.close();
  }
});

test("all 34 illustrated conversations contain two named characters and eight translated lines", async () => {
  const { body: catalog } = await request("/api/catalog");
  assert.equal(catalog.scenarios.length, 34);
  const keys = new Set([
    "office",
    "phone",
    "airport",
    "online",
    "fitting",
    "packing",
    "retail",
    "city",
    "museum",
    "souvenir",
    "hotel",
    "restaurant",
    "wall",
    "falls",
    "park",
    "barcelona",
    "temple",
    "rome",
  ]);
  for (const scenario of catalog.scenarios) {
    assert.ok(keys.has(scenario.illustrationKey));
    assert.ok(scenario.illustrationAlt);
    assert.ok(
      scenario.partnerName &&
        scenario.learnerName &&
        scenario.partnerName !== scenario.learnerName,
    );
    assert.equal(scenario.dialogue.length, 8);
    scenario.dialogue.forEach((line, i) => {
      assert.equal(line.position, i + 1);
      assert.equal(line.speaker, i % 2 ? "learner" : "partner");
      assert.ok(line.english && line.vietnamese);
      if (i % 2 === 0) assert.equal(line.english, scenario.lines[i / 2]);
      else assert.equal(line.english, scenario.hints[(i - 1) / 2]);
    });
  }
  for (const file of [
    "conversation-scenes.png",
    "landmark-scenes.png",
    "additional-scenes.png",
  ]) {
    const response = await fetch(origin + "/illustrations/" + file);
    assert.equal(response.status, 200);
    assert.deepEqual(
      [...new Uint8Array(await response.arrayBuffer()).slice(0, 8)],
      [137, 80, 78, 71, 13, 10, 26, 10],
    );
  }
});

test("two-character playback follows dialogue order, supports individual lines, stop and scenario changes", async () => {
  const { body: catalog } = await request("/api/catalog");
  const dom = await browser(cookie);
  const spoken = [];
  let canceled = 0;
  const voices = [
    { voiceURI: "voice-a", name: "English A", lang: "en-US" },
    { voiceURI: "voice-b", name: "English B", lang: "en-GB" },
  ];
  dom.window.SpeechSynthesisUtterance = class {
    constructor(text) {
      this.text = text;
    }
  };
  dom.window.speechSynthesis = {
    getVoices: () => voices,
    cancel() {
      canceled++;
    },
    speak(utterance) {
      spoken.push(utterance);
      utterance.onstart?.();
    },
    addEventListener() {},
    removeEventListener() {},
  };
  try {
    const document = dom.window.document;
    click(dom, "Hội thoại");
    await waitFor(() => document.querySelector(".conversation-player"));
    assert.equal(document.querySelectorAll(".dialogue-line.partner").length, 4);
    assert.equal(document.querySelectorAll(".dialogue-line.learner").length, 4);
    assert.ok(
      document
        .querySelector(".conversation-illustration")
        .style.backgroundImage.includes("additional-scenes.png"),
    );
    assert.equal(document.querySelectorAll(".dialogue-translation").length, 8);
    click(dom, "Nghe toàn bộ hội thoại");
    await waitFor(() => spoken.length === 1);
    for (let i = 0; i < 8; i++) {
      assert.equal(spoken[i].text, catalog.scenarios[0].dialogue[i].english);
      assert.equal(spoken[i].voice.voiceURI, i % 2 ? "voice-b" : "voice-a");
      await waitFor(
        () =>
          document.querySelector(".speaking p")?.textContent === spoken[i].text,
      );
      assert.equal(
        document.querySelector(".speaking p").textContent,
        spoken[i].text,
      );
      spoken[i].onend();
      if (i < 7) await waitFor(() => spoken.length === i + 2);
    }
    await waitFor(
      () => !document.querySelector(".conversation-controls .primary").disabled,
    );
    document.querySelector('[aria-label="Nghe lượt 3"]').click();
    await waitFor(() => spoken.length === 9);
    assert.equal(spoken[8].text, catalog.scenarios[0].dialogue[2].english);
    click(dom, "Dừng phát");
    await waitFor(() => !document.querySelector(".speaking"));
    spoken[8].onend();
    await new Promise((r) => setTimeout(r, 180));
    assert.equal(spoken.length, 9);
    assert.ok(canceled > 0);
    const checkbox = document.querySelector(".conversation-controls input");
    checkbox.click();
    await waitFor(
      () => document.querySelectorAll(".dialogue-translation").length === 0,
    );
    click(dom, "Nghe toàn bộ hội thoại");
    await waitFor(() => spoken.length === 10);
    click(dom, "Hỏi người bản địa đường đến tháp Eiffel");
    await waitFor(() =>
      document.querySelector(".scenario-context").textContent.includes("Paris"),
    );
    spoken[9].onend();
    await new Promise((r) => setTimeout(r, 180));
    assert.equal(spoken.length, 10);
    assert.ok(!document.querySelector(".speaking"));
    click(dom, "Ngắm thác Niagara");
    await waitFor(() =>
      document
        .querySelector(".conversation-illustration")
        .style.backgroundImage.includes("landmark-scenes.png"),
    );
    assert.ok(
      document
        .querySelector(".conversation-illustration")
        .getAttribute("aria-label")
        .includes("Niagara"),
    );
  } finally {
    dom.window.close();
  }
});

test("conversation reports unavailable speech synthesis without starting playback", async () => {
  const dom = await browser(cookie);
  try {
    click(dom, "Hội thoại");
    await waitFor(() =>
      dom.window.document.querySelector(".conversation-player"),
    );
    click(dom, "Nghe toàn bộ hội thoại");
    await waitFor(() =>
      dom.window.document.querySelector('.conversation-player [role="alert"]'),
    );
    assert.ok(
      dom.window.document
        .querySelector('.conversation-player [role="alert"]')
        .textContent.includes("chưa hỗ trợ"),
    );
    assert.equal(
      dom.window.document.querySelector(".conversation-controls .primary")
        .disabled,
      false,
    );
  } finally {
    dom.window.close();
  }
});

test("release diagnostics report real database counts and avoid caching the HTML entry", async () => {
  const info = await fetch(origin + "/api/version");
  assert.equal(info.status, 200);
  assert.equal(info.headers.get("cache-control"), "no-store");
  assert.equal(info.headers.get("x-ct-speak-version"), "1.3.0");
  const version = await info.json();
  assert.equal(version.version, "1.3.0");
  assert.equal(version.lessons, 39);
  assert.equal(version.scenarios, 34);
  assert.equal(version.phrases, 483);
  assert.equal(version.migration, "007_ten_sentences_per_lesson.sql");
  for (const path of ["/", "/index.html", "/app-version.json"]) {
    const response = await fetch(origin + path);
    assert.equal(response.status, 200);
    assert.ok(response.headers.get("cache-control").includes("no-store"));
    if (path === "/app-version.json")
      assert.equal((await response.json()).version, "1.3.0");
  }
});

test("home and lesson library show illustrations and the visible release label", async () => {
  const dom = await browser(cookie);
  try {
    const document = dom.window.document;
    assert.ok(
      document.querySelector(".sidebar-bottom").textContent.includes("1.3.0"),
    );
    const heroImage = document.querySelector(".hero-visual img");
    assert.ok(heroImage && heroImage.getAttribute("alt"));
    const illustration = await fetch(origin + heroImage.getAttribute("src"));
    assert.equal(illustration.status, 200);
    assert.ok(illustration.headers.get("content-type").includes("image/png"));
    assert.equal(
      document.querySelectorAll('.conversation-preview [role="img"]').length,
      3,
    );
    click(dom, "Bài học");
    await waitFor(() => document.querySelector(".lesson-grid"));
    assert.equal(document.querySelectorAll(".lesson-card").length, 39);
    assert.equal(
      document.querySelectorAll('.lesson-card-art [role="img"]').length,
      39,
    );
  } finally {
    dom.window.close();
  }
});

test("all 39 lessons have ten sentences while vocabulary and existing review indexes stay separate", async () => {
  const { body: catalog } = await request("/api/catalog");
  assert.equal(catalog.lessons.length, 39);
  assert.equal(catalog.lessons.flatMap((l) => l.phrases).length, 390);
  assert.equal(catalog.lessons.flatMap((l) => l.flashcards).length, 483);
  for (const lesson of catalog.lessons) {
    assert.equal(lesson.phrases.length, 10);
    assert.equal(
      new Set(
        lesson.phrases.map((p) => p[0].toLowerCase().replace(/[^a-z0-9]/g, "")),
      ).size,
      10,
    );
    assert.ok(
      lesson.phrases.every(
        (p) => p[1] && p[2].startsWith("/") && !p[2].includes("*"),
      ),
    );
    assert.equal(lesson.flashcards.length, 10 + lesson.vocabulary.length);
    if (lesson.vocabulary.length) {
      assert.equal(lesson.flashcards[3].phraseIndex, 3);
      assert.equal(lesson.flashcards[3].p[0], lesson.vocabulary[0][0]);
      assert.ok(!lesson.phrases.some((p) => p[0] === lesson.vocabulary[0][0]));
    }
  }
  const phraseId = 21404;
  const saved = (
    await pool.query(
      "SELECT phrase_id FROM flashcard_reviews WHERE phrase_id=$1",
      [phraseId],
    )
  ).rows;
  assert.equal(saved.length, 1);
  assert.equal(
    catalog.lessons.find((l) => l.id === 214).flashcards[3].p[0],
    "gift wrapping",
  );
});

test("lesson games select five unique learned sentences and normalize punctuation and contractions", async () => {
  const { body: catalog } = await request("/api/catalog");
  for (const lesson of catalog.lessons) {
    const questions = makeLessonQuestions(lesson);
    assert.equal(questions.length, 5);
    assert.equal(new Set(questions.map((q) => q.english)).size, 5);
    assert.deepEqual(
      questions.map((q) => q.type),
      ["blank", "rewrite", "blank", "rewrite", "blank"],
    );
    assert.ok(
      questions.every((q) =>
        lesson.phrases.some((p) => p[0] === q.english && p[1] === q.meaning),
      ),
    );
    for (const q of questions.filter((q) => q.type === "blank"))
      assert.equal(q.masked.replace("______", q.answer), q.english);
  }
  assert.equal(
    normalizeAnswer("  HELLO,   WORLD! "),
    normalizeAnswer("hello world"),
  );
  assert.equal(normalizeAnswer("I'm here."), normalizeAnswer("I am here"));
  assert.equal(normalizeAnswer("café"), normalizeAnswer("cafe"));
});

test("end-of-lesson game grades typed answers, shows results and resets replay", async () => {
  const { body: catalog } = await request("/api/catalog");
  const lesson = catalog.lessons[0],
    questions = makeLessonQuestions(lesson);
  const dom = await browser(cookie);
  try {
    const document = dom.window.document;
    click(dom, "Bài học");
    await waitFor(() => document.querySelector(".lesson-card"));
    document.querySelector(".lesson-card").click();
    await waitFor(() => document.querySelector(".lesson-detail"));
    for (let i = 1; i < 10; i++) {
      click(dom, "Câu tiếp theo");
      await waitFor(() =>
        document
          .querySelector(".lesson-footer span")
          .textContent.trim()
          .startsWith(`${i + 1} /`),
      );
    }
    click(dom, "Hoàn thành bài học");
    await waitFor(() => document.querySelector(".lesson-game"));
    assert.ok((await request("/api/state")).body.done.includes(lesson.id));
    assert.equal(
      document.querySelector(".lesson-game form button").disabled,
      true,
    );
    for (let i = 0; i < 5; i++) {
      const input = document.querySelector("#game-answer");
      Object.getOwnPropertyDescriptor(
        dom.window.HTMLInputElement.prototype,
        "value",
      ).set.call(
        input,
        i === 0 ? "wrong-answer" : questions[i].answer.toUpperCase(),
      );
      input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
      await waitFor(
        () => !document.querySelector(".lesson-game form button").disabled,
      );
      document
        .querySelector(".lesson-game form")
        .dispatchEvent(
          new dom.window.Event("submit", { bubbles: true, cancelable: true }),
        );
      await waitFor(() => document.querySelector(".game-feedback"));
      assert.ok(
        document
          .querySelector(".game-feedback")
          .textContent.includes(i === 0 ? "chưa khớp" : "Chính xác"),
      );
      assert.equal(document.querySelector("#game-answer").disabled, true);
      click(dom, i === 4 ? "Xem kết quả" : "Câu tiếp theo");
      await waitFor(() => !document.querySelector(".game-feedback"));
    }
    assert.ok(
      document.querySelector(".game-score").textContent.includes("4/5"),
    );
    click(dom, "Chơi lại");
    await waitFor(() => document.querySelector("#game-answer"));
    assert.equal(document.querySelector("#game-answer").value, "");
    assert.ok(
      document.querySelector(".game-progress").textContent.includes("Đúng: 0"),
    );
    click(dom, "Về thư viện");
    await waitFor(() => document.querySelector(".lesson-grid"));
  } finally {
    dom.window.close();
  }
});
