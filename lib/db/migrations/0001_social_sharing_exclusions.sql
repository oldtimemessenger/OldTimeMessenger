CREATE TABLE IF NOT EXISTS "social_sharing_exclusions" (
  "owner_id" integer NOT NULL,
  "excluded_user_id" integer NOT NULL,
  "created_at" bigint NOT NULL,
  CONSTRAINT "social_sharing_exclusions_owner_id_excluded_user_id_pk"
    PRIMARY KEY ("owner_id", "excluded_user_id")
);

CREATE INDEX IF NOT EXISTS "social_sharing_exclusions_excluded_idx"
  ON "social_sharing_exclusions" ("excluded_user_id");

ALTER TABLE "social_posts"
  ALTER COLUMN "visibility" SET DEFAULT 'friends';