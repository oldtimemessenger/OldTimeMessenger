import { Router, type IRouter } from "express";
import { and, desc, eq, inArray, lt, or, sql } from "drizzle-orm";
import { z } from "@workspace/api-zod";
import { callsTable, db, usersTable } from "@workspace/db";
import { requireChatAuth } from "../lib/chat-auth";
import { createLiveKitToken, liveKitConfigured, liveKitPublicUrl } from "../lib/livekit";
import { sendPushToUsers } from "../lib/push-notifications";
import { emitToUser } from "../lib/realtime";

const router: IRouter = Router();
const callIdSchema = z.coerce.number().int().positive();
const startCallInput = z.object({ calleeId: z.coerce.number().int().positive() });
const RING_TIMEOUT_MS = 60_000;

function callRoomName(callId: number): string {
  return `call_${callId}`;
}

async function expireMissedCalls(): Promise<void> {
  const timestamp = Date.now();
  const expired = await db.update(callsTable)
    .set({ status: "missed", missedAt: timestamp })
    .where(and(eq(callsTable.status, "ringing"), lt(callsTable.createdAt, timestamp - RING_TIMEOUT_MS)))
    .returning();
  for (const call of expired) {
    const payload = { callId: call.id, status: call.status, endedAt: null, missedAt: call.missedAt };
    emitToUser(call.callerId, "call-updated", payload);
    emitToUser(call.calleeId, "call-updated", payload);
  }
}

const missedCallExpiryTimer = setInterval(() => {
  void expireMissedCalls().catch((error) => console.error("Missed call expiry failed", error));
}, 15_000);
missedCallExpiryTimer.unref();

function serializeCall(call: typeof callsTable.$inferSelect) {
  return {
    id: call.id,
    callerId: call.callerId,
    calleeId: call.calleeId,
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

async function callForParticipant(callId: number, userId: number) {
  await expireMissedCalls();
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
  await expireMissedCalls();
  const calls = await db.select().from(callsTable)
    .where(or(eq(callsTable.callerId, userId), eq(callsTable.calleeId, userId)))
    .orderBy(desc(callsTable.createdAt)).limit(100);
  res.json({ items: calls.map(serializeCall) });
});

router.post("/calls", async (req, res): Promise<void> => {
  const callerId = await requireChatAuth(req, res);
  const parsed = startCallInput.safeParse(req.body);
  if (callerId === null) return;
  if (!parsed.success || parsed.data.calleeId === callerId) {
    res.status(400).json({ error: "Choose another Old Time user to call." });
    return;
  }
  await expireMissedCalls();
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
      callerId, calleeId: callee.id, status: "ringing", roomName: "pending", createdAt: timestamp,
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
    title: "Incoming audio call",
    body: "You have an incoming Old Time audio call.",
    data: { callId: created.id, route: "call" },
  });
  res.status(201).json(serializeCall(created));
});

router.get("/calls/:callId", async (req, res): Promise<void> => {
  const userId = await requireChatAuth(req, res);
  const callId = callIdSchema.safeParse(req.params.callId);
  if (userId === null) return;
  if (!callId.success) { res.status(400).json({ error: "A valid call ID is required." }); return; }
  const call = await callForParticipant(callId.data, userId);
  if (!call) { res.status(404).json({ error: "Call not found." }); return; }
  res.json(serializeCall(call));
});

router.post("/calls/:callId/accept", async (req, res): Promise<void> => {
  const userId = await requireChatAuth(req, res);
  const parsed = callIdSchema.safeParse(req.params.callId);
  if (userId === null) return;
  if (!parsed.success) { res.status(400).json({ error: "A valid call ID is required." }); return; }
  const call = await callForParticipant(parsed.data, userId);
  if (!call) { res.status(404).json({ error: "Call not found." }); return; }
  if (call.calleeId !== userId || call.status !== "ringing") { res.status(409).json({ error: "This call cannot be accepted." }); return; }
  const [updated] = await db.update(callsTable).set({ status: "accepted", acceptedAt: Date.now() })
    .where(and(eq(callsTable.id, call.id), eq(callsTable.status, "ringing"))).returning();
  if (!updated) { res.status(409).json({ error: "This call has already changed." }); return; }
  emitCall(updated); res.json(serializeCall(updated));
});

router.post("/calls/:callId/decline", async (req, res): Promise<void> => {
  const userId = await requireChatAuth(req, res);
  const parsed = callIdSchema.safeParse(req.params.callId);
  if (userId === null) return;
  if (!parsed.success) { res.status(400).json({ error: "A valid call ID is required." }); return; }
  const call = await callForParticipant(parsed.data, userId);
  if (!call) { res.status(404).json({ error: "Call not found." }); return; }
  if (call.calleeId !== userId || call.status !== "ringing") { res.status(409).json({ error: "This call cannot be declined." }); return; }
  const [updated] = await db.update(callsTable).set({ status: "declined", declinedAt: Date.now() })
    .where(and(eq(callsTable.id, call.id), eq(callsTable.status, "ringing"))).returning();
  if (!updated) { res.status(409).json({ error: "This call has already changed." }); return; }
  emitCall(updated); res.json(serializeCall(updated));
});

router.post("/calls/:callId/end", async (req, res): Promise<void> => {
  const userId = await requireChatAuth(req, res);
  const parsed = callIdSchema.safeParse(req.params.callId);
  if (userId === null) return;
  if (!parsed.success) { res.status(400).json({ error: "A valid call ID is required." }); return; }
  const call = await callForParticipant(parsed.data, userId);
  if (!call) { res.status(404).json({ error: "Call not found." }); return; }
  if (!["ringing", "accepted"].includes(call.status)) { res.status(409).json({ error: "This call has already ended." }); return; }
  const [updated] = await db.update(callsTable).set({ status: "ended", endedAt: Date.now() })
    .where(and(eq(callsTable.id, call.id), inArray(callsTable.status, ["ringing", "accepted"]))).returning();
  if (!updated) { res.status(409).json({ error: "This call has already changed." }); return; }
  emitCall(updated); res.json(serializeCall(updated));
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