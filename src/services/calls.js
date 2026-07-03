import { supabase } from '../lib/supabase';

export async function getRecentCalls(userId) {
  const { data, error } = await supabase
    .from('calls')
    .select('*, caller:profiles!calls_caller_id_fkey(display_name, avatar_url), callee:profiles!calls_callee_id_fkey(display_name, avatar_url)')
    .or(`caller_id.eq.${userId},callee_id.eq.${userId}`)
    .order('started_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data || [];
}

export async function startCall(callerId, calleeId, callType, chatId = null) {
  const { data, error } = await supabase
    .from('calls')
    .insert({ caller_id: callerId, callee_id: calleeId, call_type: callType, chat_id: chatId, status: 'ringing' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function endCall(callId, status = 'completed') {
  const { error } = await supabase
    .from('calls')
    .update({ status, ended_at: new Date().toISOString() })
    .eq('id', callId);
  if (error) throw error;
}

export async function scheduleMeeting(chatId, createdBy, callType, scheduledFor) {
  const { data, error } = await supabase
    .from('scheduled_calls')
    .insert({ chat_id: chatId, created_by: createdBy, call_type: callType, scheduled_for: scheduledFor })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getScheduledMeetings(userId) {
  const { data: memberships } = await supabase.from('chat_participants').select('chat_id').eq('user_id', userId);
  const chatIds = (memberships || []).map((m) => m.chat_id);
  if (chatIds.length === 0) return [];
  const { data, error } = await supabase
    .from('scheduled_calls')
    .select('*, chats(chat_name, is_group)')
    .in('chat_id', chatIds)
    .gte('scheduled_for', new Date().toISOString())
    .order('scheduled_for', { ascending: true });
  if (error) throw error;
  return data || [];
}
