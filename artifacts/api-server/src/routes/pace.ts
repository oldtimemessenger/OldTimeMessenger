import { Router, type IRouter } from "express";
import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { z } from "@workspace/api-zod";
import {
  db,
  currentEventWalletsTable,
  paceCommentLikesTable,
  paceRouteCommentsTable,
  paceRouteExercisesTable,
  paceRouteGiftsTable,
  paceRouteLikesTable,
  paceRoutesTable,
  paceDiscoveryHistoryTable,
  virtualCurrencyLedgerTable,
  socialBlocksTable,
  usersTable,
} from "@workspace/db";
import { requireChatAuth } from "../lib/chat-auth";
import { giftPrices, requestIdempotencyKey } from "../lib/money";
import { ensureWalletWithLedger } from "../lib/wallet-ledger";

const router: IRouter = Router();
const routePoint = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
});
const exerciseInput = z.object({
  name: z.string().trim().min(1).max(80),
  sets: z.number().int().min(1).max(100),
  reps: z.number().int().min(1).max(500),
  weight: z.number().finite().min(0).max(10_000).nullable().optional(),
});
const routeInput = z.object({
  title: z.string().trim().min(2).max(80),
  description: z.string().trim().max(800).default(""),
  kind: z.enum(["route", "challenge"]).default("route"),
  visibility: z.enum(["public", "private"]).optional(),
  audience: z.enum(["community", "public"]).optional(),
  activity: z.enum(["run", "walk", "bike", "hike", "jog", "swim", "strength", "yoga", "dance", "skate"]).default("run"),
  activityGroup: z.enum(["distance", "ride", "swim", "studio", "strength"]).optional(),
  difficulty: z.enum(["easy", "steady", "hard"]).default("steady"),
  distanceKm: z.number().finite().min(0).max(250),
  elevationM: z.number().int().min(0).max(10_000).default(0),
  durationMin: z.number().int().positive().max(1_440),
  calories: z.number().int().min(0).max(100_000).nullable().optional(),
  startLatitude: z.number().finite().min(-90).max(90).default(0),
  startLongitude: z.number().finite().min(-180).max(180).default(0),
  locationLabel: z.string().trim().min(2).max(120).default("Nearby"),
  routeCoordinates: z.array(routePoint).max(120).default([]),
  exerciseLog: z.array(exerciseInput).max(30).default([]),
}).superRefine((input, context) => {
  const group = input.activityGroup ?? activityGroupFor(input.activity);
  if (group !== "studio" && group !== "strength" && input.routeCoordinates.length < 2) {
    context.addIssue({ code: "custom", path: ["routeCoordinates"], message: "A route needs at least two points." });
  }
  if (group !== "studio" && group !== "strength" && input.distanceKm <= 0) {
    context.addIssue({ code: "custom", path: ["distanceKm"], message: "A route needs a positive distance." });
  }
  if (group === "strength" && input.exerciseLog.length === 0) {
    context.addIssue({ code: "custom", path: ["exerciseLog"], message: "Strength activities need at least one exercise." });
  }
});
const commentInput = z.object({ content: z.string().trim().min(1).max(1_000) });
const giftInput = z.object({ gift: z.enum(["coffee", "idea", "heart", "gem", "studio", "time_is_up"]) });

type PaceRoute = typeof paceRoutesTable.$inferSelect;
type Point = { latitude: number; longitude: number };
type PaceActivityGroup = "distance" | "ride" | "swim" | "studio" | "strength";
type PaceExercise = { name: string; sets: number; reps: number; weight?: number | null };

function parseId(value: unknown) {
  const parsed = z.coerce.number().int().positive().safeParse(value);
  return parsed.success ? parsed.data : null;
}

function usernameFor(user: { id: number; name: string; username?: string | null }) {
  return user.username || user.name.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 18) || `user${user.id}`;
}

