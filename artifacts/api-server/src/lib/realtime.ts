import type { Server } from "socket.io";

let io: Server | null = null;

export function registerRealtimeServer(server: Server): void {
  io = server;
}

export function emitToChat(chatId: number, event: string, payload: unknown): void {
  io?.to(`chat_${chatId}`).emit(event, payload);
}

export function emitToUser(userId: number, event: string, payload: unknown): void {
  io?.to(`user_${userId}`).emit(event, payload);
}

export function disconnectUser(userId: number): void {
  io?.in(`user_${userId}`).disconnectSockets(true);
}