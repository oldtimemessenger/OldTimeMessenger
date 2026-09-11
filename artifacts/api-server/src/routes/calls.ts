import { Router, type IRouter } from "express";
import { and, desc, eq, inArray, lt, or, sql } from "drizzle-orm";
import { z } from "@workspace/api-zod";
import { callsTable, db, usersTable } from "@workspace/db";
import { requireChatAuth } from "../lib/chat-auth";
import { createLiveKitToken, liveKitConfigured, liveKitPublicUrl } from "../lib/livekit";
import { sendPushToUsers } from "../lib/push-notifications";
import { emitToUser } from "../lib/realtime";
import { ACCEPTED_CALL_MAX_MS, isCallTerminal } from "../lib/call-lifecycle";

const router: IRouter = Router();
const callIdSchema = z.coerce.number().int().positive();
const startCallInput = z.object({
  calleeId: z.coerce.number().int().positive(),
  type: z.enum(["voice", "video"]).default("voice"),
});
const RING_TIMEOUT_MS = 60_000;

function callRoomName(callId: number): string {
  return `call_${callId}`;
}

async function expireStaleCalls(): Promise<void> {
  const timestamp = Date.now();
  const missed = await db.update(callsTable)
    .set({ status: "missed", missedAt: timestamp })
    .where(and(eq(callsTable.status, "ringing"), lt(callsTable.createdAt, timestamp - RING_TIMEOUT_MS)))
    .returning();
  const ended = await db.update(callsTable)
    .set({ status: "ended", endedAt: timestamp })
    .where(and(eq(callsTable.status, "accepted"), lt(callsTable.acceptedAt, timestamp - ACCEPTED_CALL_MAX_MS)))
    .returning();
  for (const call of [...missed, ...ended]) {
    const payload = { callId: call.id, status: call.status, endedAt: call.endedAt, missedAt: call.missedAt };
    emitToUser(call.callerId, "call-updated", payload);
    emitToUser(call.calleeId, "call-updated", payload);
  }
}

const missedCallExpiryTimer = setInterval(() => {
  void expireStaleCalls().catch((error) => console.error("Call expiry failed", error));
}, 15_000);
missedCallExpiryTimer.unref();

function serializeCall(call: typeof callsTable.$inferSelect) {
  return {
    id: call.id,
    callerId: call.callerId,
    calleeId: call.calleeId,
    type: call.type,
    status: call.status,
    roomName: call.roomName,
    createdAt: call.createdAt,
    acceptedAt: call.acceptedAt,
    declinedAt: call.declinedAt,
    endedAt: call.endedAt,
    missedAt: call.missedAt,
    durationSeconds: call.acceptedAt && call.endedAt
      ? Math.max(0, Math.floor((call.endedAt - call.acceptedAt) / 1000))
      : 0,
  };
}

async function serializeCallForUser(call: typeof callsTable.$inferSelect, userId: number) {
  const otherUserId = call.callerId === userId ? call.calleeId : call.callerId;
  const [otherUser] = await db.select({ id: usersTable.id, name: usersTable.name })
    .from(usersTable)
    .where(eq(usersTable.id, otherUserId))
    .limit(1);
  return {
    ...serializeCall(call),
    otherUser: otherUser ? { id: otherUser.id, name: otherUser.name } : null,
  };
}

async function callForParticipant(callId: number, userId: number) {
  await expireStaleCalls();
  const [call] = await db.select().from(callsTable).where(and(
    eq(callsTable.id, callId),
    or(eq(callsTable.callerId, userId), eq(callsTable.calleeId, userId)),
  )).limit(1);
  return call;
}

function emitCall(call: typeof callsTable.$inferSelect): void {
  const payload = serializeCall(call);
  emitToUser(call.callerId, "call-updated", payload);
  emitToUser(call.calleeId, "call-updated", payload);
}

router.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

