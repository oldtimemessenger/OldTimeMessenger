import { Router, type IRouter, type Request, type Response } from "express";
import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { z } from "@workspace/api-zod";
import {
  db,
  paceActivitiesTable,
  paceActivityCommentsTable,
  paceActivityLikesTable,
  paceActivityPointsTable,
  paceChallengeParticipantsTable,
  paceChallengesTable,
  paceSegmentsTable,
  paceSegmentEffortsTable,
  socialFollowsTable,
  usersTable,
} from "@workspace/db";
import { requireChatAuth } from "../lib/chat-auth";

const router: IRouter = Router();

const activityTypes = z.enum(["running", "walking", "cycling", "hiking", "jogging", "other"]);
const activityVisibility = z.enum(["public", "followers", "private"]);
const syncStatusSchema = z.enum(["local", "pending", "uploading", "synced", "failed"]);

const createActivityInput = z.object({
  activityUuid: z.string().trim().min(8).max(120),
  activityType: activityTypes.default("running"),
  title: z.string().trim().max(120).optional(),
  description: z.string().trim().max(2_000).optional(),
  visibility: activityVisibility.default("followers"),
  autoPauseEnabled: z.boolean().default(true),
  voiceAnnouncementsEnabled: z.boolean().default(false),
  equipment: z.string().trim().max(120).nullable().optional(),
  challengeIds: z.array(z.number().int().positive()).max(20).default([]),
  hideStartEnd: z.boolean().default(true),
  privacyRadiusMeters: z.number().int().min(0).max(2_000).default(120),
  startedAt: z.number().int().positive().optional(),
});

const pointsBatchInput = z.object({
  points: z
    .array(
      z.object({
        sequence: z.number().int().min(0),
        latitude: z.number().finite().gte(-90).lte(90),
        longitude: z.number().finite().gte(-180).lte(180),
        timestamp: z.number().int().positive(),
        accuracy: z.number().finite().nonnegative().optional(),
        altitude: z.number().finite().optional(),
        speed: z.number().finite().optional(),
        heading: z.number().finite().optional(),
      }),
    )
    .min(1)
    .max(500),
  syncStatus: syncStatusSchema.optional(),
});

const finishInput = z.object({
  endedAt: z.number().int().positive().optional(),
  elapsedTimeSec: z.number().int().nonnegative().optional(),
  caption: z.string().trim().max(2_000).optional(),
  photos: z
    .array(
      z.object({
        objectPath: z.string().trim().min(1).max(500),
        mimeType: z.string().trim().min(1).max(120),
      }),
    )
    .max(8)
    .optional(),
  visibility: activityVisibility.optional(),
  calories: z.number().int().nonnegative().nullable().optional(),
  heartRateAverage: z.number().int().nonnegative().nullable().optional(),
  heartRateMax: z.number().int().nonnegative().nullable().optional(),
  heartRateMin: z.number().int().nonnegative().nullable().optional(),
});

const pauseResumeInput = z.object({
  syncStatus: syncStatusSchema.optional(),
});

const commentInput = z.object({
  content: z.string().trim().min(1).max(1_000),
  parentId: z.number().int().positive().nullable().optional(),
});

function parseId(value: unknown): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function parseLimit(value: unknown, fallback = 20, cap = 50): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.max(1, Math.min(cap, parsed));
}

