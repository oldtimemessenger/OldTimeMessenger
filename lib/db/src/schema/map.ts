import {
  bigint as pgBigint,
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const mapPinsTable = pgTable("map_pins", {
  id: serial("id").primaryKey(),
  authorId: integer("author_id").notNull(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  caption: text("caption"),
  visibility: text("visibility").notNull().default("friends"),
  createdAt: pgBigint("created_at", { mode: "number" }).notNull(),
  updatedAt: pgBigint("updated_at", { mode: "number" }).notNull(),
  expiresAt: pgBigint("expires_at", { mode: "number" }),
  deleted: boolean("deleted").notNull().default(false),
}, (table) => ({
  activeIndex: index("map_pins_active_idx").on(table.deleted, table.expiresAt, table.createdAt),
  authorIndex: index("map_pins_author_idx").on(table.authorId, table.createdAt),
}));

export const mapPinReactionsTable = pgTable("map_pin_reactions", {
  pinId: integer("pin_id").notNull(),
  userId: integer("user_id").notNull(),
  createdAt: pgBigint("created_at", { mode: "number" }).notNull(),
}, (table) => ({ primaryKey: primaryKey({ columns: [table.pinId, table.userId] }) }));

export const mapPinSavesTable = pgTable("map_pin_saves", {
  pinId: integer("pin_id").notNull(),
  userId: integer("user_id").notNull(),
  createdAt: pgBigint("created_at", { mode: "number" }).notNull(),
}, (table) => ({ primaryKey: primaryKey({ columns: [table.pinId, table.userId] }), userIndex: index("map_pin_saves_user_idx").on(table.userId) }));

export const mapPinCommentsTable = pgTable("map_pin_comments", {
  id: serial("id").primaryKey(),
  pinId: integer("pin_id").notNull(),
  authorId: integer("author_id").notNull(),
  content: text("content").notNull(),
  createdAt: pgBigint("created_at", { mode: "number" }).notNull(),
  deleted: boolean("deleted").notNull().default(false),
}, (table) => ({ pinIndex: index("map_pin_comments_pin_idx").on(table.pinId, table.createdAt) }));

export const mapPinReportsTable = pgTable("map_pin_reports", {
  id: serial("id").primaryKey(),
  pinId: integer("pin_id").notNull(),
  reporterId: integer("reporter_id").notNull(),
  reason: text("reason").notNull(),
  createdAt: pgBigint("created_at", { mode: "number" }).notNull(),
}, (table) => ({ reporterPin: uniqueIndex("map_pin_reports_reporter_pin_idx").on(table.reporterId, table.pinId) }));

export const insertMapPinSchema = createInsertSchema(mapPinsTable).omit({ id: true, authorId: true, createdAt: true, updatedAt: true, deleted: true });
export type MapPin = typeof mapPinsTable.$inferSelect;
export type MapPinComment = typeof mapPinCommentsTable.$inferSelect;
export type InsertMapPin = z.infer<typeof insertMapPinSchema>;