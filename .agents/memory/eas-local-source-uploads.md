---
name: EAS local source uploads
description: Source provenance when triggering EAS builds from the monorepo.
---

Running `eas build` from the mobile artifact uploads the local project archive. A connected GitHub repository does not automatically make that command build the current GitHub `main` tree.

**Why:** A successful TestFlight build can have a local workspace commit hash even when the connected GitHub branch is behind or contains only configuration changes.

**How to apply:** Before submitting, compare the EAS build `gitCommitHash` and `gitCommitMessage` with the intended release commit, and install the resulting TestFlight build number rather than assuming the existing app icon changed.