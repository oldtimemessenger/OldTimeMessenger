CREATE TABLE IF NOT EXISTS "current_event_rooms" (
  "id" serial PRIMARY KEY NOT NULL,
  "club_name" text NOT NULL DEFAULT 'Current Events',
  "title" text NOT NULL,
  "topic" text NOT NULL,
  "is_open" boolean NOT NULL DEFAULT true,
  "is_live" boolean NOT NULL DEFAULT true,
  "host_id" integer NOT NULL,
  "latitude" double precision,
  "longitude" double precision,
  "created_at" bigint NOT NULL,
  "ended_at" bigint
);
CREATE INDEX IF NOT EXISTS "current_event_rooms_live_topic_idx"
  ON "current_event_rooms" ("is_live", "topic");
CREATE INDEX IF NOT EXISTS "current_event_rooms_location_idx"
  ON "current_event_rooms" ("latitude", "longitude");

CREATE TABLE IF NOT EXISTS "current_event_participants" (
  "id" serial PRIMARY KEY NOT NULL,
  "room_id" integer NOT NULL,
  "user_id" integer NOT NULL,
  "role" text NOT NULL DEFAULT 'listener',
  "muted" boolean NOT NULL DEFAULT true,
  "hand_raised" boolean NOT NULL DEFAULT false,
  "joined_at" bigint NOT NULL,
  CONSTRAINT "current_event_participants_room_user_idx" UNIQUE("room_id","user_id")
);
CREATE INDEX IF NOT EXISTS "current_event_participants_room_role_idx"
  ON "current_event_participants" ("room_id", "role");

CREATE TABLE IF NOT EXISTS "current_event_messages" (
  "id" serial PRIMARY KEY NOT NULL,
  "room_id" integer NOT NULL,
  "sender_id" integer NOT NULL,
  "content" text NOT NULL,
  "created_at" bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS "current_event_messages_room_created_idx"
  ON "current_event_messages" ("room_id", "created_at");

CREATE TABLE IF NOT EXISTS "current_event_wallets" (
  "user_id" integer PRIMARY KEY NOT NULL,
  "coins" integer NOT NULL DEFAULT 1000,
  "gold" integer NOT NULL DEFAULT 0,
  "pending_gold" integer NOT NULL DEFAULT 0,
  "updated_at" bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS "current_event_gifts" (
  "id" serial PRIMARY KEY NOT NULL,
  "room_id" integer NOT NULL,
  "sender_id" integer NOT NULL,
  "recipient_id" integer NOT NULL,
  "gift" text NOT NULL,
  "coins" integer NOT NULL,
  "gold" integer NOT NULL,
  "created_at" bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS "current_event_gifts_room_created_idx"
  ON "current_event_gifts" ("room_id", "created_at");