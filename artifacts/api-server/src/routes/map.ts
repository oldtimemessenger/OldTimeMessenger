import { Router, type IRouter } from "express";
import { and, asc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import { z } from "@workspace/api-zod";
import {
  db,
  mapPinCommentsTable,
  mapPinReactionsTable,
  mapPinReportsTable,
  mapPinSavesTable,
  mapPinsTable,
  socialBlocksTable,
  socialFollowsTable,
  socialSharingExclusionsTable,
  usersTable,
} from "@workspace/db";
import { requireChatAuth } from "../lib/chat-auth";

const router: IRouter = Router();
const visibility = z.enum(["public", "friends", "followers", "private"]);
const pinInput = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  caption: z.string().trim().max(280).optional(),
  visibility: visibility.default("friends"),
  expiresAt: z.number().int().positive().nullable().optional(),
});
const pinUpdate = pinInput.partial();
const commentInput = z.object({ content: z.string().trim().min(1).max(1_000) });
const reportInput = z.object({ reason: z.enum(["spam", "harassment", "other"]) });

function id(value: unknown) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}
function nameFor(user: { id: number; name: string; username?: string | null }) {
  if (user.username) return user.username;
  return user.name.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 18) || `user${user.id}`;
}
async function blockedIds(viewerId: number) {
  const rows = await db.select().from(socialBlocksTable).where(or(eq(socialBlocksTable.blockerId, viewerId), eq(socialBlocksTable.blockedId, viewerId)));
  return new Set(rows.map((row) => row.blockerId === viewerId ? row.blockedId : row.blockerId));
}
async function followingIds(viewerId: number) {
  const rows = await db.select({ id: socialFollowsTable.followingId }).from(socialFollowsTable).where(eq(socialFollowsTable.followerId, viewerId));
  return new Set(rows.map((row) => row.id));
}
async function canSee(viewerId: number, pin: typeof mapPinsTable.$inferSelect, following: Set<number>, blocked: Set<number>) {
  if (blocked.has(pin.authorId) || pin.deleted || (pin.expiresAt !== null && pin.expiresAt <= Date.now())) return false;
  if (pin.authorId === viewerId) return true;
  const [exclusion] = await db.select({ ownerId: socialSharingExclusionsTable.ownerId }).from(socialSharingExclusionsTable).where(and(eq(socialSharingExclusionsTable.ownerId, pin.authorId), eq(socialSharingExclusionsTable.excludedUserId, viewerId))).limit(1);
  if (exclusion) return false;
  if (pin.visibility === "public") return true;
  if (pin.visibility === "private" || !following.has(pin.authorId)) return false;
  if (pin.visibility === "followers") return true;
  const [reciprocal] = await db.select({ id: socialFollowsTable.followerId }).from(socialFollowsTable).where(and(eq(socialFollowsTable.followerId, pin.authorId), eq(socialFollowsTable.followingId, viewerId))).limit(1);
  return Boolean(reciprocal);
}
async function activePin(pinId: number) {
  const [pin] = await db.select().from(mapPinsTable).where(and(eq(mapPinsTable.id, pinId), eq(mapPinsTable.deleted, false), or(isNull(mapPinsTable.expiresAt), gt(mapPinsTable.expiresAt, Date.now())))).limit(1);
  return pin;
}
async function serialize(pins: Array<typeof mapPinsTable.$inferSelect>, viewerId: number, origin?: { latitude: number; longitude: number }) {
  if (!pins.length) return [];
  const ids = pins.map((pin) => pin.id);
  const authorIds = [...new Set(pins.map((pin) => pin.authorId))];
  const [authors, reactions, saves, comments, viewerReactions, viewerSaves] = await Promise.all([
    db.select({ id: usersTable.id, name: usersTable.name, username: usersTable.username }).from(usersTable).where(inArray(usersTable.id, authorIds)),
    db.select({ pinId: mapPinReactionsTable.pinId, count: sql<number>`count(*)` }).from(mapPinReactionsTable).where(inArray(mapPinReactionsTable.pinId, ids)).groupBy(mapPinReactionsTable.pinId),
    db.select({ pinId: mapPinSavesTable.pinId, count: sql<number>`count(*)` }).from(mapPinSavesTable).where(inArray(mapPinSavesTable.pinId, ids)).groupBy(mapPinSavesTable.pinId),
    db.select({ pinId: mapPinCommentsTable.pinId, count: sql<number>`count(*)` }).from(mapPinCommentsTable).where(and(inArray(mapPinCommentsTable.pinId, ids), eq(mapPinCommentsTable.deleted, false))).groupBy(mapPinCommentsTable.pinId),
    db.select({ pinId: mapPinReactionsTable.pinId }).from(mapPinReactionsTable).where(and(eq(mapPinReactionsTable.userId, viewerId), inArray(mapPinReactionsTable.pinId, ids))),
    db.select({ pinId: mapPinSavesTable.pinId }).from(mapPinSavesTable).where(and(eq(mapPinSavesTable.userId, viewerId), inArray(mapPinSavesTable.pinId, ids))),
  ]);
  const author = new Map(authors.map((item) => [item.id, item]));
  const counts = (items: Array<{ pinId: number; count: number }>) => new Map(items.map((item) => [item.pinId, Number(item.count)]));
  const reactionCounts = counts(reactions), saveCounts = counts(saves), commentCounts = counts(comments);
  const reacted = new Set(viewerReactions.map((item) => item.pinId)), saved = new Set(viewerSaves.map((item) => item.pinId));
  return pins.map((pin) => {
    const user = author.get(pin.authorId) ?? { id: pin.authorId, name: "Old Time user" };
    const distanceKm = origin ? haversine(origin.latitude, origin.longitude, pin.latitude, pin.longitude) : 0;
    return { id: pin.id, authorId: pin.authorId, author: { id: user.id, name: user.name, username: nameFor(user) }, latitude: pin.latitude, longitude: pin.longitude, caption: pin.caption, visibility: pin.visibility as "public" | "friends" | "followers" | "private", createdAt: pin.createdAt, updatedAt: pin.updatedAt, expiresAt: pin.expiresAt, distanceKm, counts: { reactions: reactionCounts.get(pin.id) ?? 0, comments: commentCounts.get(pin.id) ?? 0, saves: saveCounts.get(pin.id) ?? 0 }, viewer: { reacted: reacted.has(pin.id), saved: saved.has(pin.id) } };
  });
}
function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const radians = (value: number) => value * Math.PI / 180;
  const a = Math.sin(radians(lat2 - lat1) / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(radians(lon2 - lon1) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

router.get("/map/pins/nearby", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res); if (viewerId === null) return;
  const query = z.object({ latitude: z.coerce.number().finite().min(-90).max(90), longitude: z.coerce.number().finite().min(-180).max(180), radiusKm: z.coerce.number().finite().min(0.1).max(50).default(25) }).safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: "Valid latitude, longitude, and a radius no greater than 50 km are required." }); return; }
  const [following, blocked, candidates] = await Promise.all([followingIds(viewerId), blockedIds(viewerId), db.select().from(mapPinsTable).where(and(eq(mapPinsTable.deleted, false), or(isNull(mapPinsTable.expiresAt), gt(mapPinsTable.expiresAt, Date.now())))).limit(1_000)]);
  const visible: Array<typeof mapPinsTable.$inferSelect> = [];
  for (const pin of candidates) if (haversine(query.data.latitude, query.data.longitude, pin.latitude, pin.longitude) <= query.data.radiusKm && await canSee(viewerId, pin, following, blocked)) visible.push(pin);
  const items = await serialize(visible, viewerId, query.data);
  items.sort((left, right) => left.distanceKm - right.distanceKm);
  res.json({ items });
});

