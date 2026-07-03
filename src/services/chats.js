import { supabase } from '../lib/supabase';

// Returns chats the user participates in, with the other participant(s)
// and the most recent message, newest first.
export async function getChats(userId) {
  const { data: memberships, error: mErr } = await supabase
    .from('chat_participants')
    .select('chat_id')
    .eq('user_id', userId)
    .is('left_at', null);
  if (mErr) throw mErr;
  const chatIds = (memberships || []).map((m) => m.chat_id);
  if (chatIds.length === 0) return [];

  const { data: chats, error } = await supabase
    .from('chats')
    .select(`
      id, is_group, chat_name, updated_at, disappearing_duration,
      chat_participants ( user_id, profiles ( id, display_name, avatar_url, status ) )
    `)
    .in('id', chatIds)
    .order('updated_at', { ascending: false });
  if (error) throw error;

  const withLastMessage = await Promise.all(
    (chats || []).map(async (c) => {
      const { data: lastMsg } = await supabase
        .from('messages')
        .select('content, message_type, created_at, sender_id')
        .eq('chat_id', c.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return { ...c, lastMessage: lastMsg || null };
    })
  );
  return withLastMessage;
}

export async function getOrCreateDirectChat(userId, otherUserId) {
  const { data: mine } = await supabase
    .from('chat_participants')
    .select('chat_id')
    .eq('user_id', userId);
  const chatIds = (mine || []).map((m) => m.chat_id);

  if (chatIds.length > 0) {
    const { data: shared } = await supabase
      .from('chat_participants')
      .select('chat_id')
      .eq('user_id', otherUserId)
      .in('chat_id', chatIds);
    if (shared && shared.length > 0) {
      const { data: chat } = await supabase.from('chats').select('*').eq('id', shared[0].chat_id).single();
      return chat;
    }
  }

  const { data: chat, error } = await supabase
    .from('chats')
    .insert({ is_group: false, created_by: userId })
    .select()
    .single();
  if (error) throw error;

  const { error: pErr } = await supabase.from('chat_participants').insert([
    { chat_id: chat.id, user_id: userId, is_admin: true },
    { chat_id: chat.id, user_id: otherUserId },
  ]);
  if (pErr) throw pErr;
  return chat;
}

export async function createGroupChat(userId, name, memberIds) {
  const { data: chat, error } = await supabase
    .from('chats')
    .insert({ is_group: true, chat_name: name, created_by: userId })
    .select()
    .single();
  if (error) throw error;

  const rows = [userId, ...memberIds].map((uid) => ({
    chat_id: chat.id, user_id: uid, is_admin: uid === userId,
  }));
  const { error: pErr } = await supabase.from('chat_participants').insert(rows);
  if (pErr) throw pErr;
  return chat;
}

export async function setDisappearingDuration(chatId, duration) {
  const { error } = await supabase.from('chats').update({ disappearing_duration: duration }).eq('id', chatId);
  if (error) throw error;
}
