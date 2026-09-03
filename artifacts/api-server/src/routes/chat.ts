import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { and, desc, eq, gt, inArray, isNull, lt, ne, or, sql } from "drizzle-orm";
import {
  Chat,
  CreateChatBody,
  CreateChatResponse,
  CreateMessageBody,
  CreateMessageParams,
  CreateMessageResponse,
  CompleteBirthdayBody,
  CompleteBirthdayResponse,
  FirebaseSignInBody,
  FirebaseSignInResponse,
  GetDirectChatParams,
  GetDirectChatResponse,
  GetInboxParams,
  GetInboxResponse,
  ListMessagesParams,
  ListMessagesQueryParams,
  ListMessagesResponse,
  ListUsersQueryParams,
  ListUsersResponse,
  MarkChatReadBody,
  MarkChatReadParams,
  MarkChatReadResponse,
  OpenMessageBody,
  OpenMessageParams,
  OpenMessageResponse,
  RequestOtpBody,
  RequestOtpResponse,
  SaveMessageBody,
  SaveMessageParams,
  SaveMessageResponse,
  VerifyOtpBody,
  VerifyOtpResponse,
  LogoutResponse,
} from "@workspace/api-zod";
import {
  authChallengesTable,
  authSessionsTable,
  chatMessageRequestsTable,
  chatParticipantsTable,
  chatsTable,
  db,
  messagesTable,
  socialBlocksTable,
  socialFollowsTable,
  socialPostsTable,
  socialStoriesTable,
  uploadSlotsTable,
  usersTable,
} from "@workspace/db";
import { disconnectUser, emitToChat, emitToUser } from "../lib/realtime";
import {
  callerMatches,
  createAuthToken,
  requireChatAuth,
  revokeCurrentSession,
} from "../lib/chat-auth";
import {
  checkPhoneVerification,
  isTestOtpBypassPhone,
  normalizePhone,
  privacyHash,
  sendPhoneVerification,
} from "../lib/phone-auth";
import {
  cleanupUnreferencedUploads,
  deleteObject,
  fileForObjectPath,
  MAX_UPLOAD_BYTES,
} from "../lib/chat-storage";
import { isValidBirthday, meetsMinimumAge } from "../lib/age-gate";
import { verifyFirebaseIdToken } from "../lib/firebase-auth";
import { syncFirebaseProfile } from "../lib/supabase-profiles";

const router: IRouter = Router();

type ChatUser = typeof usersTable.$inferSelect;
type ChatRecord = typeof chatsTable.$inferSelect;
type MessageRecord = typeof messagesTable.$inferSelect;

const OTP_LIFETIME_MS = 10 * 60 * 1000;
const OTP_RATE_WINDOW_MS = 10 * 60 * 1000;
const OTP_RESEND_DELAY_MS = 60 * 1000;
const MAX_PHONE_REQUESTS_PER_WINDOW = 5;
const MAX_IP_REQUESTS_PER_WINDOW = 20;
const MAX_OTP_ATTEMPTS = 5;

function now(): number {
  return Date.now();
}

function parseUser(user: ChatUser, viewerId = user.id) {
  const revealPresence = viewerId === user.id || user.lastSeenVisible;
  return {
    id: user.id,
    phone: user.phone.startsWith("firebase:") ? "" : user.phone,
    name: user.name,
    username: user.username,
    bio: user.bio,
    birthday: viewerId === user.id ? user.birthday : null,
    contactPermission: user.contactPermission,
    online: revealPresence && user.online,
    lastSeen: revealPresence ? user.lastSeen : 0,
    lastSeenVisible: user.lastSeenVisible,
  };
}

function defaultUsernameForPhone(phone: string): string {
  return `user${privacyHash(phone).slice(0, 12)}`;
}

function parseChat(chat: ChatRecord, participantIds: number[]) {
  return {
    id: chat.id,
    name: chat.name,
    isGroup: chat.isGroup,
    createdAt: chat.createdAt,
    participantIds,
  };
}

function parseMessage(message: MessageRecord) {
  return {
    id: message.id,
    chatId: message.chatId,
    senderId: message.senderId,
    content: message.content,
    timestamp: message.timestamp,
    read: message.read,
    attachment: message.attachment,
    openedAt: message.openedAt,
    expiresAt: message.expiresAt,
    saved: message.saved,
  };
}

async function cleanupExpiredMessages(): Promise<void> {
  const expired = await db
    .delete(messagesTable)
    .where(and(lt(messagesTable.expiresAt, now()), eq(messagesTable.saved, false)))
    .returning();
  for (const message of expired) {
    emitToChat(message.chatId, "message-expired", { chatId: message.chatId, messageId: message.id });
    const participants = await getChatParticipants(message.chatId);
    for (const participantId of participants) emitToUser(participantId, "inbox-updated", { chatId: message.chatId });
  }
}

