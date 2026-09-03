---
name: Supabase schema staging
description: Why Old Time's Supabase schema must remain isolated until a deliberate database cutover.
---

Stage Old Time's PostgreSQL model in a dedicated schema rather than merging it into Supabase's existing public schema.

**Why:** The selected Supabase project already contains populated public tables from an earlier architecture, including at least one table name whose column types conflict with the current Drizzle model. A direct public-schema migration could corrupt or overwrite unrelated data.

**How to apply:** Keep the staged schema private and deny direct client roles by default. Before switching the API, choose an explicit data-mapping strategy, test the migration, and update the server's database search path or schema-qualified Drizzle definitions.