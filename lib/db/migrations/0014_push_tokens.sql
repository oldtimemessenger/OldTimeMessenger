CREATE TABLE IF NOT EXISTS "push_tokens" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL REFERENCES "chat_users" ("id") ON DELETE CASCADE,
  "token" text NOT NULL,
  "platform" text NOT NULL,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL,
  "last_seen_at" bigint NOT NULL,
  "deactivated_at" bigint
);

CREATE UNIQUE INDEX IF NOT EXISTS "push_tokens_token_idx" ON "push_tokens" ("token");
CREATE INDEX IF NOT EXISTS "push_tokens_active_user_idx" ON "push_tokens" ("user_id", "active");
ALTER TABLE "push_tokens" ENABLE ROW LEVEL SECURITY;