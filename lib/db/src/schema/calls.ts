import { index, integer, pgTable, serial, text, bigint as pgBigint } from "drizzle-orm/pg-core";

export const callsTable = pgTable(
  "calls",
  {
    id: serial("id").primaryKey(),
    callerId: integer("caller_id").notNull(),
    calleeId: integer("callee_id").notNull(),
    type: text("type").notNull().default("voice"),
    status: text("status").notNull().default("ringing"),
    roomName: text("room_name").notNull(),
    createdAt: pgBigint("created_at", { mode: "number" }).notNull(),
    acceptedAt: pgBigint("accepted_at", { mode: "number" }),
    declinedAt: pgBigint("declined_at", { mode: "number" }),
    endedAt: pgBigint("ended_at", { mode: "number" }),
    missedAt: pgBigint("missed_at", { mode: "number" }),
  },
  (table) => ({
    callerStatusIndex: index("calls_caller_status_created_idx").on(table.callerId, table.status, table.createdAt),
    calleeStatusIndex: index("calls_callee_status_created_idx").on(table.calleeId, table.status, table.createdAt),
    roomNameIndex: index("calls_room_name_idx").on(table.roomName),
  }),
);