ALTER TABLE "chat_users"
  ADD COLUMN IF NOT EXISTS "last_seen_visible" boolean NOT NULL DEFAULT true;

ALTER TABLE "social_posts"
  ADD COLUMN IF NOT EXISTS "allow_reposts" boolean NOT NULL DEFAULT false;