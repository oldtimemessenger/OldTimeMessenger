---
name: Updates and Community feed separation
description: Product boundary between the creator Updates surface and the text-friendly Community surface.
---

Updates is a media-only creator surface: its For You, Following, and Interests feeds request and render only photo/video posts. Community owns text and mixed social posts, including profile post history and search results.

**Why:** The product intentionally separates TikTok-style creator discovery from friend/community conversations so text posts do not leak into Updates.

**How to apply:** Keep media-only filtering enforced by the API as well as the client. Use Community for text composition, relationship filters, comments, reposts, and profile post history.