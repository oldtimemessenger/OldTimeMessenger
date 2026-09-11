---
name: Expo production API environment
description: Required API environment configuration for Old Time production mobile builds.
---

Production EAS profiles must explicitly provide both `EXPO_PUBLIC_DOMAIN` and `EXPO_PUBLIC_API_URL`. The mobile API module reads them at import time and throws when neither is present; local build scripts setting them for Metro do not automatically configure cloud EAS builds.

**Why:** A successful native build can still crash immediately on launch when the cloud build omits the production API host.

**How to apply:** Before every production iOS/Android build, inspect the EAS environment list and confirm the public production host is present; keep it pointed at the healthy published API deployment, never a workspace development host.