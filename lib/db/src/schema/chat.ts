import {
  bigint as pgBigint,
  boolean,
  date,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("chat_users", {
  id: serial("id").primaryKey(),
  phone: text("phone").notNull().unique(),
  name: text("name").notNull(),
  username: text("username").notNull().unique(),
  bio: text("bio").notNull().default(""),
  birthday: date("birthday", { mode: "string" }),
  contactPermission: text("contact_permission").notNull().default("everyone"),
  online: boolean("online").notNull().default(false),
  lastSeen: pgBigint("last_seen", { mode: "number" }).notNull(),
  lastSeenVisible: boolean("last_seen_visible").notNull().default(true),
});

export const chatsTable = pgTable("chat_chats", {
  id: serial("id").primaryKey(),
  isGroup: boolean("is_group").notNull().default(false),
  name: text("name").notNull().default(""),
  createdAt: pgBigint("created_at", { mode: "number" }).notNull(),
});

export const chatParticipantsTable = pgTable(
  "chat_participants",
  {
    chatId: integer("chat_id").notNull(),
    userId: integer("user_id").notNull(),
  },
  (table) => ({
    primaryKey: primaryKey({ columns: [table.chatId, table.userId] }),
  }),
);

export const chatMessageRequestsTable = pgTable(
  "chat_message_requests",
  {
    id: serial("id").primaryKey(),
    senderId: integer("sender_id").notNull(),
    recipientId: integer("recipient_id").notNull(),
    status: text("status").notNull().default("pending"),
    chatId: integer("chat_id"),
    createdAt: pgBigint("created_at", { mode: "number" }).notNull(),
    updatedAt: pgBigint("updated_at", { mode: "number" }).notNull(),
  },
  (table) => ({
    senderRecipientIndex: uniqueIndex("chat_message_requests_sender_recipient_idx").on(
      table.senderId,
      table.recipientId,
    ),
    recipientStatusIndex: index("chat_message_requests_recipient_status_idx").on(
      table.recipientId,
      table.status,
    ),
    senderStatusIndex: index("chat_message_requests_sender_status_idx").on(
      table.senderId,
      table.status,
    ),
  }),
);

export const messagesTable = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  chatId: integer("chat_id").notNull(),
  senderId: integer("sender_id").notNull(),
  content: text("content").notNull().default(""),
  attachment: jsonb("attachment").$type<{
    type: "image" | "video" | "file";
    objectPath: string;
    name: string;
    mimeType: string;
    size: number;
    width?: number;
    height?: number;
    duration?: number;
  } | null>(),
  timestamp: pgBigint("timestamp", { mode: "number" }).notNull(),
  read: boolean("read").notNull().default(false),
  openedAt: pgBigint("opened_at", { mode: "number" }),
  expiresAt: pgBigint("expires_at", { mode: "number" }),
  saved: boolean("saved").notNull().default(false),
});

export const authChallengesTable = pgTable(
  "chat_auth_challenges",
  {
    id: text("id").primaryKey(),
    phone: text("phone").notNull(),
    codeHash: text("code_hash"),
    requestIpHash: text("request_ip_hash").notNull(),
    status: text("status").notNull().default("pending"),
    attemptCount: integer("attempt_count").notNull().default(0),
    createdAt: pgBigint("created_at", { mode: "number" }).notNull(),
    expiresAt: pgBigint("expires_at", { mode: "number" }).notNull(),
    lastAttemptAt: pgBigint("last_attempt_at", { mode: "number" }),
  },
  (table) => ({
    phoneCreatedIndex: index("chat_auth_challenges_phone_created_idx").on(
      table.phone,
      table.createdAt,
    ),
    ipCreatedIndex: index("chat_auth_challenges_ip_created_idx").on(
      table.requestIpHash,
      table.createdAt,
    ),
    expiryIndex: index("chat_auth_challenges_expiry_idx").on(table.expiresAt),
  }),
);

export const authSessionsTable = pgTable(
  "chat_auth_sessions",
  {
    id: text("id").primaryKey(),
    userId: integer("user_id").notNull(),
    tokenHash: text("token_hash").notNull(),
    createdAt: pgBigint("created_at", { mode: "number" }).notNull(),
    expiresAt: pgBigint("expires_at", { mode: "number" }).notNull(),
    revokedAt: pgBigint("revoked_at", { mode: "number" }),
    lastSeenAt: pgBigint("last_seen_at", { mode: "number" }).notNull(),
  },
  (table) => ({
    tokenHashIndex: uniqueIndex("chat_auth_sessions_token_hash_idx").on(table.tokenHash),
    userExpiryIndex: index("chat_auth_sessions_user_expiry_idx").on(
      table.userId,
      table.expiresAt,
    ),
  }),
);

export const uploadSlotsTable = pgTable(
  "chat_upload_slots",
  {
    id: text("id").primaryKey(),
    userId: integer("user_id").notNull(),
    objectPath: text("object_path").notNull(),
    contentType: text("content_type").notNull(),
    declaredSize: integer("declared_size").notNull(),
    status: text("status").notNull().default("issued"),
    createdAt: pgBigint("created_at", { mode: "number" }).notNull(),
    expiresAt: pgBigint("expires_at", { mode: "number" }).notNull(),
    messageId: integer("message_id"),
    referenceType: text("reference_type"),
    referenceId: integer("reference_id"),
  },
  (table) => ({
    objectPathIndex: uniqueIndex("chat_upload_slots_object_path_idx").on(table.objectPath),
    expiryStatusIndex: index("chat_upload_slots_expiry_status_idx").on(
      table.expiresAt,
      table.status,
    ),
  }),
);

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
});
export const insertChatSchema = createInsertSchema(chatsTable).omit({
  id: true,
});
export const insertMessageSchema = createInsertSchema(messagesTable).omit({
  id: true,
});
export const insertAuthChallengeSchema = createInsertSchema(authChallengesTable);
export const insertAuthSessionSchema = createInsertSchema(authSessionsTable);
export const insertUploadSlotSchema = createInsertSchema(uploadSlotsTable);

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertChat = z.infer<typeof insertChatSchema>;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type User = typeof usersTable.$inferSelect;
export type ChatMessageRequest = typeof chatMessageRequestsTable.$inferSelect;
export type Chat = typeof chatsTable.$inferSelect;
export type Message = typeof messagesTable.$inferSelect;
export type AuthChallenge = typeof authChallengesTable.$inferSelect;
export type AuthSession = typeof authSessionsTable.$inferSelect;
export type UploadSlot = typeof uploadSlotsTable.$inferSelect;