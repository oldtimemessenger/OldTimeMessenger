import type { Request, Response } from "express";
import { and, eq, gt } from "drizzle-orm";
import {
  CompleteBirthdayBody,
  CompleteBirthdayResponse,
} from "@workspace/api-zod";
import {
  authChallengesTable,
  db,
  usersTable,
} from "@workspace/db";
import { createAuthToken } from "../lib/chat-auth";
import { contactDiscoveryHash, privacyHash } from "../lib/phone-auth";
import { isValidBirthday, meetsMinimumAge } from "../lib/age-gate";

function now(): number {
  return Date.now();
}

function isFirebasePhone(phone: string): boolean {
  return phone.startsWith("firebase:");
}

function firebaseUidFromPhone(phone: string): string | null {
  if (!isFirebasePhone(phone)) return null;
  const uid = phone.slice("firebase:".length).trim();
  return uid || null;
}

function defaultUsernameForPhone(phone: string): string {
  return `user${privacyHash(phone).slice(0, 12)}`;
}

function parseUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    phone: !user.phone.startsWith("firebase:") ? user.phone : "",
    hasRegisteredPhone: !user.phone.startsWith("firebase:"),
    phoneVerified: user.phoneVerified,
    phoneDiscoveryPermission: user.phoneDiscoveryPermission,
    name: user.name,
    username: user.username,
    bio: user.bio,
    birthday: user.birthday,
    contactPermission: user.contactPermission,
    online: user.online,
    lastSeen: user.lastSeen,
    lastSeenVisible: user.lastSeenVisible,
  };
}

/**
 * Production-safe birthday completion.
 * Mounted ahead of chat.ts so Firebase users are resolved by firebaseUid
 * and never get phoneVerified / contact-discovery side effects.
 */
export async function handleCompleteBirthday(req: Request, res: Response): Promise<void> {
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
  let [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.phone, challenge.phone))
    .limit(1);

  if (!user) {
    const firebaseUid = firebaseUidFromPhone(challenge.phone);
    if (firebaseUid) {
      [user] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.firebaseUid, firebaseUid))
        .limit(1);
    }
  }

  if (!user) {
    const firebaseUid = firebaseUidFromPhone(challenge.phone);
    const isFirebase = Boolean(firebaseUid);
    const [created] = await db
      .insert(usersTable)
      .values({
        phone: challenge.phone,
        firebaseUid: firebaseUid ?? undefined,
        phoneDiscoveryHash: isFirebase ? null : contactDiscoveryHash(challenge.phone),
        phoneVerified: !isFirebase,
        birthday,
        name: isFirebase ? "Old Time User" : `User ${challenge.phone.slice(-4)}`,
        username: defaultUsernameForPhone(challenge.phone),
        online: true,
        lastSeen: timestamp,
      })
      .returning();
    user = created;
  } else {
    const isFirebase = isFirebasePhone(user.phone) || Boolean(user.firebaseUid);
    const [updated] = await db
      .update(usersTable)
      .set(
        isFirebase
          ? { birthday, online: true, lastSeen: timestamp }
          : {
              birthday,
              online: true,
              lastSeen: timestamp,
              phoneVerified: true,
              phoneDiscoveryHash: contactDiscoveryHash(challenge.phone),
            },
      )
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
}