async function cleanupOrphanedUploads(): Promise<void> {
  const cleanupTime = now();
  await db
    .delete(authChallengesTable)
    .where(lt(authChallengesTable.expiresAt, cleanupTime));
  await db
    .delete(authSessionsTable)
    .where(
      or(
        lt(authSessionsTable.expiresAt, cleanupTime),
        lt(authSessionsTable.revokedAt, cleanupTime - 24 * 60 * 60 * 1000),
      ),
    );
  const expiredSlots = await db
    .delete(uploadSlotsTable)
    .where(
      and(
        lt(uploadSlotsTable.expiresAt, cleanupTime),
        ne(uploadSlotsTable.status, "committed"),
      ),
    )
    .returning({ objectPath: uploadSlotsTable.objectPath });
  for (const slot of expiredSlots) {
    await deleteObject(slot.objectPath).catch((error) =>
      console.error("Unable to remove expired upload", error),
    );
  }
  const [messageRows, postRows, storyRows, committedSlots] = await Promise.all([
    db
    .select({ attachment: messagesTable.attachment })
    .from(messagesTable)
    .where(sql`${messagesTable.attachment} is not null`),
    db
      .select({ media: socialPostsTable.media })
      .from(socialPostsTable)
      .where(eq(socialPostsTable.deleted, false)),
    db
      .select({ media: socialStoriesTable.media })
      .from(socialStoriesTable)
      .where(and(eq(socialStoriesTable.deleted, false), gt(socialStoriesTable.expiresAt, cleanupTime))),
    db
      .select({ objectPath: uploadSlotsTable.objectPath })
      .from(uploadSlotsTable)
      .where(eq(uploadSlotsTable.status, "committed")),
  ]);
  const referencedPaths = new Set(
    messageRows
      .map((row) => row.attachment?.objectPath)
      .filter((path): path is string => Boolean(path)),
  );
  for (const post of postRows) {
    for (const media of post.media ?? []) referencedPaths.add(media.objectPath);
  }
  for (const story of storyRows) {
    if (story.media?.objectPath) referencedPaths.add(story.media.objectPath);
  }
  for (const slot of committedSlots) referencedPaths.add(slot.objectPath);
  await cleanupUnreferencedUploads(referencedPaths);
}

const cleanupTimer = setInterval(() => {
  void cleanupExpiredMessages().catch((error) => console.error("Message expiry cleanup failed", error));
}, 10_000);
cleanupTimer.unref();

const orphanCleanupTimer = setInterval(() => {
  void cleanupOrphanedUploads().catch((error) =>
    console.error("Orphaned upload cleanup failed", error),
  );
}, 60 * 60 * 1000);
orphanCleanupTimer.unref();

async function getChatParticipants(chatId: number): Promise<number[]> {
  const rows = await db
    .select({ userId: chatParticipantsTable.userId })
    .from(chatParticipantsTable)
    .where(eq(chatParticipantsTable.chatId, chatId));
  return rows.map((row) => row.userId);
}

async function getChatById(chatId: number): Promise<ChatRecord | undefined> {
  const [chat] = await db
    .select()
    .from(chatsTable)
    .where(eq(chatsTable.id, chatId))
    .limit(1);
  return chat;
}

async function usersAreBlocked(userOneId: number, userTwoId: number): Promise<boolean> {
  const [relationship] = await db
    .select({ blockerId: socialBlocksTable.blockerId })
    .from(socialBlocksTable)
    .where(
      or(
        and(eq(socialBlocksTable.blockerId, userOneId), eq(socialBlocksTable.blockedId, userTwoId)),
        and(eq(socialBlocksTable.blockerId, userTwoId), eq(socialBlocksTable.blockedId, userOneId)),
      ),
    )
    .limit(1);
  return Boolean(relationship);
}

async function chatIsBlockedForUser(chatId: number, userId: number): Promise<boolean> {
  const participants = await getChatParticipants(chatId);
  for (const participantId of participants) {
    if (participantId !== userId && await usersAreBlocked(userId, participantId)) return true;
  }
  return false;
}

async function getDirectChatForUsers(
  userOneId: number,
  userTwoId: number,
): Promise<ChatRecord | undefined> {
  const firstChats = await db
    .select({ chatId: chatParticipantsTable.chatId })
    .from(chatParticipantsTable)
    .innerJoin(
      chatsTable,
      eq(chatsTable.id, chatParticipantsTable.chatId),
    )
    .where(
      and(
        eq(chatParticipantsTable.userId, userOneId),
        eq(chatsTable.isGroup, false),
      ),
    );

  const candidateIds = firstChats.map((row) => row.chatId);
  if (candidateIds.length === 0) {
    return undefined;
  }

  const secondChats = await db
    .select({ chatId: chatParticipantsTable.chatId })
    .from(chatParticipantsTable)
    .where(
      and(
        eq(chatParticipantsTable.userId, userTwoId),
        inArray(chatParticipantsTable.chatId, candidateIds),
      ),
    );
  const sharedId = secondChats[0]?.chatId;
  if (!sharedId) {
    return undefined;
  }
  return getChatById(sharedId);
}

function readParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

