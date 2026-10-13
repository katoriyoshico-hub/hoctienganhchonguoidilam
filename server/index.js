import { createPool } from "./db.js";
import { createApp } from "./app.js";
const pool = createPool();
await pool.query("SELECT 1 FROM schema_migrations LIMIT 1");
const server = createApp(pool).listen(
  Number(process.env.PORT || 3001),
  process.env.HOST || "127.0.0.1",
  () => console.log("CT-Speak API started."),
);
async function shutdown() {
  server.close(async () => {
    await pool.end();
  });
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
