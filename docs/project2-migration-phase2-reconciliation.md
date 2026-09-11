# Old Time Project 2 → Project 1 Migration

## Phase 2: source reconciliation result

**Status:** Complete without application-source copying.

**Project 1:** current workspace `main`

**Project 2:** `remotes/origin/replit-complete-app` at `ef38d9a197659f49a213bda7af1c715b07e7a3dd`

## Result

Project 2 is an ancestor of Project 1. The Project 1 history already contains the Project 2 application source and then adds later UI, feature, backend, database, and production-infrastructure work.

Because the requested Project 2 source is already present in Project 1, copying those files again would be an uncontrolled backward merge and would remove production functionality. No application source was replaced.

## File-level reconciliation

### Project 2 files already present in Project 1

All Project 2 files under these mobile application areas are already present in Project 1:

```text
artifacts/old-time-mobile/app/**
artifacts/old-time-mobile/components/**
artifacts/old-time-mobile/context/**
artifacts/old-time-mobile/hooks/**
artifacts/old-time-mobile/lib/**
artifacts/old-time-mobile/constants/**
artifacts/old-time-mobile/assets/**
```

This includes the Project 2 versions of:

- Updates and social feed
- Stories and Story viewer
- Map and map presentation
- Chat
- Camera
- Current Events
- Settings
- Profiles and profile cards
- Home and navigation shell

The current Project 1 versions are retained because they include the Project 2 source plus later production behavior and integrations.

### The only Project 2 file not present in Project 1

```text
artifacts/old-time-mobile/app/(tabs)/calls.tsx
```

This file was intentionally removed from Project 1 in the existing commit:

```text
5fe0df6 Remove legacy Calls tab route
```

Project 2's Calls tab is a legacy phone-dialer screen using `tel:` links and local call records. It does not use Project 1's production in-app call API, LiveKit rooms, call-token flow, call detail route, or ReplayKit integration.

It is intentionally not restored.

Project 1 retains calls through:

```text
artifacts/old-time-mobile/app/call/[id].tsx
artifacts/old-time-mobile/lib/chat-api.ts
artifacts/api-server/src/routes/calls.ts
artifacts/api-server/src/lib/livekit.ts
```

Recent calls remain available through the Project 1 Settings flow.

## Project 1 files preserved as authoritative

No changes were made to:

```text
artifacts/old-time-mobile/app.json
artifacts/old-time-mobile/eas.json
artifacts/old-time-mobile/package.json
artifacts/old-time-mobile/firebaseConfig.js
artifacts/old-time-mobile/firebaseConfig.d.ts
artifacts/old-time-mobile/targets/OldTimeBroadcast/**
artifacts/api-server/**
lib/api-spec/**
lib/api-client-react/**
lib/api-zod/**
lib/db/**
```

Project 1-only functionality remains intact, including:

- Firebase, Apple, Google, and email authentication
- Supabase integration
- Current API and generated-client contract
- ReplayKit and App Group configuration
- LiveKit and WebRTC
- Calls and call detail
- Pace
- Wallet, Coins, RevenueCat, and creator payments
- Push notifications
- Discovery and Atmosphere
- AdMob and ad policy
- Expo Updates
- Production environment configuration

## Dependencies and imports

No dependencies were added, removed, downgraded, or reconciled in this phase.

Project 1's explicit dependency versions remain authoritative. Project 2's older package manifest and `catalog:` specifications were not copied.

## Navigation decision

Project 1's current five-tab navigation remains unchanged:

- Updates
- Pace
- Map
- Chat
- Settings

The legacy Project 2 Calls tab was not restored because it would present a different phone-dialer behavior beside Project 1's production in-app calling system.

## Verification

The source-lineage and file-presence checks confirmed:

- Project 2 is an ancestor of Project 1.
- No Project 2 application files are missing except the intentionally removed legacy Calls tab.
- No Project 2 backend or database files need to be migrated.
- No production configuration was overwritten.

No EAS build, TestFlight submission, or App Store submission was run.

## Remaining blocker before a future phase

There is no safe Project 2 source delta left to apply from the approved branch. A later phase should only begin if one of these is provided:

1. A newer Project 2 branch or working directory that is not already an ancestor of Project 1; or
2. Specific UI changes that should be designed or rebuilt on top of the current Project 1 source.