router.post("/auth/request-otp", async (req, res): Promise<void> => {
  const parsed = RequestOtpBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.flatten() }, "Invalid OTP request");
    res.status(400).json({ error: "Enter a valid phone number." });
    return;
  }

  const phone = normalizePhone(parsed.data.phone);
  if (!phone) {
    res.status(400).json({ error: "Enter a valid phone number including country code." });
    return;
  }
  const requestTime = now();
  const requestIpHash = privacyHash(req.ip || req.socket.remoteAddress || "unknown");
  const cutoff = requestTime - OTP_RATE_WINDOW_MS;
  const [{ count: phoneRequests }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(authChallengesTable)
    .where(and(eq(authChallengesTable.phone, phone), gt(authChallengesTable.createdAt, cutoff)));
  const [{ count: ipRequests }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(authChallengesTable)
    .where(
      and(
        eq(authChallengesTable.requestIpHash, requestIpHash),
        gt(authChallengesTable.createdAt, cutoff),
      ),
    );
  const [latest] = await db
    .select({ createdAt: authChallengesTable.createdAt })
    .from(authChallengesTable)
    .where(eq(authChallengesTable.phone, phone))
    .orderBy(desc(authChallengesTable.createdAt))
    .limit(1);
  const isTestPhone = isTestOtpBypassPhone(phone);
  if (
    !isTestPhone &&
    (Number(phoneRequests) >= MAX_PHONE_REQUESTS_PER_WINDOW ||
      Number(ipRequests) >= MAX_IP_REQUESTS_PER_WINDOW ||
      (latest && latest.createdAt > requestTime - OTP_RESEND_DELAY_MS))
  ) {
    res.setHeader("Retry-After", "60");
    res.status(429).json({ error: "Please wait before requesting another code." });
    return;
  }

  const challengeId = randomUUID();
  const expiresAt = requestTime + OTP_LIFETIME_MS;
  try {
    const developmentCode = await sendPhoneVerification(phone);
    await db.insert(authChallengesTable).values({
      id: challengeId,
      phone,
      codeHash: developmentCode ? privacyHash(developmentCode) : null,
      requestIpHash,
      createdAt: requestTime,
      expiresAt,
    });
    req.log.info(
      { phoneHash: privacyHash(phone), provider: developmentCode ? "local-development" : "twilio" },
      "Phone verification requested",
    );
    res.json(RequestOtpResponse.parse({ success: true, challengeId, expiresAt }));
  } catch (error) {
    req.log.error({ err: error }, "Unable to send phone verification");
    res.status(503).json({ error: "Phone verification is temporarily unavailable." });
  }
});

router.post("/auth/firebase", async (req, res): Promise<void> => {
  const parsed = FirebaseSignInBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "A valid Firebase ID token is required." });
    return;
  }

  try {
    const identity = await verifyFirebaseIdToken(parsed.data.idToken);
    const email = identity.email?.trim().toLowerCase();
    if (!email) {
      res.status(400).json({ error: "Sign in with an account that has an email address." });
      return;
    }

    await syncFirebaseProfile({
      uid: identity.uid,
      email,
      name: typeof identity.name === "string" ? identity.name : undefined,
    });
    const timestamp = now();
    let [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.firebaseUid, identity.uid))
      .limit(1);

    if (!user) {
      const internalPhone = `firebase:${identity.uid}`;
      const emailName = email.split("@")[0]?.replace(/[^a-zA-Z0-9 ]/g, " ").trim();
      const [created] = await db
        .insert(usersTable)
        .values({
          phone: internalPhone,
          firebaseUid: identity.uid,
          email,
          name: typeof identity.name === "string" && identity.name.trim()
            ? identity.name.trim().slice(0, 80)
            : emailName?.slice(0, 80) || "Old Time User",
          username: defaultUsernameForPhone(internalPhone),
          online: false,
          lastSeen: timestamp,
        })
        .returning();
      user = created;
    } else if (user.email !== email) {
      const [updated] = await db
        .update(usersTable)
        .set({ email })
        .where(eq(usersTable.id, user.id))
        .returning();
      user = updated;
    }

    if (!user.birthday) {
      const challengeId = randomUUID();
      await db.insert(authChallengesTable).values({
        id: challengeId,
        phone: user.phone,
        codeHash: null,
        requestIpHash: privacyHash(req.ip || req.socket.remoteAddress || "unknown"),
        status: "birthday_pending",
        createdAt: timestamp,
        expiresAt: timestamp + 30 * 60 * 1000,
      });
      res.json(FirebaseSignInResponse.parse({ requiresBirthday: true, challengeId }));
      return;
    }
    if (!meetsMinimumAge(user.birthday)) {
      res.status(403).json({ error: "Old Time is for people age 13 and older." });
      return;
    }

    const [activeUser] = await db
      .update(usersTable)
      .set({ online: true, lastSeen: timestamp })
      .where(eq(usersTable.id, user.id))
      .returning();
    const authToken = await createAuthToken(activeUser.id);
    res.json(FirebaseSignInResponse.parse({ ...parseUser(activeUser), authToken }));
  } catch (error) {
    req.log.error({ err: error }, "Firebase sign-in failed");
    res.status(503).json({ error: "Firebase sign-in is temporarily unavailable." });
  }
});