router.get("/calls", async (req, res): Promise<void> => {
  const userId = await requireChatAuth(req, res);
  if (userId === null) return;
  await expireStaleCalls();
  const calls = await db.select().from(callsTable)
    .where(or(eq(callsTable.callerId, userId), eq(callsTable.calleeId, userId)))
    .orderBy(desc(callsTable.createdAt)).limit(100);
  res.json({ items: await Promise.all(calls.map((call) => serializeCallForUser(call, userId))) });
});

router.post("/calls", async (req, res): Promise<void> => {
  const callerId = await requireChatAuth(req, res);
  const parsed = startCallInput.safeParse(req.body);
  if (callerId === null) return;
  if (!parsed.success || parsed.data.calleeId === callerId) {
    res.status(400).json({ error: "Choose another Old Time user to call." });
    return;
  }
  await expireStaleCalls();
  const [callee] = await db.select({ id: usersTable.id }).from(usersTable)
    .where(eq(usersTable.id, parsed.data.calleeId)).limit(1);
  if (!callee) {
    res.status(404).json({ error: "The person you are calling was not found." });
    return;
  }
  // Both locks are acquired in numeric order so concurrent requests across
  // server instances cannot create overlapping calls for either participant.
  const created = await db.transaction(async (tx) => {
    for (const id of [callerId, callee.id].sort((left, right) => left - right)) {
      await tx.execute(sql`select pg_advisory_xact_lock(${id})`);
    }
    const active = await tx.select({ id: callsTable.id }).from(callsTable).where(and(
      inArray(callsTable.status, ["ringing", "accepted"]),
      or(
        eq(callsTable.callerId, callerId), eq(callsTable.calleeId, callerId),
        eq(callsTable.callerId, callee.id), eq(callsTable.calleeId, callee.id),
      ),
    )).limit(1);
    if (active[0]) return null;
    const timestamp = Date.now();
    const [call] = await tx.insert(callsTable).values({
      callerId, calleeId: callee.id, type: parsed.data.type, status: "ringing", roomName: "pending", createdAt: timestamp,
    }).returning();
    const [updated] = await tx.update(callsTable).set({ roomName: callRoomName(call.id) })
      .where(eq(callsTable.id, call.id)).returning();
    return updated;
  });
  if (!created) {
    res.status(409).json({ error: "One of you is already in an active call." });
    return;
  }
  emitCall(created);
  void sendPushToUsers([callee.id], {
    title: parsed.data.type === "video" ? "Incoming video call" : "Incoming audio call",
    body: parsed.data.type === "video" ? "You have an incoming Old Time video call." : "You have an incoming Old Time audio call.",
    data: { callId: created.id, route: "call", type: parsed.data.type },
  });
  res.status(201).json(await serializeCallForUser(created, callerId));
});

router.get("/calls/:callId", async (req, res): Promise<void> => {
  const userId = await requireChatAuth(req, res);
  const callId = callIdSchema.safeParse(req.params.callId);
  if (userId === null) return;
  if (!callId.success) { res.status(400).json({ error: "A valid call ID is required." }); return; }
  const call = await callForParticipant(callId.data, userId);
  if (!call) { res.status(404).json({ error: "Call not found." }); return; }
  res.json(await serializeCallForUser(call, userId));
});

router.post("/calls/:callId/accept", async (req, res): Promise<void> => {
  const userId = await requireChatAuth(req, res);
  const parsed = callIdSchema.safeParse(req.params.callId);
  if (userId === null) return;
  if (!parsed.success) { res.status(400).json({ error: "A valid call ID is required." }); return; }
  const call = await callForParticipant(parsed.data, userId);
  if (!call) { res.status(404).json({ error: "Call not found." }); return; }
  if (call.calleeId !== userId) { res.status(403).json({ error: "Only the recipient can accept this call." }); return; }
  if (call.status === "accepted") { res.json(await serializeCallForUser(call, userId)); return; }
  if (call.status !== "ringing") { res.status(409).json({ error: "This call cannot be accepted." }); return; }
  const [updated] = await db.update(callsTable).set({ status: "accepted", acceptedAt: Date.now() })
    .where(and(eq(callsTable.id, call.id), eq(callsTable.status, "ringing"))).returning();
  if (!updated) {
    const latest = await callForParticipant(call.id, userId);
    if (latest?.status === "accepted") { res.json(await serializeCallForUser(latest, userId)); return; }
    res.status(409).json({ error: "This call has already changed." }); return;
  }
  emitCall(updated); res.json(await serializeCallForUser(updated, userId));
});

