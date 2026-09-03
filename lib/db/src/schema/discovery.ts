import {
  bigint as pgBigint,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export type DiscoveryEngagement = {
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
};

export const discoveryItemsTable = pgTable(
  "discovery_items",
  {
    id: serial("id").primaryKey(),
    platform: text("platform").notNull(),
    canonicalUrl: text("canonical_url").notNull(),
    embedHtml: text("embed_html").notNull(),
    title: text("title").notNull(),
    creatorName: text("creator_name").notNull(),
    creatorHandle: text("creator_handle"),
    category: text("category"),
    engagement: jsonb("engagement").$type<DiscoveryEngagement>().notNull().default({}),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    locationLabel: text("location_label"),
    publishedAt: pgBigint("published_at", { mode: "number" }),
    discoveredAt: pgBigint("discovered_at", { mode: "number" }).notNull(),
    status: text("status").notNull().default("active"),
  },
  (table) => ({
    urlIndex: uniqueIndex("discovery_items_url_idx").on(table.canonicalUrl),
    locationIndex: index("discovery_items_location_idx").on(table.latitude, table.longitude),
    statusDateIndex: index("discovery_items_status_date_idx").on(table.status, table.discoveredAt),
  }),
);

export const discoveryCreatorClaimsTable = pgTable(
  "discovery_creator_claims",
  {
    id: serial("id").primaryKey(),
    itemId: integer("item_id").notNull(),
    claimantId: integer("claimant_id").notNull(),
    note: text("note"),
    status: text("status").notNull().default("pending"),
    createdAt: pgBigint("created_at", { mode: "number" }).notNull(),
    updatedAt: pgBigint("updated_at", { mode: "number" }).notNull(),
  },
  (table) => ({
    claimantItemIndex: uniqueIndex("discovery_claims_claimant_item_idx").on(table.claimantId, table.itemId),
    itemStatusIndex: index("discovery_claims_item_status_idx").on(table.itemId, table.status),
  }),
);