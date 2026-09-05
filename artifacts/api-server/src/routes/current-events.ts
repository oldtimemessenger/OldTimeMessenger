import { Router, type IRouter, type Request, type Response } from "express";
import { and, asc, desc, eq, gte, gt, inArray, sql } from "drizzle-orm";
import { z } from "@workspace/api-zod";
import {
  currentEventGiftsTable,
  currentEventCoinPurchasesTable,
  creatorPayoutAccountsTable,
  creatorWithdrawalsTable,
  currentEventMessagesTable,
  currentEventParticipantsTable,
  currentEventRoomsTable,
  currentEventWalletsTable,
  db,
  usersTable,
} from "@workspace/db";
import { requireChatAuth } from "../lib/chat-auth";
import { getVerifiedCoinPurchases } from "../lib/revenuecat";
import { createLiveKitToken, liveKitConfigured, liveKitPublicUrl } from "../lib/livekit";
import { emitToCurrentEventRoom, evictCurrentEventRoom, evictUserFromCurrentEventRoom } from "../lib/realtime";
import { getUncachableStripeClient } from "../lib/stripe-client";

const router: IRouter = Router();

// Room state is live session data. Never let the browser reuse an ended room
// or a participant list from a previous request.
router.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

const topics = z.enum(["for-you", "politics", "markets", "tech", "culture", "sports", "world"]);
const roles = z.enum(["host", "moderator", "speaker", "listener"]);
const roomIdSchema = z.coerce.number().int().positive();
const roomInput = z.object({
  clubName: z.string().trim().min(1).max(80).default("Current Events"),
  title: z.string().trim().min(1).max(120),
  topic: topics,
  isOpen: z.boolean().default(true),
  latitude: z.number().finite().min(-90).max(90).nullable().optional(),
  longitude: z.number().finite().min(-180).max(180).nullable().optional(),
});
const messageInput = z.object({ content: z.string().trim().min(1).max(1000) });
const handInput = z.object({ raised: z.boolean() });
const participantAction = z.object({ action: z.enum(["promote", "demote", "mute", "unmute", "remove"]) });
const giftInput = z.object({
  gift: z.enum(["coffee", "idea", "heart", "gem", "studio", "time_is_up"]),
  recipientId: z.coerce.number().int().positive(),
});
const withdrawalInput = z.object({ gold: z.coerce.number().int().min(900).max(9_000_000) });
const GOLD_PER_USD = 90;
const MINIMUM_WITHDRAWAL_GOLD = 900;
const terminalPayoutStatuses = new Set(["paid", "failed", "canceled"]);

const giftPrices = {
  coffee: 25,
  idea: 100,
  heart: 200,
  gem: 500,
  studio: 1000,
  time_is_up: 10000,
} as const;

type Room = typeof currentEventRoomsTable.$inferSelect;
function parseId(value: unknown) {
  const parsed = roomIdSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function usernameFor(user: { id: number; name: string; username?: string | null }) {
  return user.username || user.name.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 18) || `user${user.id}`;
}

