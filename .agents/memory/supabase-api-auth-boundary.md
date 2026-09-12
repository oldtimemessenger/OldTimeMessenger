---
name: Supabase API auth boundary
description: The mobile app's Supabase session is distinct from the API server's legacy Old Time session token.
---

The mobile app authenticates with Supabase, while protected Old Time API routes use server-issued sessions. Supabase access tokens may be verified server-side and mapped to an existing Old Time user by email, but they must not be treated as Old Time session tokens or used to bypass age and privacy checks.

**Why:** Map requests exposed this boundary when the mobile client had a valid Supabase session but the API correctly returned 401 for private pin endpoints.

**How to apply:** Keep public place discovery available without a session, keep pins and other private data behind `requireChatAuth`, and preserve the existing age gate when bridging Supabase identities.