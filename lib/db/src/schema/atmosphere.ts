import {
  bigint as pgBigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
} from "drizzle-orm/pg-core";

export const atmospherePreferencesTable = pgTable(
  "atmosphere_preferences",
  {
    userId: integer("user_id").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    radiusKm: integer("radius_km").notNull().default(25),
    language: text("language"),
    mutedCategories: jsonb("muted_categories").$type<string[]>().notNull().default([]),
    updatedAt: pgBigint("updated_at", { mode: "number" }).notNull(),
  },
  (table) => ({ primaryKey: primaryKey({ columns: [table.userId] }) }),
);

export const atmosphereInteractionsTable = pgTable(
  "atmosphere_interactions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    itemId: text("item_id").notNull(),
    itemKind: text("item_kind").notNull(),
    interaction: text("interaction").notNull(),
    sessionId: text("session_id"),
    metadata: jsonb("metadata").$type<Record<string, string | number | boolean | null> | null>(),
    createdAt: pgBigint("created_at", { mode: "number" }).notNull(),
  },
  (table) => ({
    userCreatedIndex: index("atmosphere_interactions_user_created_idx").on(table.userId, table.createdAt),
    userItemIndex: index("atmosphere_interactions_user_item_idx").on(table.userId, table.itemId, table.createdAt),
    sessionIndex: index("atmosphere_interactions_session_idx").on(table.sessionId, table.createdAt),
  }),
);