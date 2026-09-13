# EAS Build – Base Directory Setup

## GitHub repository

**Expo project GitHub repo:** `oldtimemessenger/OldTimeMessenger`

Point Expo / EAS at the branch you actually build from (currently the repo default). Do not use Replit as a source for the GitHub integration.

## Critical: Expo dashboard Base directory

This is a monorepo. The real Expo app lives only under `artifacts/old-time-mobile/`.

1. Go to [expo.dev](https://expo.dev) → your project → **Project settings** → **GitHub / EAS**.
2. Set **Base directory (working directory)** to exactly:
   ```
   artifacts/old-time-mobile
   ```
3. Save.

Without this setting, EAS builds from the monorepo root, falls back to the default Expo entry (`AppEntry.js`), and fails with:

```
Unable to resolve module ../../App from .../node_modules/expo/AppEntry.js
```

Root-level `eas.json` and `app.json` have been removed so this misconfiguration can no longer silently use the wrong entry point.

## Permanent iOS build numbering

Do **not** set `cli.appVersionSource` to `"remote"`.

Expo's remote iOS counter for this project is far behind TestFlight (it produced build **21** after TestFlight was already at **96/97**). Apple requires a unique `CFBundleVersion` higher than the last uploaded build.

Permanent policy:

- `artifacts/old-time-mobile/eas.json` → `cli.appVersionSource` is **`local`**
- preview and production → `autoIncrement` is **`false`**
- `artifacts/old-time-mobile/app.json` → `expo.ios.buildNumber` is the source of truth

Current pinned build number: **98**.

Before the next store/TestFlight build after 98 ships, bump `ios.buildNumber` in `app.json` (99, then 100, …). Do not switch back to remote versioning unless someone first runs:

```bash
eas build:version:set -p ios --build-number <last-TestFlight-number>
```

and confirms the Expo remote value matches Apple.

## Build trigger

Use Replit’s Expo Launch / Publish flow for builds. Select the **mobile** artifact (`artifacts/old-time-mobile`), choose the iOS platform, and select the `preview` profile for an internal build or `production` for an App Store build.

For production App Store builds, prefer the repository's GitHub-triggered workflow (with the base directory set as above).

**Do not start a build from the monorepo root.** `eas.json` and `app.json` live only in `artifacts/old-time-mobile/`.
