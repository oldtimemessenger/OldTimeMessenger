CREATE TABLE IF NOT EXISTS "discovery_items" (
  "id" serial PRIMARY KEY NOT NULL,
  "platform" text NOT NULL,
  "canonical_url" text NOT NULL,
  "embed_html" text NOT NULL,
  "title" text NOT NULL,
  "creator_name" text NOT NULL,
  "creator_handle" text,
  "category" text,
  "engagement" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "latitude" double precision,
  "longitude" double precision,
  "location_label" text,
  "published_at" bigint,
  "discovered_at" bigint NOT NULL,
  "status" text DEFAULT 'active' NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "discovery_items_url_idx"
  ON "discovery_items" ("canonical_url");
CREATE INDEX IF NOT EXISTS "discovery_items_location_idx"
  ON "discovery_items" ("latitude", "longitude");
CREATE INDEX IF NOT EXISTS "discovery_items_status_date_idx"
  ON "discovery_items" ("status", "discovered_at");

CREATE TABLE IF NOT EXISTS "discovery_creator_claims" (
  "id" serial PRIMARY KEY NOT NULL,
  "item_id" integer NOT NULL,
  "claimant_id" integer NOT NULL,
  "note" text,
  "status" text DEFAULT 'pending' NOT NULL,
  "created_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "discovery_claims_claimant_item_idx"
  ON "discovery_creator_claims" ("claimant_id", "item_id");
CREATE INDEX IF NOT EXISTS "discovery_claims_item_status_idx"
  ON "discovery_creator_claims" ("item_id", "status");