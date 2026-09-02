CREATE TABLE IF NOT EXISTS "chat_notes" (
  "id" serial PRIMARY KEY NOT NULL,
  "owner_id" integer NOT NULL,
  "content" text NOT NULL,
  "created_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL,
  "expires_at" bigint NOT NULL,
  "deleted" boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS "chat_notes_owner_updated_idx"
  ON "chat_notes" ("owner_id", "updated_at");

CREATE INDEX IF NOT EXISTS "chat_notes_expiry_idx"
  ON "chat_notes" ("expires_at");