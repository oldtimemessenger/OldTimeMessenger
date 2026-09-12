---
name: GitHub monorepo EAS read behavior
description: Replit's GitHub build dialog can report that a nested eas.json cannot be read even when the file exists locally and on the connected main branch.
---

The GitHub build dialog may fail to read a valid nested Expo configuration in a monorepo after the app directory is supplied, so changing the EAS profile or regenerating eas.json is not an appropriate fix.

**Why:** The Old Time mobile repository keeps eas.json under its artifact directory; the file can be present locally and on GitHub while the dialog still reports a read failure.

**How to apply:** Verify the selected branch and nested file first. If both are correct, stop using that dialog rather than running eas build:configure; use the mobile artifact's supported Expo build flow or a builder with explicit monorepo base-directory support.