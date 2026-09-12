import { AccessToken, TrackSource } from "livekit-server-sdk";

const TOKEN_TTL_SECONDS = 10 * 60;

function liveKitConfigError(): string | null {
  const url = process.env.LIVEKIT_URL?.trim();
  const apiKey = process.env.LIVEKIT_API_KEY?.trim();
  const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();
  if (!url || !apiKey || !apiSecret) return "LiveKit is not configured.";
  try {
    const parsed = new URL(url);
    if (!["ws:", "wss:"].includes(parsed.protocol) || !parsed.hostname) {
      return "LiveKit URL must be a valid ws:// or wss:// endpoint.";
    }
  } catch {
    return "LiveKit URL must be a valid ws:// or wss:// endpoint.";
  }
  return null;
}

export function liveKitConfigured(): boolean {
  return liveKitConfigError() === null;
}

export function liveKitPublicUrl(): string {
  const error = liveKitConfigError();
  if (error) throw new Error(error);
  return process.env.LIVEKIT_URL!.trim();
}

export async function createLiveKitToken(input: {
  room: string;
  userId: number;
  canPublish: boolean;
  canPublishCamera?: boolean;
}): Promise<string> {
  const error = liveKitConfigError();
  if (error) throw new Error(error);
  const apiKey = process.env.LIVEKIT_API_KEY!;
  const apiSecret = process.env.LIVEKIT_API_SECRET!;
  const token = new AccessToken(apiKey, apiSecret, {
    identity: `user_${input.userId}`,
    ttl: TOKEN_TTL_SECONDS,
  });
  const canPublishSources = input.canPublish && input.canPublishCamera !== undefined
    ? input.canPublishCamera
      ? [TrackSource.MICROPHONE, TrackSource.CAMERA]
      : [TrackSource.MICROPHONE]
    : undefined;
  token.addGrant({
    roomJoin: true,
    room: input.room,
    canPublish: input.canPublish,
    canPublishSources,
    canSubscribe: true,
  });
  return token.toJwt();
}