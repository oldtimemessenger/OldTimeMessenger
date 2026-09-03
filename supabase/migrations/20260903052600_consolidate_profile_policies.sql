DROP POLICY IF EXISTS "user can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles are readable by any authenticated user" ON public.profiles;
DROP POLICY IF EXISTS "user can update own profile" ON public.profiles;