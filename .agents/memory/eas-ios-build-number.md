---
name: EAS iOS build number
description: Keep iOS CFBundleVersion local and never use Expo remote versioning until it matches TestFlight.
---

Do not set `artifacts/old-time-mobile/eas.json` `cli.appVersionSource` to `remote`.

Expo's remote iOS counter for this project lagged TestFlight and produced build 21 after Apple already had 96/97.

Keep:
- `appVersionSource`: `local`
- preview/production `autoIncrement`: `false`
- `artifacts/old-time-mobile/app.json` `expo.ios.buildNumber` as the only source of truth

Current pinned value: `98`. Bump that string before each new TestFlight/App Store upload. Do not re-enable remote versioning unless `eas build:version:set -p ios` has been synced to the last Apple build number.