function distanceKm(left: Point, right: Point) {
  const radians = (value: number) => value * Math.PI / 180;
  const deltaLatitude = radians(right.latitude - left.latitude);
  const deltaLongitude = radians(right.longitude - left.longitude);
  const a = Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(radians(left.latitude)) * Math.cos(radians(right.latitude)) * Math.sin(deltaLongitude / 2) ** 2;
  return 6_371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type PaceActivity = "run" | "walk" | "bike" | "hike" | "jog" | "swim" | "strength" | "yoga" | "dance" | "skate";

const PACE_ACTIVITIES: PaceActivity[] = ["run", "walk", "bike", "hike", "jog", "swim", "strength", "yoga", "dance", "skate"];
const DISCOVERY_ADJECTIVES = ["Quiet", "Golden", "Riverside", "Northside", "Open", "First Light", "Long Way", "Easy", "Tempo", "Parkline", "Cedar", "Harbor", "Sunset", "Neighborhood", "Bright", "Steady", "Meadow", "Old Town", "West Loop", "Morning", "Low-Key", "Fresh Air", "Highline", "Sunday"];
const DISCOVERY_NOUNS = ["Loop", "Out-and-Back", "Circuit", "Cruise", "Climb", "Wander", "Reset", "Connector", "Explorer", "Figure Eight", "Greenway", "Tour", "Arc", "Path", "Link", "Drift", "Runway", "Passage", "Ladder", "Circuit"];
const DISTANCE_OPTIONS = [1.8, 2.4, 3.1, 3.8, 4.6, 5.2, 6.1, 7.4, 8.6, 9.8, 11.2, 12.6, 14.5, 16.8, 19.4, 22.1, 25.7, 31.5, 38.4, 46.2];
const ACTIVITY_SPEEDS: Record<PaceActivity, number> = { run: 8.6, walk: 4.9, bike: 19.5, hike: 4.2, jog: 7.1, swim: 2.6, strength: 1, yoga: 1, dance: 3.8, skate: 12.5 };
const ACTIVITY_ELEVATION: Record<PaceActivity, number> = { run: 9, walk: 6, bike: 12, hike: 28, jog: 8, swim: 0, strength: 0, yoga: 0, dance: 0, skate: 4 };
const ACTIVITY_GROUPS: Record<PaceActivity, PaceActivityGroup> = {
  run: "distance", walk: "distance", hike: "distance", jog: "distance",
  bike: "ride", skate: "ride", swim: "swim", dance: "studio", yoga: "studio", strength: "strength",
};
const CALORIES_PER_MINUTE: Record<PaceActivityGroup, number> = {
  distance: 10, ride: 9, swim: 8, studio: 7, strength: 6,
};
// The catalog has more than 200 million deterministic combinations before per-user history is applied.

function activityGroupFor(activity: PaceActivity): PaceActivityGroup {
  return ACTIVITY_GROUPS[activity];
}

function caloriesFor(activity: PaceActivity, durationMin: number) {
  return Math.max(1, Math.round(durationMin * CALORIES_PER_MINUTE[activityGroupFor(activity)]));
}

function seededNumber(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43_758.5453;
  return value - Math.floor(value);
}

function suggestedCoordinates(center: Point, distance: number, seed: number): Point[] {
  const radius = Math.max(0.008, distance / 111 / 2);
  const longitudeRadius = radius / Math.max(0.25, Math.cos(center.latitude * Math.PI / 180));
  const phase = seededNumber(seed) * Math.PI * 2;
  const shape = [
    [0, 0],
    [0.85, 0.15],
    [0.7, 0.8],
    [-0.25, 1],
    [-0.95, 0.45],
    [-0.72, -0.35],
    [0, 0],
  ];
  return shape.map(([x, y]) => ({
    latitude: center.latitude + Math.sin(phase) * radius * 0.16 + y * radius - radius * 0.45,
    longitude: center.longitude + Math.cos(phase) * longitudeRadius * 0.16 + x * longitudeRadius,
  }));
}

async function buildSuggestions(center: Point | null, viewerId: number, requestedActivity: PaceActivity, requestedExclusions: string[] = []) {
  const globalCenters = [
    { label: "Sydney, Australia", latitude: -33.8688, longitude: 151.2093 },
    { label: "Manchester, UK", latitude: 53.4808, longitude: -2.2426 },
    { label: "Nairobi, Kenya", latitude: -1.2921, longitude: 36.8219 },
    { label: "Tokyo, Japan", latitude: 35.6762, longitude: 139.6503 },
    { label: "São Paulo, Brazil", latitude: -23.5505, longitude: -46.6333 },
    { label: "Toronto, Canada", latitude: 43.6532, longitude: -79.3832 },
    { label: "Paris, France", latitude: 48.8566, longitude: 2.3522 },
  ] as const;
  const hourBucket = Math.floor(Date.now() / 3_600_000);
  const locationCell = center ? `${Math.round(center.latitude * 100)}:${Math.round(center.longitude * 100)}` : "global";
  const activityIndex = Math.max(0, PACE_ACTIVITIES.indexOf(requestedActivity));
  const baseSeed = Math.abs(Math.round(viewerId * 7919 + activityIndex * 104729 + hourBucket * 37 + [...locationCell].reduce((sum, char) => sum + char.charCodeAt(0), 0)));
  const historical = await db.select({ suggestionId: paceDiscoveryHistoryTable.suggestionId })
    .from(paceDiscoveryHistoryTable)
    .where(eq(paceDiscoveryHistoryTable.userId, viewerId))
    .orderBy(desc(paceDiscoveryHistoryTable.seenAt))
    .limit(2_000);
  const excluded = new Set([...historical.map((row) => row.suggestionId), ...requestedExclusions]);
  const activity = requestedActivity;
  const centerPoint = center ?? globalCenters[baseSeed % globalCenters.length];
  const results: Array<Record<string, unknown>> = [];
  for (let index = 0; index < 96 && results.length < 6; index += 1) {
    const variant = Math.abs(baseSeed + index * 104729);
    const group = activityGroupFor(activity);
    const distanceKmValue = group === "studio" || group === "strength"
      ? 0
      : group === "swim"
        ? [0.2, 0.4, 0.6, 0.8, 1.0, 1.5][variant % 6]
        : DISTANCE_OPTIONS[variant % DISTANCE_OPTIONS.length];
    const elevationM = group === "distance" || group === "ride"
      ? Math.round(distanceKmValue * ACTIVITY_ELEVATION[activity] * (0.55 + seededNumber(variant + 7) * 1.2))
      : 0;
    const durationMin = group === "strength"
      ? 30 + (variant % 4) * 10
      : group === "studio"
        ? 25 + (variant % 5) * 10
        : Math.max(5, Math.round(distanceKmValue / ACTIVITY_SPEEDS[activity] * 60 * (0.92 + seededNumber(variant + 13) * 0.18)));
    const difficulty = elevationM / Math.max(distanceKmValue, 1) > 18 ? "hard" : distanceKmValue > 8 ? "steady" : "easy";
    const id = `suggested-${viewerId}-${locationCell}-${activity}-${variant}`;
    if (excluded.has(id)) continue;
    const adjective = DISCOVERY_ADJECTIVES[variant % DISCOVERY_ADJECTIVES.length];
    const noun = DISCOVERY_NOUNS[Math.floor(variant / DISCOVERY_ADJECTIVES.length) % DISCOVERY_NOUNS.length];
    results.push({
      id,
      suggested: true as const,
      kind: "route" as const,
      visibility: "public" as const,
      audience: "community" as const,
      title: `${adjective} ${noun}`,
      activity,
      activityGroup: group,
      distanceKm: distanceKmValue,
      elevationM,
      durationMin,
      calories: caloriesFor(activity, durationMin),
      difficulty,
      description: `${ACTIVITY_LABELS[activity]} idea with a different shape for this area and this moment. Save it only if it feels right.`,
      locationLabel: center ? "Near your current area" : globalCenters[variant % globalCenters.length].label,
      distanceFromYouKm: center ? 0 : null,
      routeCoordinates: group === "distance" || group === "ride" || group === "swim"
        ? suggestedCoordinates(centerPoint, distanceKmValue || 1, variant)
        : [],
    });
  }
  return results;
}

const ACTIVITY_LABELS: Record<PaceActivity, string> = { run: "Run", walk: "Walk", bike: "Ride", hike: "Hike", jog: "Jog", swim: "Swim", strength: "Strength", yoga: "Yoga", dance: "Dance", skate: "Skate" };

async function blockedIds(viewerId: number) {
  const rows = await db
    .select()
    .from(socialBlocksTable)
    .where(orBlocks(viewerId));
  return new Set(rows.map((row) => row.blockerId === viewerId ? row.blockedId : row.blockerId));
}

function orBlocks(viewerId: number) {
  return sql`${socialBlocksTable.blockerId} = ${viewerId} OR ${socialBlocksTable.blockedId} = ${viewerId}`;
}

async function activeRoute(routeId: number, viewerId?: number) {
  const [route] = await db
    .select()
    .from(paceRoutesTable)
    .where(and(
      eq(paceRoutesTable.id, routeId),
      eq(paceRoutesTable.deleted, false),
      viewerId === undefined
        ? sql`(${paceRoutesTable.audience} = 'public' OR ${paceRoutesTable.visibility} = 'public')`
        : sql`((${paceRoutesTable.audience} IN ('community', 'public') OR ${paceRoutesTable.visibility} = 'public') OR ${paceRoutesTable.authorId} = ${viewerId})`,
    ))
    .limit(1);
  return route;
}

async function serializeRoutes(routes: PaceRoute[], viewerId: number, origin: Point | null) {
  if (!routes.length) return [];
  const ids = routes.map((route) => route.id);
  const authorIds = [...new Set(routes.map((route) => route.authorId))];
  const [authors, likes, comments, gifts, viewerLikes, exercises] = await Promise.all([
    db.select({ id: usersTable.id, name: usersTable.name, username: usersTable.username, avatarObjectPath: usersTable.avatarObjectPath }).from(usersTable).where(inArray(usersTable.id, authorIds)),
    db.select({ routeId: paceRouteLikesTable.routeId, count: sql<number>`count(*)` }).from(paceRouteLikesTable).where(inArray(paceRouteLikesTable.routeId, ids)).groupBy(paceRouteLikesTable.routeId),
    db.select({ routeId: paceRouteCommentsTable.routeId, count: sql<number>`count(*)` }).from(paceRouteCommentsTable).where(and(inArray(paceRouteCommentsTable.routeId, ids), eq(paceRouteCommentsTable.deleted, false))).groupBy(paceRouteCommentsTable.routeId),
    db.select({ routeId: paceRouteGiftsTable.routeId, count: sql<number>`count(*)` }).from(paceRouteGiftsTable).where(inArray(paceRouteGiftsTable.routeId, ids)).groupBy(paceRouteGiftsTable.routeId),
    db.select({ routeId: paceRouteLikesTable.routeId }).from(paceRouteLikesTable).where(and(eq(paceRouteLikesTable.userId, viewerId), inArray(paceRouteLikesTable.routeId, ids))),
    db.select().from(paceRouteExercisesTable).where(inArray(paceRouteExercisesTable.routeId, ids)).orderBy(asc(paceRouteExercisesTable.sortOrder)),
  ]);
  const authorById = new Map(authors.map((author) => [author.id, author]));
  const countBy = (rows: Array<{ routeId: number; count: number }>) => new Map(rows.map((row) => [row.routeId, Number(row.count)]));
  const liked = new Set(viewerLikes.map((row) => row.routeId));
  const likeCounts = countBy(likes);
  const commentCounts = countBy(comments);
  const giftCounts = countBy(gifts);
  const exercisesByRoute = new Map<number, PaceExercise[]>();
  for (const exercise of exercises) {
    const existing = exercisesByRoute.get(exercise.routeId) ?? [];
    existing.push({ name: exercise.name, sets: exercise.sets, reps: exercise.reps, weight: exercise.weight });
    exercisesByRoute.set(exercise.routeId, existing);
  }
  return routes.map((route) => {
    const author = authorById.get(route.authorId);
    return {
      id: route.id,
      suggested: false,
      title: route.title,
      description: route.description,
      kind: route.kind,
      visibility: route.visibility === "private" ? "private" : (route.audience === "public" ? "public" : "community"),
      audience: route.visibility === "private" ? "community" : (route.audience === "public" ? "public" : "community"),
      activity: route.activity,
      activityGroup: route.activityGroup || activityGroupFor(route.activity as PaceActivity),
      difficulty: route.difficulty,
      distanceKm: route.distanceKm,
      elevationM: route.elevationM,
      durationMin: route.durationMin,
      calories: route.calories ?? caloriesFor(route.activity as PaceActivity, route.durationMin),
      exerciseLog: exercisesByRoute.get(route.id) ?? [],
      startLatitude: route.startLatitude,
      startLongitude: route.startLongitude,
      locationLabel: route.locationLabel,
      routeCoordinates: route.routeCoordinates,
      createdAt: route.createdAt,
      author: author
        ? { id: author.id, name: author.name, username: usernameFor(author), avatarObjectPath: author.avatarObjectPath }
        : { id: route.authorId, name: "Old Time member", username: `user${route.authorId}`, avatarObjectPath: null },
      distanceFromYouKm: origin ? distanceKm(origin, { latitude: route.startLatitude, longitude: route.startLongitude }) : null,
      counts: {
        likes: likeCounts.get(route.id) ?? 0,
        comments: commentCounts.get(route.id) ?? 0,
        gifts: giftCounts.get(route.id) ?? 0,
      },
      viewer: { liked: liked.has(route.id), isOwner: route.authorId === viewerId },
    };
  });
}

router.get("/pace/feed", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res);
  if (viewerId === null) return;
  const query = z.object({
    latitude: z.coerce.number().finite().min(-90).max(90).optional(),
    longitude: z.coerce.number().finite().min(-180).max(180).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(30),
    activity: z.enum(["run", "walk", "bike", "hike", "jog", "swim", "strength", "yoga", "dance", "skate"]).default("run"),
    mode: z.enum(["community", "for-you"]).default("community"),
    exclude: z.string().trim().max(20_000).optional(),
  }).safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "Valid location coordinates are required." });
    return;
  }
  const origin = query.data.latitude !== undefined && query.data.longitude !== undefined
    ? { latitude: query.data.latitude, longitude: query.data.longitude }
    : null;
  const blocked = await blockedIds(viewerId);
  const audienceCondition = query.data.mode === "for-you"
    ? sql`(${paceRoutesTable.audience} = 'public' OR ${paceRoutesTable.visibility} = 'public')`
    : sql`(${paceRoutesTable.visibility} <> 'private' OR ${paceRoutesTable.authorId} = ${viewerId})`;
  const routes = await db.select().from(paceRoutesTable).where(and(
    eq(paceRoutesTable.deleted, false),
    audienceCondition,
  )).orderBy(desc(paceRoutesTable.createdAt)).limit(query.data.limit * 2);
  const visible = routes
    .filter((route) => !blocked.has(route.authorId))
    .filter((route) => !origin || distanceKm(origin, { latitude: route.startLatitude, longitude: route.startLongitude }) <= 80)
    .slice(0, query.data.limit);
  const exclusions = query.data.exclude?.split(",").filter(Boolean).slice(0, 500) ?? [];
  res.json({ items: await serializeRoutes(visible, viewerId, origin), suggestions: await buildSuggestions(origin, viewerId, query.data.activity, exclusions) });
});

