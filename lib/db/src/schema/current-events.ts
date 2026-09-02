import {
  boolean,
  doublePrecision,
  index,
  integer,
  bigint as pgBigint,
  pgTable,
  serial,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const currentEventRoomsTable = pgTable(
  "current_event_rooms",
  {
    id: serial("id").primaryKey(),
    clubName: text("club_name").notNull().default("Current Events"),
    title: text("title").notNull(),
    topic: text("topic").notNull(),
    isOpen: boolean("is_open").notNull().default(true),
    isLive: boolean("is_live").notNull().default(true),
    hostId: integer("host_id").notNull(),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    createdAt: pgBigint("created_at", { mode: "number" }).notNull(),
    endedAt: pgBigint("ended_at", { mode: "number" }),
  },
  (table) => ({
    liveTopicIndex: index("current_event_rooms_live_topic_idx").on(table.isLive, table.topic),
    locationIndex: index("current_event_rooms_location_idx").on(table.latitude, table.longitude),
  }),
);

export const currentEventParticipantsTable = pgTable(
  "current_event_participants",
  {
    id: serial("id").primaryKey(),
    roomId: integer("room_id").notNull(),
    userId: integer("user_id").notNull(),
    role: text("role").notNull().default("listener"),
    muted: boolean("muted").notNull().default(true),
    handRaised: boolean("hand_raised").notNull().default(false),
    joinedAt: pgBigint("joined_at", { mode: "number" }).notNull(),
  },
  (table) => ({
    roomUserIndex: uniqueIndex("current_event_participants_room_user_idx").on(table.roomId, table.userId),
    roomRoleIndex: index("current_event_participants_room_role_idx").on(table.roomId, table.role),
  }),
);

export const currentEventMessagesTable = pgTable(
  "current_event_messages",
  {
    id: serial("id").primaryKey(),
    roomId: integer("room_id").notNull(),
    senderId: integer("sender_id").notNull(),
    content: text("content").notNull(),
    createdAt: pgBigint("created_at", { mode: "number" }).notNull(),
  },
  (table) => ({
    roomCreatedIndex: index("current_event_messages_room_created_idx").on(table.roomId, table.createdAt),
  }),
);

export const currentEventWalletsTable = pgTable(
  "current_event_wallets",
  {
    userId: integer("user_id").primaryKey(),
    coins: integer("coins").notNull().default(1000),
    gold: integer("gold").notNull().default(0),
    pendingGold: integer("pending_gold").notNull().default(0),
    updatedAt: pgBigint("updated_at", { mode: "number" }).notNull(),
  },
);

export const currentEventGiftsTable = pgTable(
  "current_event_gifts",
  {
    id: serial("id").primaryKey(),
    roomId: integer("room_id").notNull(),
    senderId: integer("sender_id").notNull(),
    recipientId: integer("recipient_id").notNull(),
    gift: text("gift").notNull(),
    coins: integer("coins").notNull(),
    gold: integer("gold").notNull(),
    createdAt: pgBigint("created_at", { mode: "number" }).notNull(),
  },
  (table) => ({
    roomCreatedIndex: index("current_event_gifts_room_created_idx").on(table.roomId, table.createdAt),
  }),
);