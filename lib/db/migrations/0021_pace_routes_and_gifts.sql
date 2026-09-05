CREATE TABLE IF NOT EXISTS "pace_routes" (
  "id" serial PRIMARY KEY NOT NULL,
  "author_id" integer NOT NULL,
  "title" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "kind" text DEFAULT 'route' NOT NULL,
  "activity" text DEFAULT 'run' NOT NULL,
  "difficulty" text DEFAULT 'steady' NOT NULL,
  "distance_km" double precision NOT NULL,
  "elevation_m" integer DEFAULT 0 NOT NULL,
  "duration_min" integer NOT NULL,
  "start_latitude" double precision NOT NULL,
  "start_longitude" double precision NOT NULL,
  "location_label" text DEFAULT 'Nearby' NOT NULL,
  "route_coordinates" jsonb NOT NULL,
  "created_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL,
  "deleted" boolean DEFAULT false NOT NULL
);

CREATE INDEX IF NOT EXISTS "pace_routes_author_created_idx" ON "pace_routes" ("author_id", "created_at");
CREATE INDEX IF NOT EXISTS "pace_routes_location_idx" ON "pace_routes" ("start_latitude", "start_longitude", "created_at");

CREATE TABLE IF NOT EXISTS "pace_route_likes" (
  "route_id" integer NOT NULL,
  "user_id" integer NOT NULL,
  "created_at" bigint NOT NULL,
  CONSTRAINT "pace_route_likes_route_id_user_id_pk" PRIMARY KEY("route_id","user_id")
);
CREATE INDEX IF NOT EXISTS "pace_route_likes_user_idx" ON "pace_route_likes" ("user_id");

CREATE TABLE IF NOT EXISTS "pace_route_comments" (
  "id" serial PRIMARY KEY NOT NULL,
  "route_id" integer NOT NULL,
  "author_id" integer NOT NULL,
  "content" text NOT NULL,
  "created_at" bigint NOT NULL,
  "deleted" boolean DEFAULT false NOT NULL
);
CREATE INDEX IF NOT EXISTS "pace_route_comments_route_created_idx" ON "pace_route_comments" ("route_id", "created_at");

CREATE TABLE IF NOT EXISTS "pace_comment_likes" (
  "comment_id" integer NOT NULL,
  "user_id" integer NOT NULL,
  "created_at" bigint NOT NULL,
  CONSTRAINT "pace_comment_likes_comment_id_user_id_pk" PRIMARY KEY("comment_id","user_id")
);
CREATE INDEX IF NOT EXISTS "pace_comment_likes_user_idx" ON "pace_comment_likes" ("user_id");

CREATE TABLE IF NOT EXISTS "pace_route_gifts" (
  "id" serial PRIMARY KEY NOT NULL,
  "route_id" integer NOT NULL,
  "sender_id" integer NOT NULL,
  "recipient_id" integer NOT NULL,
  "gift" text NOT NULL,
  "coins" integer NOT NULL,
  "gold" integer NOT NULL,
  "created_at" bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS "pace_route_gifts_route_created_idx" ON "pace_route_gifts" ("route_id", "created_at");
CREATE INDEX IF NOT EXISTS "pace_route_gifts_recipient_idx" ON "pace_route_gifts" ("recipient_id", "created_at");