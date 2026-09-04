# Old Time production readiness

## Required configuration

Keep values in hosting / EAS environment secrets; never commit them or print them in logs.

- `DATABASE_URL`
- `SESSION_SECRET`
- `DEFAULT_OBJECT_STORAGE_BUCKET_ID`
- `PRIVATE_OBJECT_DIR`
- `PUBLIC_OBJECT_SEARCH_PATHS`

## Release gate

1. Run `pnpm --filter @workspace/db run push` against development only.
2. Run `pnpm run typecheck` and `pnpm run build`.
3. Confirm `/api/healthz` returns `{"status":"ok"}`.
4. Confirm `/api/readyz` returns `{"status":"ready"}`.
5. Run dependency, static-analysis, and privacy scans.
6. Test Firebase authentication, session restore, logout/revocation, chat access, attachment limits, attachment ownership, and message expiry.
7. Deploy from GitHub (Expo EAS for the mobile app; your chosen host for the API). Review schema diffs before applying production database changes; do not run unreviewed custom production migrations.

## Operations

- Local-development OTP challenges are single-use, expire after ten minutes, have attempt limits, and are rate-limited by privacy-preserving phone/IP hashes. Production authentication uses Firebase.
- Sessions use random opaque bearer tokens. Only token hashes are stored, and logout revokes the current session.
- Upload slots are database-backed, owner-bound, single-use, and expire after fifteen minutes.
- Cleanup is safe to run from multiple autoscaled instances because claims and state live in PostgreSQL. Request paths also remove expired messages before returning data.
- Logs must include internal IDs or one-way hashes only, never phone numbers, OTPs, bearer tokens, or object contents.

## Rollback

If a deploy fails before traffic moves, cancel it and keep the last successful deployment. If a new release causes authentication or storage failures:

1. Redeploy the last known-good Git commit.
2. Do not delete new authentication or upload tables during rollback; older code can ignore them and retaining them avoids destructive data loss.
3. Revoke affected sessions if credentials or bearer tokens may have been exposed.