router.post("/pace/suggestions/:suggestionId/impression", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res);
  if (viewerId === null) return;
  const suggestionId = String(req.params.suggestionId || "").trim();
  const parsed = z.object({
    activity: z.enum(["run", "walk", "bike", "hike", "jog", "swim", "strength", "yoga", "dance", "skate"]),
    locationCell: z.string().trim().max(80).optional(),
  }).safeParse(req.body);
  if (!suggestionId.startsWith(`suggested-${viewerId}-`) || !parsed.success) {
    res.status(400).json({ error: "Invalid Pace suggestion." });
    return;
  }
  await db.insert(paceDiscoveryHistoryTable).values({
    userId: viewerId,
    suggestionId,
    activity: parsed.data.activity,
    locationCell: parsed.data.locationCell ?? null,
    seenAt: Date.now(),
  }).onConflictDoNothing();
  res.status(204).send();
});

router.post("/pace/routes", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res);
  if (viewerId === null) return;
  const parsed = routeInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Add a title, activity, distance, location, and route before sharing." });
    return;
  }
  const now = Date.now();
  const { exerciseLog, audience: requestedAudience, visibility: legacyVisibility, activityGroup: requestedGroup, ...routeValues } = parsed.data;
  const audience = requestedAudience ?? (legacyVisibility === "public" ? "public" : "community");
  const activityGroup = requestedGroup ?? activityGroupFor(routeValues.activity);
  const [route] = await db.insert(paceRoutesTable).values({
    ...routeValues,
    authorId: viewerId,
    visibility: legacyVisibility === "private" ? "private" : audience,
    audience,
    activityGroup,
    calories: routeValues.calories ?? caloriesFor(routeValues.activity, routeValues.durationMin),
    createdAt: now,
    updatedAt: now,
  }).returning();
  if (exerciseLog.length) {
    await db.insert(paceRouteExercisesTable).values(exerciseLog.map((exercise, index) => ({ ...exercise, routeId: route.id, sortOrder: index })));
  }
  res.status(201).json((await serializeRoutes([route], viewerId, { latitude: route.startLatitude, longitude: route.startLongitude }))[0]);
});