function parseGeo(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function distanceMeters(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): number {
  const earthRadius = 6371000;
  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function activitySpeedLimit(activityType: string): number {
  if (activityType === "cycling") return 35;
  return 12;
}

function obfuscateRoute(
  points: Array<{ latitude: number; longitude: number }>,
  hideStartEnd: boolean,
  privacyRadiusMeters: number,
): Array<{ latitude: number; longitude: number }> {
  if (!hideStartEnd || privacyRadiusMeters <= 0 || points.length < 3) return points;
  const start = points[0];
  const end = points[points.length - 1];
  const filtered = points.filter((point, index) => {
    if (index === 0 || index === points.length - 1) return false;
    const fromStart = distanceMeters(start, point);
    const fromEnd = distanceMeters(end, point);
    return fromStart >= privacyRadiusMeters && fromEnd >= privacyRadiusMeters;
  });
  return filtered.length >= 2 ? filtered : points.slice(1, Math.max(2, points.length - 1));
}

async function canViewActivity(viewerId: number, activity: typeof paceActivitiesTable.$inferSelect): Promise<boolean> {
  if (activity.userId === viewerId) return true;
  if (activity.visibility === "public") return true;
  if (activity.visibility === "private") return false;
  const [follow] = await db
    .select({ followerId: socialFollowsTable.followerId })
    .from(socialFollowsTable)
    .where(and(eq(socialFollowsTable.followerId, viewerId), eq(socialFollowsTable.followingId, activity.userId)))
    .limit(1);
  return Boolean(follow);
}

async function serializeActivity(viewerId: number, activity: typeof paceActivitiesTable.$inferSelect) {
  const [author, pointRows, likeStats, commentStats, viewerLike] = await Promise.all([
    db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        username: usersTable.username,
        avatarObjectPath: usersTable.avatarObjectPath,
      })
      .from(usersTable)
      .where(eq(usersTable.id, activity.userId))
      .limit(1),
    db
      .select({
        latitude: paceActivityPointsTable.latitude,
        longitude: paceActivityPointsTable.longitude,
      })
      .from(paceActivityPointsTable)
      .where(eq(paceActivityPointsTable.activityId, activity.id))
      .orderBy(asc(paceActivityPointsTable.sequence)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(paceActivityLikesTable)
      .where(eq(paceActivityLikesTable.activityId, activity.id)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(paceActivityCommentsTable)
      .where(and(eq(paceActivityCommentsTable.activityId, activity.id), eq(paceActivityCommentsTable.deleted, false))),
    db
      .select({ userId: paceActivityLikesTable.userId })
      .from(paceActivityLikesTable)
      .where(and(eq(paceActivityLikesTable.activityId, activity.id), eq(paceActivityLikesTable.userId, viewerId)))
      .limit(1),
  ]);
  const routePoints = pointRows.map((point) => ({ latitude: point.latitude, longitude: point.longitude }));
  const shownRoute = activity.userId === viewerId
    ? routePoints
    : obfuscateRoute(routePoints, activity.hideStartEnd, activity.privacyRadiusMeters);
  return {
    id: activity.id,
    activityUuid: activity.activityUuid,
    activityType: activity.activityType,
    title: activity.title,
    description: activity.description,
    visibility: activity.visibility,
    lifecycleStatus: activity.lifecycleStatus,
    syncStatus: activity.syncStatus,
    startedAt: activity.startedAt,
    endedAt: activity.endedAt,
    elapsedTimeSec: activity.elapsedTimeSec,
    movingTimeSec: activity.movingTimeSec,
    distanceMeters: activity.distanceMeters,
    averageSpeedMps: activity.averageSpeedMps,
    averagePaceSecPerKm: activity.averagePaceSecPerKm,
    maxSpeedMps: activity.maxSpeedMps,
    elevationGainMeters: activity.elevationGainMeters,
    elevationLossMeters: activity.elevationLossMeters,
    calories: activity.calories,
    heartRateAverage: activity.heartRateAverage,
    heartRateMax: activity.heartRateMax,
    heartRateMin: activity.heartRateMin,
    autoPauseEnabled: activity.autoPauseEnabled,
    voiceAnnouncementsEnabled: activity.voiceAnnouncementsEnabled,
    hideStartEnd: activity.hideStartEnd,
    privacyRadiusMeters: activity.privacyRadiusMeters,
    caption: activity.caption,
    photos: activity.photos ?? [],
    challengeIds: activity.challengeIds,
    antiCheatSignals: activity.antiCheatSignals ?? null,
    leaderboardEligible: activity.leaderboardEligible,
    leaderboardIneligibleReason: activity.leaderboardIneligibleReason,
    route: shownRoute,
    author: author[0] ?? null,
    counts: {
      likes: likeStats[0]?.count ?? 0,
      comments: commentStats[0]?.count ?? 0,
    },
    viewer: {
      liked: viewerLike.length > 0,
      own: activity.userId === viewerId,
    },
    createdAt: activity.createdAt,
    updatedAt: activity.updatedAt,
  };
}

async function computeMetrics(activityId: number, activityType: string) {
  const points = await db
    .select({
      sequence: paceActivityPointsTable.sequence,
      latitude: paceActivityPointsTable.latitude,
      longitude: paceActivityPointsTable.longitude,
      timestamp: paceActivityPointsTable.timestamp,
      altitude: paceActivityPointsTable.altitude,
      speed: paceActivityPointsTable.speed,
    })
    .from(paceActivityPointsTable)
    .where(eq(paceActivityPointsTable.activityId, activityId))
    .orderBy(asc(paceActivityPointsTable.sequence));
  if (!points.length) {
    return {
      routeGeometry: { points: [] as Array<{ latitude: number; longitude: number }> },
      distanceMetersTotal: 0,
      movingTimeSec: 0,
      averageSpeedMps: 0,
      averagePaceSecPerKm: 0,
      maxSpeedMps: 0,
      elevationGainMeters: 0,
      elevationLossMeters: 0,
      antiCheatSignals: null as null | Record<string, boolean>,
      leaderboardEligible: true,
      leaderboardIneligibleReason: null as string | null,
    };
  }
  let distanceMetersTotal = 0;
  let movingTimeMs = 0;
  let maxSpeedMps = 0;
  let elevationGainMeters = 0;
  let elevationLossMeters = 0;
  let suspiciousSpeed = false;
  let suspiciousAcceleration = false;
  let suspiciousTeleport = false;
  let timestampInconsistency = false;
  const speedLimit = activitySpeedLimit(activityType);
  for (let index = 1; index < points.length; index += 1) {
    const prev = points[index - 1];
    const current = points[index];
    const dtMs = current.timestamp - prev.timestamp;
    if (dtMs <= 0) {
      timestampInconsistency = true;
      continue;
    }
    const segmentDistance = distanceMeters(
      { latitude: prev.latitude, longitude: prev.longitude },
      { latitude: current.latitude, longitude: current.longitude },
    );
    distanceMetersTotal += segmentDistance;
    const estimatedSpeed = segmentDistance / (dtMs / 1000);
    const speedValue = Number.isFinite(current.speed ?? NaN) ? Math.max(0, current.speed ?? 0) : estimatedSpeed;
    maxSpeedMps = Math.max(maxSpeedMps, speedValue);
    if (speedValue > speedLimit) suspiciousSpeed = true;
    if (estimatedSpeed > 80) suspiciousTeleport = true;
    if (estimatedSpeed > 0.6) movingTimeMs += dtMs;
    const prevSpeed = Number.isFinite(prev.speed ?? NaN) ? Math.max(0, prev.speed ?? 0) : estimatedSpeed;
    const acceleration = Math.abs(speedValue - prevSpeed) / (dtMs / 1000);
    if (acceleration > 10) suspiciousAcceleration = true;
    if (typeof prev.altitude === "number" && typeof current.altitude === "number") {
      const delta = current.altitude - prev.altitude;
      if (delta > 0) elevationGainMeters += delta;
      if (delta < 0) elevationLossMeters += Math.abs(delta);
    }
  }
  const movingTimeSec = Math.round(movingTimeMs / 1000);
  const averageSpeedMps = movingTimeSec > 0 ? distanceMetersTotal / movingTimeSec : 0;
  const averagePaceSecPerKm = distanceMetersTotal > 0 && movingTimeSec > 0
    ? movingTimeSec / (distanceMetersTotal / 1000)
    : 0;
  const antiCheatSignals = suspiciousSpeed || suspiciousAcceleration || suspiciousTeleport || timestampInconsistency
    ? { suspiciousSpeed, suspiciousAcceleration, suspiciousTeleport, timestampInconsistency }
    : null;
  const leaderboardEligible = antiCheatSignals === null;
  return {
    routeGeometry: {
      points: points.map((point) => ({ latitude: point.latitude, longitude: point.longitude })),
    },
    distanceMetersTotal,
    movingTimeSec,
    averageSpeedMps,
    averagePaceSecPerKm,
    maxSpeedMps,
    elevationGainMeters,
    elevationLossMeters,
    antiCheatSignals,
    leaderboardEligible,
    leaderboardIneligibleReason: leaderboardEligible ? null : "suspicious_gps_data",
  };
}

router.get("/pace/home", async (req, res): Promise<void> => {
  const userId = await requireChatAuth(req, res);
  if (userId === null) return;
  const [recent, active, challengeRows, nearbyTypes] = await Promise.all([
    db
      .select()
      .from(paceActivitiesTable)
      .where(and(eq(paceActivitiesTable.userId, userId), ne(paceActivitiesTable.lifecycleStatus, "discarded")))
      .orderBy(desc(paceActivitiesTable.createdAt))
      .limit(5),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(paceActivitiesTable)
      .where(and(eq(paceActivitiesTable.userId, userId), inArray(paceActivitiesTable.lifecycleStatus, ["active", "paused"]))),
    db
      .select({
        id: paceChallengesTable.id,
        name: paceChallengesTable.name,
        description: paceChallengesTable.description,
        targetDistanceMeters: paceChallengesTable.targetDistanceMeters,
        progressDistanceMeters: paceChallengeParticipantsTable.progressDistanceMeters,
      })
      .from(paceChallengesTable)
      .leftJoin(
        paceChallengeParticipantsTable,
        and(
          eq(paceChallengeParticipantsTable.challengeId, paceChallengesTable.id),
          eq(paceChallengeParticipantsTable.userId, userId),
        ),
      )
      .orderBy(desc(paceChallengesTable.updatedAt))
      .limit(6),
    db
      .select({
        activityType: paceActivitiesTable.activityType,
        count: sql<number>`count(*)::int`,
      })
      .from(paceActivitiesTable)
      .where(and(ne(paceActivitiesTable.userId, userId), eq(paceActivitiesTable.visibility, "public")))
      .groupBy(paceActivitiesTable.activityType),
  ]);
  const totalDistance = recent.reduce((sum, item) => sum + item.distanceMeters, 0);
  const totalTime = recent.reduce((sum, item) => sum + item.movingTimeSec, 0);
  res.json({
    activeCount: active[0]?.count ?? 0,
    recentDistanceMeters: totalDistance,
    recentMovingTimeSec: totalTime,
    recentActivities: await Promise.all(recent.map((item) => serializeActivity(userId, item))),
    nearbyActivity: nearbyTypes.map((item) => ({ activityType: item.activityType, count: item.count })),
    challenges: challengeRows.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      targetDistanceMeters: item.targetDistanceMeters,
      progressDistanceMeters: item.progressDistanceMeters ?? 0,
    })),
  });
});

