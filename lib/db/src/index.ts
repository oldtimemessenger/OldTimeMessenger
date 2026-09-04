import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const connectionString =
  process.env.SUPABASE_DATABASE_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "SUPABASE_DATABASE_URL or DATABASE_URL must be set.",
  );
}

const schemaName = process.env.DB_SCHEMA
  ?? (process.env.SUPABASE_DATABASE_URL ? "old_time" : "public");

if (!/^[a-z_][a-z0-9_]*$/.test(schemaName)) {
  throw new Error("DB_SCHEMA contains invalid characters.");
}

export const pool = new Pool({
  connectionString,
  ssl: process.env.SUPABASE_DATABASE_URL
    ? { rejectUnauthorized: false }
    : undefined,
  options: `-c search_path=${schemaName},public`,
});
export const db = drizzle(pool, { schema });

export * from "./schema";
