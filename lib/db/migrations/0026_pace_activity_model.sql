ALTER TABLE "chat_users"
  ADD COLUMN IF NOT EXISTS "pace_default_audience" text DEFAULT 'community' NOT NULL;

ALTER TABLE "pace_routes"
  ADD COLUMN IF NOT EXISTS "audience" text DEFAULT 'community' NOT NULL;

ALTER TABLE "pace_routes"
  ADD COLUMN IF NOT EXISTS "activity_group" text DEFAULT 'distance' NOT NULL;

ALTER TABLE "pace_routes"
  ADD COLUMN IF NOT EXISTS "calories" integer;

UPDATE "pace_routes"
SET "audience" = CASE
  WHEN "visibility" = 'public' THEN 'public'
  ELSE 'community'
END
WHERE "audience" = 'community' AND "visibility" = 'public';

UPDATE "pace_routes"
SET "activity_group" = CASE
  WHEN "activity" IN ('bike', 'skate') THEN 'ride'
  WHEN "activity" = 'swim' THEN 'swim'
  WHEN "activity" IN ('dance', 'yoga') THEN 'studio'
  WHEN "activity" = 'strength' THEN 'strength'
  ELSE 'distance'
END
WHERE "activity_group" = 'distance';

CREATE TABLE IF NOT EXISTS "pace_route_exercises" (
  "id" serial PRIMARY KEY NOT NULL,
  "route_id" integer NOT NULL,
  "name" text NOT NULL,
  "sets" integer NOT NULL,
  "reps" integer NOT NULL,
  "weight" double precision,
  "sort_order" integer DEFAULT 0 NOT NULL
);

CREATE INDEX IF NOT EXISTS "pace_route_exercises_route_order_idx"
  ON "pace_route_exercises" ("route_id", "sort_order");