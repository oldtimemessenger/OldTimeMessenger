import { mobileApiRequest } from '@/lib/mobile-api';

export type ChatPresence = 'available' | 'busy' | 'dnd';

export type ChatReaction = {
  emoji: string;
  count: number;
  reacted: boolean;
};

export type ChatReplyPreview = {
  id: number;
  senderId: number;
  senderName: string;
  content: string;
  attachmentType: 'image' | 'video' | 'audio' | 'file' | 'location' | 'text';
  deleted: boolean;
} | null;

export type ChatAttachment =
  | {
      type: 'image' | 'video' | 'audio' | 'file';
      objectPath: string;
      name: string;
      mimeType: string;
      size: number;
      width?: number;
      height?: number;
      duration?: number;
      label?: string;
    }
  | {
      type: 'location';
      objectPath: string;
      name: string;
      mimeType: string;
      size: number;
      latitude: number;
      longitude: number;
      label?: string;
    };

export type ChatMessage = {
  id: number;
  chatId: number;
  senderId: number;
  clientId?: string | null;
  content: string;
  timestamp: number;
  read: boolean;
  deliveredAt?: number | null;
  openedAt?: number | null;
  playedAt?: number | null;
  editedAt?: number | null;
  deletedAt?: number | null;
  deletedForEveryone?: boolean;
  attachment: ChatAttachment | null;
  replyToMessageId?: number | null;
  replyPreview?: ChatReplyPreview;
  expiresAt: number | null;
  saved: boolean;
  reactions?: ChatReaction[];
};

export type ManagedCall = {
  id: number;
  callerId: number;
  calleeId: number;
  type: 'voice' | 'video';
  status: 'ringing' | 'accepted' | 'declined' | 'ended' | 'missed';
  roomName: string;
  createdAt: number;
  acceptedAt?: number | null;
  declinedAt?: number | null;
  endedAt?: number | null;
  missedAt?: number | null;
  durationSeconds: number;
};

export function sendChatMessage(
  token: string,
  chatId: number,
  input: {
    senderId: number;
    clientId: string;
    content?: string;
    attachment?: ChatAttachment;
    replyToMessageId?: number | null;
  },
) {
  return mobileApiRequest<ChatMessage>(token, `/api/chats/${chatId}/messages`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateChatMessage(
  token: string,
  messageId: number,
  input: {
    userId: number;
    mode: 'edit' | 'delete_for_me' | 'delete_for_everyone';
    content?: string;
  },
) {
  return mobileApiRequest<ChatMessage | { success: true }>(token, `/api/messages/${messageId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function setMessageReaction(token: string, messageId: number, userId: number, emoji: string) {
  return mobileApiRequest<ChatMessage>(token, `/api/messages/${messageId}/reaction`, {
    method: 'PUT',
    body: JSON.stringify({ userId, emoji }),
  });
}

export function markVoiceMessagePlayed(token: string, messageId: number, userId: number) {
  return mobileApiRequest<ChatMessage | { success: true }>(token, `/api/messages/${messageId}/play`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
}

export function startManagedCall(
  token: string,
  input: { calleeId: number; type: 'voice' | 'video' },
) {
  return mobileApiRequest<ManagedCall>(token, '/api/calls', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function getManagedCall(token: string, callId: number) {
  return mobileApiRequest<ManagedCall>(token, `/api/calls/${callId}`);
}

export function acceptManagedCall(token: string, callId: number) {
  return mobileApiRequest<ManagedCall>(token, `/api/calls/${callId}/accept`, { method: 'POST' });
}

export function declineManagedCall(token: string, callId: number) {
  return mobileApiRequest<ManagedCall>(token, `/api/calls/${callId}/decline`, { method: 'POST' });
}

export function endManagedCall(token: string, callId: number) {
  return mobileApiRequest<ManagedCall>(token, `/api/calls/${callId}/end`, { method: 'POST' });
}

export function getManagedCallToken(token: string, callId: number) {
  return mobileApiRequest<{ token: string; url: string; roomName: string }>(token, `/api/calls/${callId}/token`, { method: 'POST' });
}
