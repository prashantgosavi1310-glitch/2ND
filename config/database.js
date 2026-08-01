// =====================================================================
// PostgreSQL connection pool.
// Reads DATABASE_URL (Railway injects this automatically once a
// PostgreSQL plugin is attached to the project). SSL is required on
// Railway's managed Postgres in production but not for local dev.
// =====================================================================
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  // Fail fast and loudly — a missing connection string should never
  // surface later as a cryptic pool-connect error.
  console.error("[database] DATABASE_URL is not set. Check your .env file.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on("error", (err) => {
  // Errors on idle clients — log but never crash the process for this.
  console.error("[database] Unexpected error on idle client:", err.message);
});

/**
 * Run a parameterized query. Always use placeholders ($1, $2, ...) —
 * never string-concatenate user input into SQL — this is the app's
 * primary SQL-injection defense.
 */
export function query(text, params) {
  return pool.query(text, params);
}

/**
 * Borrow a client for a multi-statement transaction. Caller is
 * responsible for BEGIN / COMMIT / ROLLBACK and client.release().
 */
export async function getClient() {
  const client = await pool.connect();
  return client;
}

export default pool;
