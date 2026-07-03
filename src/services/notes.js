import { supabase } from '../lib/supabase';

// Note Drops are private by RLS — only the owning user can ever read them.
export async function getNotes(userId) {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function saveNote(userId, note) {
  const payload = { user_id: userId, title: note.title, body: note.body };
  if (note.id) {
    const { data, error } = await supabase.from('notes').update(payload).eq('id', note.id).select().single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase.from('notes').insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function deleteNote(noteId) {
  const { error } = await supabase.from('notes').delete().eq('id', noteId);
  if (error) throw error;
}
