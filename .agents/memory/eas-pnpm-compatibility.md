---
name: EAS pnpm compatibility
description: Expo cloud builds may resolve dependencies with an older pnpm than the workspace packageManager declaration.
---

For Old Time's Expo builds, do not rely on pnpm catalog dependency syntax in workspace package manifests. The EAS builder has used pnpm 9.3 even when the repository declares pnpm 10.26.1, and catalog resolution then fails before prebuild.

**Why:** The cloud builder's package-manager selection is independent of the local Replit toolchain and can fail before any Expo code is compiled.

**How to apply:** Keep build-relevant package manifests on explicit dependency versions, keep the lockfile synchronized, and verify installation with the oldest pnpm version reported by the build logs before rerunning an iOS build.