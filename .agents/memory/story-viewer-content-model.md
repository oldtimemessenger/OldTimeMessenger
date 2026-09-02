---
name: Story viewer content model
description: The durable architecture rule for mixing user and future sponsored Stories.
---

The Story viewer consumes a discriminated sequence of `USER_STORY` and `SPONSORED_STORY` items rather than assuming every page is a backend user Story.

**Why:** Future sponsored placements must participate in the existing timer, progress, gestures, safe-area layout, and navigation without making ads look like user content or coupling the viewer to an ad network.

**How to apply:** Keep ad-network code behind the replaceable ad-slot renderer, preserve explicit Sponsored/Ad disclosure, and build any future insertion policy outside the viewer before passing the final item sequence.