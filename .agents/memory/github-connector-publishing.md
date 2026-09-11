---
name: GitHub connector publishing
description: How to publish workspace changes when the local GitHub HTTPS remote cannot authenticate.
---

When the local GitHub HTTPS remote rejects credentials, use the authorized GitHub connection to publish a tree based on the current remote branch. Create blobs for changed files, create one tree with additions/modifications/deletions, create a commit with the remote branch as its parent, and update the branch ref without force-pushing.

**Why:** The workspace Git remote may be readable but not writable, while the connected GitHub integration can write safely. Replacing the remote with an invented token or force-pushing would risk losing newer release commits.

**How to apply:** Compare the committed workspace against the fetched remote branch, rate-limit blob uploads to the connector's request budget, then verify the new branch SHA and key files through the GitHub API.