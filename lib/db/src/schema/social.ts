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
    visibility: text("visibility").notNull().default("friends"),
    allowReposts: boolean("allow_reposts").notNull().default(false),
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

export const socialSharingExclusionsTable = pgTable(
  "social_sharing_exclusions",
  {
    ownerId: integer("owner_id").notNull(),
    excludedUserId: integer("excluded_user_id").notNull(),
    createdAt: pgBigint("created_at", { mode: "number" }).notNull(),
  },
  (table) => ({
    primaryKey: primaryKey({ columns: [table.ownerId, table.excludedUserId] }),
    excludedIndex: index("social_sharing_exclusions_excluded_idx").on(table.excludedUserId),
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

/**
 * Ephemeral social content. Object paths always point at private storage; the
 * storage route resolves the story and applies its audience policy before
 * serving a file.
 */
export const socialStoriesTable = pgTable(
  "social_stories",
  {
    id: serial("id").primaryKey(),
    authorId: integer("author_id").notNull(),
    kind: text("kind").notNull().default("text"),
    content: text("content").notNull().default(""),
    textPosition: jsonb("text_position").$type<{ x: number; y: number } | null>(),
    visibility: text("visibility").notNull().default("friends"),
    taggedUserIds: jsonb("tagged_user_ids").$type<number[]>().notNull().default([]),
    media: jsonb("media").$type<{
      type: "image" | "video";
      objectPath: string;
      mimeType: string;
      width?: number;
      height?: number;
      duration?: number;
      fit?: "contain" | "cover";
    } | null>(),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    createdAt: pgBigint("created_at", { mode: "number" }).notNull(),
    expiresAt: pgBigint("expires_at", { mode: "number" }).notNull(),
    deleted: boolean("deleted").notNull().default(false),
  },
  (table) => ({
    audienceIndex: index("social_stories_audience_idx").on(
      table.deleted,
      table.expiresAt,
      table.createdAt,
    ),
    authorCreatedIndex: index("social_stories_author_created_idx").on(
      table.authorId,
      table.createdAt,
    ),
    locationIndex: index("social_stories_location_idx").on(
      table.latitude,
      table.longitude,
      table.expiresAt,
    ),
  }),
);

export const socialStoryViewersTable = pgTable(
  "social_story_viewers",
  {
    storyId: integer("story_id").notNull(),
    viewerId: integer("viewer_id").notNull(),
    viewedAt: pgBigint("viewed_at", { mode: "number" }).notNull(),
    expiresAt: pgBigint("expires_at", { mode: "number" }),
  },
  (table) => ({
    primaryKey: primaryKey({ columns: [table.storyId, table.viewerId] }),
    viewerIndex: index("social_story_viewers_viewer_idx").on(table.viewerId),
    expiryIndex: index("social_story_viewers_expiry_idx").on(table.expiresAt),
  }),
);

export const socialStoryReactionsTable = pgTable(
  "social_story_reactions",
  {
    storyId: integer("story_id").notNull(),
    userId: integer("user_id").notNull(),
    reaction: text("reaction").notNull(),
    createdAt: pgBigint("created_at", { mode: "number" }).notNull(),
  },
  (table) => ({
    primaryKey: primaryKey({ columns: [table.storyId, table.userId] }),
    userIndex: index("social_story_reactions_user_idx").on(table.userId),
  }),
);

export const socialStoryRepliesTable = pgTable(
  "social_story_replies",
  {
    id: serial("id").primaryKey(),
    storyId: integer("story_id").notNull(),
    authorId: integer("author_id").notNull(),
    content: text("content").notNull(),
    createdAt: pgBigint("created_at", { mode: "number" }).notNull(),
    deleted: boolean("deleted").notNull().default(false),
  },
  (table) => ({
    storyCreatedIndex: index("social_story_replies_story_created_idx").on(
      table.storyId,
      table.createdAt,
    ),
    authorIndex: index("social_story_replies_author_idx").on(table.authorId),
  }),
);

export const socialCloseFriendsTable = pgTable(
  "social_close_friends",
  {
    ownerId: integer("owner_id").notNull(),
    memberId: integer("member_id").notNull(),
    createdAt: pgBigint("created_at", { mode: "number" }).notNull(),
  },
  (table) => ({
    primaryKey: primaryKey({ columns: [table.ownerId, table.memberId] }),
    memberIndex: index("social_close_friends_member_idx").on(table.memberId),
  }),
);

export const socialHighlightsTable = pgTable(
  "social_highlights",
  {
    id: serial("id").primaryKey(),
    ownerId: integer("owner_id").notNull(),
    title: text("title").notNull(),
    coverObjectPath: text("cover_object_path"),
    createdAt: pgBigint("created_at", { mode: "number" }).notNull(),
    updatedAt: pgBigint("updated_at", { mode: "number" }).notNull(),
    deleted: boolean("deleted").notNull().default(false),
  },
  (table) => ({
    ownerUpdatedIndex: index("social_highlights_owner_updated_idx").on(
      table.ownerId,
      table.updatedAt,
    ),
  }),
);

export const socialHighlightItemsTable = pgTable(
  "social_highlight_items",
  {
    highlightId: integer("highlight_id").notNull(),
    storyId: integer("story_id").notNull(),
    addedAt: pgBigint("added_at", { mode: "number" }).notNull(),
  },
  (table) => ({
    primaryKey: primaryKey({ columns: [table.highlightId, table.storyId] }),
    storyIndex: index("social_highlight_items_story_idx").on(table.storyId),
  }),
);

export const socialNotificationsTable = pgTable(
  "social_notifications",
  {
    id: serial("id").primaryKey(),
    recipientId: integer("recipient_id").notNull(),
    actorId: integer("actor_id").notNull(),
    type: text("type").notNull(),
    storyId: integer("story_id"),
    replyId: integer("reply_id"),
    createdAt: pgBigint("created_at", { mode: "number" }).notNull(),
    readAt: pgBigint("read_at", { mode: "number" }),
  },
  (table) => ({
    recipientCreatedIndex: index("social_notifications_recipient_created_idx").on(
      table.recipientId,
      table.createdAt,
    ),
    storyIndex: index("social_notifications_story_idx").on(table.storyId),
  }),
);

export const insertSocialPostSchema = createInsertSchema(socialPostsTable).omit({
  id: true,
});

export type SocialPost = typeof socialPostsTable.$inferSelect;
export type SocialComment = typeof socialCommentsTable.$inferSelect;
export type SocialStory = typeof socialStoriesTable.$inferSelect;
export type SocialStoryViewer = typeof socialStoryViewersTable.$inferSelect;
export type SocialStoryReaction = typeof socialStoryReactionsTable.$inferSelect;
export type SocialStoryReply = typeof socialStoryRepliesTable.$inferSelect;
export type SocialHighlight = typeof socialHighlightsTable.$inferSelect;
export type SocialNotification = typeof socialNotificationsTable.$inferSelect;
