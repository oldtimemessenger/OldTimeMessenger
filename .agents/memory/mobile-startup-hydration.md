---
name: Mobile startup hydration
description: Rules for avoiding an indefinite blank/loading screen during native app launch.
---

The mobile app must treat persisted-state hydration as fallible: storage reads need rejection handling and a bounded timeout, and the native splash should hide only after hydration has settled.

**Why:** A TestFlight launch could remain on a blank loading screen when the native storage read never resolved or rejected without settling the app state. The API and Supabase services were healthy; the router was waiting on local startup state.

**How to apply:** Keep a visible startup fallback while hydration is pending, resolve to clean defaults after the timeout, and only call `SplashScreen.hideAsync()` after the hydration-ready signal.