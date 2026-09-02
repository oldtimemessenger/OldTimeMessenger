---
name: Development readiness checks
description: Distinguishes the lightweight local health check from production dependency readiness.
---

Use `/api/healthz` as the local API smoke test. `/api/readyz` also validates provider configuration that may be intentionally absent during development, so a 503 `configuration_incomplete` there is not by itself an API startup failure.

**Why:** The API can be fully reachable and database-backed in development while production-only messaging and storage providers are not configured.

**How to apply:** After server changes, verify the workflow starts and `healthz` returns 200; interpret `readyz` separately based on the target environment.