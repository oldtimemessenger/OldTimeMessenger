---
name: Story text positioning
description: The durable data-model decision for preserving draggable Story text placement across devices.
---

Persist draggable Story text placement as a normalized offset from the canvas center, rather than raw screen pixels. Keep the offset bounded to the composer’s safe drag range and scale it by the viewer’s current canvas dimensions when rendering.

**Why:** Raw pixel coordinates from the creator’s phone do not reproduce reliably on phones with different dimensions or aspect ratios.

**How to apply:** Treat missing positions as the legacy centered/bottom-caption layout, and keep the API, schema, composer, and viewer on the same normalized coordinate contract.