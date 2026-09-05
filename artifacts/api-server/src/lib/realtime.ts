import type { Server } from "socket.io";

let io: Server | null = null;

export function registerRealtimeServer(server: Server): void {
  io = server;
}

export function emitToChat(chatId: number, event: string, payload: unknown): void {
  io?.to(`chat_${chatId}`).emit(event, payload);
}

export function emitToCurrentEventRoom(roomId: number, event: string, payload: unknown): void {
  io?.to(`current_event_${roomId}`).emit(event, payload);
}

export async function evictUserFromCurrentEventRoom(userId: number, roomId: number): Promise<void> {
  if (!io) return;
  await io.in(`user_${userId}`).socketsLeave(`current_event_${roomId}`);
}

export async function evictCurrentEventRoom(roomId: number): Promise<void> {
  if (!io) return;
  await io.in(`current_event_${roomId}`).socketsLeave(`current_event_${roomId}`);
}

export function emitToUser(userId: number, event: string, payload: unknown): void {
  io?.to(`user_${userId}`).emit(event, payload);
}

export function disconnectUser(userId: number): void {
  io?.in(`user_${userId}`).disconnectSockets(true);
}
