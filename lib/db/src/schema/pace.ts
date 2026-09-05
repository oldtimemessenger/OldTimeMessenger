import {
  bigint as pgBigint,
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const paceActivityTypeSchema = z.enum([
  "running",
  "walking",
  "cycling",
  "hiking",
  "jogging",
  "other",
]);
export const paceVisibilitySchema = z.enum(["public", "followers", "private"]);
export const paceSyncStatusSchema = z.enum(["local", "pending", "uploading", "synced", "failed"]);
export const paceLifecycleStatusSchema = z.enum(["active", "paused", "finished", "discarded"]);

export const paceActivitiesTable = pgTable(
  "pace_activities",
  {
    id: serial("id").primaryKey(),
    activityUuid: text("activity_uuid").notNull(),
    userId: integer("user_id").notNull(),
    activityType: text("activity_type").notNull().default("running"),
    title: text("title").notNull().default(""),
    description: text("description").notNull().default(""),
    visibility: text("visibility").notNull().default("followers"),
    lifecycleStatus: text("lifecycle_status").notNull().default("active"),
    syncStatus: text("sync_status").notNull().default("pending"),
    autoPauseEnabled: boolean("auto_pause_enabled").notNull().default(true),
    voiceAnnouncementsEnabled: boolean("voice_announcements_enabled").notNull().default(false),
    equipment: text("equipment"),
    challengeIds: jsonb("challenge_ids").$type<number[]>().notNull().default([]),
    hideStartEnd: boolean("hide_start_end").notNull().default(true),
    privacyRadiusMeters: integer("privacy_radius_meters").notNull().default(120),
    startedAt: pgBigint("started_at", { mode: "number" }).notNull(),
    endedAt: pgBigint("ended_at", { mode: "number" }),
    elapsedTimeSec: integer("elapsed_time_sec").notNull().default(0),
    movingTimeSec: integer("moving_time_sec").notNull().default(0),
    distanceMeters: doublePrecision("distance_meters").notNull().default(0),
    averageSpeedMps: doublePrecision("average_speed_mps").notNull().default(0),
    averagePaceSecPerKm: doublePrecision("average_pace_sec_per_km").notNull().default(0),
    maxSpeedMps: doublePrecision("max_speed_mps").notNull().default(0),
    elevationGainMeters: doublePrecision("elevation_gain_meters").notNull().default(0),
    elevationLossMeters: doublePrecision("elevation_loss_meters").notNull().default(0),
    calories: integer("calories"),
    heartRateAverage: integer("heart_rate_average"),
    heartRateMax: integer("heart_rate_max"),
    heartRateMin: integer("heart_rate_min"),
    routeGeometry: jsonb("route_geometry").$type<{
      points: Array<{ latitude: number; longitude: number }>;
    } | null>(),
    antiCheatSignals: jsonb("anti_cheat_signals").$type<{
      suspiciousSpeed?: boolean;
      suspiciousAcceleration?: boolean;
      suspiciousTeleport?: boolean;
      timestampInconsistency?: boolean;
    } | null>(),
    leaderboardEligible: boolean("leaderboard_eligible").notNull().default(true),
    leaderboardIneligibleReason: text("leaderboard_ineligible_reason"),
    caption: text("caption").notNull().default(""),
    photos: jsonb("photos").$type<Array<{ objectPath: string; mimeType: string }> | null>(),
    createdAt: pgBigint("created_at", { mode: "number" }).notNull(),
    updatedAt: pgBigint("updated_at", { mode: "number" }).notNull(),
  },
  (table) => ({
    activityUuidIndex: uniqueIndex("pace_activities_uuid_idx").on(table.activityUuid),
    userCreatedIndex: index("pace_activities_user_created_idx").on(table.userId, table.createdAt),
    statusIndex: index("pace_activities_lifecycle_status_idx").on(table.lifecycleStatus, table.updatedAt),
  }),
);

export const paceActivityPointsTable = pgTable(
  "pace_activity_points",
  {
    id: serial("id").primaryKey(),
    activityId: integer("activity_id").notNull(),
    sequence: integer("sequence").notNull(),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    timestamp: pgBigint("timestamp", { mode: "number" }).notNull(),
    accuracy: doublePrecision("accuracy"),
    altitude: doublePrecision("altitude"),
    speed: doublePrecision("speed"),
    heading: doublePrecision("heading"),
    createdAt: pgBigint("created_at", { mode: "number" }).notNull(),
  },
  (table) => ({
    activitySequenceIndex: uniqueIndex("pace_activity_points_activity_sequence_idx").on(table.activityId, table.sequence),
    activityTimestampIndex: index("pace_activity_points_activity_timestamp_idx").on(table.activityId, table.timestamp),
  }),
);

export const paceActivityLikesTable = pgTable(
  "pace_activity_likes",
  {
    activityId: integer("activity_id").notNull(),
    userId: integer("user_id").notNull(),
    createdAt: pgBigint("created_at", { mode: "number" }).notNull(),
  },
  (table) => ({
    primaryKey: primaryKey({ columns: [table.activityId, table.userId] }),
    userIndex: index("pace_activity_likes_user_idx").on(table.userId),
  }),
);

export const paceActivityCommentsTable = pgTable(
  "pace_activity_comments",
  {
    id: serial("id").primaryKey(),
    activityId: integer("activity_id").notNull(),
    authorId: integer("author_id").notNull(),
    parentId: integer("parent_id"),
    content: text("content").notNull(),
    createdAt: pgBigint("created_at", { mode: "number" }).notNull(),
    deleted: boolean("deleted").notNull().default(false),
  },
  (table) => ({
    activityCreatedIndex: index("pace_activity_comments_activity_created_idx").on(table.activityId, table.createdAt),
    parentIndex: index("pace_activity_comments_parent_idx").on(table.parentId),
  }),
);

export const paceSegmentsTable = pgTable(
  "pace_segments",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    activityType: text("activity_type").notNull().default("running"),
    distanceMeters: doublePrecision("distance_meters").notNull().default(0),
    startLatitude: doublePrecision("start_latitude").notNull(),
    startLongitude: doublePrecision("start_longitude").notNull(),
    endLatitude: doublePrecision("end_latitude").notNull(),
    endLongitude: doublePrecision("end_longitude").notNull(),
    visibility: text("visibility").notNull().default("public"),
    createdAt: pgBigint("created_at", { mode: "number" }).notNull(),
    updatedAt: pgBigint("updated_at", { mode: "number" }).notNull(),
  },
  (table) => ({
    slugIndex: uniqueIndex("pace_segments_slug_idx").on(table.slug),
    visibilityIndex: index("pace_segments_visibility_idx").on(table.visibility),
  }),
);

