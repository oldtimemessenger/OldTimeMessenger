import { Router, type IRouter } from "express";
import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { z } from "@workspace/api-zod";
import {
  db,
  currentEventWalletsTable,
  paceCommentLikesTable,
  paceRouteCommentsTable,
  paceRouteGiftsTable,
  paceRouteLikesTable,
  paceRoutesTable,
  socialBlocksTable,
  usersTable,
} from "@workspace/db";
import { requireChatAuth } from "../lib/chat-auth";

const router: IRouter = Router();
const routePoint = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
});
const routeInput = z.object({
  title: z.string().trim().min(2).max(80),
  description: z.string().trim().max(800).default(""),
  kind: z.enum(["route", "challenge"]).default("route"),
  visibility: z.enum(["public", "private"]).default("public"),
  activity: z.enum(["run", "walk", "bike", "hike"]).default("run"),
  difficulty: z.enum(["easy", "steady", "hard"]).default("steady"),
  distanceKm: z.number().finite().positive().max(250),
  elevationM: z.number().int().min(0).max(10_000).default(0),
  durationMin: z.number().int().positive().max(1_440),
  startLatitude: z.number().finite().min(-90).max(90),
  startLongitude: z.number().finite().min(-180).max(180),
  locationLabel: z.string().trim().min(2).max(120).default("Nearby"),
  routeCoordinates: z.array(routePoint).min(2).max(120),
});
const commentInput = z.object({ content: z.string().trim().min(1).max(1_000) });
const giftInput = z.object({ gift: z.enum(["coffee", "idea", "heart", "gem", "studio", "time_is_up"]) });
const giftPrices = { coffee: 25, idea: 100, heart: 200, gem: 500, studio: 1_000, time_is_up: 10_000 } as const;

type PaceRoute = typeof paceRoutesTable.$inferSelect;
type Point = { latitude: number; longitude: number };

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

function buildSuggestions(center: Point | null) {
  const templates = [
    { title: "The Reset Loop", activity: "run", distanceKm: 4.8, elevationM: 42, durationMin: 31, difficulty: "steady", description: "A balanced loop for clearing your head and finding a steady rhythm." },
    { title: "Golden Hour Out-and-Back", activity: "walk", distanceKm: 3.2, elevationM: 18, durationMin: 42, difficulty: "easy", description: "An easy route with room to slow down, notice the neighborhood, and keep moving." },
    { title: "The Long Way Home", activity: "bike", distanceKm: 12.6, elevationM: 118, durationMin: 45, difficulty: "hard", description: "A longer local push with enough elevation to make the finish feel earned." },
    { title: "Parkline Climb", activity: "hike", distanceKm: 6.1, elevationM: 164, durationMin: 78, difficulty: "hard", description: "A scenic climb for a more deliberate day outside." },
    { title: "Neighborhood Tempo", activity: "run", distanceKm: 7.4, elevationM: 63, durationMin: 44, difficulty: "steady", description: "A repeatable route that fits between real life and your next goal." },
  ] as const;
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
  const baseSeed = center
    ? Math.abs(Math.round(center.latitude * 97 + center.longitude * 193 + hourBucket))
    : Math.abs(hourBucket * 37 + 11);
  const ordered = [...templates].sort((left, right) => seededNumber(baseSeed + left.distanceKm) - seededNumber(baseSeed + right.distanceKm));
  return ordered.slice(0, 3).map((template, index) => ({
    id: `suggested-${baseSeed}-${index}`,
    suggested: true as const,
    kind: "route" as const,
    visibility: "public" as const,
    ...template,
    locationLabel: center ? "Near your current area" : globalCenters[(baseSeed + index) % globalCenters.length].label,
    distanceFromYouKm: center ? 0 : null,
    routeCoordinates: suggestedCoordinates(
      center ?? globalCenters[(baseSeed + index) % globalCenters.length],
      template.distanceKm,
      baseSeed + index,
    ),
  }));
}

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
      viewerId === undefined ? eq(paceRoutesTable.visibility, "public") : sql`(${paceRoutesTable.visibility} = 'public' OR ${paceRoutesTable.authorId} = ${viewerId})`,
    ))
    .limit(1);
  return route;
}

