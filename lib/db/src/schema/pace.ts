import {
  bigint as pgBigint,
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
} from "drizzle-orm/pg-core";

export type PaceRoutePoint = {
  latitude: number;
  longitude: number;
};

export const paceRoutesTable = pgTable(
  "pace_routes",
  {
    id: serial("id").primaryKey(),
    authorId: integer("author_id").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    kind: text("kind").notNull().default("route"),
    visibility: text("visibility").notNull().default("public"),
    activity: text("activity").notNull().default("run"),
    difficulty: text("difficulty").notNull().default("steady"),
    distanceKm: doublePrecision("distance_km").notNull(),
    elevationM: integer("elevation_m").notNull().default(0),
    durationMin: integer("duration_min").notNull(),
    startLatitude: doublePrecision("start_latitude").notNull(),
    startLongitude: doublePrecision("start_longitude").notNull(),
    locationLabel: text("location_label").notNull().default("Nearby"),
    routeCoordinates: jsonb("route_coordinates").$type<PaceRoutePoint[]>().notNull(),
    createdAt: pgBigint("created_at", { mode: "number" }).notNull(),
    updatedAt: pgBigint("updated_at", { mode: "number" }).notNull(),
    deleted: boolean("deleted").notNull().default(false),
  },
  (table) => ({
    authorCreatedIndex: index("pace_routes_author_created_idx").on(table.authorId, table.createdAt),
    locationIndex: index("pace_routes_location_idx").on(table.startLatitude, table.startLongitude, table.createdAt),
  }),
);

export const paceRouteLikesTable = pgTable(
  "pace_route_likes",
  {
    routeId: integer("route_id").notNull(),
    userId: integer("user_id").notNull(),
    createdAt: pgBigint("created_at", { mode: "number" }).notNull(),
  },
  (table) => ({
    primaryKey: primaryKey({ columns: [table.routeId, table.userId] }),
    userIndex: index("pace_route_likes_user_idx").on(table.userId),
  }),
);

export const paceRouteCommentsTable = pgTable(
  "pace_route_comments",
  {
    id: serial("id").primaryKey(),
    routeId: integer("route_id").notNull(),
    authorId: integer("author_id").notNull(),
    content: text("content").notNull(),
    createdAt: pgBigint("created_at", { mode: "number" }).notNull(),
    deleted: boolean("deleted").notNull().default(false),
  },
  (table) => ({
    routeCreatedIndex: index("pace_route_comments_route_created_idx").on(table.routeId, table.createdAt),
  }),
);

export const paceCommentLikesTable = pgTable(
  "pace_comment_likes",
  {
    commentId: integer("comment_id").notNull(),
    userId: integer("user_id").notNull(),
    createdAt: pgBigint("created_at", { mode: "number" }).notNull(),
  },
  (table) => ({
    primaryKey: primaryKey({ columns: [table.commentId, table.userId] }),
    userIndex: index("pace_comment_likes_user_idx").on(table.userId),
  }),
);

export const paceRouteGiftsTable = pgTable(
  "pace_route_gifts",
  {
    id: serial("id").primaryKey(),
    routeId: integer("route_id").notNull(),
    senderId: integer("sender_id").notNull(),
    recipientId: integer("recipient_id").notNull(),
    gift: text("gift").notNull(),
    coins: integer("coins").notNull(),
    gold: integer("gold").notNull(),
    createdAt: pgBigint("created_at", { mode: "number" }).notNull(),
  },
  (table) => ({
    routeCreatedIndex: index("pace_route_gifts_route_created_idx").on(table.routeId, table.createdAt),
    recipientIndex: index("pace_route_gifts_recipient_idx").on(table.recipientId, table.createdAt),
  }),
);