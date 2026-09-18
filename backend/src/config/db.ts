import { Pool } from "pg";
import { env } from "./env";

export const pool = new Pool({
  connectionString: env.databaseUrl,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

// node-postgres requires an error listener on the pool — without one, an
// error on an idle pooled client (DB restart, network blip) is emitted as an
// unhandled 'error' event, which is fatal to the whole process. This is a
// synchronous EventEmitter throw, not a promise rejection, so the
// unhandledRejection/uncaughtException handlers in server.ts do NOT catch it.
pool.on("error", (err) => {
  console.error("Unexpected error on idle Postgres client:", err);
});
