import assert from "node:assert/strict";
import {
  ACCEPTED_CALL_MAX_MS,
  isAcceptedCallStale,
  isCallTerminal,
} from "./call-lifecycle";
import { canManageStageTarget } from "./current-event-permissions";
import { liveKitConfigured, liveKitPublicUrl } from "./livekit";

assert.equal(isCallTerminal("ended"), true);
assert.equal(isCallTerminal("missed"), true);
assert.equal(isCallTerminal("accepted"), false);
assert.equal(isAcceptedCallStale(Date.now() - ACCEPTED_CALL_MAX_MS - 1, Date.now()), true);
assert.equal(isAcceptedCallStale(Date.now() - ACCEPTED_CALL_MAX_MS + 1, Date.now()), false);

assert.equal(canManageStageTarget("host", "moderator"), true);
assert.equal(canManageStageTarget("host", "listener"), true);
assert.equal(canManageStageTarget("moderator", "speaker"), true);
assert.equal(canManageStageTarget("moderator", "moderator"), false);
assert.equal(canManageStageTarget("moderator", "host"), false);
assert.equal(canManageStageTarget("speaker", "listener"), false);

const previousLiveKit = {
  url: process.env.LIVEKIT_URL,
  key: process.env.LIVEKIT_API_KEY,
  secret: process.env.LIVEKIT_API_SECRET,
};
try {
  delete process.env.LIVEKIT_URL;
  delete process.env.LIVEKIT_API_KEY;
  delete process.env.LIVEKIT_API_SECRET;
  assert.equal(liveKitConfigured(), false);

  process.env.LIVEKIT_URL = "https://not-a-livekit-endpoint.example.com";
  process.env.LIVEKIT_API_KEY = "key";
  process.env.LIVEKIT_API_SECRET = "secret";
  assert.equal(liveKitConfigured(), false);

  process.env.LIVEKIT_URL = "wss://livekit.example.com";
  assert.equal(liveKitConfigured(), true);
  assert.equal(liveKitPublicUrl(), "wss://livekit.example.com");
} finally {
  if (previousLiveKit.url === undefined) delete process.env.LIVEKIT_URL;
  else process.env.LIVEKIT_URL = previousLiveKit.url;
  if (previousLiveKit.key === undefined) delete process.env.LIVEKIT_API_KEY;
  else process.env.LIVEKIT_API_KEY = previousLiveKit.key;
  if (previousLiveKit.secret === undefined) delete process.env.LIVEKIT_API_SECRET;
  else process.env.LIVEKIT_API_SECRET = previousLiveKit.secret;
}

console.log("Phase 5 call lifecycle, Current Event authorization, and LiveKit checks passed.");