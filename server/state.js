import { randomUUID } from "node:crypto";
const goals = { both: "BOTH", work: "CONSULTING", travel: "TRAVEL" };
function invalid(res) {
  return res.status(400).json({ error: "Invalid request" });
}
export function registerState(app, pool) {
  app.use("/api", async (req, res, next) => {
    if (!req.path.startsWith("/state") && !req.path.startsWith("/sessions") && !req.path.startsWith("/ai") && !req.path.startsWith("/youtube/audio"))
      return next();
    // Reject cross-origin mutations; anonymous identity remains in an HttpOnly cookie.
    if (
      req.method !== "GET" &&
      req.headers.origin &&
      new URL(req.headers.origin).host !== req.headers.host
    )
      return res.status(403).json({ error: "Cross-origin request rejected" });
    const token = req.headers.cookie
      ?.split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith("ct_session="))
      ?.slice(11);
    let user;
    if (token && /^[0-9a-f-]{36}$/.test(token)) {
      user = (
        await pool.query(
          "SELECT user_id, primary_goal FROM users WHERE email = $1",
          [token + "@anonymous.local"],
        )
      ).rows[0];
    }
    if (!user) {
      if (req.method !== "GET")
        return res
          .status(401)
          .json({ error: "Load your learning profile before saving" });
      const id = randomUUID();
      user = (
        await pool.query(
          "INSERT INTO users (full_name, email, primary_goal) VALUES ('Học viên CT-Speak', $1, 'BOTH') RETURNING user_id, primary_goal",
          [id + "@anonymous.local"],
        )
      ).rows[0];
      res.cookie("ct_session", id, {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        maxAge: 365 * 86400000,
      });
    }
    req.user = user;
    next();
  });
  app.get("/api/state", async (req, res) => {
    const [progress, reviews, sessions] = await Promise.all([
      pool.query(
        "SELECT lesson_id FROM user_progress WHERE user_id = $1 AND status = 'COMPLETED'",
        [req.user.user_id],
      ),
      pool.query(
        `SELECT l.lesson_id, p.phrase_id, (SELECT COUNT(*) FROM phrases p2 WHERE p2.lesson_id = p.lesson_id AND p2.phrase_id < p.phrase_id) AS phrase_index, r.rating, r.next_review_due FROM flashcard_reviews r JOIN phrases p USING(phrase_id) JOIN lessons l USING(lesson_id) WHERE r.user_id = $1`,
        [req.user.user_id],
      ),
      pool.query(
        "SELECT session_id, scenario_id, started_at, completed_at FROM practice_sessions WHERE user_id = $1 ORDER BY started_at DESC LIMIT 100",
        [req.user.user_id],
      ),
    ]);
    res
      .set("Cache-Control", "no-store")
      .json({
        done: progress.rows.map((r) => r.lesson_id),
        goal: Object.keys(goals).find(
          (k) => goals[k] === req.user.primary_goal,
        ),
        reviews: Object.fromEntries(
          reviews.rows.map((r) => [
            `${r.lesson_id}-${r.phrase_index}`,
            { rating: r.rating, due: new Date(r.next_review_due).getTime() },
          ]),
        ),
        sessions: sessions.rows,
      });
  });
  app.put("/api/state/goal", async (req, res) => {
    if (!Object.hasOwn(goals, req.body.goal)) return invalid(res);
    await pool.query(
      "UPDATE users SET primary_goal = $1, updated_at = NOW() WHERE user_id = $2",
      [goals[req.body.goal], req.user.user_id],
    );
    res.json({ goal: req.body.goal });
  });
  app.put("/api/state/progress", async (req, res) => {
    if (!Number.isSafeInteger(req.body.lessonId)) return invalid(res);
    const result = await pool.query(
      `INSERT INTO user_progress (user_id, lesson_id, status, completion_percentage)
      SELECT $1, lesson_id, 'COMPLETED', 100 FROM lessons WHERE lesson_id = $2
      ON CONFLICT (user_id, lesson_id) DO UPDATE SET status = 'COMPLETED', completion_percentage = 100, last_accessed_at = NOW() RETURNING lesson_id`,
      [req.user.user_id, req.body.lessonId],
    );
    if (!result.rowCount)
      return res.status(404).json({ error: "Lesson not found" });
    res.json({ lessonId: req.body.lessonId });
  });
  app.put("/api/state/reviews", async (req, res) => {
    const { lessonId, phraseIndex, rating } = req.body;
    const minutes = { hard: 10, good: 1440, easy: 5760 };
    if (
      !Number.isSafeInteger(lessonId) ||
      !Number.isSafeInteger(phraseIndex) ||
      phraseIndex < 0 ||
      !Object.hasOwn(minutes, rating)
    )
      return invalid(res);
    const phrase = (
      await pool.query(
        "SELECT phrase_id FROM phrases WHERE lesson_id = $1 ORDER BY phrase_id OFFSET $2 LIMIT 1",
        [lessonId, phraseIndex],
      )
    ).rows[0];
    if (!phrase) return res.status(404).json({ error: "Phrase not found" });
    const {
      rows: [review],
    } = await pool.query(
      `INSERT INTO flashcard_reviews (user_id, phrase_id, rating, next_review_due, interval_days, repetition_count)
      VALUES ($1, $2, $3, NOW() + $4 * INTERVAL '1 minute', $5, 1)
      ON CONFLICT (user_id, phrase_id) DO UPDATE SET rating = EXCLUDED.rating, next_review_due = EXCLUDED.next_review_due,
      interval_days = EXCLUDED.interval_days, repetition_count = flashcard_reviews.repetition_count + 1, last_reviewed_at = NOW() RETURNING next_review_due`,
      [
        req.user.user_id,
        phrase.phrase_id,
        rating,
        minutes[rating],
        Math.floor(minutes[rating] / 1440),
      ],
    );
    res.json({ rating, due: new Date(review.next_review_due).getTime() });
  });
  app.get("/api/sessions/:id", async (req, res) => {
    if (!/^\d+$/.test(req.params.id)) return invalid(res);
    const session = (
      await pool.query(
        "SELECT session_id, scenario_id, started_at, completed_at FROM practice_sessions WHERE session_id = $1 AND user_id = $2",
        [req.params.id, req.user.user_id],
      )
    ).rows[0];
    if (!session) return res.status(404).json({ error: "Session not found" });
    const turns = (
      await pool.query(
        "SELECT turn_index, user_speech_transcript, ai_response_text FROM session_turns WHERE session_id = $1 ORDER BY turn_index",
        [session.session_id],
      )
    ).rows;
    res.json({ ...session, turns });
  });
  app.post("/api/sessions", async (req, res) => {
    if (!Number.isSafeInteger(req.body.scenarioId)) return invalid(res);
    const {
      rows: [session],
    } = await pool.query(
      "INSERT INTO practice_sessions (user_id, scenario_id) SELECT $1, scenario_id FROM scenarios WHERE scenario_id = $2 RETURNING session_id",
      [req.user.user_id, req.body.scenarioId],
    );
    if (!session) return res.status(404).json({ error: "Scenario not found" });
    res.status(201).json({ id: session.session_id });
  });
  app.put("/api/sessions/:id/turns", async (req, res) => {
    const { turnIndex, transcript } = req.body;
    if (
      !/^\d+$/.test(req.params.id) ||
      !Number.isSafeInteger(turnIndex) ||
      turnIndex < 0 ||
      typeof transcript !== "string" ||
      transcript.length > 10000
    )
      return invalid(res);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const {
        rows: [session],
      } = await client.query(
        "SELECT * FROM practice_sessions WHERE session_id = $1 AND user_id = $2 FOR UPDATE",
        [req.params.id, req.user.user_id],
      );
      if (!session) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Session not found" });
      }
      if (session.completed_at) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "Session already completed" });
      }
      const { rows: turns } = await client.query(
        "SELECT bot_reaction_rules FROM scenario_turns WHERE scenario_id = $1 ORDER BY step_order",
        [session.scenario_id],
      );
      if (turnIndex >= turns.length) {
        await client.query("ROLLBACK");
        return invalid(res);
      }
      const {
        rows: [count],
      } = await client.query(
        "SELECT COUNT(*)::int AS n FROM session_turns WHERE session_id = $1",
        [session.session_id],
      );
      if (turnIndex > count.n) {
        await client.query("ROLLBACK");
        return invalid(res);
      }
      await client.query(
        `INSERT INTO session_turns (session_id, turn_index, user_speech_transcript, ai_response_text) VALUES ($1, $2, $3, $4)
        ON CONFLICT (session_id, turn_index) DO UPDATE SET user_speech_transcript = EXCLUDED.user_speech_transcript`,
        [
          session.session_id,
          turnIndex,
          transcript,
          turns[turnIndex].bot_reaction_rules,
        ],
      );
      if (turnIndex === turns.length - 1)
        await client.query(
          "UPDATE practice_sessions SET completed_at = NOW() WHERE session_id = $1",
          [session.session_id],
        );
      await client.query("COMMIT");
      res.json({ saved: true });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });
}