router.post("/map/pins", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res); if (viewerId === null) return;
  const parsed = pinInput.safeParse(req.body);
  if (!parsed.success || (parsed.success && parsed.data.expiresAt !== null && parsed.data.expiresAt !== undefined && parsed.data.expiresAt <= Date.now())) { res.status(400).json({ error: "Pin coordinates, caption, or expiry are invalid." }); return; }
  const now = Date.now();
  const [pin] = await db.insert(mapPinsTable).values({ ...parsed.data, caption: parsed.data.caption || null, expiresAt: parsed.data.expiresAt ?? null, authorId: viewerId, createdAt: now, updatedAt: now }).returning();
  res.status(201).json((await serialize([pin], viewerId))[0]);
});

router.patch("/map/pins/:pinId", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res); if (viewerId === null) return;
  const pinId = id(req.params.pinId); if (pinId === null) { res.status(400).json({ error: "A valid pin ID is required." }); return; }
  const parsed = pinUpdate.safeParse(req.body);
  if (!parsed.success || !Object.keys(parsed.data).length || (parsed.data.expiresAt !== undefined && parsed.data.expiresAt !== null && parsed.data.expiresAt <= Date.now())) { res.status(400).json({ error: "Pin update is invalid." }); return; }
  const [pin] = await db.update(mapPinsTable).set({ ...parsed.data, caption: parsed.data.caption === undefined ? undefined : parsed.data.caption || null, updatedAt: Date.now() }).where(and(eq(mapPinsTable.id, pinId), eq(mapPinsTable.authorId, viewerId), eq(mapPinsTable.deleted, false))).returning();
  if (!pin) { res.status(404).json({ error: "Pin not found or not owned by you." }); return; }
  res.json((await serialize([pin], viewerId))[0]);
});

