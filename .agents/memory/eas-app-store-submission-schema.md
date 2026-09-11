---
name: EAS App Store submission schema
description: EAS submit configuration rule for App Store Connect uploads.
---

For iOS submissions, the App Store Connect numeric ID is nested at `submit.production.ios.ascAppId`. A profile-level `submit.production.ascAppId` is rejected by EAS CLI.

**Why:** A repository can intentionally leave the submit profile empty while credentials are already configured on EAS; the CLI then requires the App Store ID before scheduling the upload.

**How to apply:** Validate the submit profile before running a non-interactive iOS submission, and preserve the existing bundle ID and App Store record.