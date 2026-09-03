---
name: Firebase profile sync boundary
description: Security boundary between Expo Firebase authentication and Supabase profile persistence.
---

Firebase authentication happens in Expo, but Firebase token verification and Supabase profile writes must remain server-side.

**Why:** Supabase profile policies are tied to Supabase Auth identities, so Firebase users cannot safely upsert profiles directly. Weakening RLS would allow profile impersonation, while exposing a service-role key in Expo would grant administrative database access.

**How to apply:** Send the Firebase ID token to the API, verify its project and signature there, and use the server-only Supabase credential for profile synchronization. Never bundle the service-role key into mobile code.