# Supabase schema staging

Old Time stages its PostgreSQL model in the dedicated `old_time` schema.

## Why

The selected Supabase project already contains populated `public` tables from an earlier architecture. Some names/column types conflict with the current Drizzle model. A direct public-schema migration could corrupt or overwrite unrelated data.

## How it works

- `lib/db` sets `search_path=old_time,public` when `SUPABASE_DATABASE_URL` is present (see `lib/db/src/index.ts`).
- Drizzle table definitions stay schema-unqualified; the search path routes them into `old_time`.
- Supabase SQL migrations under `supabase/migrations/` create the schema, discovery tables, and harden RLS (deny `anon` / `authenticated`).
- Core application tables are managed via the Drizzle migrations in `lib/db/migrations/`.

## Operator rules

1. Never merge `old_time` into `public` without an explicit, reviewed cutover plan and data mapping.
2. Keep client roles (`anon`, `authenticated`) revoked from `old_time` tables; the API uses a privileged connection.
3. Secrets (`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DATABASE_URL`, etc.) belong in Replit Secrets / EAS env / host secrets — never in the repo.
4. Before production cutover: test the mapping, update any schema-qualified queries, and verify RLS + service-role access.