router.post("/auth/verify-otp", async (req, res): Promise<void> => {
  const parsed = VerifyOtpBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter your phone number and verification code." });
    return;
  }

  const phone = normalizePhone(parsed.data.phone);
  if (!phone) {
    res.status(400).json({ error: "Enter a valid phone number." });
    return;
  }
  const verificationTime = now();
  const [challenge] = await db
    .select()
    .from(authChallengesTable)
    .where(
      and(
        eq(authChallengesTable.id, parsed.data.challengeId),
        eq(authChallengesTable.phone, phone),
        eq(authChallengesTable.status, "pending"),
        gt(authChallengesTable.expiresAt, verificationTime),
      ),
    )
    .limit(1);
  if (!challenge || challenge.attemptCount >= MAX_OTP_ATTEMPTS) {
    res.status(400).json({ error: "That code is invalid or has expired." });
    return;
  }
  const [attempted] = await db
    .update(authChallengesTable)
    .set({
      lastAttemptAt: verificationTime,
      status: "verifying",
    })
    .where(
      and(
        eq(authChallengesTable.id, challenge.id),
        eq(authChallengesTable.status, "pending"),
        eq(authChallengesTable.attemptCount, challenge.attemptCount),
      ),
    )
    .returning();
  if (!attempted) {
    res.status(409).json({ error: "Verification is already in progress. Try again." });
    return;
  }
  let approved = false;
  try {
    approved = await checkPhoneVerification(phone, parsed.data.otp, challenge.codeHash);
  } catch (error) {
    await db
      .update(authChallengesTable)
      .set({ status: "pending" })
      .where(
        and(
          eq(authChallengesTable.id, challenge.id),
          eq(authChallengesTable.status, "verifying"),
        ),
      );
    req.log.error({ err: error }, "Unable to check phone verification");
    res.status(503).json({ error: "Phone verification is temporarily unavailable." });
    return;
  }
  if (!approved) {
    const attemptCount = challenge.attemptCount + 1;
    await db
      .update(authChallengesTable)
      .set({
        attemptCount,
        status: attemptCount >= MAX_OTP_ATTEMPTS ? "locked" : "pending",
      })
      .where(
        and(
          eq(authChallengesTable.id, challenge.id),
          eq(authChallengesTable.status, "verifying"),
        ),
      );
    res.status(400).json({ error: "That code is invalid or has expired." });
    return;
  }
  const timestamp = verificationTime;
  let [user] = await db.select().from(usersTable).where(eq(usersTable.phone, phone));
  if (user?.birthday && !meetsMinimumAge(user.birthday)) {
    await db
      .update(authChallengesTable)
      .set({ status: "age_rejected" })
      .where(and(eq(authChallengesTable.id, challenge.id), eq(authChallengesTable.status, "verifying")));
    res.status(403).json({ error: "Old Time is for people age 13 and older." });
    return;
  }
  if (!user?.birthday) {
    const [pending] = await db
      .update(authChallengesTable)
      .set({ status: "birthday_pending" })
      .where(
        and(
          eq(authChallengesTable.id, challenge.id),
          eq(authChallengesTable.status, "verifying"),
        ),
      )
      .returning({ id: authChallengesTable.id });
    if (!pending) {
      res.status(409).json({ error: "This verification code was already used." });
      return;
    }
    res.json({ requiresBirthday: true, challengeId: challenge.id });
    return;
  }
  const [consumed] = await db
    .update(authChallengesTable)
    .set({ status: "consumed" })
    .where(and(eq(authChallengesTable.id, challenge.id), eq(authChallengesTable.status, "verifying")))
    .returning({ id: authChallengesTable.id });
  if (!consumed) {
    res.status(409).json({ error: "This verification code was already used." });
    return;
  }
  if (!user) {
    const [created] = await db
      .insert(usersTable)
      .values({
        phone,
        name: `User ${phone.slice(-4)}`,
        username: defaultUsernameForPhone(phone),
        online: true,
        lastSeen: timestamp,
      })
      .returning();
    user = created;
  } else {
    const [updated] = await db
      .update(usersTable)
      .set({ online: true, lastSeen: timestamp })
      .where(eq(usersTable.id, user.id))
      .returning();
    user = updated;
  }

  const authToken = await createAuthToken(user.id);
  res.json(VerifyOtpResponse.parse({ ...parseUser(user), authToken }));
});

router.post("/auth/complete-birthday", async (req, res): Promise<void> => {
  const parsed = CompleteBirthdayBody.safeParse(req.body);
  const birthday = parsed.success ? parsed.data.birthday.toISOString().slice(0, 10) : "";
  if (!parsed.success || !isValidBirthday(birthday)) {
    res.status(400).json({ error: "Enter a real birthday in YYYY-MM-DD format." });
    return;
  }
  const [challenge] = await db
    .select()
    .from(authChallengesTable)
    .where(
      and(
        eq(authChallengesTable.id, parsed.data.challengeId),
        eq(authChallengesTable.status, "birthday_pending"),
        gt(authChallengesTable.expiresAt, now()),
      ),
    )
    .limit(1);
  if (!challenge) {
    res.status(400).json({ error: "This age-verification step has expired. Start sign-in again." });
    return;
  }
  if (!meetsMinimumAge(birthday)) {
    await db
      .update(authChallengesTable)
      .set({ status: "age_rejected" })
      .where(and(eq(authChallengesTable.id, challenge.id), eq(authChallengesTable.status, "birthday_pending")));
    res.status(403).json({ error: "Old Time is for people age 13 and older." });
    return;
  }
  const [claimed] = await db
    .update(authChallengesTable)
    .set({ status: "verifying" })
    .where(and(eq(authChallengesTable.id, challenge.id), eq(authChallengesTable.status, "birthday_pending")))
    .returning({ id: authChallengesTable.id });
  if (!claimed) {
    res.status(409).json({ error: "Age verification is already in progress. Try again." });
    return;
  }

  const timestamp = now();
  let [user] = await db.select().from(usersTable).where(eq(usersTable.phone, challenge.phone));
  if (!user) {
    const [created] = await db
      .insert(usersTable)
      .values({
        phone: challenge.phone,
        birthday,
        name: `User ${challenge.phone.slice(-4)}`,
        username: defaultUsernameForPhone(challenge.phone),
        online: true,
        lastSeen: timestamp,
      })
      .returning();
    user = created;
  } else {
    const [updated] = await db
      .update(usersTable)
      .set({ birthday, online: true, lastSeen: timestamp })
      .where(eq(usersTable.id, user.id))
      .returning();
    user = updated;
  }
  await db
    .update(authChallengesTable)
    .set({ status: "consumed" })
    .where(and(eq(authChallengesTable.id, challenge.id), eq(authChallengesTable.status, "verifying")));
  const authToken = await createAuthToken(user.id);
  res.json(CompleteBirthdayResponse.parse({ ...parseUser(user), authToken }));
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  const userId = await requireChatAuth(req, res);
  if (userId === null) return;
  const revoked = await revokeCurrentSession(req);
  if (!revoked) {
    res.status(401).json({ error: "Session is already invalid." });
    return;
  }
  await db
    .update(usersTable)
    .set({ online: false, lastSeen: now() })
    .where(eq(usersTable.id, userId));
  disconnectUser(userId);
  res.json(LogoutResponse.parse({ success: true }));
});

