DROP INDEX IF EXISTS "chat_users_firebase_uid_idx";
ALTER TABLE "chat_users"
DROP COLUMN IF EXISTS "firebase_uid";