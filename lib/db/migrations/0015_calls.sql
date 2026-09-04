CREATE TABLE IF NOT EXISTS "calls" (
  "id" serial PRIMARY KEY,
  "caller_id" integer NOT NULL REFERENCES "chat_users" ("id") ON DELETE CASCADE,
  "callee_id" integer NOT NULL REFERENCES "chat_users" ("id") ON DELETE CASCADE,
  "status" text NOT NULL DEFAULT 'ringing',
  "room_name" text NOT NULL,
  "created_at" bigint NOT NULL,
  "accepted_at" bigint,
  "declined_at" bigint,
  "ended_at" bigint,
  "missed_at" bigint,
  CONSTRAINT "calls_distinct_participants" CHECK ("caller_id" <> "callee_id"),
  CONSTRAINT "calls_status_valid" CHECK ("status" IN ('ringing', 'accepted', 'declined', 'missed', 'ended'))
);

CREATE INDEX IF NOT EXISTS "calls_caller_status_created_idx" ON "calls" ("caller_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "calls_callee_status_created_idx" ON "calls" ("callee_id", "status", "created_at");
CREATE UNIQUE INDEX IF NOT EXISTS "calls_room_name_idx" ON "calls" ("room_name");
ALTER TABLE "calls" ENABLE ROW LEVEL SECURITY;