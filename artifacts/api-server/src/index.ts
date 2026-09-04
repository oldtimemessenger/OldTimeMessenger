import http from "node:http";
import { Server } from "socket.io";
import app from "./app";
import { logger } from "./lib/logger";
import { registerRealtimeServer } from "./lib/realtime";
import { chatParticipantsTable, db, usersTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { authenticateToken } from "./lib/chat-auth";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: true, credentials: true },
});
registerRealtimeServer(io);

let shuttingDown = false;

function shutdown(signal: NodeJS.Signals): void {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "Shutting down realtime API");

  const forceExit = setTimeout(() => {
    logger.error("Forced shutdown after graceful shutdown timeout");
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  io.close(() => {
    clearTimeout(forceExit);
    logger.info("Realtime API shut down cleanly");
    process.exit(0);
  });
}

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));

io.use(async (socket, next) => {
  const rawToken = socket.handshake.auth?.token;
  if (typeof rawToken !== "string") {
    next(new Error("Authentication required"));
    return;
  }
  try {
    const userId = await authenticateToken(rawToken);
    if (userId === null) {
      next(new Error("Invalid or expired session"));
      return;
    }
    socket.data.userId = userId;
    next();
  } catch {
    next(new Error("Unable to authenticate session"));
  }
});

io.on("connection", (socket) => {
  const userId = socket.data.userId as number;
  const rawToken = socket.handshake.auth.token as string;

  socket.join(`user_${userId}`);
  void db
    .update(usersTable)
    .set({ online: true, lastSeen: Date.now() })
    .where(eq(usersTable.id, userId));

  async function isParticipant(chatId: number): Promise<boolean> {
    if (!Number.isInteger(chatId) || chatId <= 0) return false;
    const [membership] = await db
      .select({ userId: chatParticipantsTable.userId })
      .from(chatParticipantsTable)
      .where(
        and(
          eq(chatParticipantsTable.chatId, chatId),
          eq(chatParticipantsTable.userId, userId),
        ),
      )
      .limit(1);
    return Boolean(membership);
  }

  const sessionCheck = setInterval(() => {
    void authenticateToken(rawToken).then((currentUserId) => {
      if (currentUserId !== userId) socket.disconnect(true);
    });
  }, 60_000);
  sessionCheck.unref();

  socket.on("join-chat", async (payload: unknown) => {
    const chatId =
      payload && typeof payload === "object" ? (payload as { chatId?: unknown }).chatId : null;
    if (typeof chatId !== "number") return;
    if (await isParticipant(chatId)) socket.join(`chat_${chatId}`);
  });
  socket.on("leave-chat", (payload: unknown) => {
    const chatId =
      payload && typeof payload === "object" ? (payload as { chatId?: unknown }).chatId : null;
    if (typeof chatId !== "number") return;
    if (Number.isInteger(chatId) && chatId > 0) socket.leave(`chat_${chatId}`);
  });
  socket.on("typing", async (payload: unknown) => {
    if (!payload || typeof payload !== "object") return;
    const { chatId, isTyping } = payload as { chatId?: unknown; isTyping?: unknown };
    if (typeof chatId !== "number" || typeof isTyping !== "boolean") return;
    if (await isParticipant(chatId)) {
      socket.to(`chat_${chatId}`).emit("user-typing", { chatId, isTyping, userId });
    }
  });
  socket.on("disconnect", () => {
    clearInterval(sessionCheck);
    setTimeout(() => {
      void io.in(`user_${userId}`).fetchSockets().then((connections) => {
        if (connections.length > 0) return;
        return db
          .update(usersTable)
          .set({ online: false, lastSeen: Date.now() })
          .where(eq(usersTable.id, userId));
      });
    }, 250);
  });
});

httpServer.on("error", (err) => {
  logger.error({ err }, "Error listening on port");
  process.exit(1);
});

httpServer.listen(port, () => {
  logger.info({ port }, "Server listening");
});
