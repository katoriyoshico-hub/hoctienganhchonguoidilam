import express from "express";
import { registerAI } from "./ai.js";
import { registerState } from "./state.js";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
const { version } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);
export function createApp(pool, options = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.set("X-CT-Speak-Version", version);
    next();
  });
  app.use("/api", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app.get("/api/version", async (_req, res) => {
    const {
      rows: [counts],
    } = await pool.query(`SELECT (SELECT COUNT(*)::int FROM lessons) AS lessons,
      (SELECT COUNT(*)::int FROM scenarios) AS scenarios,
      (SELECT COUNT(*)::int FROM phrases) AS phrases,
      (SELECT name FROM schema_migrations ORDER BY name DESC LIMIT 1) AS migration`);
    res.json({ version, ...counts });
  });
  app.use(express.json({ limit: "32kb" }));
  registerState(app, pool);
  registerAI(app, pool, options);
  app.get("/api/health", async (_req, res) => {
    await pool.query("SELECT 1");
    res.json({ status: "ok" });
  });
  app.get("/api/catalog", async (_req, res) => {
    // One statement gives a consistent snapshot of the full catalog.
    const {
      rows: [catalog],
    } = await pool.query(`SELECT
      (SELECT json_agg(json_build_object('code',code,'title',title,'group',group_code,'groupTitle',group_title,'description',description,'order',sort_order) ORDER BY sort_order) FROM cefr_levels) AS levels,
      (SELECT COALESCE(json_agg(json_build_object('id',module_id,'title',title,'category',category) ORDER BY order_index,module_id),'[]'::json) FROM modules WHERE is_active) AS fields,
      (SELECT COALESCE(json_agg(l ORDER BY l.id), '[]'::json) FROM (
        SELECT l.lesson_id AS id, CASE m.category WHEN 'TRAVEL_SURVIVAL' THEN 'travel' ELSE 'work' END AS cat,
          l.illustration_key AS "illustrationKey", l.illustration_alt AS "illustrationAlt",
          l.cefr_level AS "level", c.title AS "levelTitle", c.group_title AS "levelGroup", c.sort_order AS "levelOrder",
          l.title, l.target_situation AS "desc", m.module_id AS "fieldId", m.title AS "fieldTitle",
          (SELECT COALESCE(json_agg(json_build_array(p.english_text, p.vietnamese_meaning, p.ipa_phonetic) ORDER BY p.phrase_id), '[]'::json)
            FROM phrases p WHERE p.lesson_id = l.lesson_id AND p.context_note IS DISTINCT FROM 'VOCABULARY') AS phrases,
          (SELECT COALESCE(json_agg(json_build_array(p.english_text, p.vietnamese_meaning, p.ipa_phonetic) ORDER BY p.phrase_id), '[]'::json)
            FROM phrases p WHERE p.lesson_id = l.lesson_id AND p.context_note = 'VOCABULARY') AS vocabulary,
          (SELECT COALESCE(json_agg(json_build_object('p',json_build_array(f.english_text,f.vietnamese_meaning,f.ipa_phonetic),'phraseIndex',f.phrase_index) ORDER BY f.phrase_id), '[]'::json)
            FROM (SELECT p.*, (ROW_NUMBER() OVER (ORDER BY p.phrase_id)-1)::int AS phrase_index FROM phrases p WHERE p.lesson_id=l.lesson_id) f) AS flashcards
        FROM lessons l JOIN modules m USING(module_id) JOIN cefr_levels c ON c.code=l.cefr_level WHERE m.is_active
      ) l) AS lessons,
      (SELECT COALESCE(json_agg(s ORDER BY s.id), '[]'::json) FROM (
        SELECT s.scenario_id AS id, s.lesson_id AS "lessonId", s.title, s.ai_role_name AS role, s.user_role_name AS "userRole", s.context_briefing AS briefing, m.module_id AS "fieldId", m.title AS "fieldTitle",
          s.illustration_key AS "illustrationKey", s.illustration_alt AS "illustrationAlt",
          s.partner_name AS "partnerName", s.learner_name AS "learnerName",
          (SELECT COALESCE(json_agg(json_build_object('position', d.position, 'speaker', d.speaker, 'english', d.english_text, 'vietnamese', d.vietnamese_text) ORDER BY d.position), '[]'::json)
            FROM dialogue_lines d WHERE d.scenario_id=s.scenario_id) AS dialogue,
          CASE m.category WHEN 'TRAVEL_SURVIVAL' THEN 'travel' ELSE 'work' END AS cat,
          (SELECT COALESCE(json_agg(t.bot_reaction_rules ORDER BY t.step_order), '[]'::json) FROM scenario_turns t WHERE t.scenario_id = s.scenario_id) AS lines,
          (SELECT COALESCE(json_agg(t.suggested_sample_phrases[1] ORDER BY t.step_order), '[]'::json) FROM scenario_turns t WHERE t.scenario_id = s.scenario_id) AS hints
        FROM scenarios s JOIN lessons l USING(lesson_id) JOIN modules m USING(module_id) WHERE m.is_active
      ) s) AS scenarios,
      (SELECT COALESCE(json_agg(e ORDER BY e.id), '[]'::json) FROM (
        SELECT e.exercise_id AS id, l.lesson_id AS "lessonId", l.title AS "lessonTitle", m.module_id AS "fieldId", m.title AS "fieldTitle", l.cefr_level AS level,
          CASE m.category WHEN 'TRAVEL_SURVIVAL' THEN 'travel' ELSE 'work' END AS cat,
          e.situation, e.situation_en AS "situationEn", e.spoken_translation AS "spokenTranslation", e.spoken_text AS "spokenText", p.english_text AS word,
          p.vietnamese_meaning AS meaning, p.ipa_phonetic AS ipa
        FROM listening_exercises e JOIN phrases p USING(phrase_id)
        JOIN lessons l USING(lesson_id) JOIN modules m USING(module_id) WHERE m.is_active
      ) e) AS "listeningExercises"`);
    res.set("Cache-Control", "no-store").json(catalog);
  });
  app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));
  app.use(
    express.static(fileURLToPath(new URL("../dist/", import.meta.url)), {
      setHeaders(res, path) {
        if (path.endsWith("index.html") || path.endsWith("app-version.json"))
          res.setHeader("Cache-Control", "no-store, max-age=0");
      },
    }),
  );
  app.use((error, _req, res, _next) => {
    console.error("API request failed:", error.code || error.name);
    res
      .status(
        error.type === "entity.parse.failed"
          ? 400
          : error.type === "entity.too.large"
            ? 413
            : 503,
      )
      .json({ error: "Request could not be completed" });
  });
  return app;
}