router.delete("/map/pins/:pinId", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res); if (viewerId === null) return;
  const pinId = id(req.params.pinId); if (pinId === null) { res.status(400).json({ error: "A valid pin ID is required." }); return; }
  const [pin] = await db.update(mapPinsTable).set({ deleted: true, updatedAt: Date.now() }).where(and(eq(mapPinsTable.id, pinId), eq(mapPinsTable.authorId, viewerId), eq(mapPinsTable.deleted, false))).returning({ id: mapPinsTable.id });
  if (!pin) { res.status(404).json({ error: "Pin not found or not owned by you." }); return; } res.json({ success: true });
});

async function relation(req: any, res: any, kind: "reaction" | "save", active: boolean): Promise<void> {
  const viewerId = await requireChatAuth(req, res); if (viewerId === null) return;
  const pinId = id(req.params.pinId); if (pinId === null) { res.status(400).json({ error: "A valid pin ID is required." }); return; }
  const pin = await activePin(pinId); const following = await followingIds(viewerId), blocked = await blockedIds(viewerId);
  if (!pin || !await canSee(viewerId, pin, following, blocked)) { res.status(404).json({ error: "Pin not found." }); return; }
  const table = kind === "reaction" ? mapPinReactionsTable : mapPinSavesTable;
  if (active) await db.insert(table).values({ pinId, userId: viewerId, createdAt: Date.now() }).onConflictDoNothing();
  else await db.delete(table).where(and(eq(table.pinId, pinId), eq(table.userId, viewerId)));
  res.json({ success: true, active });
}
router.put("/map/pins/:pinId/reaction", async (req, res): Promise<void> => relation(req, res, "reaction", true));
router.delete("/map/pins/:pinId/reaction", async (req, res): Promise<void> => relation(req, res, "reaction", false));
router.put("/map/pins/:pinId/save", async (req, res): Promise<void> => relation(req, res, "save", true));
router.delete("/map/pins/:pinId/save", async (req, res): Promise<void> => relation(req, res, "save", false));

router.get("/map/pins/:pinId/comments", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res); if (viewerId === null) return;
  const pinId = id(req.params.pinId); if (pinId === null) { res.status(400).json({ error: "A valid pin ID is required." }); return; }
  const pin = await activePin(pinId); const following = await followingIds(viewerId), blocked = await blockedIds(viewerId);
  if (!pin || !await canSee(viewerId, pin, following, blocked)) { res.status(404).json({ error: "Pin not found." }); return; }
  const rows = await db.select({ id: mapPinCommentsTable.id, pinId: mapPinCommentsTable.pinId, authorId: mapPinCommentsTable.authorId, content: mapPinCommentsTable.content, createdAt: mapPinCommentsTable.createdAt, name: usersTable.name, username: usersTable.username }).from(mapPinCommentsTable).innerJoin(usersTable, eq(usersTable.id, mapPinCommentsTable.authorId)).where(and(eq(mapPinCommentsTable.pinId, pinId), eq(mapPinCommentsTable.deleted, false))).orderBy(asc(mapPinCommentsTable.createdAt));
  res.json(rows.filter((row) => !blocked.has(row.authorId)).map((row) => ({ id: row.id, pinId: row.pinId, author: { id: row.authorId, name: row.name, username: nameFor({ id: row.authorId, name: row.name, username: row.username }) }, content: row.content, createdAt: row.createdAt })));
});
router.post("/map/pins/:pinId/comments", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res); if (viewerId === null) return;
  const pinId = id(req.params.pinId);
  const parsed = commentInput.safeParse(req.body);
  if (pinId === null || !parsed.success) { res.status(400).json({ error: "A valid pin ID and comment are required." }); return; }
  const pin = await activePin(pinId); const following = await followingIds(viewerId), blocked = await blockedIds(viewerId);
  if (!pin || !await canSee(viewerId, pin, following, blocked)) { res.status(404).json({ error: "Pin not found." }); return; }
  const [comment] = await db.insert(mapPinCommentsTable).values({ pinId, authorId: viewerId, content: parsed.data.content, createdAt: Date.now() }).returning();
  const [user] = await db.select({ id: usersTable.id, name: usersTable.name, username: usersTable.username }).from(usersTable).where(eq(usersTable.id, viewerId));
  res.status(201).json({ id: comment.id, pinId: comment.pinId, author: { id: user.id, name: user.name, username: nameFor(user) }, content: comment.content, createdAt: comment.createdAt });
});
router.post("/map/pins/:pinId/report", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res); if (viewerId === null) return;
  const pinId = id(req.params.pinId);
  const parsed = reportInput.safeParse(req.body);
  if (pinId === null || !parsed.success) { res.status(400).json({ error: "A valid pin ID and report reason are required." }); return; }
  const pin = await activePin(pinId); if (!pin || !await canSee(viewerId, pin, await followingIds(viewerId), await blockedIds(viewerId))) { res.status(404).json({ error: "Pin not found." }); return; }
  await db.insert(mapPinReportsTable).values({ pinId, reporterId: viewerId, reason: parsed.data.reason, createdAt: Date.now() }).onConflictDoNothing(); res.status(201).json({ success: true });
});
export default router;