router.get("/pace/preferences", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res);
  if (viewerId === null) return;
  const [user] = await db.select({ paceDefaultAudience: usersTable.paceDefaultAudience }).from(usersTable).where(eq(usersTable.id, viewerId)).limit(1);
  res.json({ defaultAudience: user?.paceDefaultAudience === "public" ? "public" : "community" });
});

router.put("/pace/preferences", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res);
  if (viewerId === null) return;
  const parsed = z.object({ defaultAudience: z.enum(["community", "public"]) }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Choose Community or Public." });
    return;
  }
  await db.update(usersTable).set({ paceDefaultAudience: parsed.data.defaultAudience }).where(eq(usersTable.id, viewerId));
  res.json(parsed.data);
});

router.put("/pace/routes/:routeId/like", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res);
  const routeId = parseId(req.params.routeId);
  if (viewerId === null || routeId === null) return;
  const route = await activeRoute(routeId, viewerId);
  if (!route) { res.status(404).json({ error: "Route not found." }); return; }
  await db.insert(paceRouteLikesTable).values({ routeId, userId: viewerId, createdAt: Date.now() }).onConflictDoNothing();
  res.json({ success: true, active: true });
});

router.delete("/pace/routes/:routeId/like", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res);
  const routeId = parseId(req.params.routeId);
  if (viewerId === null || routeId === null) return;
  await db.delete(paceRouteLikesTable).where(and(eq(paceRouteLikesTable.routeId, routeId), eq(paceRouteLikesTable.userId, viewerId)));
  res.json({ success: true, active: false });
});

