---
name: GitHub sync identity
description: Durable repository and generated-output constraints for Old Time Messenger GitHub synchronization.
---

The connected GitHub repository is `oldtimemessenger/OldTimeMessenger` (singular), and its active branch is `replit-complete-app`. The workspace's configured Git remote is a gitsafe backup remote, not the GitHub repository.

**Why:** The repository owner spelling in older project context was plural, while the connected GitHub account and repository are singular; using the stale spelling returns a misleading 404.

**How to apply:** Resolve the connected GitHub repository before publishing, and keep `artifacts/old-time-mobile/static-build/` ignored and out of repository sync. The connector can read this repository, but GitHub write endpoints may be blocked by the upstream proxy; the CLI does not inherit a GitHub write credential, so do not claim a push succeeded without verifying the branch tip.