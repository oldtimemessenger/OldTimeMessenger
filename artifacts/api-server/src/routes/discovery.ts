import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { z } from "@workspace/api-zod";
import {
  db,
  discoveryCreatorClaimsTable,
  discoveryItemsTable,
  type DiscoveryEngagement,
} from "@workspace/db";
import { requireChatAuth } from "../lib/chat-auth";

const router: IRouter = Router();
const platformSchema = z.enum(["youtube", "tiktok", "x"]);
const nearbyQuery = z.object({
  latitude: z.coerce.number().finite().min(-90).max(90),
  longitude: z.coerce.number().finite().min(-180).max(180),
  radiusKm: z.coerce.number().finite().min(0.1).max(100).default(10),
  limit: z.coerce.number().int().min(1).max(30).default(12),
});
const submissionInput = z.object({
  url: z.string().url().max(2_000),
  latitude: z.number().finite().min(-90).max(90).nullable().optional(),
  longitude: z.number().finite().min(-180).max(180).nullable().optional(),
  locationLabel: z.string().trim().max(120).nullable().optional(),
  category: z.string().trim().max(80).nullable().optional(),
});
const claimInput = z.object({ note: z.string().trim().max(500).nullable().optional() });

type Platform = z.infer<typeof platformSchema>;
type OEmbedResponse = {
  html?: unknown;
  title?: unknown;
  author_name?: unknown;
  author_url?: unknown;
};

function platformFor(input: string): { platform: Platform; canonicalUrl: string; oembedUrl: string } | null {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  url.hash = "";
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  let platform: Platform;
  let endpoint: string;
  if (host === "youtube.com" || host === "youtu.be") {
    platform = "youtube";
    endpoint = "https://www.youtube.com/oembed";
  } else if (host === "tiktok.com" || host.endsWith(".tiktok.com")) {
    platform = "tiktok";
    endpoint = "https://www.tiktok.com/oembed";
  } else if (host === "x.com" || host === "twitter.com" || host.endsWith(".twitter.com")) {
    platform = "x";
    endpoint = "https://publish.twitter.com/oembed";
  } else {
    return null;
  }
  const canonicalUrl = url.toString();
  const oembedTarget = platform === "x" ? canonicalUrl.replace("://x.com/", "://twitter.com/") : canonicalUrl;
  const query = new URLSearchParams({ url: oembedTarget, format: "json" });
  if (platform === "x") {
    query.set("omit_script", "true");
    query.set("dnt", "true");
  }
  return { platform, canonicalUrl, oembedUrl: `${endpoint}?${query}` };
}

function handleFromAuthorUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const segments = new URL(value).pathname.split("/").filter(Boolean);
    return segments[0] ? `@${segments[0].replace(/^@/, "")}` : null;
  } catch {
    return null;
  }
}

function engagementScore(engagement: DiscoveryEngagement) {
  return (engagement.views ?? 0) * 0.02
    + (engagement.likes ?? 0)
    + (engagement.comments ?? 0) * 2
    + (engagement.shares ?? 0) * 3;
}

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const radians = (value: number) => value * Math.PI / 180;
  const a = Math.sin(radians(lat2 - lat1) / 2) ** 2
    + Math.cos(radians(lat1)) * Math.cos(radians(lat2))
    * Math.sin(radians(lon2 - lon1) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function serialize(item: typeof discoveryItemsTable.$inferSelect, origin?: { latitude: number; longitude: number }) {
  const engagement = item.engagement ?? {};
  const distance = origin && item.latitude !== null && item.longitude !== null
    ? distanceKm(origin.latitude, origin.longitude, item.latitude, item.longitude)
    : null;
  const freshness = Math.max(0, 120 - (Date.now() - (item.publishedAt ?? item.discoveredAt)) / 3_600_000);
  return {
    id: item.id,
    platform: platformSchema.parse(item.platform),
    url: item.canonicalUrl,
    embedHtml: item.embedHtml,
    title: item.title,
    creator: { name: item.creatorName, handle: item.creatorHandle },
    category: item.category,
    engagement,
    latitude: item.latitude,
    longitude: item.longitude,
    locationLabel: item.locationLabel,
    publishedAt: item.publishedAt,
    discoveredAt: item.discoveredAt,
    distanceKm: distance,
    score: engagementScore(engagement) + freshness,
  };
}

router.get("/discovery/nearby", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res);
  if (viewerId === null) return;
  const parsed = nearbyQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Choose a valid map area." });
    return;
  }
  const rows = await db.select().from(discoveryItemsTable)
    .where(eq(discoveryItemsTable.status, "active"))
    .orderBy(desc(discoveryItemsTable.discoveredAt))
    .limit(250);
  const origin = { latitude: parsed.data.latitude, longitude: parsed.data.longitude };
  const ranked = rows.map((item) => serialize(item, origin));
  const nearby = ranked.filter((item) => item.distanceKm !== null && item.distanceKm <= parsed.data.radiusKm);
  const items = (nearby.length ? nearby : ranked)
    .sort((left, right) => right.score - left.score)
    .slice(0, parsed.data.limit);
  res.json({ items, usedGlobalFallback: nearby.length === 0 && items.length > 0 });
});

router.get("/discovery/feed", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res);
  if (viewerId === null) return;
  const parsed = z.object({ limit: z.coerce.number().int().min(1).max(30).default(12) }).safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Choose a valid feed size." });
    return;
  }
  const rows = await db.select().from(discoveryItemsTable)
    .where(eq(discoveryItemsTable.status, "active"))
    .orderBy(desc(discoveryItemsTable.discoveredAt))
    .limit(250);
  const items = rows.map((item) => serialize(item))
    .sort((left, right) => right.score - left.score)
    .slice(0, parsed.data.limit);
  res.json({ items });
});

