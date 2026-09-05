import { Router, type IRouter } from "express";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import { z } from "@workspace/api-zod";
import {
  db, discoveryItemsTable, mapPinsTable,
  paceRoutesTable, socialHubsTable, socialPostsTable,
} from "@workspace/db";
import { atmosphereInteractionsTable, atmospherePreferencesTable } from "@workspace/db/schema";
import { requireChatAuth } from "../lib/chat-auth";
import { discoveryTarget, rankAtmosphere, type AtmosphereCard } from "../lib/atmosphere-engine";

const router: IRouter = Router();
const enabled = () => process.env.ATMOSPHERE_ENABLED !== "false";
const testMode = () => process.env.ATMOSPHERE_TEST_MODE === "true";
const numberEnv = (key: string, fallback: number, min: number, max: number) => {
  const n = Number(process.env[key]); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
};
const feedQuery = z.object({
  limit: z.coerce.number().int().min(1).max(30).default(12),
  interests: z.string().max(500).optional(), latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(), sessionId: z.string().trim().max(120).optional(),
  language: z.string().trim().min(2).max(80).optional(), debug: z.coerce.boolean().default(false),
});
const preferencesInput = z.object({
  enabled: z.boolean(), radiusKm: z.number().int().min(1).max(500), language: z.string().trim().min(2).max(80).nullable(),
  mutedCategories: z.array(z.string().trim().min(1).max(80)).max(30),
});
const interactionInput = z.object({
  itemId: z.string().trim().min(1).max(300), itemKind: z.enum(["route", "motivation", "world", "hub", "pace", "map", "external"]),
  interaction: z.enum(["impression", "open", "dismiss", "complete"]), sessionId: z.string().trim().max(120).optional(),
  metadata: z.record(z.string().max(80), z.union([z.string().max(500), z.number().finite(), z.boolean(), z.null()])).refine((value) => Object.keys(value).length <= 20).optional(),
});
function card(id: string, kind: AtmosphereCard["kind"], label: string, title: string, description: string, category: string | null, locationLabel: string | null, coordinates: AtmosphereCard["coordinates"], action: "map" | "hub" | "pace" | "external", value: string): AtmosphereCard {
  const ctaLabel = action === "map" ? "View on map" : action === "hub" ? "Open Hub" : action === "pace" ? "Open Pace" : "Open original";
  return { id, kind, origin: "legitimate", label, title, description, category, locationLabel, coordinates, cta: { label: ctaLabel, action, value } };
}
function unavailable(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return message.includes("atmosphere_") || message.includes("does not exist");
}
function distanceKm(latitude: number, longitude: number, target: { latitude: number; longitude: number }) {
  const radians = (value: number) => value * Math.PI / 180;
  const a = Math.sin(radians(target.latitude - latitude) / 2) ** 2
    + Math.cos(radians(latitude)) * Math.cos(radians(target.latitude)) * Math.sin(radians(target.longitude - longitude) / 2) ** 2;
  return 6_371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

router.get("/atmosphere/feed", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res); if (viewerId === null) return;
  const parsed = feedQuery.safeParse(req.query);
  if (!parsed.success || (parsed.data.latitude === undefined) !== (parsed.data.longitude === undefined)) { res.status(400).json({ error: "Choose a valid feed query and complete location pair." }); return; }
  if (!enabled()) { res.json({ enabled: false, testMode: testMode(), mix: { realContentCount: 0, discoveryCount: 0, discoveryRatio: 0 }, items: [] }); return; }
  const now = Date.now();
  const [preferencesResult, interactionsResult, sourceResult] = await Promise.allSettled([
    db.select().from(atmospherePreferencesTable).where(eq(atmospherePreferencesTable.userId, viewerId)).limit(1),
    db.select().from(atmosphereInteractionsTable).where(eq(atmosphereInteractionsTable.userId, viewerId)).orderBy(desc(atmosphereInteractionsTable.createdAt)).limit(300),
    Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(socialPostsTable).where(and(eq(socialPostsTable.deleted, false), gt(socialPostsTable.createdAt, now - 86_400_000))),
      db.select().from(discoveryItemsTable).where(eq(discoveryItemsTable.status, "active")).orderBy(desc(discoveryItemsTable.discoveredAt)).limit(40),
      db.select().from(socialHubsTable).where(and(eq(socialHubsTable.status, "active"), eq(socialHubsTable.privacy, "public"))).orderBy(desc(socialHubsTable.updatedAt)).limit(25),
      db.select().from(paceRoutesTable).where(and(eq(paceRoutesTable.visibility, "public"), eq(paceRoutesTable.deleted, false))).orderBy(desc(paceRoutesTable.createdAt)).limit(25),
      db.select().from(mapPinsTable).where(and(eq(mapPinsTable.visibility, "public"), eq(mapPinsTable.deleted, false), sql`(${mapPinsTable.expiresAt} is null or ${mapPinsTable.expiresAt} > ${now})`)).orderBy(desc(mapPinsTable.createdAt)).limit(25),
    ]),
  ]);
  const preference = preferencesResult.status === "fulfilled" ? preferencesResult.value[0] : undefined;
  if (preference && !preference.enabled) { res.json({ enabled: false, testMode: testMode(), mix: { realContentCount: 0, discoveryCount: 0, discoveryRatio: 0 }, items: [] }); return; }
  const [postRows, external = [], hubs = [], routes = [], pins = []] = sourceResult.status === "fulfilled" ? sourceResult.value : [[{ count: 0 }], [], [], [], []];
  let candidates: AtmosphereCard[] = [
    ...external.map((x) => card(`external:${x.id}`, "external", "DISCOVERY • EXTERNAL", x.title, `From ${x.creatorName} on ${x.platform}.`, x.category, x.locationLabel, x.latitude === null || x.longitude === null ? null : { latitude: x.latitude, longitude: x.longitude }, "external", x.canonicalUrl)),
    ...hubs.map((x) => card(`hub:${x.id}`, "hub", "DISCOVERY • HUB", x.name, x.description || "A public community to explore.", x.category, null, null, "hub", x.slug)),
    ...routes.map((x) => card(`pace:${x.id}`, "pace", "DISCOVERY • PACE", x.title, x.description || "A public Pace route.", x.activity, x.locationLabel, { latitude: x.startLatitude, longitude: x.startLongitude }, "pace", String(x.id))),
    ...pins.map((x) => card(`map:${x.id}`, "map", "DISCOVERY • MAP", x.caption || "Public map discovery", "A public map pin shared for discovery.", "map", null, { latitude: x.latitude, longitude: x.longitude }, "map", String(x.id))),
  ];
  if (parsed.data.latitude !== undefined && parsed.data.longitude !== undefined) {
    const radiusKm = preference?.radiusKm ?? numberEnv("ATMOSPHERE_GEOGRAPHIC_RADIUS_KM", 25, 1, 500);
    candidates = candidates.filter((item) => !item.coordinates
      || distanceKm(parsed.data.latitude!, parsed.data.longitude!, item.coordinates) <= radiusKm);
  }
  const realContentCount = postRows[0]?.count ?? 0;
  const maxCards = numberEnv("ATMOSPHERE_MAX_CARDS", 20, 1, 30);
  const target = discoveryTarget(realContentCount, numberEnv("ATMOSPHERE_DISCOVERY_TARGET", 0.5, 0, 0.95), Math.min(parsed.data.limit, maxCards));
  const cooldown = testMode() ? 0.01 : numberEnv("ATMOSPHERE_COOLDOWN_HOURS", 24, 0.01, 720);
  const history = interactionsResult.status === "fulfilled"
    ? interactionsResult.value.filter((event): event is typeof event & { interaction: "impression" | "open" | "dismiss" | "complete" } =>
      event.interaction === "impression" || event.interaction === "open" || event.interaction === "dismiss" || event.interaction === "complete")
    : [];
  const seed = testMode() ? (process.env.ATMOSPHERE_TEST_SEED || "atmosphere-test") : `${viewerId}:${parsed.data.sessionId ?? "default"}:${parsed.data.language ?? preference?.language ?? "default"}:${Math.floor(now / 3_600_000)}`;
  const ranked = rankAtmosphere({ userId: viewerId, sessionId: parsed.data.sessionId, seed, now, limit: target, realContentCount, cooldownHours: cooldown, globalFrequency: numberEnv("ATMOSPHERE_GLOBAL_FREQUENCY", 0.35, 0, 1), mutedCategories: preference?.mutedCategories, interests: parsed.data.interests?.split(",").map((x) => x.trim()).filter(Boolean), candidates, interactions: history, origin: parsed.data.latitude === undefined ? undefined : { latitude: parsed.data.latitude, longitude: parsed.data.longitude! } });
  const debug = process.env.ATMOSPHERE_DEBUG_MODE === "true" && parsed.data.debug;
  const items = ranked.map(({ score, reasons, cooldownStatus, ...item }) => debug ? { ...item, debug: { score, reasons, cooldownStatus } } : item);
  const discoveryCount = items.length;
  res.json({ enabled: true, testMode: testMode(), mix: { realContentCount, discoveryCount, discoveryRatio: discoveryCount / Math.max(1, realContentCount + discoveryCount) }, items });
});

