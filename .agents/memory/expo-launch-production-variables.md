---
name: Expo Launch production variables
description: How this workspace supplies public mobile build variables to Expo Launch without exposing their values
---

Expo Launch can consume the Old Time production environment, but a cloud EAS Build from the connected GitHub repository does not automatically inherit Replit production variables. The mobile build's `EXPO_PUBLIC_*` values must also exist in the Expo project's EAS production environment or be explicitly injected by the build configuration. If `EXPO_PUBLIC_SUPABASE_URL` or `EXPO_PUBLIC_SUPABASE_ANON_KEY` is absent, email, Google, and Apple login all fail at the shared auth configuration guard. The connected Expo MCP can inspect builds but does not expose an environment-variable mutation operation, so use the EAS CLI for project-level build variables.

**Why:** The TestFlight binary can start with a missing-configuration screen even when the source is correct if the variables were absent at build time; public Supabase client values are bundled into the app and must be present before a future production build.

**How to apply:** Set and verify only the named production variables in both environments when needed, report key presence rather than values, and confirm the target Expo project ID and runtime version before any build, OTA update, or submission.