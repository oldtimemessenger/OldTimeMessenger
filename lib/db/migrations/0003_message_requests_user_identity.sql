ALTER TABLE "chat_users" ADD COLUMN IF NOT EXISTS "username" text;
ALTER TABLE "chat_users" ADD COLUMN IF NOT EXISTS "contact_permission" text NOT NULL DEFAULT 'everyone';

UPDATE "chat_users"
SET "username" = CASE
  WHEN regexp_replace(lower("name"), '[^a-z0-9_]+', '', 'g') = '' THEN 'user' || "id"::text
  ELSE left(regexp_replace(lower("name"), '[^a-z0-9_]+', '', 'g'), 18) || "id"::text
END
WHERE "username" IS NULL;

ALTER TABLE "chat_users" ALTER COLUMN "username" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "chat_users_username_idx" ON "chat_users" ("username");

CREATE TABLE IF NOT EXISTS "chat_message_requests" (
  "id" serial PRIMARY KEY NOT NULL,
  "sender_id" integer NOT NULL,
  "recipient_id" integer NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "chat_id" integer,
  "created_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL,
  CONSTRAINT "chat_message_requests_sender_recipient_unique" UNIQUE("sender_id", "recipient_id")
);
CREATE INDEX IF NOT EXISTS "chat_message_requests_recipient_status_idx"
  ON "chat_message_requests" ("recipient_id", "status");
CREATE INDEX IF NOT EXISTS "chat_message_requests_sender_status_idx"
  ON "chat_message_requests" ("sender_id", "status");