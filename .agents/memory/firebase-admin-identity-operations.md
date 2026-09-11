---
name: Firebase Admin identity operations
description: Firebase Admin SDK identity-management calls may use a different Google credential project than token verification.
---

Firebase ID-token verification and Firebase client REST auth can succeed even when Firebase Admin SDK user-management calls fail because the credential project's Identity Toolkit API is disabled.

**Why:** The API server was able to verify and exchange Firebase tokens, but Admin deletion returned a 403 for the application-default credential project rather than the Firebase project used by the client.

**How to apply:** Treat Admin user deletion or other identity-management failures separately from sign-in verification. Check the Google credential project and Identity Toolkit API before diagnosing a shared authentication outage; use a supported Firebase account-management path for cleanup.