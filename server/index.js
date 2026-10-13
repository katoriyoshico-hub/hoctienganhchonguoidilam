import { once } from "node:events";
import { pathToFileURL } from "node:url";
import { createPool } from "./db.js";
import { createApp } from "./app.js";
import { migrate } from "./migrate.js";

export async function startServer({
  pool,
  port = Number(process.env.PORT || 3001),
  host = process.env.HOST || "0.0.0.0",
}) {
  // A fresh deployment has no schema_migrations table yet. Initialize the
  // database before serving traffic; migrate() is transactional and repeatable.
  await migrate(pool);
  const server = createApp(pool).listen(port, host);
  await once(server, "listening");
  return server;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  let pool;
  try {
    pool = createPool();
    pool.on("error", (error) => {
      console.error(
        "Idle database connection failed:",
        error.code || error.name,
      );
    });
    const server = await startServer({ pool });
    console.log(
      `CT-Speak started on port ${server.address().port}; database migrations complete.`,
    );
    let stopping = false;
    const shutdown = () => {
      if (stopping) return;
      stopping = true;
      server.close(async () => {
        await pool.end();
      });
    };
    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  } catch (error) {
    // Do not print the connection URL or credentials in deployment logs.
    console.error("Startup failed:", error.code || error.name);
    if (!process.env.DATABASE_URL)
      console.error(
        "Set DATABASE_URL to your PostgreSQL connection in hosting environment settings.",
      );
    else
      console.error(
        "Check database connectivity, migration permissions, and applied migration checksums.",
      );
    if (pool) await pool.end();
    process.exitCode = 1;
  }
}