router.get("/users", async (req, res): Promise<void> => {
  const parsed = ListUsersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "A valid viewerId is required." });
    return;
  }
  if (!(await callerMatches(req, res, parsed.data.viewerId))) return;
  const [viewer] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, parsed.data.viewerId))
    .limit(1);
  if (!viewer) {
    res.status(404).json({ error: "User not found." });
    return;
  }

  const users = await db
    .select()
    .from(usersTable)
    .where(ne(usersTable.id, parsed.data.viewerId))
    .orderBy(usersTable.name);
  res.json(ListUsersResponse.parse(users.map((user) => parseUser(user, viewer.id))));
});

router.put("/users/:userId/presence-privacy", async (req, res): Promise<void> => {
  const userId = Number(req.params.userId);
  if (!Number.isInteger(userId) || userId <= 0 || typeof req.body?.lastSeenVisible !== "boolean") {
    res.status(400).json({ error: "A valid userId and lastSeenVisible value are required." });
    return;
  }
  if (!(await callerMatches(req, res, userId))) return;
  const [updated] = await db
    .update(usersTable)
    .set({ lastSeenVisible: req.body.lastSeenVisible })
    .where(eq(usersTable.id, userId))
    .returning({ lastSeenVisible: usersTable.lastSeenVisible });
  if (!updated) {
    res.status(404).json({ error: "User not found." });
    return;
  }
  res.json({ success: true, lastSeenVisible: updated.lastSeenVisible });
});

router.put("/users/:userId/profile", async (req, res): Promise<void> => {
  const userId = Number(req.params.userId);
  const body = req.body ?? {};
  const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : undefined;
  const name = typeof body.name === "string" ? body.name.trim() : undefined;
  const bio = typeof body.bio === "string" ? body.bio.trim() : undefined;
  const birthday = typeof body.birthday === "string" ? body.birthday : undefined;
  const contactPermission = body.contactPermission;
  const validBirthday = birthday === undefined || isValidBirthday(birthday);
  if (
    !Number.isInteger(userId) ||
    userId <= 0 ||
    (name === undefined && username === undefined && bio === undefined && birthday === undefined && contactPermission === undefined) ||
    (name !== undefined && (name.length < 1 || name.length > 80)) ||
    (username !== undefined && !/^[a-z0-9_]{3,24}$/.test(username)) ||
    (bio !== undefined && bio.length > 150) ||
    !validBirthday ||
    (contactPermission !== undefined &&
      !["everyone", "followers", "nobody"].includes(contactPermission))
  ) {
    res.status(400).json({ error: "Enter a valid profile value, including a real birthday that is not in the future." });
    return;
  }
  if (!(await callerMatches(req, res, userId))) return;
  if (username !== undefined) {
    const [taken] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(and(eq(usersTable.username, username), ne(usersTable.id, userId)))
      .limit(1);
    if (taken) {
      res.status(409).json({ error: "That username is already taken." });
      return;
    }
  }
  const [updated] = await db
    .update(usersTable)
    .set({
      ...(name !== undefined ? { name } : {}),
      ...(username !== undefined ? { username } : {}),
      ...(bio !== undefined ? { bio } : {}),
      ...(birthday !== undefined ? { birthday } : {}),
      ...(contactPermission !== undefined ? { contactPermission } : {}),
    })
    .where(eq(usersTable.id, userId))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "User not found." });
    return;
  }
  if (updated.firebaseUid && updated.email) {
    try {
      await syncFirebaseProfile({
        uid: updated.firebaseUid,
        email: updated.email,
        name: updated.name,
        username: updated.username,
      });
    } catch (error) {
      req.log.error({ err: error, userId: updated.id }, "Supabase profile synchronization failed");
      res.status(503).json({ error: "Your profile was saved, but account setup could not be completed. Please try again." });
      return;
    }
  }
  res.json(parseUser(updated));
});

router.put("/users/:userId/presence", async (req, res): Promise<void> => {
  const userId = Number(req.params.userId);
  if (!Number.isInteger(userId) || userId <= 0 || typeof req.body?.online !== "boolean") {
    res.status(400).json({ error: "A valid userId and online value are required." });
    return;
  }
  if (!(await callerMatches(req, res, userId))) return;
  const timestamp = now();
  const [updated] = await db
    .update(usersTable)
    .set({ online: req.body.online, lastSeen: timestamp })
    .where(eq(usersTable.id, userId))
    .returning({ online: usersTable.online, lastSeen: usersTable.lastSeen });
  if (!updated) {
    res.status(404).json({ error: "User not found." });
    return;
  }
  res.json({ success: true, ...updated });
});