export const paceSegmentEffortsTable = pgTable(
  "pace_segment_efforts",
  {
    id: serial("id").primaryKey(),
    segmentId: integer("segment_id").notNull(),
    activityId: integer("activity_id").notNull(),
    userId: integer("user_id").notNull(),
    elapsedMs: integer("elapsed_ms").notNull(),
    suspicious: boolean("suspicious").notNull().default(false),
    createdAt: pgBigint("created_at", { mode: "number" }).notNull(),
  },
  (table) => ({
    segmentElapsedIndex: index("pace_segment_efforts_segment_elapsed_idx").on(table.segmentId, table.elapsedMs),
    userSegmentIndex: index("pace_segment_efforts_user_segment_idx").on(table.userId, table.segmentId),
  }),
);

export const paceChallengesTable = pgTable(
  "pace_challenges",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    activityType: text("activity_type").notNull().default("running"),
    targetDistanceMeters: doublePrecision("target_distance_meters"),
    targetCount: integer("target_count"),
    visibility: text("visibility").notNull().default("public"),
    startAt: pgBigint("start_at", { mode: "number" }),
    endAt: pgBigint("end_at", { mode: "number" }),
    createdAt: pgBigint("created_at", { mode: "number" }).notNull(),
    updatedAt: pgBigint("updated_at", { mode: "number" }).notNull(),
  },
  (table) => ({
    slugIndex: uniqueIndex("pace_challenges_slug_idx").on(table.slug),
    visibilityIndex: index("pace_challenges_visibility_idx").on(table.visibility),
  }),
);

export const paceChallengeParticipantsTable = pgTable(
  "pace_challenge_participants",
  {
    challengeId: integer("challenge_id").notNull(),
    userId: integer("user_id").notNull(),
    progressDistanceMeters: doublePrecision("progress_distance_meters").notNull().default(0),
    progressCount: integer("progress_count").notNull().default(0),
    completedAt: pgBigint("completed_at", { mode: "number" }),
    updatedAt: pgBigint("updated_at", { mode: "number" }).notNull(),
  },
  (table) => ({
    primaryKey: primaryKey({ columns: [table.challengeId, table.userId] }),
    challengeProgressIndex: index("pace_challenge_participants_progress_idx").on(table.challengeId, table.progressDistanceMeters),
  }),
);

export const insertPaceActivitySchema = createInsertSchema(paceActivitiesTable).omit({ id: true });

export type PaceActivity = typeof paceActivitiesTable.$inferSelect;
export type PaceActivityPoint = typeof paceActivityPointsTable.$inferSelect;
export type PaceActivityComment = typeof paceActivityCommentsTable.$inferSelect;
