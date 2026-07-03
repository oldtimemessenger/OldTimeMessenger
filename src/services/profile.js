import { supabase } from '../lib/supabase';

export async function searchUsersByUsername(query) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .ilike('username', `${query}%`)
    .limit(10);
  if (error) throw error;
  return data;
}

export async function getMyContacts(userId) {
  const { data, error } = await supabase
    .from('contacts')
    .select('pinned, contact:profiles!contacts_contact_id_fkey(id, display_name, avatar_url, status)')
    .eq('owner_id', userId);
  if (error) throw error;
  return (data || []).map((row) => ({ ...row.contact, pinned: row.pinned }));
}

export async function setAudienceMode(ownerId, mode) {
  const { error } = await supabase.from('audience_settings').upsert({ owner_id: ownerId, mode });
  if (error) throw error;
}

export async function setAudienceAllowlist(ownerId, allowedIds) {
  await supabase.from('audience_allowlist').delete().eq('owner_id', ownerId);
  if (allowedIds.length === 0) return;
  const rows = allowedIds.map((allowed_id) => ({ owner_id: ownerId, allowed_id }));
  const { error } = await supabase.from('audience_allowlist').insert(rows);
  if (error) throw error;
}
