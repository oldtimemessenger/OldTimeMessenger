# EAS Build – Base Directory Setup

## GitHub repository

**Expo project GitHub repo:** `oldtimemessenger/OldTimeMessenger`  
**Branch:** `replit-complete-app`

## Expo dashboard (manual step – Copilot cannot do this for you)

1. Go to [expo.dev](https://expo.dev) → your project → **Project settings** → **GitHub / EAS**.
2. Set **Base directory (working directory)** to:
   ```
   artifacts/old-time-mobile
   ```
3. Save. Every GitHub-triggered build will now run from that subdirectory, so EAS can find `eas.json` and `app.json`.

> After a GitHub-triggered build, `EAS_BUILD_GIT_COMMIT_HASH` must be the current
> `replit-complete-app` tip, **not** `0bb465dd`. If it still shows the old hash,
> the base directory was not saved correctly.

## Local build command

```sh
pnpm eas:mobile -- build --profile development --platform ios
```

This wrapper always runs EAS from `artifacts/old-time-mobile` and prints the exact
git branch and commit being built before it starts.

If you still want to run the CLI directly, use:

```sh
cd artifacts/old-time-mobile
npx eas-cli build --profile development --platform ios
```

**Do not run `eas build` from the monorepo root.** `eas.json` and `app.json` live
only in `artifacts/old-time-mobile/`, so running EAS from any other directory will
fail to find them.
