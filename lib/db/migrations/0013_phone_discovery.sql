ALTER TABLE "chat_users"
  ADD COLUMN IF NOT EXISTS "phone_discovery_hash" text,
  ADD COLUMN IF NOT EXISTS "phone_verified" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "phone_discovery_permission" text NOT NULL DEFAULT 'contacts';

CREATE UNIQUE INDEX IF NOT EXISTS "chat_users_phone_discovery_hash_idx"
  ON "chat_users" ("phone_discovery_hash")
  WHERE "phone_discovery_hash" IS NOT NULL;