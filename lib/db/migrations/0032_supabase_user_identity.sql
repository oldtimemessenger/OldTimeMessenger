ALTER TABLE "chat_users"
  ADD COLUMN IF NOT EXISTS "supabase_uid" text;

CREATE UNIQUE INDEX IF NOT EXISTS "chat_users_supabase_uid_idx"
  ON "chat_users" ("supabase_uid");