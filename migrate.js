// =====================================================================
// Applies database/schema.sql against DATABASE_URL.
// Usage: npm run migrate
// =====================================================================
import fs from "fs";
import path from "path";
import pool from "../config/database.js";

async function migrate() {
  const schemaPath = path.resolve("database/schema.sql");
  const sql = fs.readFileSync(schemaPath, "utf8");

  console.log("[migrate] Applying database/schema.sql ...");
  try {
    await pool.query(sql);
    console.log("[migrate] Schema applied successfully.");
  } catch (err) {
    console.error("[migrate] Failed:", err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

migrate();