router.get("/users/:userId/inbox", async (req, res): Promise<void> => {
  const parsed = GetInboxParams.safeParse({ userId: readParam(req.params.userId) });
  if (!parsed.success) {
    res.status(400).json({ error: "A valid userId is required." });
    return;
  }
  if (!(await callerMatches(req, res, parsed.data.userId))) return;
  await cleanupExpiredMessages();

  const [viewer] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, parsed.data.userId))
    .limit(1);
  if (!viewer) {
    res.status(404).json({ error: "User not found." });
    return;
  }

  const memberships = await db
    .select({ chatId: chatParticipantsTable.chatId })
    .from(chatParticipantsTable)
    .where(eq(chatParticipantsTable.userId, viewer.id));
  const items = [];

  for (const membership of memberships) {
    const chat = await getChatById(membership.chatId);
    if (!chat) continue;
    const participants = await getChatParticipants(chat.id);
    const contactId = participants.find((id) => id !== viewer.id);
    if (!contactId) continue;
    const [contact] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, contactId))
      .limit(1);
    if (!contact) continue;
    if (await chatIsBlockedForUser(chat.id, viewer.id)) continue;
    const [lastMessage] = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.chatId, chat.id))
      .orderBy(desc(messagesTable.timestamp))
      .limit(1);
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(messagesTable)
      .where(
        and(
          eq(messagesTable.chatId, chat.id),
          eq(messagesTable.senderId, contact.id),
          eq(messagesTable.read, false),
        ),
      );
    items.push({
      chat: parseChat(chat, participants),
      contact: parseUser(contact, viewer.id),
      lastMessage: lastMessage ? parseMessage(lastMessage) : null,
      unreadCount: Number(count),
    });
  }

  items.sort(
    (a, b) => (b.lastMessage?.timestamp ?? b.chat.createdAt) - (a.lastMessage?.timestamp ?? a.chat.createdAt),
  );
  res.json(GetInboxResponse.parse(items));
});

router.get(
  "/chats/direct/:userOneId/:userTwoId",
  async (req, res): Promise<void> => {
    const parsed = GetDirectChatParams.safeParse({
      userOneId: readParam(req.params.userOneId),
      userTwoId: readParam(req.params.userTwoId),
    });
    if (!parsed.success || parsed.data.userOneId === parsed.data.userTwoId) {
      res.status(400).json({ error: "Two different users are required." });
      return;
    }
    if (!(await callerMatches(req, res, parsed.data.userOneId))) return;
    await cleanupExpiredMessages();

    const users = await db
      .select()
      .from(usersTable)
      .where(inArray(usersTable.id, [parsed.data.userOneId, parsed.data.userTwoId]));
    if (users.length !== 2) {
      res.status(400).json({ error: "Both users must exist." });
      return;
    }
    if (await usersAreBlocked(parsed.data.userOneId, parsed.data.userTwoId)) {
      res.json(GetDirectChatResponse.parse({ chat: null, lastMessage: null }));
      return;
    }

    const chat = await getDirectChatForUsers(parsed.data.userOneId, parsed.data.userTwoId);
    const lastMessage = chat
      ? (
          await db
            .select()
            .from(messagesTable)
            .where(eq(messagesTable.chatId, chat.id))
            .orderBy(desc(messagesTable.timestamp))
            .limit(1)
        )[0]
      : undefined;
    res.json(
      GetDirectChatResponse.parse({
        chat: chat ? parseChat(chat, await getChatParticipants(chat.id)) : null,
        lastMessage: lastMessage ? parseMessage(lastMessage) : null,
      }),
    );
  },
);

router.post("/chats", async (req, res): Promise<void> => {
  const parsed = CreateChatBody.safeParse(req.body);
  const userIds = parsed.success ? [...new Set(parsed.data.userIds)] : [];
  if (!parsed.success || userIds.length !== 2) {
    res.status(400).json({ error: "Choose two different users." });
    return;
  }
  const authUserId = await requireChatAuth(req, res);
  if (authUserId === null) return;
  if (!userIds.includes(authUserId)) {
    res.status(403).json({ error: "Bearer token identity must be a chat participant." });
    return;
  }
  const users = await db
    .select()
    .from(usersTable)
    .where(inArray(usersTable.id, userIds));
  if (users.length !== 2) {
    res.status(400).json({ error: "Both users must exist." });
    return;
  }
  if (await usersAreBlocked(userIds[0], userIds[1])) {
    res.status(403).json({ error: "You cannot start a conversation with this user." });
    return;
  }

  const existing = await getDirectChatForUsers(userIds[0], userIds[1]);
  if (existing) {
    res.status(201).json(
      CreateChatResponse.parse(parseChat(existing, await getChatParticipants(existing.id))),
    );
    return;
  }

  const recipientId = userIds.find((userId) => userId !== authUserId);
  const recipient = users.find((user) => user.id === recipientId);
  if (!recipient) {
    res.status(400).json({ error: "The recipient must exist." });
    return;
  }
  if (recipient.contactPermission === "nobody") {
    res.status(403).json({ error: "This user is not accepting new conversations." });
    return;
  }
  if (recipient.contactPermission === "followers") {
    const [follow] = await db
      .select({ followerId: socialFollowsTable.followerId })
      .from(socialFollowsTable)
      .where(
        and(
          eq(socialFollowsTable.followerId, authUserId),
          eq(socialFollowsTable.followingId, recipient.id),
        ),
      )
      .limit(1);
    if (!follow) {
      res.status(403).json({ error: "Follow this user before starting a conversation." });
      return;
    }
  }

  const timestamp = now();
  const [chat] = await db
    .insert(chatsTable)
    .values({ isGroup: false, name: "", createdAt: timestamp })
    .returning();
  await db.insert(chatParticipantsTable).values(
    userIds.map((userId) => ({ chatId: chat.id, userId })),
  );
  res.status(201).json(CreateChatResponse.parse(parseChat(chat, userIds)));
});

