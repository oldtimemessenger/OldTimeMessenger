---
name: EAS iOS build image schema
description: EAS CLI validation rule for pinning an iOS build image.
---

For EAS build profiles, place the image under the platform block: `build.<profile>.ios.image`. A profile-level `build.<profile>.image` may look plausible but is rejected by the current EAS CLI before it can inspect the build.

**Why:** A root-level image setting initially prevented the build inspection command from reaching the supplied build, even though the intended Xcode version was correct.

**How to apply:** Keep the mobile artifact's production profile pinned to its valid Xcode 26 image, and validate the config with the EAS CLI before retriggering an iOS build.