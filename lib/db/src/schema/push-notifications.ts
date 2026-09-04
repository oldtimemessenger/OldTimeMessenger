import { bigint as pgBigint, boolean, index, integer, pgTable, serial, text, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./chat";

export const pushTokensTable = pgTable(
  "push_tokens",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    platform: text("platform").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: pgBigint("created_at", { mode: "number" }).notNull(),
    updatedAt: pgBigint("updated_at", { mode: "number" }).notNull(),
    lastSeenAt: pgBigint("last_seen_at", { mode: "number" }).notNull(),
    deactivatedAt: pgBigint("deactivated_at", { mode: "number" }),
  },
  (table) => ({
    tokenIndex: uniqueIndex("push_tokens_token_idx").on(table.token),
    activeUserIndex: index("push_tokens_active_user_idx").on(table.userId, table.active),
  }),
);

export const insertPushTokenSchema = createInsertSchema(pushTokensTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastSeenAt: true,
  deactivatedAt: true,
});
export type InsertPushToken = z.infer<typeof insertPushTokenSchema>;
export type PushToken = typeof pushTokensTable.$inferSelect;