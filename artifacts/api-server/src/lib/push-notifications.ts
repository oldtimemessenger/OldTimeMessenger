import { and, eq, inArray } from "drizzle-orm";
import { db, pushTokensTable } from "@workspace/db";
import { logger } from "./logger";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_BATCH_SIZE = 100;

type PushPayload = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, string | number | boolean>;
  sound?: "default";
};

function isExpoPushToken(token: string): boolean {
  return /^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/.test(token);
}

export async function registerPushToken(userId: number, token: string, platform: "ios" | "android"): Promise<void> {
  const timestamp = Date.now();
  await db.insert(pushTokensTable).values({
    userId, token, platform, active: true, createdAt: timestamp, updatedAt: timestamp, lastSeenAt: timestamp,
  }).onConflictDoUpdate({
    target: pushTokensTable.token,
    set: { userId, platform, active: true, updatedAt: timestamp, lastSeenAt: timestamp, deactivatedAt: null },
  });
}

export async function unregisterPushToken(userId: number, token: string): Promise<void> {
  const timestamp = Date.now();
  await db.update(pushTokensTable).set({ active: false, updatedAt: timestamp, deactivatedAt: timestamp })
    .where(and(eq(pushTokensTable.userId, userId), eq(pushTokensTable.token, token)));
}

export async function deactivatePushTokens(tokens: string[]): Promise<void> {
  if (!tokens.length) return;
  const timestamp = Date.now();
  await db.update(pushTokensTable).set({ active: false, updatedAt: timestamp, deactivatedAt: timestamp })
    .where(inArray(pushTokensTable.token, tokens));
}

export async function sendPushToUsers(
  userIds: number[],
  notification: Omit<PushPayload, "to">,
): Promise<void> {
  const recipients = [...new Set(userIds)];
  if (!recipients.length) return;
  const tokens = await db.select({ token: pushTokensTable.token }).from(pushTokensTable)
    .where(and(inArray(pushTokensTable.userId, recipients), eq(pushTokensTable.active, true)));
  const validTokens = tokens.map(({ token }) => token).filter(isExpoPushToken);
  const malformedTokens = tokens.map(({ token }) => token).filter((token) => !isExpoPushToken(token));
  await deactivatePushTokens(malformedTokens);

  for (let index = 0; index < validTokens.length; index += EXPO_BATCH_SIZE) {
    const batch = validTokens.slice(index, index + EXPO_BATCH_SIZE);
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify(batch.map((to) => ({ to, sound: "default", ...notification }))),
      });
      if (!response.ok) {
        logger.warn({ status: response.status }, "Expo push delivery request failed");
        continue;
      }
      const body: unknown = await response.json();
      const entries = body && typeof body === "object" && Array.isArray((body as { data?: unknown }).data)
        ? (body as { data: Array<{ status?: string; details?: { error?: string } }> }).data : [];
      const invalid = entries.flatMap((entry, offset) =>
        entry.status === "error" && entry.details?.error === "DeviceNotRegistered" ? [batch[offset]] : []);
      await deactivatePushTokens(invalid.filter((token): token is string => Boolean(token)));
    } catch (error) {
      logger.warn({ err: error }, "Expo push delivery request failed");
    }
  }
}