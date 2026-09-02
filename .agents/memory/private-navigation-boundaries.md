---
name: Private navigation boundaries
description: Routing rules that keep social Stories and Map actions separate from Chats.
---

Story entry points from Chats should open the standalone Story viewer, not push the hidden Updates tab route. Social location actions should navigate to the visible Map tab.

**Why:** Expo Router can leave the custom tab state out of sync when a hidden sibling tab route is pushed, making a private social action appear to jump into Chat or the wrong surface.

**How to apply:** Keep Story viewing in local modal state or the dedicated story route. Use the visible `/(tabs)/updates` and `/(tabs)/map` routes for deliberate tab changes; reserve `/(tabs)` for intentional Chat navigation such as opening Messages.