function distanceKm(left: { latitude: number; longitude: number }, right: { latitude: number; longitude: number }) {
  const radians = (value: number) => value * Math.PI / 180;
  const deltaLatitude = radians(right.latitude - left.latitude);
  const deltaLongitude = radians(right.longitude - left.longitude);
  const a = Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(radians(left.latitude)) * Math.cos(radians(right.latitude)) * Math.sin(deltaLongitude / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function audioStatus() {
  return liveKitConfigured()
    ? { provider: "livekit" as const, configured: true }
    : { provider: "unconfigured" as const, configured: false };
}

async function ensureWallet(userId: number) {
  await db.insert(currentEventWalletsTable).values({ userId, updatedAt: Date.now() }).onConflictDoNothing();
}

function accountStatus(account: { details_submitted: boolean; payouts_enabled: boolean; requirements?: { disabled_reason?: string | null } | null }) {
  if (account.payouts_enabled && account.details_submitted) return "enabled";
  if (account.requirements?.disabled_reason) return "restricted";
  return "pending";
}

function safePayoutUrl(req: Request, endpoint: "return" | "refresh") {
  const host = req.get("host");
  const forwarded = req.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwarded ?? req.protocol;
  // Do not reflect a path, credentials, or a non-HTTPS host into Stripe.
  if (protocol !== "https" || !host || !/^[a-z0-9.-]+(?::\d+)?$/i.test(host)) return null;
  return `https://${host}/api/current-events/payouts/onboarding/${endpoint}`;
}

function payoutHtml() {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Old Time</title></head><body><p>You can return to Old Time now.</p><p><a href="oldtime://payment-settings">Return to Old Time</a></p><script>location.href="oldtime://payment-settings"</script></body></html>`;
}

type PayoutDestination = { type: "bank_account" | "card"; label: string; last4: string };

async function payoutDestination(stripeAccountId: string): Promise<PayoutDestination | null> {
  const stripe = await getUncachableStripeClient();
  const externalAccounts = await stripe.accounts.listExternalAccounts(stripeAccountId, { limit: 1 });
  const destination = externalAccounts.data[0];
  if (!destination || !("object" in destination)) return null;
  if (destination.object === "bank_account" && destination.last4) {
    return { type: "bank_account", label: destination.bank_name || "Bank account", last4: destination.last4 };
  }
  if (destination.object === "card" && destination.last4) {
    const cardLabel = [destination.brand, destination.funding].filter(Boolean).join(" ");
    return { type: "card", label: cardLabel || "Card", last4: destination.last4 };
  }
  return null;
}

async function refreshPayoutAccount(userId: number) {
  const [stored] = await db.select().from(creatorPayoutAccountsTable).where(eq(creatorPayoutAccountsTable.userId, userId)).limit(1);
  if (!stored) return null;
  const stripe = await getUncachableStripeClient();
  const account = await stripe.accounts.retrieve(stored.stripeAccountId);
  if ("deleted" in account && account.deleted) throw new Error("The payout account is no longer available.");
  const values = { detailsSubmitted: account.details_submitted, payoutsEnabled: account.payouts_enabled, status: accountStatus(account), updatedAt: Date.now() };
  await db.update(creatorPayoutAccountsTable).set(values).where(eq(creatorPayoutAccountsTable.userId, userId));
  return { ...stored, ...values };
}

async function refundFailedWithdrawal(withdrawalId: number, reason: string) {
  await db.transaction(async (tx) => {
    const [claimed] = await tx.update(creatorWithdrawalsTable)
      .set({ status: "failed", failureReason: reason.slice(0, 500), updatedAt: Date.now() })
      .where(and(eq(creatorWithdrawalsTable.id, withdrawalId), eq(creatorWithdrawalsTable.status, "processing")))
      .returning({ gold: creatorWithdrawalsTable.gold, userId: creatorWithdrawalsTable.userId });
    if (claimed) {
      await tx.update(currentEventWalletsTable).set({ gold: sql`${currentEventWalletsTable.gold} + ${claimed.gold}`, updatedAt: Date.now() })
        .where(eq(currentEventWalletsTable.userId, claimed.userId));
    }
  });
}

function serializeWithdrawal(withdrawal: typeof creatorWithdrawalsTable.$inferSelect) {
  return {
    id: withdrawal.id,
    gold: withdrawal.gold,
    amountCents: withdrawal.amountCents,
    currency: withdrawal.currency,
    status: withdrawal.status,
    createdAt: withdrawal.createdAt,
    updatedAt: withdrawal.updatedAt,
  };
}

async function refreshWithdrawal(withdrawal: typeof creatorWithdrawalsTable.$inferSelect) {
  if (terminalPayoutStatuses.has(withdrawal.status) || withdrawal.status === "reversal_pending") return withdrawal;
  const stripe = await getUncachableStripeClient();
  const [payoutAccount] = await db.select({ stripeAccountId: creatorPayoutAccountsTable.stripeAccountId })
    .from(creatorPayoutAccountsTable).where(eq(creatorPayoutAccountsTable.userId, withdrawal.userId)).limit(1);
  if (!payoutAccount) return withdrawal;
  // Recover safely if a process ended between either idempotent provider call
  // and persisting its Stripe ID.
  if (!withdrawal.stripePayoutId) {
    let transferId = withdrawal.stripeTransferId;
    if (!transferId) {
      const transfer = await stripe.transfers.create({
        amount: withdrawal.amountCents, currency: "usd", destination: payoutAccount.stripeAccountId,
        metadata: { withdrawalId: String(withdrawal.id), oldtimeUserId: String(withdrawal.userId) },
      }, { idempotencyKey: `oldtime-withdrawal-transfer-${withdrawal.id}` });
      transferId = transfer.id;
      await db.update(creatorWithdrawalsTable).set({ stripeTransferId: transferId, updatedAt: Date.now() })
        .where(eq(creatorWithdrawalsTable.id, withdrawal.id));
    }
    const payout = await stripe.payouts.create({
      amount: withdrawal.amountCents, currency: "usd", metadata: { withdrawalId: String(withdrawal.id) },
    }, { stripeAccount: payoutAccount.stripeAccountId, idempotencyKey: `oldtime-withdrawal-payout-${withdrawal.id}` });
    const [updated] = await db.update(creatorWithdrawalsTable)
      .set({ stripeTransferId: transferId, stripePayoutId: payout.id, status: payout.status === "paid" ? "paid" : "processing", updatedAt: Date.now() })
      .where(eq(creatorWithdrawalsTable.id, withdrawal.id)).returning();
    return updated ?? withdrawal;
  }
  const payout = await stripe.payouts.retrieve(withdrawal.stripePayoutId, {}, { stripeAccount: payoutAccount.stripeAccountId });
  if (!terminalPayoutStatuses.has(payout.status)) return withdrawal;
  if (payout.status === "paid") {
    const [updated] = await db.update(creatorWithdrawalsTable).set({ status: "paid", updatedAt: Date.now() })
      .where(and(eq(creatorWithdrawalsTable.id, withdrawal.id), eq(creatorWithdrawalsTable.status, "processing"))).returning();
    return updated ?? withdrawal;
  }
  // A failed connected-account payout leaves its transfer available to reverse.
  try {
    if (withdrawal.stripeTransferId) await stripe.transfers.createReversal(withdrawal.stripeTransferId, {}, { idempotencyKey: `oldtime-withdrawal-reversal-${withdrawal.id}` });
    await refundFailedWithdrawal(withdrawal.id, payout.failure_message ?? "The payout was not completed.");
  } catch {
    await db.update(creatorWithdrawalsTable).set({ status: "reversal_pending", failureReason: "The payout needs review.", updatedAt: Date.now() })
      .where(and(eq(creatorWithdrawalsTable.id, withdrawal.id), eq(creatorWithdrawalsTable.status, "processing")));
  }
  return (await db.select().from(creatorWithdrawalsTable).where(eq(creatorWithdrawalsTable.id, withdrawal.id)).limit(1))[0] ?? withdrawal;
}

async function roomById(roomId: number, liveOnly = true) {
  const conditions = [eq(currentEventRoomsTable.id, roomId)];
  if (liveOnly) conditions.push(eq(currentEventRoomsTable.isLive, true));
  const [room] = await db
    .select()
    .from(currentEventRoomsTable)
    .where(and(...conditions))
    .limit(1);
  return room;
}

async function participantFor(roomId: number, userId: number) {
  const [participant] = await db
    .select()
    .from(currentEventParticipantsTable)
    .where(and(eq(currentEventParticipantsTable.roomId, roomId), eq(currentEventParticipantsTable.userId, userId)))
    .limit(1);
  return participant;
}

async function serializeRoom(room: Room, viewerId: number) {
  const participants = await db
    .select({
      id: currentEventParticipantsTable.id,
      userId: currentEventParticipantsTable.userId,
      role: currentEventParticipantsTable.role,
      muted: currentEventParticipantsTable.muted,
      handRaised: currentEventParticipantsTable.handRaised,
      joinedAt: currentEventParticipantsTable.joinedAt,
      name: usersTable.name,
      username: usersTable.username,
    })
    .from(currentEventParticipantsTable)
    .innerJoin(usersTable, eq(usersTable.id, currentEventParticipantsTable.userId))
    .where(eq(currentEventParticipantsTable.roomId, room.id))
    .orderBy(asc(currentEventParticipantsTable.joinedAt));
  const viewer = participants.find((participant) => participant.userId === viewerId);
  const speakerCount = participants.filter((participant) => ["host", "moderator", "speaker"].includes(participant.role)).length;
  const listenerCount = participants.length - speakerCount;
  return {
    id: room.id,
    clubName: room.clubName,
    title: room.title,
    topic: room.topic,
    isOpen: room.isOpen,
    isLive: room.isLive,
    hostId: room.hostId,
    latitude: room.latitude,
    longitude: room.longitude,
    createdAt: room.createdAt,
    participants: participants.map((participant) => ({
      id: participant.id,
      user: { id: participant.userId, name: participant.name, username: usernameFor({ id: participant.userId, name: participant.name, username: participant.username }) },
      role: roles.safeParse(participant.role).success ? participant.role : "listener",
      muted: participant.muted,
      handRaised: participant.handRaised,
      joinedAt: participant.joinedAt,
    })),
    counts: { speakers: speakerCount, listeners: listenerCount },
    viewer: {
      participantId: viewer?.id ?? null,
      role: viewer ? (roles.safeParse(viewer.role).success ? viewer.role : "listener") : null,
      muted: viewer?.muted ?? true,
      handRaised: viewer?.handRaised ?? false,
    },
    audio: audioStatus(),
  };
}

async function sendRoom(res: Response, roomId: number, viewerId: number) {
  const room = await roomById(roomId);
  if (!room) {
    res.status(404).json({ error: "Current Event room not found." });
    return null;
  }
  const serialized = await serializeRoom(room, viewerId);
  res.json(serialized);
  return serialized;
}

async function requireRoomParticipant(roomId: number, userId: number) {
  const room = await roomById(roomId);
  if (!room) return { room: null, participant: null };
  return { room, participant: await participantFor(roomId, userId) };
}

router.get("/current-events/rooms", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res);
  if (viewerId === null) return;
  const parsed = z.object({
    topic: topics.optional(),
    latitude: z.coerce.number().finite().min(-90).max(90).optional(),
    longitude: z.coerce.number().finite().min(-180).max(180).optional(),
    radiusKm: z.coerce.number().finite().min(0.1).max(50).default(25),
  }).safeParse(req.query);
  if (!parsed.success || ((parsed.data.latitude === undefined) !== (parsed.data.longitude === undefined))) {
    res.status(400).json({ error: "Room filters are invalid." });
    return;
  }
  const rooms = await db
    .select()
    .from(currentEventRoomsTable)
    .where(and(eq(currentEventRoomsTable.isLive, true), parsed.data.topic ? eq(currentEventRoomsTable.topic, parsed.data.topic) : sql`true`))
    .orderBy(desc(currentEventRoomsTable.createdAt))
    .limit(100);
  const latitude = parsed.data.latitude;
  const longitude = parsed.data.longitude;
  const items: Array<Awaited<ReturnType<typeof serializeRoom>>> = [];
  for (const room of rooms) {
    if (latitude !== undefined && longitude !== undefined && room.latitude !== null && room.longitude !== null
      && distanceKm({ latitude, longitude }, { latitude: room.latitude, longitude: room.longitude }) > parsed.data.radiusKm) continue;
    items.push(await serializeRoom(room, viewerId));
  }
  res.json({ items });
});

router.post("/current-events/rooms", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res);
  if (viewerId === null) return;
  const parsed = roomInput.safeParse(req.body);
  if (!parsed.success || ((parsed.data.latitude === undefined) !== (parsed.data.longitude === undefined))) {
    res.status(400).json({ error: "A room title, topic, and matching map coordinates are required." });
    return;
  }
  const now = Date.now();
  const [room] = await db.insert(currentEventRoomsTable).values({
    ...parsed.data,
    latitude: parsed.data.latitude ?? null,
    longitude: parsed.data.longitude ?? null,
    hostId: viewerId,
    createdAt: now,
  }).returning();
  await db.insert(currentEventParticipantsTable).values({
    roomId: room.id,
    userId: viewerId,
    role: "host",
    muted: false,
    handRaised: false,
    joinedAt: now,
  });
  await ensureWallet(viewerId);
  const serialized = await serializeRoom(room, viewerId);
  emitToCurrentEventRoom(room.id, "current-event-room-updated", { roomId: room.id });
  res.status(201).json(serialized);
});

router.get("/current-events/rooms/:roomId", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res);
  const roomId = parseId(req.params.roomId);
  if (viewerId === null) return;
  if (roomId === null) {
    res.status(400).json({ error: "A valid room ID is required." });
    return;
  }
  const room = await roomById(roomId, false);
  if (!room) {
    res.status(404).json({ error: "Current Event room not found." });
    return;
  }
  res.json(await serializeRoom(room, viewerId));
});

router.post("/current-events/rooms/:roomId/join", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res);
  const roomId = parseId(req.params.roomId);
  if (viewerId === null) return;
  if (roomId === null) {
    res.status(400).json({ error: "A valid room ID is required." });
    return;
  }
  const room = await roomById(roomId);
  if (!room) {
    res.status(404).json({ error: "Current Event room not found." });
    return;
  }
  if (!room.isOpen && room.hostId !== viewerId) {
    res.status(403).json({ error: "This room is not open to everyone." });
    return;
  }
  const existing = await participantFor(roomId, viewerId);
  if (!existing) {
    await db.insert(currentEventParticipantsTable).values({
      roomId,
      userId: viewerId,
      role: "listener",
      muted: true,
      handRaised: false,
      joinedAt: Date.now(),
    });
  }
  await ensureWallet(viewerId);
  const serialized = await serializeRoom(room, viewerId);
  if (!existing) emitToCurrentEventRoom(roomId, "current-event-room-updated", { roomId });
  res.json(serialized);
});

router.post("/current-events/rooms/:roomId/token", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res);
  const roomId = parseId(req.params.roomId);
  if (viewerId === null) return;
  if (roomId === null) {
    res.status(400).json({ error: "A valid room ID is required." });
    return;
  }
  const membership = await requireRoomParticipant(roomId, viewerId);
  if (!membership.room || !membership.participant) {
    res.status(403).json({ error: "Join the room before connecting to audio." });
    return;
  }
  if (!liveKitConfigured()) {
    res.status(503).json({ error: "Live audio is not configured." });
    return;
  }
  const canPublish = ["host", "moderator", "speaker"].includes(membership.participant.role)
    && !membership.participant.muted;
  const roomName = `current_event_${roomId}`;
  res.json({
    token: await createLiveKitToken({ room: roomName, userId: viewerId, canPublish }),
    url: liveKitPublicUrl(),
    roomName,
    canPublish,
  });
});

router.post("/current-events/rooms/:roomId/leave", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res);
  const roomId = parseId(req.params.roomId);
  if (viewerId === null) return;
  if (roomId === null) {
    res.status(400).json({ error: "A valid room ID is required." });
    return;
  }
  const room = await roomById(roomId);
  if (!room) {
    res.status(404).json({ error: "Current Event room not found." });
    return;
  }
  if (room.hostId === viewerId) {
    // Room chat is ephemeral. The current message model has no saved flag, so
    // every message is removed with the room; a future saved-message field
    // must be excluded from this cleanup.
    await db.transaction(async (tx) => {
      await tx.update(currentEventRoomsTable).set({ isLive: false, endedAt: Date.now() }).where(eq(currentEventRoomsTable.id, roomId));
      await tx.delete(currentEventMessagesTable).where(eq(currentEventMessagesTable.roomId, roomId));
      await tx.delete(currentEventParticipantsTable).where(eq(currentEventParticipantsTable.roomId, roomId));
    });
  } else {
    await db.delete(currentEventParticipantsTable).where(and(eq(currentEventParticipantsTable.roomId, roomId), eq(currentEventParticipantsTable.userId, viewerId)));
  }
  emitToCurrentEventRoom(roomId, "current-event-room-updated", { roomId, ended: room.hostId === viewerId });
  if (room.hostId === viewerId) {
    await evictCurrentEventRoom(roomId);
  } else {
    await evictUserFromCurrentEventRoom(viewerId, roomId);
  }
  res.json({ success: true });
});

router.post("/current-events/rooms/:roomId/hand", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res);
  const roomId = parseId(req.params.roomId);
  const parsed = handInput.safeParse(req.body);
  if (viewerId === null) return;
  if (roomId === null || !parsed.success) {
    res.status(400).json({ error: "A valid room and hand state are required." });
    return;
  }
  const membership = await requireRoomParticipant(roomId, viewerId);
  if (!membership.room || !membership.participant) {
    res.status(403).json({ error: "Join the room before raising your hand." });
    return;
  }
  await db.update(currentEventParticipantsTable)
    .set({ handRaised: parsed.data.raised })
    .where(and(eq(currentEventParticipantsTable.roomId, roomId), eq(currentEventParticipantsTable.userId, viewerId), eq(currentEventParticipantsTable.role, "listener")));
  const serialized = await sendRoom(res, roomId, viewerId);
  if (serialized) emitToCurrentEventRoom(roomId, "current-event-room-updated", { roomId });
});

router.patch("/current-events/rooms/:roomId/participants/:participantId", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res);
  const roomId = parseId(req.params.roomId);
  const participantId = parseId(req.params.participantId);
  const parsed = participantAction.safeParse(req.body);
  if (viewerId === null) return;
  if (roomId === null || participantId === null || !parsed.success) {
    res.status(400).json({ error: "A valid participant action is required." });
    return;
  }
  const actor = await participantFor(roomId, viewerId);
  const room = await roomById(roomId);
  const target = await db.select().from(currentEventParticipantsTable).where(and(eq(currentEventParticipantsTable.id, participantId), eq(currentEventParticipantsTable.roomId, roomId))).limit(1);
  if (!room || !actor || !target[0]) {
    res.status(404).json({ error: "Room participant not found." });
    return;
  }
  if (actor.role !== "host" && actor.role !== "moderator") {
    res.status(403).json({ error: "Only hosts and moderators can manage the stage." });
    return;
  }
  if (target[0].role === "host") {
    res.status(400).json({ error: "The host cannot be changed here." });
    return;
  }
  const action = parsed.data.action;
  if (action === "remove") {
    await db.delete(currentEventParticipantsTable).where(eq(currentEventParticipantsTable.id, participantId));
  } else if (action === "promote") {
    await db.update(currentEventParticipantsTable).set({ role: "speaker", muted: false, handRaised: false }).where(eq(currentEventParticipantsTable.id, participantId));
  } else if (action === "demote") {
    await db.update(currentEventParticipantsTable).set({ role: "listener", muted: true, handRaised: false }).where(eq(currentEventParticipantsTable.id, participantId));
  } else {
    await db.update(currentEventParticipantsTable).set({ muted: action === "mute" }).where(eq(currentEventParticipantsTable.id, participantId));
  }
  const serialized = await sendRoom(res, roomId, viewerId);
  if (serialized) emitToCurrentEventRoom(roomId, "current-event-room-updated", { roomId });
  if (action === "remove") await evictUserFromCurrentEventRoom(target[0].userId, roomId);
});

router.get("/current-events/rooms/:roomId/messages", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res);
  const roomId = parseId(req.params.roomId);
  if (viewerId === null) return;
  if (roomId === null) {
    res.status(400).json({ error: "A valid room ID is required." });
    return;
  }
  const membership = await requireRoomParticipant(roomId, viewerId);
  if (!membership.room || !membership.participant) {
    res.status(403).json({ error: "Join the room to read its chat." });
    return;
  }
  const rows = await db
    .select({
      id: currentEventMessagesTable.id,
      roomId: currentEventMessagesTable.roomId,
      senderId: currentEventMessagesTable.senderId,
      content: currentEventMessagesTable.content,
      createdAt: currentEventMessagesTable.createdAt,
      name: usersTable.name,
      username: usersTable.username,
    })
    .from(currentEventMessagesTable)
    .innerJoin(usersTable, eq(usersTable.id, currentEventMessagesTable.senderId))
    .where(eq(currentEventMessagesTable.roomId, roomId))
    .orderBy(desc(currentEventMessagesTable.createdAt))
    .limit(100);
  res.json({ items: rows.reverse().map((row) => ({ id: row.id, roomId: row.roomId, sender: { id: row.senderId, name: row.name, username: usernameFor({ id: row.senderId, name: row.name, username: row.username }) }, content: row.content, createdAt: row.createdAt })) });
});

router.post("/current-events/rooms/:roomId/messages", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res);
  const roomId = parseId(req.params.roomId);
  const parsed = messageInput.safeParse(req.body);
  if (viewerId === null) return;
  if (roomId === null || !parsed.success) {
    res.status(400).json({ error: "A valid room and message are required." });
    return;
  }
  const membership = await requireRoomParticipant(roomId, viewerId);
  if (!membership.room || !membership.participant) {
    res.status(403).json({ error: "Join the room to send a message." });
    return;
  }
  const [message] = await db.insert(currentEventMessagesTable).values({ roomId, senderId: viewerId, content: parsed.data.content, createdAt: Date.now() }).returning();
  const [sender] = await db.select({ id: usersTable.id, name: usersTable.name, username: usersTable.username }).from(usersTable).where(eq(usersTable.id, viewerId));
  const serialized = { id: message.id, roomId, sender: { id: sender.id, name: sender.name, username: usernameFor(sender) }, content: message.content, createdAt: message.createdAt };
  emitToCurrentEventRoom(roomId, "current-event-message", serialized);
  res.status(201).json(serialized);
});

router.post("/current-events/rooms/:roomId/gifts", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res);
  const roomId = parseId(req.params.roomId);
  const parsed = giftInput.safeParse(req.body);
  if (viewerId === null) return;
  if (roomId === null || !parsed.success) {
    res.status(400).json({ error: "A valid room and gift are required." });
    return;
  }
  const membership = await requireRoomParticipant(roomId, viewerId);
  const recipientParticipant = await participantFor(roomId, parsed.data.recipientId);
  if (!membership.room || !membership.participant || !recipientParticipant || !["host", "moderator", "speaker"].includes(recipientParticipant.role)) {
    res.status(400).json({ error: "Gifts can only be sent to a room speaker." });
    return;
  }
  const coins = giftPrices[parsed.data.gift];
  const gold = Math.floor(coins * 0.8);
  const result = await db.transaction(async (tx) => {
    await tx.insert(currentEventWalletsTable).values({ userId: viewerId, updatedAt: Date.now() }).onConflictDoNothing();
    await tx.insert(currentEventWalletsTable).values({ userId: parsed.data.recipientId, updatedAt: Date.now() }).onConflictDoNothing();
    const [debited] = await tx.update(currentEventWalletsTable)
      .set({ coins: sql`${currentEventWalletsTable.coins} - ${coins}`, updatedAt: Date.now() })
      .where(and(eq(currentEventWalletsTable.userId, viewerId), gte(currentEventWalletsTable.coins, coins)))
      .returning({ coins: currentEventWalletsTable.coins });
    if (!debited) return null;
    await tx.update(currentEventWalletsTable)
      .set({ gold: sql`${currentEventWalletsTable.gold} + ${gold}`, updatedAt: Date.now() })
      .where(eq(currentEventWalletsTable.userId, parsed.data.recipientId));
    const [giftRecord] = await tx.insert(currentEventGiftsTable).values({ roomId, senderId: viewerId, recipientId: parsed.data.recipientId, gift: parsed.data.gift, coins, gold, createdAt: Date.now() }).returning();
    return { coinsRemaining: debited.coins, giftRecord };
  });
  if (result === null) {
    res.status(402).json({ error: "You need more coins to send this gift." });
    return;
  }
  const [sender, recipientUser] = await Promise.all([
    db.select({ id: usersTable.id, name: usersTable.name, username: usersTable.username }).from(usersTable).where(eq(usersTable.id, viewerId)).limit(1),
    db.select({ id: usersTable.id, name: usersTable.name, username: usersTable.username }).from(usersTable).where(eq(usersTable.id, parsed.data.recipientId)).limit(1),
  ]);
  emitToCurrentEventRoom(roomId, "current-event-gift", {
    id: result.giftRecord.id,
    roomId,
    senderId: viewerId,
    senderName: sender[0]?.name ?? "Old Time member",
    recipientId: parsed.data.recipientId,
    recipientName: recipientUser[0]?.name ?? "speaker",
    gift: parsed.data.gift,
    coins,
    gold,
    createdAt: result.giftRecord.createdAt,
  });
  res.json({ success: true, gift: parsed.data.gift, coinsSpent: coins, goldEarned: gold, coinsRemaining: result.coinsRemaining });
});

router.get("/current-events/wallet", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res);
  if (viewerId === null) return;
  await ensureWallet(viewerId);
  const [wallet] = await db.select().from(currentEventWalletsTable).where(eq(currentEventWalletsTable.userId, viewerId));
  res.json({ coins: wallet?.coins ?? 0, gold: wallet?.gold ?? 0, pendingGold: wallet?.pendingGold ?? 0 });
});

router.post("/current-events/wallet/sync-purchases", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res);
  if (viewerId === null) return;
  try {
    const purchases = await getVerifiedCoinPurchases(viewerId);
    const creditedCoins = await db.transaction(async (tx) => {
      await tx.insert(currentEventWalletsTable).values({ userId: viewerId, updatedAt: Date.now() }).onConflictDoNothing();
      let total = 0;
      for (const purchase of purchases) {
        const inserted = await tx.insert(currentEventCoinPurchasesTable)
          .values({ ...purchase, userId: viewerId, creditedAt: Date.now() })
          .onConflictDoNothing()
          .returning({ purchaseId: currentEventCoinPurchasesTable.purchaseId });
        if (inserted.length) total += purchase.coins;
      }
      if (total > 0) {
        await tx.update(currentEventWalletsTable)
          .set({ coins: sql`${currentEventWalletsTable.coins} + ${total}`, updatedAt: Date.now() })
          .where(eq(currentEventWalletsTable.userId, viewerId));
      }
      return total;
    });
    const [wallet] = await db.select().from(currentEventWalletsTable).where(eq(currentEventWalletsTable.userId, viewerId));
    res.json({ creditedCoins, wallet: { coins: wallet.coins, gold: wallet.gold, pendingGold: wallet.pendingGold } });
  } catch (error) {
    req.log?.error?.({ err: error }, "RevenueCat wallet synchronization failed");
    res.status(503).json({ error: "Purchases could not be verified right now. Your purchase is safe; try restoring it shortly." });
  }
});

// Stripe redirects here only after an account-link flow. There is deliberately
// no caller-controlled return URL in this API.
router.get("/current-events/payouts/onboarding/return", (_req, res): void => {
  res.type("html").send(payoutHtml());
});
router.get("/current-events/payouts/onboarding/refresh", (_req, res): void => {
  res.type("html").send(payoutHtml());
});

router.get("/current-events/payouts/settings", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res);
  if (viewerId === null) return;
  try {
    const account = await refreshPayoutAccount(viewerId);
    const destination = account ? await payoutDestination(account.stripeAccountId) : null;
    res.json({
      account: account ? {
        configured: true,
        detailsSubmitted: account.detailsSubmitted,
        payoutsEnabled: account.payoutsEnabled,
        status: account.status,
      } : { configured: false, detailsSubmitted: false, payoutsEnabled: false, status: "not_started" },
      minimumGold: MINIMUM_WITHDRAWAL_GOLD,
      goldPerUsd: GOLD_PER_USD,
      currency: "usd",
      payoutDestination: destination,
    });
  } catch (error) {
    req.log?.error?.({ err: error, userId: viewerId }, "Unable to refresh creator payout account");
    res.status(503).json({ error: "Payout settings are unavailable right now. Please try again." });
  }
});

router.post("/current-events/payouts/onboarding", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res);
  if (viewerId === null) return;
  const returnUrl = safePayoutUrl(req, "return");
  const refreshUrl = safePayoutUrl(req, "refresh");
  if (!returnUrl || !refreshUrl) {
    res.status(400).json({ error: "Payout setup requires a secure HTTPS connection." });
    return;
  }
  try {
    let [stored] = await db.select().from(creatorPayoutAccountsTable).where(eq(creatorPayoutAccountsTable.userId, viewerId)).limit(1);
    const stripe = await getUncachableStripeClient();
    if (!stored) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "US",
        capabilities: { transfers: { requested: true } },
        metadata: { oldtimeUserId: String(viewerId) },
      }, { idempotencyKey: `oldtime-creator-account-${viewerId}` });
      const now = Date.now();
      const inserted = await db.insert(creatorPayoutAccountsTable).values({
        userId: viewerId, stripeAccountId: account.id, detailsSubmitted: account.details_submitted,
        payoutsEnabled: account.payouts_enabled, status: accountStatus(account), createdAt: now, updatedAt: now,
      }).onConflictDoNothing().returning();
      stored = inserted[0] ?? (await db.select().from(creatorPayoutAccountsTable).where(eq(creatorPayoutAccountsTable.userId, viewerId)).limit(1))[0];
    }
    const stripeAccount = await stripe.accounts.retrieve(stored.stripeAccountId);
    if (!("deleted" in stripeAccount && stripeAccount.deleted)) {
      await db.update(creatorPayoutAccountsTable).set({
        detailsSubmitted: stripeAccount.details_submitted,
        payoutsEnabled: stripeAccount.payouts_enabled,
        status: accountStatus(stripeAccount),
        updatedAt: Date.now(),
      }).where(eq(creatorPayoutAccountsTable.userId, viewerId));
    }
    if (!("deleted" in stripeAccount && stripeAccount.deleted) && stripeAccount.type === "express" && stripeAccount.details_submitted) {
      const loginLink = await stripe.accounts.createLoginLink(stored.stripeAccountId);
      res.json({ url: loginLink.url, expiresAt: null });
      return;
    }
    const link = await stripe.accountLinks.create({
      account: stored.stripeAccountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    });
    res.json({ url: link.url, expiresAt: link.expires_at * 1000 });
  } catch (error) {
    req.log?.error?.({ err: error, userId: viewerId }, "Unable to create creator onboarding link");
    res.status(503).json({ error: "Payout setup is unavailable right now. Please try again." });
  }
});

router.get("/current-events/payouts/withdrawals", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res);
  if (viewerId === null) return;
  try {
    const withdrawals = await db.select().from(creatorWithdrawalsTable)
      .where(eq(creatorWithdrawalsTable.userId, viewerId)).orderBy(desc(creatorWithdrawalsTable.createdAt)).limit(100);
    const refreshed = await Promise.all(withdrawals.map(refreshWithdrawal));
    res.json({ items: refreshed.map(serializeWithdrawal) });
  } catch (error) {
    req.log?.error?.({ err: error, userId: viewerId }, "Unable to retrieve withdrawal history");
    res.status(503).json({ error: "Withdrawal history is unavailable right now. Please try again." });
  }
});

router.post("/current-events/payouts/withdrawals", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res);
  const parsed = withdrawalInput.safeParse(req.body);
  if (viewerId === null) return;
  if (!parsed.success || parsed.data.gold % GOLD_PER_USD !== 0) {
    res.status(400).json({ error: "Withdrawals must be whole US dollars and at least $10." });
    return;
  }
  try {
    const account = await refreshPayoutAccount(viewerId);
    if (!account?.detailsSubmitted || !account.payoutsEnabled) {
      res.status(400).json({ error: "Finish payout setup before requesting a withdrawal." });
      return;
    }
    const now = Date.now();
    const withdrawal = await db.transaction(async (tx) => {
      await tx.insert(currentEventWalletsTable).values({ userId: viewerId, updatedAt: now }).onConflictDoNothing();
      const [wallet] = await tx.update(currentEventWalletsTable)
        .set({ gold: sql`${currentEventWalletsTable.gold} - ${parsed.data.gold}`, updatedAt: now })
        .where(and(eq(currentEventWalletsTable.userId, viewerId), gte(currentEventWalletsTable.gold, parsed.data.gold)))
        .returning({ gold: currentEventWalletsTable.gold });
      if (!wallet) return null;
      const [created] = await tx.insert(creatorWithdrawalsTable).values({
        userId: viewerId, gold: parsed.data.gold, amountCents: (parsed.data.gold / GOLD_PER_USD) * 100,
        currency: "usd", status: "processing", createdAt: now, updatedAt: now,
      }).returning();
      return created;
    });
    if (!withdrawal) {
      res.status(400).json({ error: "You do not have enough withdrawable Gold." });
      return;
    }
    let transferId: string | null = null;
    let stripe: Awaited<ReturnType<typeof getUncachableStripeClient>> | null = null;
    try {
      stripe = await getUncachableStripeClient();
      const transfer = await stripe.transfers.create({
        amount: withdrawal.amountCents, currency: "usd", destination: account.stripeAccountId,
        metadata: { withdrawalId: String(withdrawal.id), oldtimeUserId: String(viewerId) },
      }, { idempotencyKey: `oldtime-withdrawal-transfer-${withdrawal.id}` });
      transferId = transfer.id;
      await db.update(creatorWithdrawalsTable).set({ stripeTransferId: transfer.id, updatedAt: Date.now() })
        .where(eq(creatorWithdrawalsTable.id, withdrawal.id));
      const payout = await stripe.payouts.create({ amount: withdrawal.amountCents, currency: "usd", metadata: { withdrawalId: String(withdrawal.id) } },
        { stripeAccount: account.stripeAccountId, idempotencyKey: `oldtime-withdrawal-payout-${withdrawal.id}` });
      const [updated] = await db.update(creatorWithdrawalsTable).set({ stripePayoutId: payout.id, status: payout.status === "paid" ? "paid" : "processing", updatedAt: Date.now() })
        .where(eq(creatorWithdrawalsTable.id, withdrawal.id)).returning();
      res.status(201).json(serializeWithdrawal(updated));
    } catch (error) {
      try {
        if (transferId && stripe) await stripe.transfers.createReversal(transferId, {}, { idempotencyKey: `oldtime-withdrawal-reversal-${withdrawal.id}` });
        await refundFailedWithdrawal(withdrawal.id, "The payment provider could not process the withdrawal.");
        res.status(503).json({ error: "Your withdrawal could not be processed. Your Gold has been returned." });
      } catch (reversalError) {
        await db.update(creatorWithdrawalsTable).set({ status: "reversal_pending", failureReason: "The withdrawal needs review.", updatedAt: Date.now() })
          .where(and(eq(creatorWithdrawalsTable.id, withdrawal.id), eq(creatorWithdrawalsTable.status, "processing")));
        req.log?.error?.({ err: reversalError, withdrawalId: withdrawal.id }, "Creator withdrawal reversal failed");
        res.status(503).json({ error: "Your withdrawal needs review. Please contact support." });
      }
    }
  } catch (error) {
    req.log?.error?.({ err: error, userId: viewerId }, "Unable to request creator withdrawal");
    res.status(503).json({ error: "Withdrawals are unavailable right now. Please try again." });
  }
});

export default router;