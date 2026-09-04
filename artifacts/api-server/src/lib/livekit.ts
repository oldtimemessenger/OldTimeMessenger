import { AccessToken } from "livekit-server-sdk";

const TOKEN_TTL_SECONDS = 10 * 60;

export function liveKitConfigured(): boolean {
  return Boolean(
    process.env.LIVEKIT_URL
      && process.env.LIVEKIT_API_KEY
      && process.env.LIVEKIT_API_SECRET,
  );
}

export function liveKitPublicUrl(): string {
  const url = process.env.LIVEKIT_URL;
  if (!url) throw new Error("LiveKit is not configured.");
  return url;
}

export async function createLiveKitToken(input: {
  room: string;
  userId: number;
  canPublish: boolean;
}): Promise<string> {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!apiKey || !apiSecret || !process.env.LIVEKIT_URL) {
    throw new Error("LiveKit is not configured.");
  }
  const token = new AccessToken(apiKey, apiSecret, {
    identity: `user_${input.userId}`,
    ttl: TOKEN_TTL_SECONDS,
  });
  token.addGrant({
    roomJoin: true,
    room: input.room,
    canPublish: input.canPublish,
    canSubscribe: true,
  });
  return token.toJwt();
}