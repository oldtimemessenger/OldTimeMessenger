---
name: Pace discovery history
description: The durable rule for keeping generated Pace route ideas fresh without fabricating social activity.
---

Pace discovery suggestions should be deterministic, clearly presented as route or session ideas, and filtered through per-user impression history before they are returned again. The generator can create many combinations from activity, distance, effort, location cell, and time, but it must never pretend those generated ideas are real people, real activity, or real engagement.

**Why:** A small rotating template list made Pace feel repetitive, while synthetic activity would violate the product’s honesty boundary.

**How to apply:** When adding Pace discovery, persist impressions keyed by user and suggestion ID, accept client exclusions for in-session refreshes, and keep live activity/social counts backed by real data only.