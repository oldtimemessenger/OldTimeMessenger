# Old Time Chat

Old Time is a native Expo mobile messenger with SMS phone verification, inbox previews, direct conversations, private media, read state, and live refresh. The web artifact is not a separate product and is outside the mobile release scope.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required runtime configuration: `DATABASE_URL`, `SESSION_SECRET`, object-storage variables, and Twilio Verify variables. Store all credential values in Replit Secrets.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/old-time-chat/src/` — React pages, chat UI components, session helpers, and visual theme
- `artifacts/api-server/src/routes/chat.ts` — auth, users, inbox, chat, message, and read-state routes
- `lib/db/src/schema/chat.ts` — PostgreSQL chat tables and insert schemas
- `lib/api-spec/openapi.yaml` — source of truth for API contracts and generated hooks

## Architecture decisions

- OTP challenges, upload grants, and revocable sessions are persisted in PostgreSQL so autoscaled API instances do not depend on process memory.
- Production SMS verification uses Twilio Verify and fails closed when provider configuration is absent. A fixed local code exists only in non-production development.
- PostgreSQL is used through the shared Drizzle database package instead of the uploaded SQLite implementation.
- Direct chat access is participant-scoped at the API boundary, and the frontend uses short polling for cross-session freshness.
- Socket.IO authenticates the bearer session and checks chat membership before joining conversation rooms.

## Product

Users can verify their phone, browse people and recent conversations, start direct chats, send private media, see read state, and return to a conversation after reload.

## User preferences

The user asked to turn the uploaded Old Time WhatsApp clone into a runnable project while preserving its core messaging behavior and fixing the broken chat flow.

## Gotchas

- API changes must be made in `lib/api-spec/openapi.yaml` and regenerated with `pnpm --filter @workspace/api-spec run codegen`.
- The generated Zod barrel intentionally uses explicit type exports to avoid generated Zod/type name collisions; preserve that export shape when regenerating.
- `/api/healthz` is liveness. `/api/readyz` is the release gate for database, storage, session-secret, and SMS-provider configuration.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
