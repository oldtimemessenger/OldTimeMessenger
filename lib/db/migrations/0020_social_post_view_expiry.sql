CREATE TABLE IF NOT EXISTS "social_post_viewers" (
  "post_id" integer NOT NULL,
  "viewer_id" integer NOT NULL,
  "viewed_at" bigint NOT NULL,
  "expires_at" bigint,
  CONSTRAINT "social_post_viewers_post_id_viewer_id_pk" PRIMARY KEY("post_id","viewer_id")
);

CREATE INDEX IF NOT EXISTS "social_post_viewers_viewer_idx"
  ON "social_post_viewers" ("viewer_id");

CREATE INDEX IF NOT EXISTS "social_post_viewers_expiry_idx"
  ON "social_post_viewers" ("expires_at");