router.post("/pace/activities", async (req, res): Promise<void> => {
  const userId = await requireChatAuth(req, res);
  if (userId === null) return;
  const parsed = createActivityInput.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid activity payload." });
    return;
  }
  const input = parsed.data;
  const [existing] = await db
    .select()
    .from(paceActivitiesTable)
    .where(and(eq(paceActivitiesTable.userId, userId), eq(paceActivitiesTable.activityUuid, input.activityUuid)))
    .limit(1);
  if (existing) {
    res.json(await serializeActivity(userId, existing));
    return;
  }
  const now = Date.now();
  const [created] = await db
    .insert(paceActivitiesTable)
    .values({
      activityUuid: input.activityUuid,
      userId,
      activityType: input.activityType,
      title: input.title?.trim() || `${input.activityType[0]?.toUpperCase() ?? "A"}${input.activityType.slice(1)} Activity`,
      description: input.description?.trim() ?? "",
      visibility: input.visibility,
      lifecycleStatus: "active",
      syncStatus: "pending",
      autoPauseEnabled: input.autoPauseEnabled,
      voiceAnnouncementsEnabled: input.voiceAnnouncementsEnabled,
      equipment: input.equipment ?? null,
      challengeIds: input.challengeIds,
      hideStartEnd: input.hideStartEnd,
      privacyRadiusMeters: input.privacyRadiusMeters,
      startedAt: input.startedAt ?? now,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  res.status(201).json(await serializeActivity(userId, created));
});

router.put("/pace/activities/:activityId/start", async (req, res): Promise<void> => {
  const userId = await requireChatAuth(req, res);
  if (userId === null) return;
  const activityId = parseId(req.params.activityId);
  if (!activityId) {
    res.status(400).json({ error: "Invalid activity id." });
    return;
  }
  const [activity] = await db.select().from(paceActivitiesTable).where(eq(paceActivitiesTable.id, activityId)).limit(1);
  if (!activity || activity.userId !== userId) {
    res.status(404).json({ error: "Activity not found." });
    return;
  }
  const now = Date.now();
  const [updated] = await db
    .update(paceActivitiesTable)
    .set({
      lifecycleStatus: "active",
      startedAt: activity.startedAt || now,
      updatedAt: now,
    })
    .where(eq(paceActivitiesTable.id, activityId))
    .returning();
  res.json(await serializeActivity(userId, updated));
});

router.post("/pace/activities/:activityId/points", async (req, res): Promise<void> => {
  const userId = await requireChatAuth(req, res);
  if (userId === null) return;
  const activityId = parseId(req.params.activityId);
  if (!activityId) {
    res.status(400).json({ error: "Invalid activity id." });
    return;
  }
  const parsed = pointsBatchInput.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid points payload." });
    return;
  }
  const [activity] = await db.select().from(paceActivitiesTable).where(eq(paceActivitiesTable.id, activityId)).limit(1);
  if (!activity || activity.userId !== userId) {
    res.status(404).json({ error: "Activity not found." });
    return;
  }
  if (activity.lifecycleStatus === "discarded" || activity.lifecycleStatus === "finished") {
    res.status(409).json({ error: "This activity cannot accept more points." });
    return;
  }
  const now = Date.now();
  const pointRows = parsed.data.points.map((point) => ({
    activityId,
    sequence: point.sequence,
    latitude: point.latitude,
    longitude: point.longitude,
    timestamp: point.timestamp,
    accuracy: point.accuracy,
    altitude: point.altitude,
    speed: point.speed,
    heading: point.heading,
    createdAt: now,
  }));
  const inserted = await db
    .insert(paceActivityPointsTable)
    .values(pointRows)
    .onConflictDoNothing({ target: [paceActivityPointsTable.activityId, paceActivityPointsTable.sequence] })
    .returning({ sequence: paceActivityPointsTable.sequence });
  const [updated] = await db
    .update(paceActivitiesTable)
    .set({
      syncStatus: parsed.data.syncStatus ?? "uploading",
      updatedAt: now,
    })
    .where(eq(paceActivitiesTable.id, activityId))
    .returning();
  res.json({
    success: true,
    accepted: inserted.length,
    acceptedSequences: inserted.map((row) => row.sequence),
    activity: await serializeActivity(userId, updated),
  });
});

