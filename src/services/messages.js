import { supabase } from '../lib/supabase';

export async function getMessages(chatId, userId, limit = 50) {
  const { data, error } = await supabase
    .from('messages')
    .select('*, message_deletions!left(user_id)')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) throw error;
  // Hide messages the current user deleted "for me" locally.
  return (data || []).filter(
    (m) => !(m.message_deletions || []).some((d) => d.user_id === userId)
  );
}

export async function sendMessage(chatId, senderId, { content, messageType = 'text', mediaUrl = null, isDisappearing = false }) {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      chat_id: chatId, sender_id: senderId, content, message_type: messageType,
      media_url: mediaUrl, is_disappearing: isDisappearing,
    })
    .select()
    .single();
  if (error) throw error;
  await supabase.from('chats').update({ updated_at: new Date().toISOString() }).eq('id', chatId);
  return data;
}

export async function markMessageRead(messageId, userId) {
  const { error } = await supabase
    .from('message_reads')
    .upsert({ message_id: messageId, user_id: userId }, { onConflict: 'message_id,user_id' });
  if (error) throw error;
}

export async function deleteForMe(messageId, userId) {
  const { error } = await supabase.from('message_deletions').insert({ message_id: messageId, user_id: userId });
  if (error) throw error;
}

export async function deleteForEveryone(messageId, senderId) {
  const { error } = await supabase
    .from('messages')
    .update({ deleted_for_everyone: true, content: null, media_url: null })
    .eq('id', messageId)
    .eq('sender_id', senderId);
  if (error) throw error;
}

// Subscribe to new messages in a chat in real time.
export function subscribeToChat(chatId, onInsert) {
  const channel = supabase
    .channel(`chat-${chatId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
      (payload) => onInsert(payload.new)
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}
