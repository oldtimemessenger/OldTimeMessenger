import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { authSessionsTable, db, usersTable } from "@workspace/db";
import { verifySupabaseAccessToken } from "./supabase-auth";

const SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
type SupabaseIdentity = NonNullable<Awaited<ReturnType<typeof verifySupabaseAccessToken>>>;

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}

function defaultUsernameForSupabase(uid: string): string {
  return `user${tokenHash(`supabase:${uid}`).slice(0, 12)}`;
}

function identityName(identity: SupabaseIdentity, email: string | undefined): string {
  const metadata = identity.user_metadata;
  const metadataName = [metadata?.full_name, metadata?.name]
    .find((value): value is string => typeof value === "string" && value.trim().length > 0);
  if (metadataName) return metadataName.trim().slice(0, 80);
  const emailName = email?.split("@")[0]?.replace(/[^a-zA-Z0-9 ]/g, " ").trim();
  return emailName?.slice(0, 80) || "Old Time User";
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

export async function requireChatAuth(
  req: Request,
  res: Response,
  options: { allowDeletionPending?: boolean } = {},
): Promise<number | null> {
  const token = readBearerToken(req);
  if (!token) {
    res.status(401).json({ error: "A valid bearer token is required." });
    return null;
  }

  let userId: number | null = null;
  if (token.split(".").length === 3) {
    let identity: Awaited<ReturnType<typeof verifySupabaseAccessToken>>;
    try {
      identity = await verifySupabaseAccessToken(token);
    } catch (error) {
      req.log.error({ err: error }, "Supabase token verification failed");
      res.status(503).json({ error: "We could not verify your sign-in session right now. Please try again." });
      return null;
    }
    if (!identity) {
      res.status(401).json({ error: "Invalid, expired, or revoked bearer token." });
      return null;
    }

    const email = identity.email?.trim().toLowerCase();
    try {
      let [user] = await db
        .select({
          id: usersTable.id,
          birthday: usersTable.birthday,
          supabaseUid: usersTable.supabaseUid,
        })
        .from(usersTable)
        .where(eq(usersTable.supabaseUid, identity.id))
        .limit(1);

      if (!user && email && identity.email_confirmed_at) {
        const candidates = await db
          .select({
            id: usersTable.id,
            birthday: usersTable.birthday,
            supabaseUid: usersTable.supabaseUid,
          })
          .from(usersTable)
          .where(
            and(
              sql`lower(trim(${usersTable.email})) = ${email}`,
              isNull(usersTable.supabaseUid),
            ),
          )
          .limit(2);
        if (candidates.length === 1) {
          const candidate = candidates[0];
          const [linked] = await db
            .update(usersTable)
            .set({ supabaseUid: identity.id })
            .where(and(eq(usersTable.id, candidate.id), isNull(usersTable.supabaseUid)))
            .returning({
              id: usersTable.id,
              birthday: usersTable.birthday,
              supabaseUid: usersTable.supabaseUid,
            });
          if (linked) {
            user = linked;
          } else {
            [user] = await db
              .select({
                id: usersTable.id,
                birthday: usersTable.birthday,
                supabaseUid: usersTable.supabaseUid,
              })
              .from(usersTable)
              .where(eq(usersTable.supabaseUid, identity.id))
              .limit(1);
          }
        } else if (candidates.length > 1) {
          req.log.warn(
            { supabaseUserId: identity.id },
            "Supabase identity matched multiple unlinked Old Time profiles",
          );
        }
      }

      if (!user) {
        const timestamp = Date.now();
        const internalPhone = `supabase:${identity.id}`;
        try {
          const [created] = await db
            .insert(usersTable)
            .values({
              phone: internalPhone,
              supabaseUid: identity.id,
              email: email || null,
              name: identityName(identity, email),
              username: defaultUsernameForSupabase(identity.id),
              online: false,
              lastSeen: timestamp,
            })
            .returning({
              id: usersTable.id,
              birthday: usersTable.birthday,
              supabaseUid: usersTable.supabaseUid,
            });
          user = created;
        } catch (error) {
          // A concurrent request may have created the profile between the
          // lookup and insert. Resolve it before reporting a real failure.
          req.log.warn(
            { err: error, supabaseUserId: identity.id },
            "Supabase profile creation raced with another request",
          );
          [user] = await db
            .select({
              id: usersTable.id,
              birthday: usersTable.birthday,
              supabaseUid: usersTable.supabaseUid,
            })
            .from(usersTable)
            .where(eq(usersTable.supabaseUid, identity.id))
            .limit(1);
        }
      }

      if (!user) {
        res.status(500).json({
          error: "We could not create your Old Time profile right now.",
          code: "LOCAL_PROFILE_PROVISIONING_FAILED",
        });
        return null;
      }
      userId = user.id;
    } catch (error) {
      req.log.error(
        { err: error, supabaseUserId: identity.id },
        "Unable to resolve Supabase identity to an Old Time profile",
      );
      res.status(500).json({ error: "We could not load your Old Time profile right now." });
      return null;
    }
  } else {
    try {
      userId = await authenticateToken(token);
    } catch (error) {
      req.log.error({ err: error }, "Unable to verify Old Time session");
      res.status(500).json({ error: "We could not verify your Old Time session right now." });
      return null;
    }
  }

  if (userId === null) {
    res.status(401).json({ error: "Invalid, expired, or revoked bearer token." });
    return null;
  }
  const [user] = await db
    .select({
      birthday: usersTable.birthday,
      deletionPendingAt: usersTable.deletionPendingAt,
    })
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
  if (user.deletionPendingAt && !options.allowDeletionPending) {
    res.status(403).json({
      error: "This account is being permanently deleted.",
      code: "ACCOUNT_DELETION_PENDING",
    });
    return null;
  }
  return userId;
}

export async function requireVerifiedEmail(req: Request, res: Response): Promise<boolean> {
  const token = readBearerToken(req);
  if (!token || token.split(".").length !== 3) {
    res.status(403).json({ error: "Verify your email before requesting a withdrawal." });
    return false;
  }

  try {
    const identity = await verifySupabaseAccessToken(token);
    if (!identity) {
      res.status(401).json({ error: "Your sign-in session is no longer valid. Please sign in again." });
      return false;
    }
    if (!identity.email_confirmed_at) {
      res.status(403).json({ error: "Verify your email before requesting a withdrawal." });
      return false;
    }
    return true;
  } catch {
    res.status(503).json({ error: "We could not confirm your email right now. Please try again." });
    return false;
  }
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
