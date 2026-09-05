ALTER TABLE "pace_routes"
  ADD COLUMN IF NOT EXISTS "visibility" text DEFAULT 'public' NOT NULL;