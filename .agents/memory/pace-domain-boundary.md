---
name: Pace domain boundary
description: Product boundary for Old Time's location-aware activity community.
---

Pace is an activity-community surface for shareable routes and challenges, with its own route, comment, like, and gift records. It reuses the existing wallet ledger for Coins debits and Gold credits rather than creating a second balance system.

**Why:** Pace needs social behavior that is more structured than generic posts, while the existing wallet already defines the product's gift economics and idempotent balance behavior.

**How to apply:** Keep route geometry, route engagement, and route gifts in Pace APIs/tables. Reuse the wallet for money-like accounting. Live GPS drafts stay local until the user explicitly shares them, and sharing must expose a clear public/private choice. Background GPS is allowed only during an active user-started recording and must stop on pause, finish, or discard.