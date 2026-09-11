# Phase 5 physical-device test matrix

Static checks cannot prove native push presentation, microphone routing, lock-screen behavior, force-quit delivery, or the behavior of two real LiveKit clients. Run this matrix on two signed iPhones with separate Old Time accounts.

## Setup

1. Install the same signed build on iPhone A and iPhone B.
2. Sign in with separate accounts and confirm both accounts can see each other in Chat.
3. Enable Old Time notifications on both phones. Confirm notification permission is granted and notification settings are enabled.
4. Record the build commit, API environment, LiveKit URL, iOS versions, and network type before testing.
5. Keep the API and LiveKit logs available. Do not treat a UI state alone as proof that a second phone joined.

## Calls

### Basic lifecycle

1. From A, start a voice call to B.
2. Confirm B receives one incoming call notification and one call route.
3. On B, accept the call.
4. Confirm both phones show the same call as accepted and can hear each other.
5. End the call from A.
6. Confirm B leaves the media session and shows the ended state.
7. Repeat with a video call and confirm camera publish/subscribe on both phones.

### Decline, miss, and retry

1. Start a call from A and decline it on B.
2. Confirm A shows declined and no active call remains.
3. Start another call and do not answer on B for more than the ring timeout.
4. Confirm both phones can recover the missed state even if the incoming socket event is missed.
5. Tap the call-start action repeatedly during one request and confirm only one call is created.
6. Tap accept repeatedly on B and confirm the call remains one accepted call.
7. Tap end repeatedly on either phone and confirm the final state remains ended without an error.

### Lifecycle and network

1. Accept a call, lock B, unlock B, and confirm media reconnects or the UI offers a bounded retry.
2. Put one phone into airplane mode for 10 seconds, restore the network, and confirm the call does not remain falsely connected.
3. Background both apps during an active call and return to the foreground.
4. Force-quit B, start a new call from A, and confirm push delivery and tap routing.
5. Open Recent Calls after a missed or ended call without first opening the call screen. Confirm server-backed history restores it.
6. Attempt the same call from both phones at nearly the same time. Confirm the API leaves only one active call.

## Current Events

### Room and audio lifecycle

1. On A, create and start a Current Event room.
2. On B, join the room.
3. Confirm both phones receive the same room identity and can hear the same LiveKit audio.
4. Have B leave. Confirm A continues without B remaining in the participant list.
5. Have B reconnect. Confirm B can join the live room again and receive a fresh token.
6. End the room from A. Confirm B receives the ended state.
7. Attempt to rejoin the ended room from B and confirm the API rejects the join and token request.
8. Disable or invalidate LiveKit configuration in a controlled test environment and confirm the server returns a recoverable configuration error instead of an infinite loading state.

### Authorization, moderation, reactions, and chat

1. Use an account that is not a room participant to request the room token. Confirm it receives a rejection and no usable token.
2. Confirm a listener cannot promote, mute, demote, or remove participants.
3. Confirm a moderator can manage listeners/speakers but cannot manage another moderator or the host.
4. Send reactions from A and B. Confirm each reaction appears once per recipient and duplicate delivery does not create duplicate hearts.
5. Send chat messages from both phones. Confirm delivery, ordering, and reconnect recovery.
6. End the room and confirm ephemeral chat is no longer readable.

## Results

Record each test as `PASS`, `FAIL`, or `BLOCKED`, including the phone, timestamp, network, and relevant server error. A successful static check is not a substitute for a result in this matrix.