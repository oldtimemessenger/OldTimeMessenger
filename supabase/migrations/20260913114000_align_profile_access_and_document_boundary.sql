-- Align Supabase rules with the Old Time API auth model.
-- Clients never talk to application tables directly; the API uses the service role.

CREATE SCHEMA IF NOT EXISTS old_time;

COMMENT ON SCHEMA old_time IS
  'Staged Old Time application schema. API-only access via service role. No client (anon/authenticated) grants.';

-- Hard deny client roles on the staged schema (idempotent).
REVOKE ALL ON SCHEMA old_time FROM PUBLIC;
REVOKE ALL ON SCHEMA old_time FROM anon, authenticated;

-- Discovery tables stay RLS-enabled and client-revoked (already set in earlier migration).
-- Re-assert so a partial apply cannot leave client grants open.
DO $$
BEGIN
  IF to_regclass('old_time.discovery_items') IS NOT NULL THEN
    ALTER TABLE old_time.discovery_items ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON old_time.discovery_items FROM anon, authenticated;
  END IF;
  IF to_regclass('old_time.discovery_creator_claims') IS NOT NULL THEN
    ALTER TABLE old_time.discovery_creator_claims ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON old_time.discovery_creator_claims FROM anon, authenticated;
  END IF;
END $$;

-- public.profiles is only written by the API with the service role (see supabase-profiles.ts).
-- Drop any residual client policies so mobile cannot upsert/read other users' identity rows.
DO $$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "user can insert own profile" ON public.profiles;
    DROP POLICY IF EXISTS "profiles are readable by any authenticated user" ON public.profiles;
    DROP POLICY IF EXISTS "user can update own profile" ON public.profiles;
    DROP POLICY IF EXISTS "Enable read access for all users" ON public.profiles;
    DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.profiles;
    DROP POLICY IF EXISTS "Enable update for users based on id" ON public.profiles;
    -- No replacement client policies on purpose: service role bypasses RLS.
  END IF;
END $$;

-- There is no birthday or age column requirement on public.profiles.
-- Old Time birthday lives on the API database user row and is optional.
