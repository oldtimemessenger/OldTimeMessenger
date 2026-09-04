# Old Time Messenger

Old Time Messenger is an Expo social messaging app with chat, calls, Stories, Updates, Community, map discovery, and Current Events.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Critical production configuration: Supabase database/service access, core authentication, and `SESSION_SECRET`
- Feature-specific configuration such as LiveKit and RevenueCat must not control global API readiness

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

- Supabase is the primary backend and source of truth for persistent application data, including users, messages, social content, map/events data, transactions, and media.
- Replit is a supporting custom server for ephemeral sockets, LiveKit token generation, RevenueCat verification/webhooks, private integrations, background jobs, and business logic requiring private credentials.
- Do not create a second source of truth or add new durable domains to the Replit/Drizzle data layer. Existing Drizzle-owned domains require a deliberate, reviewed migration to Supabase without dual-write ambiguity.
- Use Supabase Realtime for persisted-data updates where appropriate; keep Socket.IO only where ephemeral custom socket behavior is genuinely needed.
- Global `/api/readyz` covers critical core dependencies only. Optional providers must fail at their feature boundary without making the entire API unready.
- Stabilization comes before any architecture migration: do not perform the proposed core-data migration, merge the `old_time` schema into `public`, change integer IDs to UUIDs, change Firebase authentication, or add Supabase directly to Expo without explicit approval.
- Replit must remain replaceable infrastructure. Document the Supabase tables, Replit-dependent data and routes, backend-only functions, environment requirements, host portability, backup/restore process, and deployment process before proposing architectural changes.

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
