---
name: Monorepo package install target
description: Installing a dependency for one workspace package must target that package explicitly.
---

Use the package manager's workspace filter when adding a dependency to an individual artifact; an unscoped add can place it at the monorepo root or fail to update the intended package.

**Why:** The mobile font dependency only became available to the Expo artifact after the install was targeted at its workspace package.

**How to apply:** For artifact-specific dependencies, run the add operation from the workspace package context or use an explicit package filter, then verify that package's package.json and lockfile.