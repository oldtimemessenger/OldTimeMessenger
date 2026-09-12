---
name: Generated client regeneration
description: The API client generator cleans its output before rewriting generated files, which can briefly confuse live bundlers.
---

Run API client code generation before restarting live Metro or Vite workflows. A clean generation can temporarily remove generated entrypoints; a live bundler may report a missing generated module even when generation and typechecking ultimately succeed.

When a mobile artifact has a local generated client alongside the workspace package, configure both fetch instances before importing an endpoint from the workspace package. They do not share module-level base URL or auth state.

The local generated client can also retain legacy endpoint paths after the API moves to a namespaced route. Treat endpoint-path drift as a release blocker and verify the mobile bundle's paths against the mounted API routes.

**Why:** Live development servers can observe the short clean-output window during codegen and cache the missing-module failure.

**How to apply:** After codegen or an API namespace change, confirm generated entrypoints and endpoint paths exist, restart the affected workflow once, then check its logs before treating the error as a source problem. For mobile-only screens, prefer the local generated client when it contains the endpoint; if using the workspace client to bridge a stale local copy, initialize both clients in the shared API setup.