router.get("/chats/:chatId/messages", async (req, res): Promise<void> => {
  const params = ListMessagesParams.safeParse({
    chatId: readParam(req.params.chatId),
  });
  const query = ListMessagesQueryParams.safeParse(req.query);
  if (!params.success || !query.success) {
    res.status(400).json({ error: "A valid chatId and viewerId are required." });
    return;
  }
  if (!(await callerMatches(req, res, query.data.viewerId))) return;
  await cleanupExpiredMessages();
  const participants = await getChatParticipants(params.data.chatId);
  if (!participants.includes(query.data.viewerId)) {
    res.status(403).json({ error: "You are not part of this conversation." });
    return;
  }
  if (await chatIsBlockedForUser(params.data.chatId, query.data.viewerId)) {
    res.status(403).json({ error: "This conversation is unavailable." });
    return;
  }
  const messages = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.chatId, params.data.chatId))
    .orderBy(messagesTable.timestamp);
  res.json(ListMessagesResponse.parse(messages.map(parseMessage)));
});

router.post("/chats/:chatId/messages", async (req, res): Promise<void> => {
  const params = CreateMessageParams.safeParse({
    chatId: readParam(req.params.chatId),
  });
  const body = CreateMessageBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Enter a message before sending." });
    return;
  }
  if (!(await callerMatches(req, res, body.data.senderId))) return;
  const input = body.data as {
    senderId: number;
    content?: string;
    attachment?: NonNullable<MessageRecord["attachment"]>;
  };
  const content = input.content?.trim() ?? "";
  if (!content && !input.attachment) {
    res.status(400).json({ error: "Enter a message or attach media before sending." });
    return;
  }
  const participants = await getChatParticipants(params.data.chatId);
  if (!participants.includes(body.data.senderId)) {
    res.status(403).json({ error: "You are not part of this conversation." });
    return;
  }
  if (await chatIsBlockedForUser(params.data.chatId, body.data.senderId)) {
    res.status(403).json({ error: "This conversation is unavailable." });
    return;
  }
  let claimedUploadId: string | null = null;
  if (input.attachment) {
    const [claimedSlot] = await db
      .update(uploadSlotsTable)
      .set({ status: "committing" })
      .where(
        and(
          eq(uploadSlotsTable.objectPath, input.attachment.objectPath),
          eq(uploadSlotsTable.userId, body.data.senderId),
          eq(uploadSlotsTable.status, "uploaded"),
          gt(uploadSlotsTable.expiresAt, now()),
        ),
      )
      .returning();
    if (!claimedSlot) {
      res.status(400).json({ error: "This upload is unavailable, expired, or already used." });
      return;
    }
    claimedUploadId = claimedSlot.id;
    try {
      const file = fileForObjectPath(input.attachment.objectPath);
      const [exists] = await file.exists();
      if (!exists) {
        await db.delete(uploadSlotsTable).where(eq(uploadSlotsTable.id, claimedSlot.id));
        res.status(400).json({ error: "The uploaded attachment could not be found." });
        return;
      }
      const [metadata] = await file.getMetadata();
      const actualSize = Number(metadata.size ?? 0);
      if (!Number.isFinite(actualSize) || actualSize < 1 || actualSize > MAX_UPLOAD_BYTES) {
        await file.delete({ ignoreNotFound: true });
        await db.delete(uploadSlotsTable).where(eq(uploadSlotsTable.id, claimedSlot.id));
        res.status(413).json({ error: "Attachments must be 25 MB or smaller." });
        return;
      }
      if (
        metadata.contentType &&
        metadata.contentType.toLowerCase() !== input.attachment.mimeType.toLowerCase()
      ) {
        await file.delete({ ignoreNotFound: true });
        await db.delete(uploadSlotsTable).where(eq(uploadSlotsTable.id, claimedSlot.id));
        res.status(415).json({ error: "The uploaded attachment type does not match its metadata." });
        return;
      }
      input.attachment.size = actualSize;
    } catch (error) {
      await deleteObject(claimedSlot.objectPath).catch(() => undefined);
      await db.delete(uploadSlotsTable).where(eq(uploadSlotsTable.id, claimedSlot.id));
      req.log.warn({ err: error }, "Unable to verify uploaded attachment");
      res.status(400).json({ error: "The uploaded attachment could not be verified." });
      return;
    }
  }
  let message: MessageRecord;
  try {
    message = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(messagesTable)
        .values({
          chatId: params.data.chatId,
          senderId: body.data.senderId,
          content,
          attachment: input.attachment ?? null,
          timestamp: now(),
          read: false,
        })
        .returning();
      if (claimedUploadId) {
        const committed = await tx
          .update(uploadSlotsTable)
          .set({
            status: "committed",
            messageId: created.id,
            referenceType: "chat_message",
            referenceId: created.id,
          })
          .where(
            and(
              eq(uploadSlotsTable.id, claimedUploadId),
              eq(uploadSlotsTable.userId, body.data.senderId),
              eq(uploadSlotsTable.status, "committing"),
            ),
          )
          .returning({ id: uploadSlotsTable.id });
        if (committed.length !== 1) throw new Error("UPLOAD_COMMIT_CONFLICT");
      }
      return created;
    });
  } catch (error) {
    if (claimedUploadId) {
      await db
        .update(uploadSlotsTable)
        .set({ status: "uploaded" })
        .where(
          and(
            eq(uploadSlotsTable.id, claimedUploadId),
            eq(uploadSlotsTable.status, "committing"),
          ),
        );
    }
    req.log.error({ err: error }, "Unable to create message");
    res.status(500).json({ error: "Unable to send message." });
    return;
  }
  const response = parseMessage(message);
  emitToChat(params.data.chatId, "new-message", response);
  for (const participantId of participants) {
    emitToUser(participantId, "inbox-updated", response);
  }
  res.status(201).json(CreateMessageResponse.parse(response));
});