router.put("/pace/activities/:activityId/pause", async (req, res): Promise<void> => {
  const userId = await requireChatAuth(req, res);
  if (userId === null) return;
  const activityId = parseId(req.params.activityId);
  if (!activityId) {
    res.status(400).json({ error: "Invalid activity id." });
    return;
  }
  const parsed = pauseResumeInput.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid pause payload." });
    return;
  }
  const [activity] = await db.select().from(paceActivitiesTable).where(eq(paceActivitiesTable.id, activityId)).limit(1);
  if (!activity || activity.userId !== userId) {
    res.status(404).json({ error: "Activity not found." });
    return;
  }
  const now = Date.now();
  const [updated] = await db
    .update(paceActivitiesTable)
    .set({
      lifecycleStatus: "paused",
      syncStatus: parsed.data.syncStatus ?? activity.syncStatus,
      updatedAt: now,
    })
    .where(eq(paceActivitiesTable.id, activityId))
    .returning();
  res.json(await serializeActivity(userId, updated));
});

router.put("/pace/activities/:activityId/resume", async (req, res): Promise<void> => {
  const userId = await requireChatAuth(req, res);
  if (userId === null) return;
  const activityId = parseId(req.params.activityId);
  if (!activityId) {
    res.status(400).json({ error: "Invalid activity id." });
    return;
  }
  const parsed = pauseResumeInput.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid resume payload." });
    return;
  }
  const [activity] = await db.select().from(paceActivitiesTable).where(eq(paceActivitiesTable.id, activityId)).limit(1);
  if (!activity || activity.userId !== userId) {
    res.status(404).json({ error: "Activity not found." });
    return;
  }
  const now = Date.now();
  const [updated] = await db
    .update(paceActivitiesTable)
    .set({
      lifecycleStatus: "active",
      syncStatus: parsed.data.syncStatus ?? activity.syncStatus,
      updatedAt: now,
    })
    .where(eq(paceActivitiesTable.id, activityId))
    .returning();
  res.json(await serializeActivity(userId, updated));
});

