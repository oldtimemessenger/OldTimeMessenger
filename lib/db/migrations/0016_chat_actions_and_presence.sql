ALTER TABLE "chat_users"
  ADD COLUMN IF NOT EXISTS "chat_presence" text NOT NULL DEFAULT 'available';

ALTER TABLE "chat_messages"
  ADD COLUMN IF NOT EXISTS "client_id" text,
  ADD COLUMN IF NOT EXISTS "reply_to_message_id" integer,
  ADD COLUMN IF NOT EXISTS "reply_preview" jsonb,
  ADD COLUMN IF NOT EXISTS "delivered_at" bigint,
  ADD COLUMN IF NOT EXISTS "played_at" bigint,
  ADD COLUMN IF NOT EXISTS "edited_at" bigint,
  ADD COLUMN IF NOT EXISTS "deleted_at" bigint,
  ADD COLUMN IF NOT EXISTS "deleted_for_everyone" boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS "chat_messages_client_id_idx"
  ON "chat_messages" ("chat_id", "client_id")
  WHERE "client_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "chat_messages_chat_delivered_idx"
  ON "chat_messages" ("chat_id", "delivered_at");

CREATE TABLE IF NOT EXISTS "chat_message_reactions" (
  "message_id" integer NOT NULL,
  "user_id" integer NOT NULL,
  "emoji" text NOT NULL,
  "created_at" bigint NOT NULL,
  PRIMARY KEY ("message_id", "user_id"),
  CONSTRAINT "chat_message_reactions_message_id_fkey"
    FOREIGN KEY ("message_id") REFERENCES "chat_messages" ("id") ON DELETE CASCADE,
  CONSTRAINT "chat_message_reactions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "chat_users" ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "chat_message_reactions_message_idx"
  ON "chat_message_reactions" ("message_id");

CREATE TABLE IF NOT EXISTS "chat_message_hidden" (
  "message_id" integer NOT NULL,
  "user_id" integer NOT NULL,
  "hidden_at" bigint NOT NULL,
  PRIMARY KEY ("message_id", "user_id"),
  CONSTRAINT "chat_message_hidden_message_id_fkey"
    FOREIGN KEY ("message_id") REFERENCES "chat_messages" ("id") ON DELETE CASCADE,
  CONSTRAINT "chat_message_hidden_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "chat_users" ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "chat_message_hidden_user_idx"
  ON "chat_message_hidden" ("user_id", "hidden_at");

CREATE INDEX IF NOT EXISTS "chat_message_hidden_user_message_idx"
  ON "chat_message_hidden" ("user_id", "message_id");

ALTER TABLE "calls"
  ADD COLUMN IF NOT EXISTS "type" text NOT NULL DEFAULT 'voice';