router.post("/chats/:chatId/read", async (req, res): Promise<void> => {
  const params = MarkChatReadParams.safeParse({
    chatId: readParam(req.params.chatId),
  });
  const body = MarkChatReadBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "A valid viewerId is required." });
    return;
  }
  if (!(await callerMatches(req, res, body.data.viewerId))) return;
  const participants = await getChatParticipants(params.data.chatId);
  if (!participants.includes(body.data.viewerId)) {
    res.status(403).json({ error: "You are not part of this conversation." });
    return;
  }
  if (await chatIsBlockedForUser(params.data.chatId, body.data.viewerId)) {
    res.status(403).json({ error: "This conversation is unavailable." });
    return;
  }
  const updated = await db
    .update(messagesTable)
    .set({ read: true })
    .where(
      and(
        eq(messagesTable.chatId, params.data.chatId),
        ne(messagesTable.senderId, body.data.viewerId),
        eq(messagesTable.read, false),
      ),
    )
    .returning({ id: messagesTable.id });
  for (const message of updated) {
    emitToUser(body.data.viewerId, "message-read", {
      chatId: params.data.chatId,
      messageId: message.id,
    });
  }
  res.json(MarkChatReadResponse.parse({ updated: updated.length }));
});

router.post("/messages/:messageId/open", async (req, res): Promise<void> => {
  const params = OpenMessageParams.safeParse({ messageId: readParam(req.params.messageId) });
  const body = OpenMessageBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "A valid message and recipient are required." });
    return;
  }
  if (!(await callerMatches(req, res, body.data.recipientId))) return;
  await cleanupExpiredMessages();
  const [message] = await db.select().from(messagesTable).where(eq(messagesTable.id, params.data.messageId)).limit(1);
  if (!message) {
    res.status(404).json({ error: "Message not found." });
    return;
  }
  const participants = await getChatParticipants(message.chatId);
  if (
    message.senderId === body.data.recipientId ||
    !participants.includes(body.data.recipientId)
  ) {
    res.status(403).json({ error: "Only a message recipient may open it." });
    return;
  }
  if (await chatIsBlockedForUser(message.chatId, body.data.recipientId)) {
    res.status(403).json({ error: "This conversation is unavailable." });
    return;
  }
  let current = message;
  if (!message.openedAt && !message.saved) {
    const openedAt = now();
    const [updated] = await db
      .update(messagesTable)
      .set({ openedAt, expiresAt: openedAt + 30_000 })
      .where(
        and(
          eq(messagesTable.id, message.id),
          isNull(messagesTable.openedAt),
          eq(messagesTable.saved, false),
        ),
      )
      .returning();
    if (updated) {
      current = updated;
    } else {
      const [latest] = await db
        .select()
        .from(messagesTable)
        .where(eq(messagesTable.id, message.id))
        .limit(1);
      if (!latest) {
        res.status(404).json({ error: "Message expired before it could be opened." });
        return;
      }
      current = latest;
    }
  }
  const response = parseMessage(current);
  emitToChat(message.chatId, "message-updated", response);
  res.json(OpenMessageResponse.parse(response));
});

router.post("/messages/:messageId/save", async (req, res): Promise<void> => {
  const params = SaveMessageParams.safeParse({ messageId: readParam(req.params.messageId) });
  const body = SaveMessageBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "A valid message and recipient are required." });
    return;
  }
  if (!(await callerMatches(req, res, body.data.recipientId))) return;
  await cleanupExpiredMessages();
  const [message] = await db.select().from(messagesTable).where(eq(messagesTable.id, params.data.messageId)).limit(1);
  if (!message) {
    res.status(404).json({ error: "Message not found." });
    return;
  }
  const participants = await getChatParticipants(message.chatId);
  if (
    message.senderId === body.data.recipientId ||
    !participants.includes(body.data.recipientId)
  ) {
    res.status(403).json({ error: "Only a message recipient may save it." });
    return;
  }
  if (await chatIsBlockedForUser(message.chatId, body.data.recipientId)) {
    res.status(403).json({ error: "This conversation is unavailable." });
    return;
  }
  const actionTime = now();
  const [updated] = await db
    .update(messagesTable)
    .set({ saved: true, expiresAt: null })
    .where(
      and(
        eq(messagesTable.id, message.id),
        ne(messagesTable.senderId, body.data.recipientId),
        or(isNull(messagesTable.expiresAt), gt(messagesTable.expiresAt, actionTime)),
      ),
    )
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Message expired before it could be saved." });
    return;
  }
  const response = parseMessage(updated);
  emitToChat(message.chatId, "message-updated", response);
  res.json(SaveMessageResponse.parse(response));
});

export default router;