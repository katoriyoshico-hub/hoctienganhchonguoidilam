import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { JSDOM } from "jsdom";
import { migrate } from "../server/migrate.js";
import { createApp } from "../server/app.js";
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
  await migrate(pool);
  server = createApp(pool).listen(0, "127.0.0.1");
  await once(server, "listening");
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
  assert.equal(result.body.lessons.length, 8);
  assert.equal(result.body.scenarios.length, 3);
  assert.equal(result.body.lessons.flatMap((l) => l.phrases).length, 18);
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
  button.click();
}
test("built frontend loads API content and saves learning changes without localStorage", async () => {
  const dom = await browser(cookie);
  try {
    const document = dom.window.document;
    assert.ok(document.body.textContent.includes("18"));
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
    click(dom, "Hoàn thành bài học");
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
