---
name: Social media authorization
description: Privacy rule for protected social and location media served by direct object paths.
---

Audience, block, and sharing-exclusion policies must be enforced again when a protected object is served, not only when its post, Story, or Map entry is listed.

**Why:** A user who is excluded after learning an object path could otherwise bypass feed/story filtering and retrieve the attachment directly.

**How to apply:** Any new social content type that references protected storage must add the same authoritative visibility checks to both content discovery and the object-serving authorization path.