# EAS Build – Base Directory Setup

## GitHub repository

**Expo project GitHub repo:** `oldtimemessenger/OldTimeMessenger`

Point Expo / EAS at the branch you actually build from (currently the repo default). Do not use Replit as a source.

## Expo dashboard

1. Go to [expo.dev](https://expo.dev) → your project → **Project settings** → **GitHub / EAS**.
2. Set **Base directory (working directory)** to:
   ```
   artifacts/old-time-mobile
   ```
3. Save. Every GitHub-triggered build will now run from that subdirectory, so EAS can find `eas.json` and `app.json`.

## Build trigger

Use Replit’s Expo Launch / Publish flow for builds. Select the mobile
artifact, choose the iOS platform, and select the `preview` profile for an
internal build or `production` for an App Store build.

For production App Store builds, prefer the repository's GitHub-triggered
workflow—the path that has already completed build and submission
successfully. Avoid manual submission calls when possible.

**Do not start a build from the monorepo root.** `eas.json` and `app.json` live
only in `artifacts/old-time-mobile/`; the configured base directory must remain
`artifacts/old-time-mobile/`.
