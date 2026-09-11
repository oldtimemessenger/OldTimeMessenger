---
name: LIVE gift delivery
description: Delivery and idempotency rules for synchronized LIVE room gifts and their benefits.
---

Treat the post-commit room socket event as the authoritative trigger for every participant's gift animation, including the sender. Deduplicate with the stable gift record ID, keep only a bounded recent-ID set, and do not replay historical gifts after reconnecting.

Gift benefits are server-owned and part of the same transaction as the Coin debit, Gold credit, ledger entries, and gift record. Time gifts extend the room deadline; Studio adds 30 days to the recipient's camera-access entitlement.

**Why:** Local sender animations drift from what other participants see, and retries can otherwise duplicate both visual playback and paid benefits.

**How to apply:** Generate one idempotency key per send and reuse it for network retries. Broadcast only after a successful commit, then let all connected clients—including the sender—queue the same event by gift ID.