---
name: Supabase API auth boundary
description: Supabase identities map to local Old Time users, including durable handling for destructive account deletion.
---

The mobile app authenticates with Supabase, while Old Time keeps a numeric local user as the owner of relational app data. Verify Supabase access tokens server-side, map them to exactly one local user, and never trust a caller-supplied identity.

Permanent account deletion must commit a durable pending state together with the local tombstone, reject ordinary authenticated operations while pending, and retry Supabase Admin deletion idempotently until provider confirmation.

**Why:** A valid Supabase session still needs a stable numeric Old Time owner. Destructive deletion can otherwise leave a provider identity active after local data is removed, or remove the provider identity before local cleanup can finish.

**How to apply:** Resolve identities by the Supabase UID or a unique confirmed email and use an internal non-public phone placeholder when needed. For deletion, require a freshly issued Supabase JWT, tombstone locally first, block pending users from normal APIs, and clear the external identity link only after Admin deletion succeeds.