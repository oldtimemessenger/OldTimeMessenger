ALTER TABLE "chat_users"
  ADD COLUMN IF NOT EXISTS "verification_paid_at" bigint,
  ADD COLUMN IF NOT EXISTS "verification_approved_at" bigint,
  ADD COLUMN IF NOT EXISTS "verification_approved_by" integer;