router.get("/pace/routes/:routeId/comments", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res);
  const routeId = parseId(req.params.routeId);
  if (viewerId === null || routeId === null) return;
  if (!await activeRoute(routeId, viewerId)) { res.status(404).json({ error: "Route not found." }); return; }
  const rows = await db
    .select({
      id: paceRouteCommentsTable.id,
      routeId: paceRouteCommentsTable.routeId,
      authorId: paceRouteCommentsTable.authorId,
      content: paceRouteCommentsTable.content,
      createdAt: paceRouteCommentsTable.createdAt,
      authorName: usersTable.name,
      username: usersTable.username,
      likeCount: sql<number>`count(${paceCommentLikesTable.commentId})`,
    })
    .from(paceRouteCommentsTable)
    .innerJoin(usersTable, eq(usersTable.id, paceRouteCommentsTable.authorId))
    .leftJoin(paceCommentLikesTable, eq(paceCommentLikesTable.commentId, paceRouteCommentsTable.id))
    .where(and(eq(paceRouteCommentsTable.routeId, routeId), eq(paceRouteCommentsTable.deleted, false)))
    .groupBy(paceRouteCommentsTable.id, usersTable.id)
    .orderBy(asc(paceRouteCommentsTable.createdAt));
  const viewerLikes = await db.select({ commentId: paceCommentLikesTable.commentId }).from(paceCommentLikesTable).where(and(eq(paceCommentLikesTable.userId, viewerId), inArray(paceCommentLikesTable.commentId, rows.map((row) => row.id))));
  const liked = new Set(viewerLikes.map((row) => row.commentId));
  res.json({ items: rows.map((row) => ({ id: row.id, routeId: row.routeId, content: row.content, createdAt: row.createdAt, author: { id: row.authorId, name: row.authorName, username: usernameFor({ id: row.authorId, name: row.authorName, username: row.username }) }, likes: Number(row.likeCount), liked: liked.has(row.id) })) });
});

