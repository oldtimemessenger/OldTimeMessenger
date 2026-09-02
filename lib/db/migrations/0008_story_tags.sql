ALTER TABLE "social_stories"
  ADD COLUMN IF NOT EXISTS "tagged_user_ids" jsonb NOT NULL DEFAULT '[]'::jsonb;