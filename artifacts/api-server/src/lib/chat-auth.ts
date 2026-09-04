import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { and, eq, gt, isNull } from "drizzle-orm";
import { authSessionsTable, db, usersTable } from "@workspace/db";
import { meetsMinimumAge } from "./age-gate";

const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}

function readBearerToken(req: Request): string | null {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token.length >= 32 ? token : null;
}

export async function createAuthToken(userId: number): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const createdAt = Date.now();
  await db.insert(authSessionsTable).values({
    id: randomUUID(),
    userId,
    tokenHash: tokenHash(token),
    createdAt,
    expiresAt: createdAt + SESSION_LIFETIME_MS,
    lastSeenAt: createdAt,
  });
  return token;
}

export async function authenticateToken(token: string): Promise<number | null> {
  if (token.length < 32) return null;
  const now = Date.now();
  const [session] = await db
    .select({ id: authSessionsTable.id, userId: authSessionsTable.userId })
    .from(authSessionsTable)
    .where(
      and(
        eq(authSessionsTable.tokenHash, tokenHash(token)),
        isNull(authSessionsTable.revokedAt),
        gt(authSessionsTable.expiresAt, now),
      ),
    )
    .limit(1);
  if (!session) return null;
  await db
    .update(authSessionsTable)
    .set({ lastSeenAt: now })
    .where(eq(authSessionsTable.id, session.id));
  return session.userId;
}

export async function requireChatAuth(req: Request, res: Response): Promise<number | null> {
  const token = readBearerToken(req);
  if (!token) {
    res.status(401).json({ error: "A valid bearer token is required." });
    return null;
  }
  const userId = await authenticateToken(token);
  if (userId === null) {
    res.status(401).json({ error: "Invalid, expired, or revoked bearer token." });
    return null;
  }
  const [user] = await db
    .select({ birthday: usersTable.birthday })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  // Orphan sessions (user row wiped / DB reset) must not keep returning opaque 404s.
  if (!user) {
    await db
      .update(authSessionsTable)
      .set({ revokedAt: Date.now() })
      .where(
        and(
          eq(authSessionsTable.tokenHash, tokenHash(token)),
          isNull(authSessionsTable.revokedAt),
        ),
      );
    res.status(401).json({ error: "Your session is no longer valid. Please sign in again." });
    return null;
  }
  if (!user.birthday || !meetsMinimumAge(user.birthday)) {
    res.status(401).json({ error: "Age verification is required before using Old Time." });
    return null;
  }
  return userId;
}

export async function revokeCurrentSession(req: Request): Promise<boolean> {
  const token = readBearerToken(req);
  if (!token) return false;
  const updated = await db
    .update(authSessionsTable)
    .set({ revokedAt: Date.now() })
    .where(
      and(
        eq(authSessionsTable.tokenHash, tokenHash(token)),
        isNull(authSessionsTable.revokedAt),
      ),
    )
    .returning({ id: authSessionsTable.id });
  return updated.length > 0;
}

export async function callerMatches(
  req: Request,
  res: Response,
  callerId: number,
): Promise<boolean> {
  const authUserId = await requireChatAuth(req, res);
  if (authUserId === null) return false;
  if (authUserId !== callerId) {
    res.status(403).json({ error: "Bearer token identity does not match the caller." });
    return false;
  }
  return true;
}

export function safeTokenEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
