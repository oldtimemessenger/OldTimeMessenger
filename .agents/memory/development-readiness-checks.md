---
name: Development readiness checks
description: Defines health and traffic-readiness semantics for the API.
---

Treat `/api/readyz` returning 503 as a release blocker. Readiness must cover the database and providers required for the app's primary traffic path, but optional capabilities such as Twilio phone verification must not make the entire API unready.

**Why:** Deployment systems use readiness to decide whether the API can receive traffic. Conflating an optional provider outage with process readiness can prevent an otherwise usable Firebase-first app from becoming live.

**How to apply:** Before release, require both `/api/healthz` and `/api/readyz` to return 200. Optional feature endpoints should report their own provider-specific unavailability without failing global readiness.