router.put("/pace/activities/:activityId/finish", async (req, res): Promise<void> => {
  const userId = await requireChatAuth(req, res);
  if (userId === null) return;
  const activityId = parseId(req.params.activityId);
  if (!activityId) {
    res.status(400).json({ error: "Invalid activity id." });
    return;
  }
  const parsed = finishInput.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid finish payload." });
    return;
  }
  const [activity] = await db.select().from(paceActivitiesTable).where(eq(paceActivitiesTable.id, activityId)).limit(1);
  if (!activity || activity.userId !== userId) {
    res.status(404).json({ error: "Activity not found." });
    return;
  }
  const endedAt = parsed.data.endedAt ?? Date.now();
  const elapsedTimeSec = parsed.data.elapsedTimeSec ?? Math.max(0, Math.round((endedAt - activity.startedAt) / 1000));
  const metrics = await computeMetrics(activityId, activity.activityType);
  const [updated] = await db
    .update(paceActivitiesTable)
    .set({
      visibility: parsed.data.visibility ?? activity.visibility,
      lifecycleStatus: "finished",
      syncStatus: "synced",
      endedAt,
      elapsedTimeSec,
      movingTimeSec: metrics.movingTimeSec,
      distanceMeters: metrics.distanceMetersTotal,
      averageSpeedMps: metrics.averageSpeedMps,
      averagePaceSecPerKm: metrics.averagePaceSecPerKm,
      maxSpeedMps: metrics.maxSpeedMps,
      elevationGainMeters: metrics.elevationGainMeters,
      elevationLossMeters: metrics.elevationLossMeters,
      routeGeometry: metrics.routeGeometry,
      antiCheatSignals: metrics.antiCheatSignals,
      leaderboardEligible: metrics.leaderboardEligible,
      leaderboardIneligibleReason: metrics.leaderboardIneligibleReason,
      caption: parsed.data.caption ?? activity.caption,
      photos: parsed.data.photos ?? activity.photos,
      calories: parsed.data.calories === undefined ? activity.calories : parsed.data.calories,
      heartRateAverage: parsed.data.heartRateAverage === undefined ? activity.heartRateAverage : parsed.data.heartRateAverage,
      heartRateMax: parsed.data.heartRateMax === undefined ? activity.heartRateMax : parsed.data.heartRateMax,
      heartRateMin: parsed.data.heartRateMin === undefined ? activity.heartRateMin : parsed.data.heartRateMin,
      updatedAt: Date.now(),
    })
    .where(eq(paceActivitiesTable.id, activityId))
    .returning();
  res.json(await serializeActivity(userId, updated));
});

router.delete("/pace/activities/:activityId", async (req, res): Promise<void> => {
  const userId = await requireChatAuth(req, res);
  if (userId === null) return;
  const activityId = parseId(req.params.activityId);
  if (!activityId) {
    res.status(400).json({ error: "Invalid activity id." });
    return;
  }
  const [activity] = await db.select().from(paceActivitiesTable).where(eq(paceActivitiesTable.id, activityId)).limit(1);
  if (!activity || activity.userId !== userId) {
    res.status(404).json({ error: "Activity not found." });
    return;
  }
  await db
    .update(paceActivitiesTable)
    .set({
      lifecycleStatus: "discarded",
      syncStatus: "failed",
      updatedAt: Date.now(),
    })
    .where(eq(paceActivitiesTable.id, activityId));
  res.json({ success: true });
});

router.post("/pace/activities/:activityId/sync-retry", async (req, res): Promise<void> => {
  const userId = await requireChatAuth(req, res);
  if (userId === null) return;
  const activityId = parseId(req.params.activityId);
  if (!activityId) {
    res.status(400).json({ error: "Invalid activity id." });
    return;
  }
  const [activity] = await db.select().from(paceActivitiesTable).where(eq(paceActivitiesTable.id, activityId)).limit(1);
  if (!activity || activity.userId !== userId) {
    res.status(404).json({ error: "Activity not found." });
    return;
  }
  const [updated] = await db
    .update(paceActivitiesTable)
    .set({ syncStatus: "pending", updatedAt: Date.now() })
    .where(eq(paceActivitiesTable.id, activityId))
    .returning();
  res.json(await serializeActivity(userId, updated));
});

router.get("/pace/activities/:activityId", async (req, res): Promise<void> => {
  const userId = await requireChatAuth(req, res);
  if (userId === null) return;
  const activityId = parseId(req.params.activityId);
  if (!activityId) {
    res.status(400).json({ error: "Invalid activity id." });
    return;
  }
  const [activity] = await db.select().from(paceActivitiesTable).where(eq(paceActivitiesTable.id, activityId)).limit(1);
  if (!activity) {
    res.status(404).json({ error: "Activity not found." });
    return;
  }
  if (!(await canViewActivity(userId, activity))) {
    res.status(403).json({ error: "You do not have access to this activity." });
    return;
  }
  res.json(await serializeActivity(userId, activity));
});

router.get("/pace/feed", async (req, res): Promise<void> => {
  const userId = await requireChatAuth(req, res);
  if (userId === null) return;
  const limit = parseLimit(req.query.limit, 20, 50);
  const queryLimit = Math.min(300, limit * 4);
  const items = await db
    .select()
    .from(paceActivitiesTable)
    .where(and(eq(paceActivitiesTable.lifecycleStatus, "finished"), ne(paceActivitiesTable.visibility, "private")))
    .orderBy(desc(paceActivitiesTable.createdAt))
    .limit(queryLimit);
  const visible = [] as typeof items;
  // eslint-disable-next-line no-restricted-syntax
  for (const item of items) {
    // eslint-disable-next-line no-await-in-loop
    if (await canViewActivity(userId, item)) visible.push(item);
    if (visible.length >= limit) break;
  }
  res.json({ items: await Promise.all(visible.map((item) => serializeActivity(userId, item))) });
});

