---
name: Generated client regeneration
description: The API client generator cleans its output before rewriting generated files, which can briefly confuse live bundlers.
---

Run API client code generation before restarting live Metro or Vite workflows. A clean generation can temporarily remove generated entrypoints; a live bundler may report a missing generated module even when generation and typechecking ultimately succeed.

**Why:** Live development servers can observe the short clean-output window during codegen and cache the missing-module failure.

**How to apply:** After codegen, confirm generated entrypoints exist, restart the affected workflow once, then check its logs before treating the error as a source problem.