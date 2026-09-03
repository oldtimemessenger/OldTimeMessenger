ALTER TABLE "chat_users"
  ADD COLUMN IF NOT EXISTS "firebase_uid" text,
  ADD COLUMN IF NOT EXISTS "email" text;

CREATE UNIQUE INDEX IF NOT EXISTS "chat_users_firebase_uid_unique"
  ON "chat_users" ("firebase_uid")
  WHERE "firebase_uid" IS NOT NULL;