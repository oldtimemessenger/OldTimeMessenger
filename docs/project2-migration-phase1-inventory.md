# Old Time Project 2 → Project 1 Migration

## Phase 1: migration inventory and staging plan

**Status:** Inventory only. No application source, configuration, dependency, database, native, or production files were changed in this phase.

**Project 1:** current workspace `main`, production artifact `artifacts/old-time-mobile`

**Project 2:** `remotes/origin/replit-complete-app`, commit `ef38d9a197659f49a213bda7af1c715b07e7a3dd`

Project 2 is not present as a second working directory. The branch above is the latest complete-app source branch available in this repository. The older `remotes/github/replit-complete-app` branch is not the staging source.

## Non-negotiable Project 1 authority

The following remain Project 1-owned and must not be overwritten by Project 2:

- Expo owner, slug, versioning, runtime policy, and Updates configuration
- EAS project association
- `artifacts/old-time-mobile/app.json`
- `artifacts/old-time-mobile/eas.json`
- `artifacts/old-time-mobile/package.json`
- Root `app.json` and root `eas.json`
- App Store Connect ID, Apple Team ID, bundle identifiers, and Android package
- Apple signing configuration and entitlements
- `artifacts/old-time-mobile/targets/OldTimeBroadcast/**`
- App Group `group.com.oldtime.messenger`
- Firebase client and server authentication
- Supabase connection and storage integration
- Current OpenAPI contract and generated API clients
- `artifacts/api-server/**`
- `lib/db/**`
- Database migrations through `0026`
- LiveKit and WebRTC integration
- Calls backend and native call surfaces
- Pace
- Wallet, Coins, RevenueCat, and creator payments
- Push notifications
- Discovery and Atmosphere
- AdMob and ad policy
- Expo Updates and production environment wiring

## Project 2 application candidates

The following files are the Project 2 application/UI candidates. They are not to be copied blindly. Each will be staged through a three-way review against the current Project 1 file before Phase 2 implementation.

### Routes and screens

| Project 2 path | Proposed action |
|---|---|
| `artifacts/old-time-mobile/app/_layout.tsx` | Use Project 2 navigation/UI structure as a candidate; preserve Project 1 providers, auth bootstrap, update handling, deep-link behavior, and native integrations. |
| `artifacts/old-time-mobile/app/index.tsx` | Use Project 2 entry-screen presentation as a candidate; preserve Project 1 authenticated-session and Firebase behavior. |
| `artifacts/old-time-mobile/app/+not-found.tsx` | Review Project 2 presentation; retain Project 1 route safety and production path behavior. |
| `artifacts/old-time-mobile/app/camera.tsx` | Use Project 2 camera UX as a candidate; preserve Project 1 media upload, permission, and Story handoff behavior. |
| `artifacts/old-time-mobile/app/chat/[id].tsx` | Use Project 2 chat presentation as a candidate; preserve Project 1 API contract, message actions, media handoff, realtime, and auth handling. |
| `artifacts/old-time-mobile/app/current-event/[id].tsx` | Use Project 2 Current Events presentation as a candidate; preserve Project 1 LiveKit, wallet, gifts, realtime, and API behavior. |
| `artifacts/old-time-mobile/app/story/[id].tsx` | Use Project 2 Story presentation as a candidate; preserve Project 1 viewer sequence, persistent text placement, media, replies, reactions, and expiry behavior. |
| `artifacts/old-time-mobile/app/(tabs)/_layout.tsx` | Review Project 2 tab structure; preserve Project 1 Pace, calls, wallet access, and private navigation boundaries. |
| `artifacts/old-time-mobile/app/(tabs)/index.tsx` | Use Project 2 home/feed presentation as a candidate; preserve Project 1 social API, auth, presence, ad policy, and navigation contracts. |
| `artifacts/old-time-mobile/app/(tabs)/map.tsx` | Use Project 2 Map presentation as a candidate; preserve Project 1 map permissions, pin APIs, storage, and visible Map-tab navigation. |
| `artifacts/old-time-mobile/app/(tabs)/settings.tsx` | Use Project 2 Settings presentation as a candidate; preserve Project 1 auth logout, account deletion, notification, payment, and production settings flows. |
| `artifacts/old-time-mobile/app/(tabs)/updates-screen.tsx` | Use Project 2 Updates presentation as a candidate; preserve Project 1 media-only Updates boundary and Story navigation. |
| `artifacts/old-time-mobile/app/(tabs)/updates.tsx` | Use Project 2 Updates/feed presentation as a candidate; preserve Project 1 social API, discovery, atmosphere, and ad boundaries. |
| `artifacts/old-time-mobile/app/(tabs)/calls.tsx` | Review as a navigation candidate only. Do not replace Project 1 call detail routing or calls infrastructure. Keep only if it can use the Project 1 calls contract and preserves existing call entry points. |

### Shared UI components

