---
name: Expo monorepo module identity
description: Prevent invalid-hook and null-context crashes when an Expo artifact consumes workspace packages.
---

For Expo artifacts in this pnpm monorepo, configure Metro to use one React, React Native, and React Query instance across both the app and linked workspace libraries.

**Why:** A linked workspace library can resolve its own dependency instance while the app resolves another. Production bundles may compile successfully but crash at runtime with invalid-hook or `useContext`-of-null errors.

**How to apply:** Keep Metro's watch scope limited to linked source packages, disable hierarchical dependency lookup, and resolve context-owning packages from the workspace root. Rebuild shared TypeScript declarations before app type checking.