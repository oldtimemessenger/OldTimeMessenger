---
name: Expo map SDK compatibility
description: Why the mobile app intentionally keeps its current react-native-maps version pin.
---

Keep `react-native-maps` pinned to the version required by this project's Expo Go/testing setup rather than applying generic Expo Doctor upgrade suggestions automatically.

**Why:** The project's supported Expo runtime requires the explicit map package pin; upgrading solely to silence the generic compatibility warning can break the intended native test environment.

**How to apply:** When changing Expo or map dependencies, verify both iOS and Android production bundles and only move the pin as part of a deliberate Expo runtime upgrade.