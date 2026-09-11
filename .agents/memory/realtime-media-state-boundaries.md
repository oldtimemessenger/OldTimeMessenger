---
name: Realtime media state boundaries
description: Durable rules for calls and Current Event audio recovery.
---

An accepted call is not proof that LiveKit media is connected. Keep call lifecycle state, media connection state, and server-backed history reconciliation separate.

**Why:** Socket events can be missed during backgrounding or network changes, while media providers can disconnect or be unavailable after the API has accepted a call. Treating one state as another leaves stale calls, falsely connected screens, or infinite audio loading.

**How to apply:** Reconnect sockets with bounded backoff, resync call history on connect/resume, refresh media tokens after provider disconnects, guard async joins against ended rooms, and make unconfigured audio reject explicitly. The current call API creates a ringing record without a LiveKit token; fetch the token only after the call is accepted, including for the caller waiting for the answer.