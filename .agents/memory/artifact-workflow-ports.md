---
name: Artifact workflow ports
description: Environment-specific workflow and build behavior for this artifact workspace.
---

Artifact-owned Vite services must receive both `PORT` and `BASE_PATH` when run outside their managed workflows. Expo static bundling must use a Metro port separate from the mockup service’s 8081. Managed artifact workflows should be restarted by their exact registered names; if a restart fails on a port, inspect listeners and workflow logs before retrying.

**Why:** The workspace’s Vite configs intentionally fail fast without the router-provided variables, stale processes can hold configured ports after an interrupted restart, and Expo’s static build script otherwise prompts interactively when 8081 is already occupied.

**How to apply:** Use the managed workflow for normal serving. For standalone builds, provide the service’s configured `PORT` and `BASE_PATH`; run Expo bundling on an unused Metro port (for example 8082) and verify the bound address before changing code or restarting again.