router.get("/pace/history", async (req, res): Promise<void> => {
  const userId = await requireChatAuth(req, res);
  if (userId === null) return;
  const limit = parseLimit(req.query.limit, 30, 100);
  const activityType = typeof req.query.activityType === "string" ? req.query.activityType : null;
  const query = db
    .select()
    .from(paceActivitiesTable)
    .where(
      and(
        eq(paceActivitiesTable.userId, userId),
        ne(paceActivitiesTable.lifecycleStatus, "discarded"),
        activityType ? eq(paceActivitiesTable.activityType, activityType) : sql`true`,
      ),
    )
    .orderBy(desc(paceActivitiesTable.createdAt))
    .limit(limit);
  const items = await query;
  res.json({ items: await Promise.all(items.map((item) => serializeActivity(userId, item))) });
});

router.get("/pace/profile/:userId?", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res);
  if (viewerId === null) return;
  const targetId = req.params.userId ? parseId(req.params.userId) : viewerId;
  if (!targetId) {
    res.status(400).json({ error: "Invalid user id." });
    return;
  }
  const [user] = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      username: usersTable.username,
      bio: usersTable.bio,
      avatarObjectPath: usersTable.avatarObjectPath,
    })
    .from(usersTable)
    .where(eq(usersTable.id, targetId))
    .limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found." });
    return;
  }
  const activities = await db
    .select()
    .from(paceActivitiesTable)
    .where(and(eq(paceActivitiesTable.userId, targetId), eq(paceActivitiesTable.lifecycleStatus, "finished")))
    .orderBy(desc(paceActivitiesTable.createdAt))
    .limit(40);
  const visible = [] as typeof activities;
  // eslint-disable-next-line no-restricted-syntax
  for (const item of activities) {
    // eslint-disable-next-line no-await-in-loop
    if (await canViewActivity(viewerId, item)) visible.push(item);
  }
  const totalDistanceMeters = visible.reduce((sum, item) => sum + item.distanceMeters, 0);
  const totalMovingTimeSec = visible.reduce((sum, item) => sum + item.movingTimeSec, 0);
  const personalBest = visible.reduce((best, item) => {
    if (!best) return item;
    if (item.distanceMeters > best.distanceMeters) return item;
    return best;
  }, visible[0]);
  res.json({
    user,
    stats: {
      totalActivities: visible.length,
      totalDistanceMeters,
      totalMovingTimeSec,
      longestActivityMeters: personalBest?.distanceMeters ?? 0,
      bestPaceSecPerKm: visible.reduce((best, item) => {
        if (!item.averagePaceSecPerKm) return best;
        if (best === 0) return item.averagePaceSecPerKm;
        return Math.min(best, item.averagePaceSecPerKm);
      }, 0),
    },
    recent: await Promise.all(visible.slice(0, 10).map((item) => serializeActivity(viewerId, item))),
  });
});

router.put("/pace/activities/:activityId/like", async (req, res): Promise<void> => {
  const userId = await requireChatAuth(req, res);
  if (userId === null) return;
  const activityId = parseId(req.params.activityId);
  if (!activityId) {
    res.status(400).json({ error: "Invalid activity id." });
    return;
  }
  const [activity] = await db.select().from(paceActivitiesTable).where(eq(paceActivitiesTable.id, activityId)).limit(1);
  if (!activity || !(await canViewActivity(userId, activity))) {
    res.status(404).json({ error: "Activity not found." });
    return;
  }
  await db
    .insert(paceActivityLikesTable)
    .values({ activityId, userId, createdAt: Date.now() })
    .onConflictDoNothing({ target: [paceActivityLikesTable.activityId, paceActivityLikesTable.userId] });
  res.json({ success: true, active: true });
});

router.delete("/pace/activities/:activityId/like", async (req, res): Promise<void> => {
  const userId = await requireChatAuth(req, res);
  if (userId === null) return;
  const activityId = parseId(req.params.activityId);
  if (!activityId) {
    res.status(400).json({ error: "Invalid activity id." });
    return;
  }
  await db
    .delete(paceActivityLikesTable)
    .where(and(eq(paceActivityLikesTable.activityId, activityId), eq(paceActivityLikesTable.userId, userId)));
  res.json({ success: true, active: false });
});

router.get("/pace/activities/:activityId/comments", async (req, res): Promise<void> => {
  const userId = await requireChatAuth(req, res);
  if (userId === null) return;
  const activityId = parseId(req.params.activityId);
  if (!activityId) {
    res.status(400).json({ error: "Invalid activity id." });
    return;
  }
  const [activity] = await db.select().from(paceActivitiesTable).where(eq(paceActivitiesTable.id, activityId)).limit(1);
  if (!activity || !(await canViewActivity(userId, activity))) {
    res.status(404).json({ error: "Activity not found." });
    return;
  }
  const rows = await db
    .select({
      id: paceActivityCommentsTable.id,
      parentId: paceActivityCommentsTable.parentId,
      content: paceActivityCommentsTable.content,
      createdAt: paceActivityCommentsTable.createdAt,
      authorId: usersTable.id,
      authorName: usersTable.name,
      authorUsername: usersTable.username,
      authorAvatarObjectPath: usersTable.avatarObjectPath,
    })
    .from(paceActivityCommentsTable)
    .innerJoin(usersTable, eq(usersTable.id, paceActivityCommentsTable.authorId))
    .where(and(eq(paceActivityCommentsTable.activityId, activityId), eq(paceActivityCommentsTable.deleted, false)))
    .orderBy(asc(paceActivityCommentsTable.createdAt));
  res.json(
    rows.map((item) => ({
      id: item.id,
      activityId,
      parentId: item.parentId,
      content: item.content,
      createdAt: item.createdAt,
      author: {
        id: item.authorId,
        name: item.authorName,
        username: item.authorUsername,
        avatarObjectPath: item.authorAvatarObjectPath,
      },
    })),
  );
});

