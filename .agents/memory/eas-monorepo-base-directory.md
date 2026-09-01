---
name: EAS monorepo base directory
description: Publishing constraint for Expo GitHub builds in this workspace.
---

Expo GitHub builds must use `artifacts/old-time-mobile` as the Base directory. Keep EAS configuration at the root of that app directory, not at the workspace root.

**Why:** The workspace is a monorepo. With no Base directory configured, GitHub-triggered EAS builds look for `/eas.json` and fail before compilation. An older root-level EAS file also referenced an obsolete Supabase setup and must not be restored.

**How to apply:** When configuring or debugging Expo's GitHub integration, verify its repository Base directory before changing build profiles or application code.