async function serializeRoutes(routes: PaceRoute[], viewerId: number, origin: Point | null) {
  if (!routes.length) return [];
  const ids = routes.map((route) => route.id);
  const authorIds = [...new Set(routes.map((route) => route.authorId))];
  const [authors, likes, comments, gifts, viewerLikes] = await Promise.all([
    db.select({ id: usersTable.id, name: usersTable.name, username: usersTable.username, avatarObjectPath: usersTable.avatarObjectPath }).from(usersTable).where(inArray(usersTable.id, authorIds)),
    db.select({ routeId: paceRouteLikesTable.routeId, count: sql<number>`count(*)` }).from(paceRouteLikesTable).where(inArray(paceRouteLikesTable.routeId, ids)).groupBy(paceRouteLikesTable.routeId),
    db.select({ routeId: paceRouteCommentsTable.routeId, count: sql<number>`count(*)` }).from(paceRouteCommentsTable).where(and(inArray(paceRouteCommentsTable.routeId, ids), eq(paceRouteCommentsTable.deleted, false))).groupBy(paceRouteCommentsTable.routeId),
    db.select({ routeId: paceRouteGiftsTable.routeId, count: sql<number>`count(*)` }).from(paceRouteGiftsTable).where(inArray(paceRouteGiftsTable.routeId, ids)).groupBy(paceRouteGiftsTable.routeId),
    db.select({ routeId: paceRouteLikesTable.routeId }).from(paceRouteLikesTable).where(and(eq(paceRouteLikesTable.userId, viewerId), inArray(paceRouteLikesTable.routeId, ids))),
  ]);
  const authorById = new Map(authors.map((author) => [author.id, author]));
  const countBy = (rows: Array<{ routeId: number; count: number }>) => new Map(rows.map((row) => [row.routeId, Number(row.count)]));
  const liked = new Set(viewerLikes.map((row) => row.routeId));
  const likeCounts = countBy(likes);
  const commentCounts = countBy(comments);
  const giftCounts = countBy(gifts);
  return routes.map((route) => {
    const author = authorById.get(route.authorId);
    return {
      id: route.id,
      suggested: false,
      title: route.title,
      description: route.description,
      kind: route.kind,
      visibility: route.visibility,
      activity: route.activity,
      difficulty: route.difficulty,
      distanceKm: route.distanceKm,
      elevationM: route.elevationM,
      durationMin: route.durationMin,
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
  }).safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "Valid location coordinates are required." });
    return;
  }
  const origin = query.data.latitude !== undefined && query.data.longitude !== undefined
    ? { latitude: query.data.latitude, longitude: query.data.longitude }
    : null;
  const blocked = await blockedIds(viewerId);
  const routes = await db.select().from(paceRoutesTable).where(and(
    eq(paceRoutesTable.deleted, false),
    sql`(${paceRoutesTable.visibility} = 'public' OR ${paceRoutesTable.authorId} = ${viewerId})`,
  )).orderBy(desc(paceRoutesTable.createdAt)).limit(query.data.limit * 2);
  const visible = routes
    .filter((route) => !blocked.has(route.authorId))
    .filter((route) => !origin || distanceKm(origin, { latitude: route.startLatitude, longitude: route.startLongitude }) <= 80)
    .slice(0, query.data.limit);
  res.json({ items: await serializeRoutes(visible, viewerId, origin), suggestions: buildSuggestions(origin) });
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
  const [route] = await db.insert(paceRoutesTable).values({ ...parsed.data, authorId: viewerId, createdAt: now, updatedAt: now }).returning();
  res.status(201).json((await serializeRoutes([route], viewerId, { latitude: route.startLatitude, longitude: route.startLongitude }))[0]);
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
  const route = await activeRoute(routeId, viewerId);
  if (!route || route.authorId === viewerId) {
    res.status(400).json({ error: "Choose a route shared by another Pace member." });
    return;
  }
  const coins = giftPrices[parsed.data.gift];
  const gold = Math.floor(coins * 0.8);
  const result = await db.transaction(async (tx) => {
    await tx.insert(currentEventWalletsTable).values({ userId: viewerId, updatedAt: Date.now() }).onConflictDoNothing();
    await tx.insert(currentEventWalletsTable).values({ userId: route.authorId, updatedAt: Date.now() }).onConflictDoNothing();
    const [debited] = await tx.update(currentEventWalletsTable)
      .set({ coins: sql`${currentEventWalletsTable.coins} - ${coins}`, updatedAt: Date.now() })
      .where(and(eq(currentEventWalletsTable.userId, viewerId), gte(currentEventWalletsTable.coins, coins)))
      .returning({ coins: currentEventWalletsTable.coins });
    if (!debited) return null;
    await tx.update(currentEventWalletsTable)
      .set({ gold: sql`${currentEventWalletsTable.gold} + ${gold}`, updatedAt: Date.now() })
      .where(eq(currentEventWalletsTable.userId, route.authorId));
    const [gift] = await tx.insert(paceRouteGiftsTable).values({ routeId, senderId: viewerId, recipientId: route.authorId, gift: parsed.data.gift, coins, gold, createdAt: Date.now() }).returning();
    return { gift, coinsRemaining: debited.coins };
  });
  if (!result) { res.status(402).json({ error: "You need more Coins to send this gift." }); return; }
  res.json({ success: true, gift: parsed.data.gift, coinsSpent: coins, goldEarned: gold, coinsRemaining: result.coinsRemaining });
});

export default router;