router.post("/pace/activities/:activityId/comments", async (req, res): Promise<void> => {
  const userId = await requireChatAuth(req, res);
  if (userId === null) return;
  const activityId = parseId(req.params.activityId);
  if (!activityId) {
    res.status(400).json({ error: "Invalid activity id." });
    return;
  }
  const parsed = commentInput.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid comment payload." });
    return;
  }
  const [activity] = await db.select().from(paceActivitiesTable).where(eq(paceActivitiesTable.id, activityId)).limit(1);
  if (!activity || !(await canViewActivity(userId, activity))) {
    res.status(404).json({ error: "Activity not found." });
    return;
  }
  if (parsed.data.parentId) {
    const [parent] = await db
      .select({ id: paceActivityCommentsTable.id })
      .from(paceActivityCommentsTable)
      .where(
        and(
          eq(paceActivityCommentsTable.id, parsed.data.parentId),
          eq(paceActivityCommentsTable.activityId, activityId),
          eq(paceActivityCommentsTable.deleted, false),
        ),
      )
      .limit(1);
    if (!parent) {
      res.status(404).json({ error: "Parent comment not found." });
      return;
    }
  }
  const [created] = await db
    .insert(paceActivityCommentsTable)
    .values({
      activityId,
      authorId: userId,
      parentId: parsed.data.parentId ?? null,
      content: parsed.data.content,
      createdAt: Date.now(),
      deleted: false,
    })
    .returning();
  const [author] = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      username: usersTable.username,
      avatarObjectPath: usersTable.avatarObjectPath,
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  res.status(201).json({
    id: created.id,
    activityId,
    parentId: created.parentId,
    content: created.content,
    createdAt: created.createdAt,
    author,
  });
});

router.get("/pace/segments", async (req, res): Promise<void> => {
  const userId = await requireChatAuth(req, res);
  if (userId === null) return;
  const limit = parseLimit(req.query.limit, 20, 100);
  const items = await db
    .select()
    .from(paceSegmentsTable)
    .where(eq(paceSegmentsTable.visibility, "public"))
    .orderBy(desc(paceSegmentsTable.updatedAt))
    .limit(limit);
  res.json({ items });
});

router.get("/pace/segments/:segmentId/leaderboard", async (req, res): Promise<void> => {
  const userId = await requireChatAuth(req, res);
  if (userId === null) return;
  const segmentId = parseId(req.params.segmentId);
  if (!segmentId) {
    res.status(400).json({ error: "Invalid segment id." });
    return;
  }
  const scope = req.query.scope === "friends" || req.query.scope === "local" ? req.query.scope : "all";
  const rows = await db
    .select({
      userId: paceSegmentEffortsTable.userId,
      elapsedMs: sql<number>`min(${paceSegmentEffortsTable.elapsedMs})::int`,
      username: usersTable.username,
      name: usersTable.name,
      avatarObjectPath: usersTable.avatarObjectPath,
    })
    .from(paceSegmentEffortsTable)
    .innerJoin(usersTable, eq(usersTable.id, paceSegmentEffortsTable.userId))
    .where(and(eq(paceSegmentEffortsTable.segmentId, segmentId), eq(paceSegmentEffortsTable.suspicious, false)))
    .groupBy(paceSegmentEffortsTable.userId, usersTable.username, usersTable.name, usersTable.avatarObjectPath)
    .orderBy(sql`min(${paceSegmentEffortsTable.elapsedMs})`)
    .limit(100);
  const entries = scope === "friends"
    ? (await (async () => {
      const following = await db
        .select({ followingId: socialFollowsTable.followingId })
        .from(socialFollowsTable)
        .where(eq(socialFollowsTable.followerId, userId));
      const ids = new Set(following.map((item) => item.followingId));
      return rows.filter((item) => ids.has(item.userId) || item.userId === userId);
    })())
    : rows;
  res.json({
    scope,
    entries: entries.map((item, index) => ({
      rank: index + 1,
      user: {
        id: item.userId,
        username: item.username,
        name: item.name,
        avatarObjectPath: item.avatarObjectPath,
      },
      elapsedMs: item.elapsedMs,
    })),
  });
});

router.get("/pace/challenges", async (req, res): Promise<void> => {
  const userId = await requireChatAuth(req, res);
  if (userId === null) return;
  const items = await db
    .select({
      id: paceChallengesTable.id,
      slug: paceChallengesTable.slug,
      name: paceChallengesTable.name,
      description: paceChallengesTable.description,
      activityType: paceChallengesTable.activityType,
      targetDistanceMeters: paceChallengesTable.targetDistanceMeters,
      targetCount: paceChallengesTable.targetCount,
      visibility: paceChallengesTable.visibility,
      startAt: paceChallengesTable.startAt,
      endAt: paceChallengesTable.endAt,
      participantProgress: paceChallengeParticipantsTable.progressDistanceMeters,
      participantCountProgress: paceChallengeParticipantsTable.progressCount,
      participantCompletedAt: paceChallengeParticipantsTable.completedAt,
    })
    .from(paceChallengesTable)
    .where(eq(paceChallengesTable.visibility, "public"))
    .leftJoin(
      paceChallengeParticipantsTable,
      and(
        eq(paceChallengeParticipantsTable.challengeId, paceChallengesTable.id),
        eq(paceChallengeParticipantsTable.userId, userId),
      ),
    )
    .orderBy(desc(paceChallengesTable.updatedAt))
    .limit(100);
  res.json({
    items: items.map((item) => ({
      id: item.id,
      slug: item.slug,
      name: item.name,
      description: item.description,
      activityType: item.activityType,
      targetDistanceMeters: item.targetDistanceMeters,
      targetCount: item.targetCount,
      visibility: item.visibility,
      startAt: item.startAt,
      endAt: item.endAt,
      progressDistanceMeters: item.participantProgress ?? 0,
      progressCount: item.participantCountProgress ?? 0,
      completedAt: item.participantCompletedAt,
    })),
  });
});

