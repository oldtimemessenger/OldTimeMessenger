---
name: GitHub bulk push limitation
description: Records why this workspace must use native authenticated Git rather than the GitHub connector for complete repository synchronization.
---

Use Replit’s Git interface with its native GitHub authorization when pushing the complete workspace. The API connector is suitable for small GitHub operations, but bulk source uploads for this project are blocked by the connector proxy.

**Why:** REST blob uploads, Contents API writes, GraphQL commits, encoded HTML, and compressed archive chunks all triggered the same connector-proxy Cloudflare block. Native Git could fetch the public repository but could not push because the connector’s OAuth grant is not exposed to Git’s credential helper.

**How to apply:** Configure the GitHub remote normally, authorize GitHub in Replit’s Git pane, and push through the pane or authenticated native Git. Avoid retrying bulk source transfer through connector APIs.