---
name: GitHub connector payload filtering
description: A connector-specific limitation affecting some repository file writes.
---

GitHub connector reads and standard content writes can succeed while a specific harmless HTML payload is rejected by the connector's security layer.

**Why:** Reauthorization restored valid repository access, but the security proxy consistently rejected one HTML document across Git blob, contents, and GraphQL write endpoints while allowing all other files.

**How to apply:** After connector-based repository synchronization, compare local and remote blob hashes. Do not assume a successful series means every payload was accepted, and avoid force-updating the branch.