router.post("/pace/challenges/:challengeId/join", async (req, res): Promise<void> => {
  const userId = await requireChatAuth(req, res);
  if (userId === null) return;
  const challengeId = parseId(req.params.challengeId);
  if (!challengeId) {
    res.status(400).json({ error: "Invalid challenge id." });
    return;
  }
  const [challenge] = await db
    .select({ id: paceChallengesTable.id })
    .from(paceChallengesTable)
    .where(eq(paceChallengesTable.id, challengeId))
    .limit(1);
  if (!challenge) {
    res.status(404).json({ error: "Challenge not found." });
    return;
  }
  await db
    .insert(paceChallengeParticipantsTable)
    .values({
      challengeId,
      userId,
      progressDistanceMeters: 0,
      progressCount: 0,
      updatedAt: Date.now(),
    })
    .onConflictDoNothing({ target: [paceChallengeParticipantsTable.challengeId, paceChallengeParticipantsTable.userId] });
  res.json({ success: true });
});

router.get("/pace/challenges/:challengeId/leaderboard", async (req, res): Promise<void> => {
  const userId = await requireChatAuth(req, res);
  if (userId === null) return;
  const challengeId = parseId(req.params.challengeId);
  if (!challengeId) {
    res.status(400).json({ error: "Invalid challenge id." });
    return;
  }
  const scope = req.query.scope === "friends" ? "friends" : "all";
  const rows = await db
    .select({
      userId: paceChallengeParticipantsTable.userId,
      progressDistanceMeters: paceChallengeParticipantsTable.progressDistanceMeters,
      progressCount: paceChallengeParticipantsTable.progressCount,
      completedAt: paceChallengeParticipantsTable.completedAt,
      username: usersTable.username,
      name: usersTable.name,
      avatarObjectPath: usersTable.avatarObjectPath,
    })
    .from(paceChallengeParticipantsTable)
    .innerJoin(usersTable, eq(usersTable.id, paceChallengeParticipantsTable.userId))
    .where(eq(paceChallengeParticipantsTable.challengeId, challengeId))
    .orderBy(desc(paceChallengeParticipantsTable.progressDistanceMeters), asc(paceChallengeParticipantsTable.updatedAt))
    .limit(200);
  const entries = scope === "friends"
    ? (await (async () => {
      const following = await db
        .select({ followingId: socialFollowsTable.followingId })
        .from(socialFollowsTable)
        .where(eq(socialFollowsTable.followerId, userId));
      const ids = new Set(following.map((item) => item.followingId));
      return rows.filter((item) => ids.has(item.userId) || item.userId === userId);
    })())
    : rows;
  res.json({
    scope,
    entries: entries.map((item, index) => ({
      rank: index + 1,
      user: {
        id: item.userId,
        username: item.username,
        name: item.name,
        avatarObjectPath: item.avatarObjectPath,
      },
      progressDistanceMeters: item.progressDistanceMeters,
      progressCount: item.progressCount,
      completedAt: item.completedAt,
    })),
  });
});

router.get("/pace/nearby", async (req, res): Promise<void> => {
  const userId = await requireChatAuth(req, res);
  if (userId === null) return;
  const latitude = parseGeo(req.query.latitude);
  const longitude = parseGeo(req.query.longitude);
  const radiusKm = Math.min(100, Math.max(0.2, parseGeo(req.query.radiusKm) ?? 5));
  const center = latitude !== null && longitude !== null ? { latitude, longitude } : null;
  const latestSequence = db
    .select({
      activityId: paceActivityPointsTable.activityId,
      maxSequence: sql<number>`max(${paceActivityPointsTable.sequence})::int`,
    })
    .from(paceActivityPointsTable)
    .groupBy(paceActivityPointsTable.activityId)
    .as("latest_sequence");
  const points = await db
    .select({
      activityType: paceActivitiesTable.activityType,
      latitude: paceActivityPointsTable.latitude,
      longitude: paceActivityPointsTable.longitude,
    })
    .from(paceActivitiesTable)
    .innerJoin(latestSequence, eq(latestSequence.activityId, paceActivitiesTable.id))
    .innerJoin(
      paceActivityPointsTable,
      and(
        eq(paceActivityPointsTable.activityId, latestSequence.activityId),
        eq(paceActivityPointsTable.sequence, latestSequence.maxSequence),
      ),
    )
    .where(
      and(
        ne(paceActivitiesTable.userId, userId),
        eq(paceActivitiesTable.visibility, "public"),
        eq(paceActivitiesTable.lifecycleStatus, "active"),
      ),
    );
  const counts = new Map<string, number>();
  for (const point of points) {
    if (center) {
      const km = distanceMeters(center, { latitude: point.latitude, longitude: point.longitude }) / 1000;
      if (km > radiusKm) continue;
    }
    counts.set(point.activityType, (counts.get(point.activityType) ?? 0) + 1);
  }
  res.json({
    items: [...counts.entries()].map(([activityType, count]) => ({ activityType, count })),
  });
});

export default router;
