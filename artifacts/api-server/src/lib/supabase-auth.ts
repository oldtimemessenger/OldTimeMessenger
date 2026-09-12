type SupabaseAuthUser = {
  id: string;
  email?: string;
  email_confirmed_at?: string | null;
  user_metadata?: Record<string, unknown>;
};

function supabaseConfiguration(): { url: string; serviceRoleKey: string } {
  const url = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Supabase Auth verification is not configured.");
  }
  return { url, serviceRoleKey };
}

export async function verifySupabaseAccessToken(accessToken: string): Promise<SupabaseAuthUser | null> {
  const { url, serviceRoleKey } = supabaseConfiguration();
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${accessToken}`,
    },
  });
  if (response.status === 401) return null;
  if (!response.ok) {
    throw new Error(`Supabase Auth verification failed with status ${response.status}.`);
  }
  return await response.json() as SupabaseAuthUser;
}