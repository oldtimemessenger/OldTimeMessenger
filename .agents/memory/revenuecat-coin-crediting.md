---
name: RevenueCat coin crediting
description: Security and ownership rules for turning native purchases into Current Events wallet coins.
---

RevenueCat owns the coin product catalog and prices. The API owns wallet balances and must reconcile purchases from RevenueCat using the authenticated Old Time user identity.

**Why:** A mobile client can be modified, requests can be replayed, and store prices vary by locale. Trusting a client-provided product, amount, or transaction would allow free or duplicate wallet credits.

**How to apply:** Identify RevenueCat customers as `oldtime-user-{numericUserId}`. Query their purchases server-side, map only known active RevenueCat product identifiers to coin amounts, and insert each provider purchase ID into an idempotency ledger before increasing the wallet.