router.post("/pace/routes/:routeId/comments", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res);
  const routeId = parseId(req.params.routeId);
  const parsed = commentInput.safeParse(req.body);
  if (viewerId === null || routeId === null || !parsed.success) return;
  if (!await activeRoute(routeId, viewerId)) { res.status(404).json({ error: "Route not found." }); return; }
  const [comment] = await db.insert(paceRouteCommentsTable).values({ routeId, authorId: viewerId, content: parsed.data.content, createdAt: Date.now() }).returning();
  const [author] = await db.select({ id: usersTable.id, name: usersTable.name, username: usersTable.username }).from(usersTable).where(eq(usersTable.id, viewerId)).limit(1);
  res.status(201).json({ id: comment.id, routeId, content: comment.content, createdAt: comment.createdAt, author: { id: author.id, name: author.name, username: usernameFor(author) }, likes: 0, liked: false });
});

router.put("/pace/comments/:commentId/like", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res);
  const commentId = parseId(req.params.commentId);
  if (viewerId === null || commentId === null) return;
  await db.insert(paceCommentLikesTable).values({ commentId, userId: viewerId, createdAt: Date.now() }).onConflictDoNothing();
  res.json({ success: true, active: true });
});

router.delete("/pace/comments/:commentId/like", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res);
  const commentId = parseId(req.params.commentId);
  if (viewerId === null || commentId === null) return;
  await db.delete(paceCommentLikesTable).where(and(eq(paceCommentLikesTable.commentId, commentId), eq(paceCommentLikesTable.userId, viewerId)));
  res.json({ success: true, active: false });
});

