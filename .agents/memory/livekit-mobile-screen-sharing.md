---
name: LiveKit mobile screen sharing
description: Platform boundary for implementing real screen sharing in Old Time calls.
---

Android screen sharing can use LiveKit’s foreground Media Projection service from the Expo plugin. iPhone full-device sharing requires a signed ReplayKit Broadcast Upload Extension, shared App Group, and the native screen-capture picker; JavaScript alone is not a working substitute.

**Why:** A visible iPhone Share button previously only showed an alert. Treating it as implemented without the extension wastes a build and leaves a dead control in production.

**How to apply:** Keep Android sharing wired to the active LiveKit room. Do not expose iPhone sharing until the extension target is included and signed in the final EAS build, then open the system broadcast picker and publish the screen-share track.