router.get("/atmosphere/preferences", async (req, res): Promise<void> => {
  const userId = await requireChatAuth(req, res); if (userId === null) return;
  try { const [row] = await db.select().from(atmospherePreferencesTable).where(eq(atmospherePreferencesTable.userId, userId)).limit(1); res.json(row ?? { enabled: true, radiusKm: numberEnv("ATMOSPHERE_GEOGRAPHIC_RADIUS_KM", 25, 1, 500), language: null, mutedCategories: [] }); }
  catch { res.status(503).json({ error: "Atmosphere preferences are temporarily unavailable." }); }
});
router.put("/atmosphere/preferences", async (req, res): Promise<void> => {
  const userId = await requireChatAuth(req, res); if (userId === null) return; const parsed = preferencesInput.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Choose valid Atmosphere preferences." }); return; }
  try { const [row] = await db.insert(atmospherePreferencesTable).values({ userId, ...parsed.data, updatedAt: Date.now() }).onConflictDoUpdate({ target: atmospherePreferencesTable.userId, set: { ...parsed.data, updatedAt: Date.now() } }).returning(); res.json(row); }
  catch { res.status(503).json({ error: "Atmosphere preferences are temporarily unavailable." }); }
});
router.post("/atmosphere/interactions", async (req, res): Promise<void> => {
  const userId = await requireChatAuth(req, res); if (userId === null) return; const parsed = interactionInput.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Choose a valid Atmosphere interaction." }); return; }
  try { await db.insert(atmosphereInteractionsTable).values({ userId, ...parsed.data, createdAt: Date.now() }); res.status(201).json({ ok: true }); }
  catch (error) { res.status(unavailable(error) ? 503 : 503).json({ error: "Atmosphere interactions are temporarily unavailable; please try again." }); }
});
export default router;