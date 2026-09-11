---
name: Verification badge enforcement
description: Rules for displaying Old Time verification badges from trusted server state.
---

The verification badge is derived server-side from a confirmed verification payment entitlement or an explicit system-admin approval. Client profile input, client-provided badge fields, coin purchases, and ordinary user roles must never grant it.

**Why:** Verification is a trust signal; accepting a client toggle or treating unrelated purchases as verification would let users impersonate approved businesses or creators.

**How to apply:** Keep payment reconciliation and admin approval as separate server-owned state. Expose only the derived boolean to clients, default it to false, and require the configured system-admin authorization for approval changes.