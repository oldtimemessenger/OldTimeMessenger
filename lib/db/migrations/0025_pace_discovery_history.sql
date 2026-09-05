CREATE TABLE IF NOT EXISTS "pace_discovery_history" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "suggestion_id" text NOT NULL,
  "activity" text NOT NULL,
  "location_cell" text,
  "seen_at" bigint NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "pace_discovery_history_user_suggestion_unique"
  ON "pace_discovery_history" ("user_id", "suggestion_id");
CREATE INDEX IF NOT EXISTS "pace_discovery_history_user_seen_idx"
  ON "pace_discovery_history" ("user_id", "seen_at");