router.post("/calls/:callId/decline", async (req, res): Promise<void> => {
  const userId = await requireChatAuth(req, res);
  const parsed = callIdSchema.safeParse(req.params.callId);
  if (userId === null) return;
  if (!parsed.success) { res.status(400).json({ error: "A valid call ID is required." }); return; }
  const call = await callForParticipant(parsed.data, userId);
  if (!call) { res.status(404).json({ error: "Call not found." }); return; }
  if (call.calleeId !== userId) { res.status(403).json({ error: "Only the recipient can decline this call." }); return; }
  if (call.status === "declined") { res.json(await serializeCallForUser(call, userId)); return; }
  if (call.status !== "ringing") { res.status(409).json({ error: "This call cannot be declined." }); return; }
  const [updated] = await db.update(callsTable).set({ status: "declined", declinedAt: Date.now() })
    .where(and(eq(callsTable.id, call.id), eq(callsTable.status, "ringing"))).returning();
  if (!updated) {
    const latest = await callForParticipant(call.id, userId);
    if (latest?.status === "declined") { res.json(await serializeCallForUser(latest, userId)); return; }
    res.status(409).json({ error: "This call has already changed." }); return;
  }
  emitCall(updated); res.json(await serializeCallForUser(updated, userId));
});

router.post("/calls/:callId/end", async (req, res): Promise<void> => {
  const userId = await requireChatAuth(req, res);
  const parsed = callIdSchema.safeParse(req.params.callId);
  if (userId === null) return;
  if (!parsed.success) { res.status(400).json({ error: "A valid call ID is required." }); return; }
  const call = await callForParticipant(parsed.data, userId);
  if (!call) { res.status(404).json({ error: "Call not found." }); return; }
  // Ending a call is intentionally idempotent. The other participant may have
  // ended it between the caller's last poll and this request.
  if (isCallTerminal(call.status as "ringing" | "accepted" | "declined" | "ended" | "missed")) { res.json(await serializeCallForUser(call, userId)); return; }
  const [updated] = await db.update(callsTable).set({ status: "ended", endedAt: Date.now() })
    .where(and(eq(callsTable.id, call.id), inArray(callsTable.status, ["ringing", "accepted"]))).returning();
  if (!updated) {
    const latest = await callForParticipant(call.id, userId);
    if (latest && isCallTerminal(latest.status as "ringing" | "accepted" | "declined" | "ended" | "missed")) {
      res.json(await serializeCallForUser(latest, userId));
      return;
    }
    res.status(409).json({ error: "This call has already changed." }); return;
  }
  emitCall(updated); res.json(await serializeCallForUser(updated, userId));
});

router.post("/calls/:callId/token", async (req, res): Promise<void> => {
  const userId = await requireChatAuth(req, res);
  const parsed = callIdSchema.safeParse(req.params.callId);
  if (userId === null) return;
  if (!parsed.success) { res.status(400).json({ error: "A valid call ID is required." }); return; }
  const call = await callForParticipant(parsed.data, userId);
  if (!call) { res.status(404).json({ error: "Call not found." }); return; }
  if (call.status !== "accepted") { res.status(409).json({ error: "Accept the call before joining audio." }); return; }
  if (!liveKitConfigured()) { res.status(503).json({ error: "Live audio is not configured." }); return; }
  res.json({ token: await createLiveKitToken({ room: call.roomName, userId, canPublish: true }), url: liveKitPublicUrl(), roomName: call.roomName });
});

export default router;