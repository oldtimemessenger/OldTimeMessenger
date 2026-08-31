---
name: Mobile object uploads
description: Environment-specific constraint and security model for private mobile media uploads.
---

Use authenticated, server-mediated streaming uploads for private mobile media in this workspace. Do not rely on Google Cloud Storage V4 signed write URLs from the sidecar credential.

**Why:** The Replit storage sidecar credential can read and write objects but does not expose the client email/private signing material required by `getSignedUrl`. Streaming through the API also permits byte-count enforcement instead of trusting client-declared file size.

**How to apply:** Issue short-lived upload slots bound to the authenticated user, enforce MIME and byte limits while streaming to storage, and verify stored metadata before attaching an object to an application record. Keep abandoned-upload cleanup independent of message expiry.