ALTER TABLE "current_event_rooms"
  ADD COLUMN IF NOT EXISTS "live_until" bigint;

ALTER TABLE "chat_users"
  ADD COLUMN IF NOT EXISTS "camera_access_until" bigint;

ALTER TABLE "current_event_gifts"
  ADD COLUMN IF NOT EXISTS "idempotency_key" text;

CREATE UNIQUE INDEX IF NOT EXISTS "current_event_gifts_idempotency_idx"
  ON "current_event_gifts" ("idempotency_key");