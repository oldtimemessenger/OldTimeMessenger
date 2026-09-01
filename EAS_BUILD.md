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

## Local / Expo Dev build command

```sh
cd artifacts/old-time-mobile
npx eas-cli build --profile development --platform ios
```

**Do not run `eas build` from the monorepo root.** `eas.json` and `app.json` live
only in `artifacts/old-time-mobile/`, so running EAS from any other directory will
fail to find them.
