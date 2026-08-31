---
name: OpenAPI codegen compatibility
description: Non-obvious compatibility constraints between the workspace's Orval output and its pinned Zod package.
---

Orval can emit Zod v4-only helpers for OpenAPI integer response fields while the workspace is pinned to Zod 3, and it can generate a duplicate parameter export when a reusable parameter is combined with a path parameter. Keep response-only numeric fields as OpenAPI `number` where integer validation is not essential, and preserve an explicit Zod barrel export when codegen creates an ambiguous duplicate.

**Why:** A normal codegen run can succeed while the chained workspace typecheck fails, so the incompatibility is easy to mistake for an application bug.

**How to apply:** After changing `lib/api-spec/openapi.yaml`, run codegen, then run `pnpm run typecheck:libs`; inspect generated barrel collisions before adding server routes.