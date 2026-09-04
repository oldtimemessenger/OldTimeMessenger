import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const connectionString =
  process.env.SUPABASE_DATABASE_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("SUPABASE_DATABASE_URL or DATABASE_URL is required to run database migrations");
}
const schemaName = process.env.DB_SCHEMA
  ?? (process.env.SUPABASE_DATABASE_URL ? "old_time" : "public");
if (!/^[a-z_][a-z0-9_]*$/.test(schemaName)) {
  throw new Error("DB_SCHEMA contains invalid characters");
}

const migrationsDir = path.resolve(process.cwd(), "migrations");
const files = (await readdir(migrationsDir))
  .filter((file) => file.endsWith(".sql"))
  .sort();
const pool = new pg.Pool({
  connectionString,
  ssl: process.env.SUPABASE_DATABASE_URL
    ? { rejectUnauthorized: false }
    : undefined,
  options: `-c search_path=${schemaName},public`,
});

try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "old_time_schema_migrations" (
      "id" text PRIMARY KEY,
      "checksum" text NOT NULL,
      "applied_at" bigint NOT NULL
    )
  `);
  const established = await pool.query(
    `SELECT to_regclass($1) AS "coreTable"`,
    [`${schemaName}.chat_users`],
  );

  for (const file of files) {
    const sql = await readFile(path.join(migrationsDir, file), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const applied = await pool.query(
      `SELECT "checksum" FROM "old_time_schema_migrations" WHERE "id" = $1`,
      [file],
    );
    if (applied.rowCount) {
      if (applied.rows[0].checksum !== checksum) {
        throw new Error(`Migration ${file} changed after it was applied`);
      }
      continue;
    }

    if (file === "0000_baseline.sql" && established.rows[0].coreTable) {
      await pool.query(
        `INSERT INTO "old_time_schema_migrations" ("id", "checksum", "applied_at") VALUES ($1, $2, $3)`,
        [file, checksum, Date.now()],
      );
      console.log(`Adopted ${file} for an established database`);
      continue;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query(
        `INSERT INTO "old_time_schema_migrations" ("id", "checksum", "applied_at") VALUES ($1, $2, $3)`,
        [file, checksum, Date.now()],
      );
      await client.query("COMMIT");
      console.log(`Applied ${file}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
} finally {
  await pool.end();
}