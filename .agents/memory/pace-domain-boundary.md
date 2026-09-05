---
name: Pace domain boundary
description: Product boundary for Old Time's location-aware activity community.
---

Pace is an activity-community surface for shareable routes and challenges, with its own route, comment, like, and gift records. It reuses the existing wallet ledger for Coins debits and Gold credits rather than creating a second balance system.

**Why:** Pace needs social behavior that is more structured than generic posts, while the existing wallet already defines the product's gift economics and idempotent balance behavior.

**How to apply:** Keep route geometry, route engagement, and route gifts in Pace APIs/tables. Reuse the wallet for money-like accounting. Live GPS drafts stay local until the user explicitly shares them, and sharing must expose a clear public/private choice. Background GPS is allowed only during an active user-started recording and must stop on pause, finish, or discard.

Global route discovery must remain useful without exact location access; nearby suggestions are an opt-in refinement. Synthetic encouragement should be labeled as a route pulse or idea, not presented as verified live user activity.

**Why:** Location access is optional and privacy-sensitive, while Pace still needs an inviting empty-state experience. Clear pulse labeling avoids implying that a real person posted when the prompt is generated locally.

**How to apply:** Return general route suggestions when the feed has no coordinates, and use location only to make them local. Keep generated pulse copy separate from server-backed community activity.