| Project 2 path | Proposed action |
|---|---|
| `components/current-events-home.tsx` | Candidate UI merge; preserve Project 1 room, wallet, gift, and LiveKit behavior. |
| `components/ErrorBoundary.tsx` | Compare presentation only; keep the version compatible with Project 1 startup and error handling. |
| `components/ErrorFallback.tsx` | Candidate presentation merge; do not weaken production error visibility. |
| `components/KeyboardAwareScrollViewCompat.tsx` | Candidate shared UI utility; retain if behavior is compatible with Project 1 screens. |
| `components/server-story-viewer.tsx` | Candidate Story viewer UI; preserve Project 1 viewer data shape and sequence model. |
| `components/social-map.native.tsx` | Candidate native Map presentation; preserve Project 1 permissions, map provider, and pin behavior. |
| `components/social-map.tsx` | Candidate Map presentation; preserve Project 1 API and routing boundaries. |
| `components/social-map.types.ts` | Review types against Project 1 Map API types before merging. |
| `components/story-viewer-content.tsx` | Candidate Story content presentation; preserve Project 1 media, placement, reaction, reply, and expiry behavior. |
| `components/ui.tsx` | Candidate UI primitives/theme usage; do not remove Project 1 feature affordances or accessibility behavior. |
| `components/video-surface.tsx` | Candidate shared video presentation; preserve Project 1 native call/video integrations. |

### Shared state, hooks, and application libraries

| Project 2 path | Proposed action |
|---|---|
| `context/app-state.tsx` | Review Project 2 state presentation and merge only compatible changes; preserve Project 1 auth, wallet, notification, and feature state. |
| `hooks/useColors.ts` | Candidate theme behavior; preserve Project 1 color tokens where required by production surfaces. |
| `lib/audio-service.ts` | Review candidate behavior; preserve Project 1 native audio implementation in `lib/audio-service.native.ts`. |
| `lib/for-you.ts` | Candidate feed/presentation logic; reconcile with Project 1 discovery and Atmosphere behavior. |
| `lib/i18n.ts` | Candidate copy/localization changes; preserve customer-facing terminology and production copy rules. |
| `lib/map-api.ts` | Review only. Project 1 API and generated types remain authoritative. |
| `lib/presence.ts` | Review only. Preserve Project 1 presence privacy and realtime behavior. |
| `lib/social-api.ts` | Review only. Preserve Project 1 current API contract and generated client integration. |
| `lib/story-viewer-sequence.ts` | Candidate sequence behavior; preserve Project 1 sponsored-content and Story-navigation model. |

### Constants and visual assets

| Project 2 path | Proposed action |
|---|---|
| `constants/colors.ts` | Candidate visual tokens; merge only after checking Project 1 feature surfaces. |
| `constants/emoji.ts` | Candidate presentation constants; merge compatible changes only. |
| `constants/typography.ts` | Candidate typography; retain accessibility and existing production layout constraints. |
| `assets/images/old-time-icon.png` | Compare as a visual candidate only. Do not replace Project 1 app icon or splash assets automatically. |

## Project 2 files explicitly excluded from application migration

These Project 2 files must not replace their Project 1 counterparts:

```text
artifacts/old-time-mobile/app.json
artifacts/old-time-mobile/eas.json
artifacts/old-time-mobile/package.json
artifacts/old-time-mobile/.replit-artifact/artifact.toml
```

The following Project 2 support files are identical or infrastructure-oriented and require no Project 2 copy. Project 1 remains the working source:

```text
artifacts/old-time-mobile/.gitignore
artifacts/old-time-mobile/.npmrc
artifacts/old-time-mobile/babel.config.js
artifacts/old-time-mobile/metro.config.js
artifacts/old-time-mobile/server/serve.js
artifacts/old-time-mobile/server/templates/landing-page.js
artifacts/old-time-mobile/tsconfig.json
```

Project 1's versions of these files remain authoritative if later edits are needed.

## Project 1-only mobile files that must remain

### Production and feature routes

```text
artifacts/old-time-mobile/app/(tabs)/pace.tsx
artifacts/old-time-mobile/app/call/[id].tsx
artifacts/old-time-mobile/app/payment-settings.tsx
artifacts/old-time-mobile/app/wallet.tsx
artifacts/old-time-mobile/app/withdraw.tsx
```

### Production/native components

```text
artifacts/old-time-mobile/components/admob-banner.native.tsx
artifacts/old-time-mobile/components/admob-banner.tsx
artifacts/old-time-mobile/components/admob-initializer.native.tsx
artifacts/old-time-mobile/components/admob-initializer.tsx
artifacts/old-time-mobile/components/admob-native-feed-ad.native.tsx
artifacts/old-time-mobile/components/admob-native-feed-ad.tsx
artifacts/old-time-mobile/components/call-video-surface.native.tsx
artifacts/old-time-mobile/components/call-video-surface.tsx
artifacts/old-time-mobile/components/call-video-surface.web.tsx
artifacts/old-time-mobile/components/chat-composer.tsx
artifacts/old-time-mobile/components/firebase-auth-panel.tsx
```

