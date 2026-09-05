---
name: GitHub connector payload filtering
description: A connector-specific limitation affecting some repository file writes.
---

GitHub connector reads and standard content writes can succeed while a specific harmless HTML payload is rejected by the connector's security layer.

**Why:** Reauthorization restored valid repository access, but the security proxy consistently rejected one HTML document across Git blob, contents, and GraphQL write endpoints while allowing all other files.

**How to apply:** After connector-based repository synchronization, compare local and remote blob hashes. Do not assume a successful series means every payload was accepted, and avoid force-updating the branch.

For large repositories, create missing blobs first and then create an incremental tree from the current remote tree rather than sending the entire repository tree in one request.

**Why:** A full-tree connector request can fail with a server error even when every blob upload succeeds; the incremental tree produces the identical Git tree with a much smaller payload.

When the workspace checkout is behind `main`, the remote tree may contain tracked paths that are absent locally. Preserve those paths when applying an incremental update; do not treat them as deletions.

**Why:** A local branch can lag behind work added directly through the connected GitHub repository, and replacing the full tree would silently remove that remote-only work.