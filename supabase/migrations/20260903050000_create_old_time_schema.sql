-- Isolated schema for Old Time application tables.
-- Keep this schema private until an explicit, reviewed cutover into public.
CREATE SCHEMA IF NOT EXISTS old_time;

COMMENT ON SCHEMA old_time IS
  'Staged Old Time application schema. Do not merge into public until explicit cutover.';

-- Deny direct client access by default. The API connects with a privileged role
-- (service role / connection string) and sets search_path=old_time,public.
REVOKE ALL ON SCHEMA old_time FROM PUBLIC;
REVOKE ALL ON SCHEMA old_time FROM anon, authenticated;
