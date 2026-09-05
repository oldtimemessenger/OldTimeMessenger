CREATE TABLE IF NOT EXISTS "pace_activities" (
  "id" serial PRIMARY KEY NOT NULL,
  "activity_uuid" text NOT NULL,
  "user_id" integer NOT NULL,
  "activity_type" text DEFAULT 'running' NOT NULL,
  "title" text DEFAULT '' NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "visibility" text DEFAULT 'followers' NOT NULL,
  "lifecycle_status" text DEFAULT 'active' NOT NULL,
  "sync_status" text DEFAULT 'pending' NOT NULL,
  "auto_pause_enabled" boolean DEFAULT true NOT NULL,
  "voice_announcements_enabled" boolean DEFAULT false NOT NULL,
  "equipment" text,
  "challenge_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "hide_start_end" boolean DEFAULT true NOT NULL,
  "privacy_radius_meters" integer DEFAULT 120 NOT NULL,
  "started_at" bigint NOT NULL,
  "ended_at" bigint,
  "elapsed_time_sec" integer DEFAULT 0 NOT NULL,
  "moving_time_sec" integer DEFAULT 0 NOT NULL,
  "distance_meters" double precision DEFAULT 0 NOT NULL,
  "average_speed_mps" double precision DEFAULT 0 NOT NULL,
  "average_pace_sec_per_km" double precision DEFAULT 0 NOT NULL,
  "max_speed_mps" double precision DEFAULT 0 NOT NULL,
  "elevation_gain_meters" double precision DEFAULT 0 NOT NULL,
  "elevation_loss_meters" double precision DEFAULT 0 NOT NULL,
  "calories" integer,
  "heart_rate_average" integer,
  "heart_rate_max" integer,
  "heart_rate_min" integer,
  "route_geometry" jsonb,
  "anti_cheat_signals" jsonb,
  "leaderboard_eligible" boolean DEFAULT true NOT NULL,
  "leaderboard_ineligible_reason" text,
  "caption" text DEFAULT '' NOT NULL,
  "photos" jsonb,
  "created_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "pace_activities_uuid_idx"
  ON "pace_activities" ("activity_uuid");
CREATE INDEX IF NOT EXISTS "pace_activities_user_created_idx"
  ON "pace_activities" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "pace_activities_lifecycle_status_idx"
  ON "pace_activities" ("lifecycle_status", "updated_at");

CREATE TABLE IF NOT EXISTS "pace_activity_points" (
  "id" serial PRIMARY KEY NOT NULL,
  "activity_id" integer NOT NULL,
  "sequence" integer NOT NULL,
  "latitude" double precision NOT NULL,
  "longitude" double precision NOT NULL,
  "timestamp" bigint NOT NULL,
  "accuracy" double precision,
  "altitude" double precision,
  "speed" double precision,
  "heading" double precision,
  "created_at" bigint NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "pace_activity_points_activity_sequence_idx"
  ON "pace_activity_points" ("activity_id", "sequence");
CREATE INDEX IF NOT EXISTS "pace_activity_points_activity_timestamp_idx"
  ON "pace_activity_points" ("activity_id", "timestamp");

CREATE TABLE IF NOT EXISTS "pace_activity_likes" (
  "activity_id" integer NOT NULL,
  "user_id" integer NOT NULL,
  "created_at" bigint NOT NULL,
  CONSTRAINT "pace_activity_likes_pk" PRIMARY KEY ("activity_id", "user_id")
);

CREATE INDEX IF NOT EXISTS "pace_activity_likes_user_idx"
  ON "pace_activity_likes" ("user_id");

CREATE TABLE IF NOT EXISTS "pace_activity_comments" (
  "id" serial PRIMARY KEY NOT NULL,
  "activity_id" integer NOT NULL,
  "author_id" integer NOT NULL,
  "parent_id" integer,
  "content" text NOT NULL,
  "created_at" bigint NOT NULL,
  "deleted" boolean DEFAULT false NOT NULL
);

CREATE INDEX IF NOT EXISTS "pace_activity_comments_activity_created_idx"
  ON "pace_activity_comments" ("activity_id", "created_at");
CREATE INDEX IF NOT EXISTS "pace_activity_comments_parent_idx"
  ON "pace_activity_comments" ("parent_id");

CREATE TABLE IF NOT EXISTS "pace_segments" (
  "id" serial PRIMARY KEY NOT NULL,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "activity_type" text DEFAULT 'running' NOT NULL,
  "distance_meters" double precision DEFAULT 0 NOT NULL,
  "start_latitude" double precision NOT NULL,
  "start_longitude" double precision NOT NULL,
  "end_latitude" double precision NOT NULL,
  "end_longitude" double precision NOT NULL,
  "visibility" text DEFAULT 'public' NOT NULL,
  "created_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "pace_segments_slug_idx"
  ON "pace_segments" ("slug");
CREATE INDEX IF NOT EXISTS "pace_segments_visibility_idx"
  ON "pace_segments" ("visibility");

CREATE TABLE IF NOT EXISTS "pace_segment_efforts" (
  "id" serial PRIMARY KEY NOT NULL,
  "segment_id" integer NOT NULL,
  "activity_id" integer NOT NULL,
  "user_id" integer NOT NULL,
  "elapsed_ms" integer NOT NULL,
  "suspicious" boolean DEFAULT false NOT NULL,
  "created_at" bigint NOT NULL
);

CREATE INDEX IF NOT EXISTS "pace_segment_efforts_segment_elapsed_idx"
  ON "pace_segment_efforts" ("segment_id", "elapsed_ms");
CREATE INDEX IF NOT EXISTS "pace_segment_efforts_user_segment_idx"
  ON "pace_segment_efforts" ("user_id", "segment_id");

CREATE TABLE IF NOT EXISTS "pace_challenges" (
  "id" serial PRIMARY KEY NOT NULL,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "activity_type" text DEFAULT 'running' NOT NULL,
  "target_distance_meters" double precision,
  "target_count" integer,
  "visibility" text DEFAULT 'public' NOT NULL,
  "start_at" bigint,
  "end_at" bigint,
  "created_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "pace_challenges_slug_idx"
  ON "pace_challenges" ("slug");
CREATE INDEX IF NOT EXISTS "pace_challenges_visibility_idx"
  ON "pace_challenges" ("visibility");

CREATE TABLE IF NOT EXISTS "pace_challenge_participants" (
  "challenge_id" integer NOT NULL,
  "user_id" integer NOT NULL,
  "progress_distance_meters" double precision DEFAULT 0 NOT NULL,
  "progress_count" integer DEFAULT 0 NOT NULL,
  "completed_at" bigint,
  "updated_at" bigint NOT NULL,
  CONSTRAINT "pace_challenge_participants_pk" PRIMARY KEY ("challenge_id", "user_id")
);

CREATE INDEX IF NOT EXISTS "pace_challenge_participants_progress_idx"
  ON "pace_challenge_participants" ("challenge_id", "progress_distance_meters");
