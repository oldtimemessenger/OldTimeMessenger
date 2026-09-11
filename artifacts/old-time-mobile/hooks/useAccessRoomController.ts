import {
  createCurrentEventMessage,
  getCurrentEventMessages,
  getCurrentEventRoom,
  joinCurrentEventRoom,
  leaveCurrentEventRoom,
  updateCurrentEventParticipant,
  type CurrentEventMessage,
  type CurrentEventParticipantAction,
  type CurrentEventRoom,
} from '@workspace/api-client-react';
import { io } from 'socket.io-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const giftNames = new Set(['coffee', 'idea', 'heart', 'gem', 'studio', 'time_is_up']);

export type CurrentEventGiftEvent = {
  id: number;
  roomId: number;
  gift: 'coffee' | 'idea' | 'heart' | 'gem' | 'studio' | 'time_is_up';
  sender: { id: number; name: string };
  recipient: { id: number; name: string };
  createdAt: number;
  benefit:
    | { type: 'live_time'; minutes: number; liveUntil: number }
    | { type: 'camera_access'; days: number; grantedUntil: number };
};

function parseGiftEvent(value: unknown, roomId: number): CurrentEventGiftEvent | null {
  if (!value || typeof value !== 'object') return null;
  const event = value as Partial<CurrentEventGiftEvent>;
  if (
    !Number.isInteger(event.id) ||
    event.roomId !== roomId ||
    typeof event.gift !== 'string' ||
    !giftNames.has(event.gift) ||
    !Number.isFinite(event.createdAt) ||
    !event.sender ||
    !Number.isInteger(event.sender.id) ||
    typeof event.sender.name !== 'string' ||
    !event.recipient ||
    !Number.isInteger(event.recipient.id) ||
    typeof event.recipient.name !== 'string' ||
    !event.benefit
  ) return null;
  if (
    event.benefit.type === 'live_time' &&
    Number.isFinite(event.benefit.minutes) &&
    Number.isFinite(event.benefit.liveUntil)
  ) return event as CurrentEventGiftEvent;
  if (
    event.benefit.type === 'camera_access' &&
    Number.isFinite(event.benefit.days) &&
    Number.isFinite(event.benefit.grantedUntil)
  ) return event as CurrentEventGiftEvent;
  return null;
}

export function useAccessRoomController(roomId: string) {
  const { getToken } = useAuth();
  const numericRoomId = Number(roomId);
  const [room, setRoom] = useState<CurrentEventRoom | null>(null);
  const [messages, setMessages] = useState<CurrentEventMessage[]>([]);
  const [giftEvents, setGiftEvents] = useState<CurrentEventGiftEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const seenGiftIds = useRef(new Set<number>());

  const refresh = useCallback(async (join = false) => {
    if (!roomId || !Number.isFinite(numericRoomId)) return;
    try {
      const next = join ? await joinCurrentEventRoom(numericRoomId) : await getCurrentEventRoom(numericRoomId);
      setRoom(next);
      if (next.viewer.participantId) {
        const chat = await getCurrentEventMessages(numericRoomId);
        setMessages(chat.items);
      }
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Access room unavailable.');
    } finally {
      setLoading(false);
    }
  }, [roomId, numericRoomId]);

  useEffect(() => {
    void refresh(true);
    const timer = setInterval(() => void refresh(false), 4_000);
    return () => clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (!room?.viewer.participantId || !Number.isInteger(numericRoomId) || numericRoomId <= 0) return;
    let active = true;
    let socket: ReturnType<typeof io> | null = null;

    void getToken().then((token) => {
      if (!active || !token) return;
      socket = io(API_BASE_URL, {
        auth: { token },
        transports: ['websocket'],
      });
      socket.on('connect', () => {
        socket?.emit('join-current-event', { roomId: numericRoomId });
      });
      socket.on('current-event-gift', (payload: unknown) => {
        const event = parseGiftEvent(payload, numericRoomId);
        if (!event || seenGiftIds.current.has(event.id)) return;
        seenGiftIds.current.add(event.id);
        if (seenGiftIds.current.size > 100) {
          const oldest = seenGiftIds.current.values().next().value;
          if (typeof oldest === 'number') seenGiftIds.current.delete(oldest);
        }
        setGiftEvents((current) => [...current, event].slice(-20));
      });
    }).catch(() => undefined);

    return () => {
      active = false;
      socket?.emit('leave-current-event', { roomId: numericRoomId });
      socket?.disconnect();
      seenGiftIds.current.clear();
      setGiftEvents([]);
    };
  }, [getToken, numericRoomId, room?.viewer.participantId]);

  const sendMessage = useCallback(async (body: string) => {
    const trimmed = body.trim();
    if (!trimmed) return;
    const sent = await createCurrentEventMessage(numericRoomId, { content: trimmed });
    setMessages((current) => [...current.filter((item) => item.id !== sent.id), sent]);
  }, [roomId, numericRoomId]);

  const participantAction = useCallback(async (participantId: number, action: CurrentEventParticipantAction['action']) => {
    const next = await updateCurrentEventParticipant(numericRoomId, participantId, { action });
    setRoom(next);
  }, [roomId, numericRoomId]);

  const leave = useCallback(async () => {
    await leaveCurrentEventRoom(numericRoomId).catch(() => undefined);
  }, [roomId, numericRoomId]);

  return { room, messages, giftEvents, loading, error, refresh, sendMessage, participantAction, leave };
}