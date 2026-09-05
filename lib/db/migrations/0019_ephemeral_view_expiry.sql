ALTER TABLE "chat_messages"
  ALTER COLUMN "expires_at" DROP NOT NULL;

UPDATE "chat_messages"
SET "expires_at" = NULL
WHERE "saved" = false
  AND "opened_at" IS NULL;

UPDATE "chat_messages"
SET "expires_at" = "opened_at" + 60000
WHERE "saved" = false
  AND "opened_at" IS NOT NULL;

ALTER TABLE "social_story_viewers"
  ADD COLUMN IF NOT EXISTS "expires_at" bigint;

UPDATE "social_story_viewers"
SET "expires_at" = "viewed_at" + 30000
WHERE "expires_at" IS NULL;

CREATE INDEX IF NOT EXISTS "social_story_viewers_expiry_idx"
  ON "social_story_viewers" ("expires_at");