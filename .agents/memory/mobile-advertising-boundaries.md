---
name: Mobile advertising boundaries
description: Durable placement, privacy, and production-safety rules for Old Time mobile advertising.
---

All mobile ads must go through one policy/runtime that owns allowed surfaces, spacing, cooldowns, session limits, test IDs, and production unit lookup. Native ads may appear only as separate items at stable boundaries in public feeds. Interstitials belong only at natural transitions after meaningful viewing, and app-open ads require a real background interval. Chats, message composers, Settings, authentication, phone verification, payments, calls, and other private communication surfaces are permanently ad-free. Rewarded formats are not part of the product.

**Why:** Old Time is communication-first. Scattered ad logic can leak into private flows, interrupt playback, create back-to-back ads, or accidentally ship Google test inventory.

**How to apply:** Add or change placements through the central policy, never directly in a screen. Keep requests non-personalized unless consent handling is deliberately expanded. A platform must have its own production App ID and complete unit set before release ad requests are enabled.