---
name: GitHub sync identity
description: Durable repository and generated-output constraints for Old Time Messenger GitHub synchronization.
---

The connected GitHub repository is `oldtimemessenger/OldTimeMessenger` (singular), and completed project snapshots belong on `main`. Confirm the live remote branch tip because local remote-tracking references may be stale.

**Why:** The repository owner spelling in older project context was plural, while the connected GitHub account and repository are singular; using the stale spelling returns a misleading 404.

**How to apply:** Resolve the connected GitHub repository before publishing, keep `artifacts/old-time-mobile/static-build/` ignored, and verify the final remote tree hash. Use the connector when CLI credentials are unavailable.