router.post("/pace/routes/:routeId/gifts", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res);
  const routeId = parseId(req.params.routeId);
  const parsed = giftInput.safeParse(req.body);
  if (viewerId === null || routeId === null || !parsed.success) return;
  const idempotencyKey = requestIdempotencyKey(req, viewerId, "pace-gift");
  if (!idempotencyKey) {
    res.status(400).json({ error: "A unique gift request key is required. Please try again." });
    return;
  }
  const route = await activeRoute(routeId, viewerId);
  if (!route || route.authorId === viewerId) {
    res.status(400).json({ error: "Choose a route shared by another Pace member." });
    return;
  }
  const [existingGift] = await db.select().from(paceRouteGiftsTable)
    .where(eq(paceRouteGiftsTable.idempotencyKey, idempotencyKey)).limit(1);
  if (existingGift) {
    if (existingGift.routeId !== routeId || existingGift.gift !== parsed.data.gift) {
      res.status(409).json({ error: "That gift request key was already used for another gift." });
      return;
    }
    const [wallet] = await db.select({ coins: currentEventWalletsTable.coins })
      .from(currentEventWalletsTable).where(eq(currentEventWalletsTable.userId, viewerId)).limit(1);
    res.json({ success: true, gift: existingGift.gift, coinsSpent: existingGift.coins, goldEarned: existingGift.gold, coinsRemaining: wallet?.coins ?? 0 });
    return;
  }
  const coins = giftPrices[parsed.data.gift];
  const gold = Math.floor(coins * 0.8);
  const result = await db.transaction(async (tx) => {
    await ensureWalletWithLedger(tx, viewerId);
    await ensureWalletWithLedger(tx, route.authorId);
    const [debited] = await tx.update(currentEventWalletsTable)
      .set({ coins: sql`${currentEventWalletsTable.coins} - ${coins}`, updatedAt: Date.now() })
      .where(and(eq(currentEventWalletsTable.userId, viewerId), gte(currentEventWalletsTable.coins, coins)))
      .returning({ coins: currentEventWalletsTable.coins });
    if (!debited) return null;
    const [credited] = await tx.update(currentEventWalletsTable)
      .set({ gold: sql`${currentEventWalletsTable.gold} + ${gold}`, updatedAt: Date.now() })
      .where(eq(currentEventWalletsTable.userId, route.authorId))
      .returning({ gold: currentEventWalletsTable.gold });
    if (!credited) throw new Error("Recipient wallet is unavailable.");
    const [gift] = await tx.insert(paceRouteGiftsTable).values({
      routeId,
      senderId: viewerId,
      recipientId: route.authorId,
      gift: parsed.data.gift,
      idempotencyKey,
      coins,
      gold,
      createdAt: Date.now(),
    }).returning();
    await tx.insert(virtualCurrencyLedgerTable).values([
      {
        idempotencyKey: `${idempotencyKey}:sender`,
        userId: viewerId,
        account: "coins",
        delta: -coins,
        balanceAfter: debited.coins,
        entryType: "pace_gift_spend",
        referenceId: String(gift.id),
        relatedUserId: route.authorId,
        createdAt: Date.now(),
      },
      {
        idempotencyKey: `${idempotencyKey}:recipient`,
        userId: route.authorId,
        account: "gold",
        delta: gold,
        balanceAfter: credited.gold,
        entryType: "pace_gift_earn",
        referenceId: String(gift.id),
        relatedUserId: viewerId,
        createdAt: Date.now(),
      },
    ]);
    return { gift, coinsRemaining: debited.coins };
  });
  if (!result) { res.status(402).json({ error: "You need more Coins to send this gift." }); return; }
  res.json({ success: true, gift: parsed.data.gift, coinsSpent: coins, goldEarned: gold, coinsRemaining: result.coinsRemaining });
});

export default router;