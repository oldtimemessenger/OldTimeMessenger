CREATE TABLE IF NOT EXISTS "atmosphere_preferences" (
  "user_id" integer PRIMARY KEY NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "radius_km" integer DEFAULT 25 NOT NULL,
  "language" text,
  "muted_categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "updated_at" bigint NOT NULL,
  CONSTRAINT "atmosphere_preferences_radius_check" CHECK ("radius_km" BETWEEN 1 AND 500),
  CONSTRAINT "atmosphere_preferences_user_fk" FOREIGN KEY ("user_id") REFERENCES "chat_users"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "atmosphere_interactions" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "item_id" text NOT NULL,
  "item_kind" text NOT NULL,
  "interaction" text NOT NULL,
  "session_id" text,
  "metadata" jsonb,
  "created_at" bigint NOT NULL,
  CONSTRAINT "atmosphere_interactions_kind_check" CHECK ("item_kind" IN ('route', 'motivation', 'world', 'hub', 'pace', 'map', 'external')),
  CONSTRAINT "atmosphere_interactions_type_check" CHECK ("interaction" IN ('impression', 'open', 'dismiss', 'complete')),
  CONSTRAINT "atmosphere_interactions_user_fk" FOREIGN KEY ("user_id") REFERENCES "chat_users"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "atmosphere_interactions_user_created_idx"
  ON "atmosphere_interactions" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "atmosphere_interactions_user_item_idx"
  ON "atmosphere_interactions" ("user_id", "item_id", "created_at");
CREATE INDEX IF NOT EXISTS "atmosphere_interactions_session_idx"
  ON "atmosphere_interactions" ("session_id", "created_at");

ALTER TABLE "atmosphere_preferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "atmosphere_interactions" ENABLE ROW LEVEL SECURITY;