### Production/native libraries

```text
artifacts/old-time-mobile/lib/ad-manager.native.ts
artifacts/old-time-mobile/lib/ad-manager.ts
artifacts/old-time-mobile/lib/ad-policy.ts
artifacts/old-time-mobile/lib/atmosphere-api.ts
artifacts/old-time-mobile/lib/audio-service.native.ts
artifacts/old-time-mobile/lib/chat-api.ts
artifacts/old-time-mobile/lib/livekit-globals.native.ts
artifacts/old-time-mobile/lib/livekit-globals.ts
artifacts/old-time-mobile/lib/livekit-globals.web.ts
artifacts/old-time-mobile/lib/mobile-api.ts
artifacts/old-time-mobile/lib/pace-api.ts
artifacts/old-time-mobile/lib/pace-coach.ts
artifacts/old-time-mobile/lib/pace-recorder.ts
artifacts/old-time-mobile/lib/push-notifications.ts
artifacts/old-time-mobile/lib/revenuecat.tsx
```

### Native and release files

```text
artifacts/old-time-mobile/firebaseConfig.d.ts
artifacts/old-time-mobile/firebaseConfig.js
artifacts/old-time-mobile/scripts/build.js
artifacts/old-time-mobile/scripts/navigation-regression.mjs
artifacts/old-time-mobile/scripts/validate-eas-config.cjs
artifacts/old-time-mobile/targets/OldTimeBroadcast/Atomic.swift
artifacts/old-time-mobile/targets/OldTimeBroadcast/DarwinNotificationCenter.swift
artifacts/old-time-mobile/targets/OldTimeBroadcast/Info.plist
artifacts/old-time-mobile/targets/OldTimeBroadcast/SampleHandler.swift
artifacts/old-time-mobile/targets/OldTimeBroadcast/SampleUploader.swift
artifacts/old-time-mobile/targets/OldTimeBroadcast/SocketConnection.swift
artifacts/old-time-mobile/targets/OldTimeBroadcast/expo-target.config.js
```

### Project 1-only assets and constants

```text
artifacts/old-time-mobile/assets/images/old-time-native-splash.png
artifacts/old-time-mobile/assets/coins/**
artifacts/old-time-mobile/assets/gifts/**
artifacts/old-time-mobile/assets/pace/pace-rival.webp
artifacts/old-time-mobile/constants/chat-stickers.ts
artifacts/old-time-mobile/constants/current-event-gifts.ts
```

## Backend, API contract, and database staging decision

No Project 2 backend files are scheduled for direct migration.

Project 1 remains authoritative for:

```text
artifacts/api-server/**
lib/api-spec/**
lib/api-client-react/**
lib/api-zod/**
lib/db/**
```

Project 2's backend route files are retained only as behavioral reference during later UI reconciliation. They must not downgrade Project 1's current routes or generated contracts.

Project 1-only backend capabilities that must remain include:

```text
artifacts/api-server/src/routes/account.ts
artifacts/api-server/src/routes/atmosphere.ts
artifacts/api-server/src/routes/auth-birthday.ts
artifacts/api-server/src/routes/calls.ts
artifacts/api-server/src/routes/discovery.ts
artifacts/api-server/src/routes/pace.ts
artifacts/api-server/src/lib/atmosphere-engine.ts
artifacts/api-server/src/lib/firebase-auth.ts
artifacts/api-server/src/lib/livekit.ts
artifacts/api-server/src/lib/push-notifications.ts
artifacts/api-server/src/lib/revenuecat.ts
artifacts/api-server/src/lib/stripe-client.ts
artifacts/api-server/src/lib/supabase-profiles.ts
```

No Project 2 migration files are scheduled for copying. Project 1's migration history through `0026` remains authoritative.

## Dependency staging decision

Project 2's `package.json` is review-only. It must not replace Project 1's package manifest or lockfile because it:

- omits required production integrations;
- omits native call, Firebase, notifications, advertising, and purchase dependencies;
- uses `catalog:` dependency specifications;
- contains older Expo package versions.

Phase 2 will use Project 1's explicit dependency versions and add only a dependency that is demonstrated to be required by a selected Project 2 UI change.

## Proposed implementation phases after Phase 1

These are staging boundaries, not work performed in this phase:

1. **Phase 2 — shared visual shell and navigation review:** merge the selected Project 2 route/layout/UI changes while preserving Project 1 providers and feature entry points.
2. **Phase 3 — social surfaces:** reconcile feed, Stories, profiles, Map, Updates, chat, and Settings behavior against Project 1 APIs.
3. **Phase 4 — feature integration:** verify calls, Current Events, Pace, wallet, payments, push, discovery, atmosphere, ads, and authentication remain connected.
4. **Phase 5 — validation:** run static checks, navigation checks, API readiness checks, and targeted mobile verification. No production build or Apple submission is implied until separately approved.

Each phase will be committed separately and will stop for review before the next phase begins.