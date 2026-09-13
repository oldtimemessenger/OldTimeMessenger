---
name: Supabase API auth boundary
description: The mobile app's Supabase session is distinct from the API server's legacy Old Time session token.
---

The mobile app authenticates with Supabase (or Firebase), while protected Old Time API routes use either a verified Supabase JWT or a server-issued session token. Supabase access tokens may be verified server-side and mapped to an existing Old Time user by `supabase_uid` or confirmed email, but they must not be treated as Old Time session tokens.

**Birthday / age is not part of this boundary.** Profile birthday is an optional private field on the Old Time user row. Auth and session bridging must never require or reject based on birthday or minimum age.

**Why:** Map requests and other protected routes need a clear auth check without reintroducing profile-field gates that block legitimate signed-in users.

**How to apply:**
- Keep public place discovery available without a session.
- Keep pins and other private data behind `requireChatAuth`.
- Bridge Supabase identities by stable `supabase_uid` (or single confirmed-email link); do not gate on birthday.
- Never expose the Supabase service-role key to the mobile client.
- `public.profiles` writes go only through the API (service role); clients must not upsert profiles directly.