router.get("/discovery/items/:itemId/embed", async (req, res): Promise<void> => {
  const itemId = Number(req.params.itemId);
  if (!Number.isInteger(itemId) || itemId <= 0) {
    res.status(404).send("Post not found.");
    return;
  }
  const [item] = await db.select({
    title: discoveryItemsTable.title,
    embedHtml: discoveryItemsTable.embedHtml,
    canonicalUrl: discoveryItemsTable.canonicalUrl,
  }).from(discoveryItemsTable).where(
    and(eq(discoveryItemsTable.id, itemId), eq(discoveryItemsTable.status, "active")),
  ).limit(1);
  if (!item) {
    res.status(404).send("Post not found.");
    return;
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'none'; frame-src https://www.youtube.com https://www.youtube-nocookie.com https://www.tiktok.com https://platform.twitter.com https://twitter.com https://x.com; script-src 'unsafe-inline' https://www.tiktok.com https://platform.twitter.com; style-src 'unsafe-inline'; img-src https: data:; media-src https:; connect-src https:; base-uri 'none'; form-action 'none'",
  );
  const safeTitle = item.title.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character] ?? character);
  const safeUrl = item.canonicalUrl.replace(/"/g, "&quot;");
  res.send(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeTitle}</title><style>html,body{margin:0;min-height:100%;background:#09090b;color:#fff;font-family:system-ui,sans-serif}main{min-height:100vh;display:grid;place-items:center;padding:18px;box-sizing:border-box}main>*{max-width:100%!important}.source{position:fixed;right:14px;bottom:14px;color:#fff;background:#7c3aed;border-radius:999px;padding:10px 14px;text-decoration:none;font-weight:700;font-size:13px}</style></head><body><main>${item.embedHtml}</main><a class="source" href="${safeUrl}" rel="noopener noreferrer">Open original</a></body></html>`);
});

router.post("/discovery/items", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res);
  if (viewerId === null) return;
  const parsed = submissionInput.safeParse(req.body);
  if (!parsed.success || (parsed.data.latitude === null) !== (parsed.data.longitude === null)) {
    res.status(400).json({ error: "Add a supported post link and a complete location." });
    return;
  }
  const provider = platformFor(parsed.data.url);
  if (!provider) {
    res.status(400).json({ error: "Use a public YouTube, TikTok, or X post link." });
    return;
  }
  const response = await fetch(provider.oembedUrl, {
    headers: { Accept: "application/json", "User-Agent": "OldTimeMessenger/1.0" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) {
    res.status(422).json({ error: "That post could not be opened right now." });
    return;
  }
  const embed = await response.json() as OEmbedResponse;
  if (typeof embed.html !== "string" || !embed.html.trim()) {
    res.status(422).json({ error: "That post does not offer an official embed." });
    return;
  }
  const now = Date.now();
  const [item] = await db.insert(discoveryItemsTable).values({
    platform: provider.platform,
    canonicalUrl: provider.canonicalUrl,
    embedHtml: embed.html,
    title: typeof embed.title === "string" && embed.title.trim() ? embed.title.trim() : "Trending now",
    creatorName: typeof embed.author_name === "string" && embed.author_name.trim() ? embed.author_name.trim() : provider.platform,
    creatorHandle: handleFromAuthorUrl(embed.author_url),
    category: parsed.data.category ?? null,
    latitude: parsed.data.latitude ?? null,
    longitude: parsed.data.longitude ?? null,
    locationLabel: parsed.data.locationLabel ?? null,
    engagement: {},
    discoveredAt: now,
    status: "active",
  }).onConflictDoUpdate({
    target: discoveryItemsTable.canonicalUrl,
    set: {
      embedHtml: embed.html,
      title: typeof embed.title === "string" && embed.title.trim() ? embed.title.trim() : "Trending now",
      creatorName: typeof embed.author_name === "string" && embed.author_name.trim() ? embed.author_name.trim() : provider.platform,
      creatorHandle: handleFromAuthorUrl(embed.author_url),
      category: parsed.data.category ?? null,
      latitude: parsed.data.latitude ?? null,
      longitude: parsed.data.longitude ?? null,
      locationLabel: parsed.data.locationLabel ?? null,
      discoveredAt: now,
      status: "active",
    },
  }).returning();
  res.status(201).json(serialize(item));
});

router.post("/discovery/items/:itemId/claim", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res);
  if (viewerId === null) return;
  const itemId = Number(req.params.itemId);
  const parsed = claimInput.safeParse(req.body);
  if (!Number.isInteger(itemId) || itemId <= 0 || !parsed.success) {
    res.status(400).json({ error: "Add a short note about your creator account." });
    return;
  }
  const [item] = await db.select({ id: discoveryItemsTable.id }).from(discoveryItemsTable)
    .where(and(eq(discoveryItemsTable.id, itemId), eq(discoveryItemsTable.status, "active"))).limit(1);
  if (!item) {
    res.status(404).json({ error: "This post is no longer available." });
    return;
  }
  const now = Date.now();
  const [claim] = await db.insert(discoveryCreatorClaimsTable).values({
    itemId,
    claimantId: viewerId,
    note: parsed.data.note ?? null,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: [discoveryCreatorClaimsTable.claimantId, discoveryCreatorClaimsTable.itemId],
    set: { note: parsed.data.note ?? null, status: "pending", updatedAt: now },
  }).returning();
  res.status(201).json({ id: claim.id, itemId, status: claim.status, createdAt: claim.createdAt });
});

export default router;