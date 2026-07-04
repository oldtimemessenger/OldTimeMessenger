import { supabase } from '../lib/supabase';

export async function getVisibleStatuses() {
  const { data, error } = await supabase
    .from('statuses')
    .select('*, profiles:profiles!statuses_user_id_fkey(display_name, avatar_url)')
    .gte('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw error;
  return data || [];
}
