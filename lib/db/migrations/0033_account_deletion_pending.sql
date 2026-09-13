ALTER TABLE "chat_users"
ADD COLUMN IF NOT EXISTS "deletion_pending_at" bigint;