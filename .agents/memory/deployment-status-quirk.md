---
name: Deployment status and placeholder behavior
description: How to interpret Replit publish metadata when the current build has not become live
---

Replit deployment metadata can report an existing deployment URL while `hasSuccessfulBuild` is false; that URL may serve the “This app isn’t live yet” placeholder rather than the latest artifact.

**Why:** A publish attempt can build and briefly start the artifact processes, then be terminated before promotion completes. The local bundle may be correct even though production routes return the placeholder page.

**How to apply:** Check `hasSuccessfulBuild` and probe the returned `primaryUrl` before diagnosing route code. If the URL is not live, validate locally and have the user publish again rather than rewriting working routes.