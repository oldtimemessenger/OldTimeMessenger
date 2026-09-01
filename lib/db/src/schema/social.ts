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
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const socialPostsTable = pgTable(
  "social_posts",
  {
    id: serial("id").primaryKey(),
    authorId: integer("author_id").notNull(),
    kind: text("kind").notNull().default("text"),
    content: text("content").notNull().default(""),
    visibility: text("visibility").notNull().default("public"),
    media: jsonb("media").$type<Array<{
      type: "image" | "video";
      objectPath: string;
      mimeType: string;
      width?: number;
      height?: number;
      duration?: number;
    }> | null>(),
    linkUrl: text("link_url"),
    linkTitle: text("link_title"),
    linkDescription: text("link_description"),
    linkImageUrl: text("link_image_url"),
    newsSource: text("news_source"),
    newsPublishedAt: pgBigint("news_published_at", { mode: "number" }),
    newsUrl: text("news_url"),
    createdAt: pgBigint("created_at", { mode: "number" }).notNull(),
    updatedAt: pgBigint("updated_at", { mode: "number" }).notNull(),
    deleted: boolean("deleted").notNull().default(false),
  },
  (table) => ({
    authorCreatedIndex: index("social_posts_author_created_idx").on(table.authorId, table.createdAt),
    feedIndex: index("social_posts_feed_idx").on(table.createdAt, table.deleted),
    newsIndex: index("social_posts_news_idx").on(table.newsUrl),
  }),
);

export const socialFollowsTable = pgTable(
  "social_follows",
  {
    followerId: integer("follower_id").notNull(),
    followingId: integer("following_id").notNull(),
    createdAt: pgBigint("created_at", { mode: "number" }).notNull(),
  },
  (table) => ({
    primaryKey: primaryKey({ columns: [table.followerId, table.followingId] }),
    followingIndex: index("social_follows_following_idx").on(table.followingId),
  }),
);

export const socialPostLikesTable = pgTable(
  "social_post_likes",
  {
    postId: integer("post_id").notNull(),
    userId: integer("user_id").notNull(),
    createdAt: pgBigint("created_at", { mode: "number" }).notNull(),
  },
  (table) => ({
    primaryKey: primaryKey({ columns: [table.postId, table.userId] }),
    userIndex: index("social_post_likes_user_idx").on(table.userId),
  }),
);

export const socialPostRepostsTable = pgTable(
  "social_post_reposts",
  {
    postId: integer("post_id").notNull(),
    userId: integer("user_id").notNull(),
    createdAt: pgBigint("created_at", { mode: "number" }).notNull(),
  },
  (table) => ({
    primaryKey: primaryKey({ columns: [table.postId, table.userId] }),
    userIndex: index("social_post_reposts_user_idx").on(table.userId),
  }),
);

export const socialPostSavesTable = pgTable(
  "social_post_saves",
  {
    postId: integer("post_id").notNull(),
    userId: integer("user_id").notNull(),
    createdAt: pgBigint("created_at", { mode: "number" }).notNull(),
  },
  (table) => ({
    primaryKey: primaryKey({ columns: [table.postId, table.userId] }),
    userIndex: index("social_post_saves_user_idx").on(table.userId),
  }),
);

export const socialCommentsTable = pgTable(
  "social_comments",
  {
    id: serial("id").primaryKey(),
    postId: integer("post_id").notNull(),
    authorId: integer("author_id").notNull(),
    parentId: integer("parent_id"),
    content: text("content").notNull(),
    createdAt: pgBigint("created_at", { mode: "number" }).notNull(),
    deleted: boolean("deleted").notNull().default(false),
  },
  (table) => ({
    postCreatedIndex: index("social_comments_post_created_idx").on(table.postId, table.createdAt),
    parentIndex: index("social_comments_parent_idx").on(table.parentId),
  }),
);

export const socialCommentLikesTable = pgTable(
  "social_comment_likes",
  {
    commentId: integer("comment_id").notNull(),
    userId: integer("user_id").notNull(),
    createdAt: pgBigint("created_at", { mode: "number" }).notNull(),
  },
  (table) => ({
    primaryKey: primaryKey({ columns: [table.commentId, table.userId] }),
  }),
);

export const socialBlocksTable = pgTable(
  "social_blocks",
  {
    blockerId: integer("blocker_id").notNull(),
    blockedId: integer("blocked_id").notNull(),
    createdAt: pgBigint("created_at", { mode: "number" }).notNull(),
  },
  (table) => ({
    primaryKey: primaryKey({ columns: [table.blockerId, table.blockedId] }),
    blockedIndex: index("social_blocks_blocked_idx").on(table.blockedId),
  }),
);

export const socialMutesTable = pgTable(
  "social_mutes",
  {
    muterId: integer("muter_id").notNull(),
    mutedUserId: integer("muted_user_id").notNull(),
    createdAt: pgBigint("created_at", { mode: "number" }).notNull(),
  },
  (table) => ({
    primaryKey: primaryKey({ columns: [table.muterId, table.mutedUserId] }),
  }),
);

export const socialReportsTable = pgTable(
  "social_reports",
  {
    id: serial("id").primaryKey(),
    reporterId: integer("reporter_id").notNull(),
    targetType: text("target_type").notNull(),
    targetId: integer("target_id").notNull(),
    reason: text("reason").notNull(),
    details: text("details").notNull().default(""),
    createdAt: pgBigint("created_at", { mode: "number" }).notNull(),
  },
  (table) => ({
    reporterTargetIndex: uniqueIndex("social_reports_reporter_target_idx").on(
      table.reporterId,
      table.targetType,
      table.targetId,
    ),
    targetIndex: index("social_reports_target_idx").on(table.targetType, table.targetId),
  }),
);

export const insertSocialPostSchema = createInsertSchema(socialPostsTable).omit({
  id: true,
});

export type SocialPost = typeof socialPostsTable.$inferSelect;
export type SocialComment = typeof socialCommentsTable.$inferSelect;