import { Router, type IRouter, type Request, type Response } from "express";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  ilike,
  inArray,
  lt,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { z } from "@workspace/api-zod";
import {
  db,
  chatMessageRequestsTable,
  chatParticipantsTable,
  chatsTable,
  socialBlocksTable,
  socialCommentLikesTable,
  socialCommentsTable,
  socialFollowsTable,
  socialMutesTable,
  socialPostLikesTable,
  socialPostRepostsTable,
  socialPostSavesTable,
  socialPostsTable,
  socialReportsTable,
  socialSharingExclusionsTable,
  socialStoriesTable,
  socialStoryViewersTable,
  socialStoryReactionsTable,
  socialStoryRepliesTable,
  socialCloseFriendsTable,
  socialHighlightsTable,
  socialHighlightItemsTable,
  socialNotificationsTable,
  uploadSlotsTable,
  usersTable,
} from "@workspace/db";
import { requireChatAuth } from "../lib/chat-auth";
import { fileForObjectPath, MAX_UPLOAD_BYTES } from "../lib/chat-storage";

const router: IRouter = Router();

const postVisibility = z.enum(["public", "friends", "followers", "private"]);
const postKind = z.enum(["text", "photo", "video", "link", "news"]);
const reportReasons = z.enum([
  "spam",
  "harassment",
  "hate",
  "violence",
  "sexual_content",
  "misinformation",
  "copyright",
  "other",
]);

const postInput = z.object({
  content: z.string().trim().max(2_000).default(""),
  kind: postKind.default("text"),
  visibility: postVisibility.default("friends"),
  allowReposts: z.boolean().default(false),
  media: z
    .array(
      z.object({
        type: z.enum(["image", "video"]),
        objectPath: z.string().min(1).max(500),
        mimeType: z.string().min(1).max(120),
        width: z.number().int().positive().optional(),
        height: z.number().int().positive().optional(),
        duration: z.number().nonnegative().optional(),
      }),
    )
    .max(8)
    .nullable()
    .optional(),
  linkUrl: z.string().url().max(2_000).nullable().optional(),
  linkTitle: z.string().trim().max(300).nullable().optional(),
  linkDescription: z.string().trim().max(800).nullable().optional(),
  linkImageUrl: z.string().url().max(2_000).nullable().optional(),
});

const commentInput = z.object({
  content: z.string().trim().min(1).max(1_000),
  parentId: z.number().int().positive().nullable().optional(),
});

const storyVisibility = z.enum(["public", "friends", "followers", "close_friends", "private"]);
const storyInput = z.object({
  content: z.string().trim().max(2_000).default(""),
  visibility: storyVisibility.default("friends"),
  media: z.object({
    type: z.enum(["image", "video"]),
    objectPath: z.string().min(1).max(500),
    mimeType: z.string().min(1).max(120),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    duration: z.number().nonnegative().optional(),
    fit: z.enum(["contain", "cover"]).optional(),
  }).nullable().optional(),
  location: z.object({
    latitude: z.number().finite().gte(-90).lte(90),
    longitude: z.number().finite().gte(-180).lte(180),
  }).nullable().optional(),
  expiresAt: z.number().int().positive().optional(),
});
const storyReplyInput = z.object({ content: z.string().trim().min(1).max(1_000) });
const storyReactionInput = z.object({ reaction: z.string().trim().min(1).max(32).default("❤️") });

type SocialPost = typeof socialPostsTable.$inferSelect;

function parseId(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseLimit(value: unknown): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.min(30, Math.max(1, parsed)) : 20;
}

function parseGeoQuery(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function distanceKm(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }) {
  const earthRadiusKm = 6371;
  const latitudeDelta = (to.latitude - from.latitude) * Math.PI / 180;
  const longitudeDelta = (to.longitude - from.longitude) * Math.PI / 180;
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(from.latitude * Math.PI / 180) * Math.cos(to.latitude * Math.PI / 180) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function handleForUser(user: { id: number; name: string; username?: string | null }): string {
  if (user.username) return user.username;
  const normalized = user.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 18);
  return normalized || `user${user.id}`;
}

function publicUser(user: { id: number; name: string; username?: string | null; bio?: string | null }) {
  return { id: user.id, name: user.name, username: handleForUser(user), bio: user.bio ?? "" };
}

type MessageRequest = typeof chatMessageRequestsTable.$inferSelect;

async function directChatForUsers(userOneId: number, userTwoId: number) {
  const first = await db
    .select({ chatId: chatParticipantsTable.chatId })
    .from(chatParticipantsTable)
    .innerJoin(chatsTable, eq(chatsTable.id, chatParticipantsTable.chatId))
    .where(and(eq(chatParticipantsTable.userId, userOneId), eq(chatsTable.isGroup, false)));
  if (!first.length) return undefined;
  const [shared] = await db
    .select({ chatId: chatParticipantsTable.chatId })
    .from(chatParticipantsTable)
    .where(
      and(
        eq(chatParticipantsTable.userId, userTwoId),
        inArray(chatParticipantsTable.chatId, first.map((item) => item.chatId)),
      ),
    )
    .limit(1);
  if (!shared) return undefined;
  const [chat] = await db.select().from(chatsTable).where(eq(chatsTable.id, shared.chatId)).limit(1);
  return chat;
}

async function serializeMessageRequest(request: MessageRequest) {
  const [sender, recipient] = await Promise.all([
    db.select({ id: usersTable.id, name: usersTable.name, username: usersTable.username, bio: usersTable.bio }).from(usersTable).where(eq(usersTable.id, request.senderId)).limit(1),
    db.select({ id: usersTable.id, name: usersTable.name, username: usersTable.username, bio: usersTable.bio }).from(usersTable).where(eq(usersTable.id, request.recipientId)).limit(1),
  ]);
  return {
    id: request.id,
    sender: sender[0] ? publicUser(sender[0]) : null,
    recipient: recipient[0] ? publicUser(recipient[0]) : null,
    status: request.status,
    chatId: request.chatId,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  };
}

async function userExists(userId: number): Promise<boolean> {
  const [user] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  return Boolean(user);
}

async function blockedUserIds(viewerId: number): Promise<Set<number>> {
  const rows = await db
    .select({ blockerId: socialBlocksTable.blockerId, blockedId: socialBlocksTable.blockedId })
    .from(socialBlocksTable)
    .where(or(eq(socialBlocksTable.blockerId, viewerId), eq(socialBlocksTable.blockedId, viewerId)));
  return new Set(
    rows.map((row) => (row.blockerId === viewerId ? row.blockedId : row.blockerId)),
  );
}

async function followingUserIds(viewerId: number): Promise<Set<number>> {
  const rows = await db
    .select({ followingId: socialFollowsTable.followingId })
    .from(socialFollowsTable)
    .where(eq(socialFollowsTable.followerId, viewerId));
  return new Set(rows.map((row) => row.followingId));
}

async function mutedUserIds(viewerId: number): Promise<Set<number>> {
  const rows = await db
    .select({ mutedUserId: socialMutesTable.mutedUserId })
    .from(socialMutesTable)
    .where(eq(socialMutesTable.muterId, viewerId));
  return new Set(rows.map((row) => row.mutedUserId));
}

async function isBlocked(viewerId: number, otherUserId: number): Promise<boolean> {
  const [relationship] = await db
    .select({ blockerId: socialBlocksTable.blockerId })
    .from(socialBlocksTable)
    .where(
      or(
        and(
          eq(socialBlocksTable.blockerId, viewerId),
          eq(socialBlocksTable.blockedId, otherUserId),
        ),
        and(
          eq(socialBlocksTable.blockerId, otherUserId),
          eq(socialBlocksTable.blockedId, viewerId),
        ),
      ),
    )
    .limit(1);
  return Boolean(relationship);
}

async function isExcludedFromSharing(ownerId: number, viewerId: number): Promise<boolean> {
  if (ownerId === viewerId) return false;
  const [exclusion] = await db
    .select({ ownerId: socialSharingExclusionsTable.ownerId })
    .from(socialSharingExclusionsTable)
    .where(and(
      eq(socialSharingExclusionsTable.ownerId, ownerId),
      eq(socialSharingExclusionsTable.excludedUserId, viewerId),
    ))
    .limit(1);
  return Boolean(exclusion);
}

async function postById(postId: number): Promise<SocialPost | undefined> {
  const [post] = await db
    .select()
    .from(socialPostsTable)
    .where(and(eq(socialPostsTable.id, postId), eq(socialPostsTable.deleted, false)))
    .limit(1);
  return post;
}

async function visiblePostFor(viewerId: number, postId: number): Promise<SocialPost | undefined> {
  const post = await postById(postId);
  if (!post) return undefined;
  const [following, blocked] = await Promise.all([followingUserIds(viewerId), blockedUserIds(viewerId)]);
  return (await canSeePost(viewerId, post, following, blocked)) ? post : undefined;
}

async function postForComment(commentId: number): Promise<SocialPost | undefined> {
  const [row] = await db
    .select({ post: socialPostsTable })
    .from(socialCommentsTable)
    .innerJoin(socialPostsTable, eq(socialPostsTable.id, socialCommentsTable.postId))
    .where(and(eq(socialCommentsTable.id, commentId), eq(socialCommentsTable.deleted, false)))
    .limit(1);
  return row?.post;
}

async function canSeePost(
  viewerId: number,
  post: SocialPost,
  following: Set<number>,
  blocked: Set<number>,
): Promise<boolean> {
  if (blocked.has(post.authorId)) return false;
  if (post.authorId === viewerId) return true;
  if (await isExcludedFromSharing(post.authorId, viewerId)) return false;
  if (post.visibility === "public") return true;
  if (post.visibility === "private") return false;
  if (post.visibility === "followers") return following.has(post.authorId);
  if (!following.has(post.authorId)) return false;
  const [reciprocal] = await db
    .select({ followerId: socialFollowsTable.followerId })
    .from(socialFollowsTable)
    .where(
      and(
        eq(socialFollowsTable.followerId, post.authorId),
        eq(socialFollowsTable.followingId, viewerId),
      ),
    )
    .limit(1);
  return Boolean(reciprocal);
}

async function serializePosts(posts: SocialPost[], viewerId: number) {
  if (!posts.length) return [];
  const authorIds = [...new Set(posts.map((post) => post.authorId))];
  const postIds = posts.map((post) => post.id);
  const [authors, likes, reposts, saves, comments, viewerLikes, viewerReposts, viewerSaves, follows] =
    await Promise.all([
      db
        .select({ id: usersTable.id, name: usersTable.name, username: usersTable.username, bio: usersTable.bio })
        .from(usersTable)
        .where(inArray(usersTable.id, authorIds)),
      db
        .select({ postId: socialPostLikesTable.postId, count: sql<number>`count(*)` })
        .from(socialPostLikesTable)
        .where(inArray(socialPostLikesTable.postId, postIds))
        .groupBy(socialPostLikesTable.postId),
      db
        .select({ postId: socialPostRepostsTable.postId, count: sql<number>`count(*)` })
        .from(socialPostRepostsTable)
        .where(inArray(socialPostRepostsTable.postId, postIds))
        .groupBy(socialPostRepostsTable.postId),
      db
        .select({ postId: socialPostSavesTable.postId, count: sql<number>`count(*)` })
        .from(socialPostSavesTable)
        .where(inArray(socialPostSavesTable.postId, postIds))
        .groupBy(socialPostSavesTable.postId),
      db
        .select({ postId: socialCommentsTable.postId, count: sql<number>`count(*)` })
        .from(socialCommentsTable)
        .where(
          and(
            inArray(socialCommentsTable.postId, postIds),
            eq(socialCommentsTable.deleted, false),
          ),
        )
        .groupBy(socialCommentsTable.postId),
      db
        .select({ postId: socialPostLikesTable.postId })
        .from(socialPostLikesTable)
        .where(
          and(
            eq(socialPostLikesTable.userId, viewerId),
            inArray(socialPostLikesTable.postId, postIds),
          ),
        ),
      db
        .select({ postId: socialPostRepostsTable.postId })
        .from(socialPostRepostsTable)
        .where(
          and(
            eq(socialPostRepostsTable.userId, viewerId),
            inArray(socialPostRepostsTable.postId, postIds),
          ),
        ),
      db
        .select({ postId: socialPostSavesTable.postId })
        .from(socialPostSavesTable)
        .where(
          and(
            eq(socialPostSavesTable.userId, viewerId),
            inArray(socialPostSavesTable.postId, postIds),
          ),
        ),
      db
        .select({ followingId: socialFollowsTable.followingId })
        .from(socialFollowsTable)
        .where(
          and(
            eq(socialFollowsTable.followerId, viewerId),
            inArray(socialFollowsTable.followingId, authorIds),
          ),
        ),
    ]);
  const authorById = new Map(authors.map((author) => [author.id, author]));
  const countBy = (rows: Array<{ postId: number; count: number }>) =>
    new Map(rows.map((row) => [row.postId, Number(row.count)]));
  const likeCounts = countBy(likes);
  const repostCounts = countBy(reposts);
  const saveCounts = countBy(saves);
  const commentCounts = countBy(comments);
  const liked = new Set(viewerLikes.map((row) => row.postId));
  const reposted = new Set(viewerReposts.map((row) => row.postId));
  const saved = new Set(viewerSaves.map((row) => row.postId));
  const following = new Set(follows.map((row) => row.followingId));

  return posts.map((post) => {
    const author = authorById.get(post.authorId);
    const media = Array.isArray(post.media) ? post.media : [];
    return {
      id: post.id,
      kind: post.kind,
      content: post.content,
      visibility: post.visibility,
      allowReposts: post.allowReposts,
      media,
      linkUrl: post.linkUrl,
      linkTitle: post.linkTitle,
      linkDescription: post.linkDescription,
      linkImageUrl: post.linkImageUrl,
      news:
        post.newsUrl && post.newsSource
          ? {
              source: post.newsSource,
              publishedAt: post.newsPublishedAt,
              url: post.newsUrl,
            }
          : null,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      author: author
        ? {
            id: author.id,
            name: author.name,
            username: handleForUser(author),
          }
        : { id: post.authorId, name: "Old Time user", username: `user${post.authorId}` },
      counts: {
        likes: likeCounts.get(post.id) ?? 0,
        comments: commentCounts.get(post.id) ?? 0,
        reposts: repostCounts.get(post.id) ?? 0,
        saves: saveCounts.get(post.id) ?? 0,
      },
      viewer: {
        liked: liked.has(post.id),
        reposted: reposted.has(post.id),
        saved: saved.has(post.id),
        followingAuthor: following.has(post.authorId),
      },
    };
  });
}

router.get("/social/feed", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res);
  if (viewerId === null) return;
  const mode = req.query.mode === "following" ? "following" : "for-you";
  const limit = parseLimit(req.query.limit);
  const cursor = req.query.cursor ? Number(req.query.cursor) : Number.POSITIVE_INFINITY;
  if (!Number.isFinite(cursor) && cursor !== Number.POSITIVE_INFINITY) {
    res.status(400).json({ error: "Cursor must be a timestamp." });
    return;
  }
  const [following, blocked, muted] = await Promise.all([
    followingUserIds(viewerId),
    blockedUserIds(viewerId),
    mutedUserIds(viewerId),
  ]);
  const candidates = await db
    .select()
    .from(socialPostsTable)
    .where(
      and(
        eq(socialPostsTable.deleted, false),
        Number.isFinite(cursor) ? lt(socialPostsTable.createdAt, cursor) : undefined,
      ),
    )
    .orderBy(desc(socialPostsTable.createdAt))
    .limit(Math.min(100, limit * 4));
  const visible: SocialPost[] = [];
  for (const post of candidates) {
    if (mode === "following" && !following.has(post.authorId)) continue;
    if (muted.has(post.authorId)) continue;
    if (await canSeePost(viewerId, post, following, blocked)) visible.push(post);
  }

  const serialized = await serializePosts(visible, viewerId);
  if (mode === "for-you") {
    const engagementById = new Map(
      serialized.map((post) => [
        post.id,
        post.counts.likes + post.counts.comments * 2 + post.counts.reposts * 3,
      ]),
    );
    serialized.sort((left, right) => {
      const leftAuthorWeight =
        left.author.id === viewerId ? 2_000 : left.viewer.followingAuthor ? 1_000 : 0;
      const rightAuthorWeight =
        right.author.id === viewerId ? 2_000 : right.viewer.followingAuthor ? 1_000 : 0;
      const leftScore =
        leftAuthorWeight +
        (engagementById.get(left.id) ?? 0) +
        Math.max(0, 100 - (Date.now() - left.createdAt) / 3_600_000);
      const rightScore =
        rightAuthorWeight +
        (engagementById.get(right.id) ?? 0) +
        Math.max(0, 100 - (Date.now() - right.createdAt) / 3_600_000);
      return rightScore - leftScore;
    });
  }
  const page = serialized.slice(0, limit);
  res.json({
    mode,
    items: page,
    nextCursor: page.length === limit ? page[page.length - 1].createdAt : null,
  });
});

router.post("/social/posts", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res);
  if (viewerId === null) return;
  const parsed = postInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Post content or media is invalid." });
    return;
  }
  const input = parsed.data;
  if (!input.content && !input.media?.length && !input.linkUrl) {
    res.status(400).json({ error: "Add text, media, or a link before posting." });
    return;
  }
  const media = input.media ?? [];
  const now = Date.now();
  const claimedUploadIds: string[] = [];
  for (const item of media) {
    if (
      (item.type === "image" && !item.mimeType.toLowerCase().startsWith("image/")) ||
      (item.type === "video" && !item.mimeType.toLowerCase().startsWith("video/"))
    ) {
      res.status(400).json({ error: "Post media type must match its MIME type." });
      return;
    }
    const [slot] = await db
      .update(uploadSlotsTable)
      .set({ status: "committing" })
      .where(and(
        eq(uploadSlotsTable.objectPath, item.objectPath),
        eq(uploadSlotsTable.userId, viewerId),
        eq(uploadSlotsTable.status, "uploaded"),
        gt(uploadSlotsTable.expiresAt, now),
      ))
      .returning();
    if (!slot || slot.contentType !== item.mimeType.toLowerCase()) {
      if (claimedUploadIds.length) {
        await db.update(uploadSlotsTable).set({ status: "uploaded" })
          .where(inArray(uploadSlotsTable.id, claimedUploadIds));
      }
      res.status(400).json({ error: "Post media must be an uploaded file you own." });
      return;
    }
    try {
      const file = fileForObjectPath(slot.objectPath);
      const [[exists], [metadata]] = await Promise.all([file.exists(), file.getMetadata()]);
      const size = Number(metadata.size ?? 0);
      if (!exists || !Number.isFinite(size) || size < 1 || size > MAX_UPLOAD_BYTES ||
        (metadata.contentType ?? "").toLowerCase() !== slot.contentType) {
        throw new Error("Invalid uploaded media");
      }
      claimedUploadIds.push(slot.id);
    } catch {
      await db.update(uploadSlotsTable).set({ status: "uploaded" })
        .where(inArray(uploadSlotsTable.id, [...claimedUploadIds, slot.id]));
      res.status(400).json({ error: "The uploaded post media could not be verified." });
      return;
    }
  }
  const timestamp = Date.now();
  let created: SocialPost;
  try {
    [created] = await db.transaction(async (tx) => {
      const inserted = await tx.insert(socialPostsTable).values({
        authorId: viewerId, kind: input.kind, content: input.content, visibility: input.visibility,
        allowReposts: input.allowReposts && input.visibility === "public",
        media: input.media ?? null, linkUrl: input.linkUrl ?? null, linkTitle: input.linkTitle ?? null,
        linkDescription: input.linkDescription ?? null, linkImageUrl: input.linkImageUrl ?? null,
        createdAt: timestamp, updatedAt: timestamp,
      }).returning();
      if (claimedUploadIds.length) {
        const committed = await tx.update(uploadSlotsTable)
          .set({ status: "committed", referenceType: "social_post", referenceId: inserted[0].id })
          .where(and(inArray(uploadSlotsTable.id, claimedUploadIds), eq(uploadSlotsTable.status, "committing")))
          .returning({ id: uploadSlotsTable.id });
        if (committed.length !== claimedUploadIds.length) throw new Error("UPLOAD_COMMIT_CONFLICT");
      }
      return inserted;
    });
  } catch {
    if (claimedUploadIds.length) await db.update(uploadSlotsTable).set({ status: "uploaded" })
      .where(and(inArray(uploadSlotsTable.id, claimedUploadIds), eq(uploadSlotsTable.status, "committing")));
    res.status(500).json({ error: "Unable to publish post." });
    return;
  }
  res.status(201).json((await serializePosts([created], viewerId))[0]);
});

router.delete("/social/posts/:postId", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res);
  const postId = parseId(req.params.postId);
  if (viewerId === null || postId === null) return;
  const [deleted] = await db
    .update(socialPostsTable)
    .set({ deleted: true, updatedAt: Date.now() })
    .where(and(eq(socialPostsTable.id, postId), eq(socialPostsTable.authorId, viewerId)))
    .returning({ id: socialPostsTable.id });
  if (!deleted) {
    res.status(404).json({ error: "Post not found or not owned by you." });
    return;
  }
  res.json({ success: true });
});

async function togglePostRelation(
  req: Request<{ postId: string }>,
  res: Response,
  relation: "like" | "repost" | "save",
): Promise<void> {
  const viewerId = await requireChatAuth(req, res);
  const postId = parseId(req.params.postId);
  if (viewerId === null || postId === null) return;
  const post = await visiblePostFor(viewerId, postId);
  if (!post) {
    res.status(404).json({ error: "Post not found." });
    return;
  }
  if (relation === "repost" && post.authorId !== viewerId && !(post.visibility === "public" && post.allowReposts)) {
    res.status(403).json({ error: "The author has not allowed reposts for this post." });
    return;
  }
  const timestamp = Date.now();
  if (relation === "like") {
    await db
      .insert(socialPostLikesTable)
      .values({ postId, userId: viewerId, createdAt: timestamp })
      .onConflictDoNothing();
  } else if (relation === "repost") {
    await db
      .insert(socialPostRepostsTable)
      .values({ postId, userId: viewerId, createdAt: timestamp })
      .onConflictDoNothing();
  } else {
    await db
      .insert(socialPostSavesTable)
      .values({ postId, userId: viewerId, createdAt: timestamp })
      .onConflictDoNothing();
  }
  res.json({ success: true, active: true });
}

async function removePostRelation(
  req: Request<{ postId: string }>,
  res: Response,
  relation: "like" | "repost" | "save",
): Promise<void> {
  const viewerId = await requireChatAuth(req, res);
  const postId = parseId(req.params.postId);
  if (viewerId === null || postId === null) return;
  if (!(await visiblePostFor(viewerId, postId))) {
    res.status(404).json({ error: "Post not found." });
    return;
  }
  if (relation === "like") {
    await db
      .delete(socialPostLikesTable)
      .where(
        and(
          eq(socialPostLikesTable.postId, postId),
          eq(socialPostLikesTable.userId, viewerId),
        ),
      );
  } else if (relation === "repost") {
    await db
      .delete(socialPostRepostsTable)
      .where(
        and(
          eq(socialPostRepostsTable.postId, postId),
          eq(socialPostRepostsTable.userId, viewerId),
        ),
      );
  } else {
    await db
      .delete(socialPostSavesTable)
      .where(
        and(
          eq(socialPostSavesTable.postId, postId),
          eq(socialPostSavesTable.userId, viewerId),
        ),
      );
  }
  res.json({ success: true, active: false });
}

router.put("/social/posts/:postId/like", async (req, res) => togglePostRelation(req, res, "like"));
router.delete("/social/posts/:postId/like", async (req, res) => removePostRelation(req, res, "like"));
router.put("/social/posts/:postId/repost", async (req, res) => togglePostRelation(req, res, "repost"));
router.delete("/social/posts/:postId/repost", async (req, res) => removePostRelation(req, res, "repost"));
router.put("/social/posts/:postId/save", async (req, res) => togglePostRelation(req, res, "save"));
router.delete("/social/posts/:postId/save", async (req, res) => removePostRelation(req, res, "save"));

router.get("/social/posts/:postId/comments", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res);
  const postId = parseId(req.params.postId);
  if (viewerId === null || postId === null) return;
  const post = await postById(postId);
  if (!post || !(await canSeePost(viewerId, post, await followingUserIds(viewerId), await blockedUserIds(viewerId)))) {
    res.status(404).json({ error: "Post not found." });
    return;
  }
  const comments = await db
    .select({
      id: socialCommentsTable.id,
      postId: socialCommentsTable.postId,
      authorId: socialCommentsTable.authorId,
      parentId: socialCommentsTable.parentId,
      content: socialCommentsTable.content,
      createdAt: socialCommentsTable.createdAt,
      authorName: usersTable.name,
      authorUsername: usersTable.username,
      authorBio: usersTable.bio,
    })
    .from(socialCommentsTable)
    .innerJoin(usersTable, eq(usersTable.id, socialCommentsTable.authorId))
    .where(
      and(
        eq(socialCommentsTable.postId, postId),
        eq(socialCommentsTable.deleted, false),
      ),
    )
    .orderBy(asc(socialCommentsTable.createdAt))
    .limit(200);
  const commentIds = comments.map((comment) => comment.id);
  const liked = commentIds.length
    ? await db
        .select({ commentId: socialCommentLikesTable.commentId })
        .from(socialCommentLikesTable)
        .where(
          and(
            eq(socialCommentLikesTable.userId, viewerId),
            inArray(socialCommentLikesTable.commentId, commentIds),
          ),
        )
    : [];
  const likedIds = new Set(liked.map((row) => row.commentId));
  res.json(
    comments.map((comment) => ({
      ...comment,
      author: {
        id: comment.authorId,
        name: comment.authorName,
        username: handleForUser({ id: comment.authorId, name: comment.authorName, username: comment.authorUsername }),
        bio: comment.authorBio ?? "",
      },
      liked: likedIds.has(comment.id),
    })),
  );
});

router.post("/social/posts/:postId/comments", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res);
  const postId = parseId(req.params.postId);
  const parsed = commentInput.safeParse(req.body);
  if (viewerId === null || postId === null || !parsed.success) {
    res.status(400).json({ error: "A valid comment is required." });
    return;
  }
  const post = await postById(postId);
  if (!post || !(await canSeePost(viewerId, post, await followingUserIds(viewerId), await blockedUserIds(viewerId)))) {
    res.status(404).json({ error: "Post not found." });
    return;
  }
  if (parsed.data.parentId) {
    const [parent] = await db
      .select({ id: socialCommentsTable.id, postId: socialCommentsTable.postId })
      .from(socialCommentsTable)
      .where(
        and(
          eq(socialCommentsTable.id, parsed.data.parentId),
          eq(socialCommentsTable.postId, postId),
          eq(socialCommentsTable.deleted, false),
        ),
      )
      .limit(1);
    if (!parent) {
      res.status(400).json({ error: "The reply target is unavailable." });
      return;
    }
  }
  const [created] = await db
    .insert(socialCommentsTable)
    .values({
      postId,
      authorId: viewerId,
      parentId: parsed.data.parentId ?? null,
      content: parsed.data.content,
      createdAt: Date.now(),
    })
    .returning();
  res.status(201).json(created);
});

router.delete("/social/comments/:commentId", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res);
  const commentId = parseId(req.params.commentId);
  if (viewerId === null || commentId === null) return;
  const post = await postForComment(commentId);
  if (!post || !(await visiblePostFor(viewerId, post.id))) {
    res.status(404).json({ error: "Comment not found." });
    return;
  }
  const [deleted] = await db
    .update(socialCommentsTable)
    .set({ deleted: true })
    .where(
      and(
        eq(socialCommentsTable.id, commentId),
        eq(socialCommentsTable.authorId, viewerId),
        eq(socialCommentsTable.deleted, false),
      ),
    )
    .returning({ id: socialCommentsTable.id });
  if (!deleted) {
    res.status(404).json({ error: "Comment not found or not owned by you." });
    return;
  }
  res.json({ success: true });
});

router.put("/social/comments/:commentId/like", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res);
  const commentId = parseId(req.params.commentId);
  if (viewerId === null || commentId === null) return;
  const post = await postForComment(commentId);
  if (!post || !(await visiblePostFor(viewerId, post.id))) {
    res.status(404).json({ error: "Comment not found." });
    return;
  }
  await db
    .insert(socialCommentLikesTable)
    .values({ commentId, userId: viewerId, createdAt: Date.now() })
    .onConflictDoNothing();
  res.json({ success: true, active: true });
});

router.delete("/social/comments/:commentId/like", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res);
  const commentId = parseId(req.params.commentId);
  if (viewerId === null || commentId === null) return;
  const post = await postForComment(commentId);
  if (!post || !(await visiblePostFor(viewerId, post.id))) {
    res.status(404).json({ error: "Comment not found." });
    return;
  }
  await db
    .delete(socialCommentLikesTable)
    .where(
      and(
        eq(socialCommentLikesTable.commentId, commentId),
        eq(socialCommentLikesTable.userId, viewerId),
      ),
    );
  res.json({ success: true, active: false });
});

async function relationshipTarget(
  req: Request<{ userId: string }>,
  res: Response,
): Promise<{ viewerId: number; targetId: number } | null> {
  const viewerId = await requireChatAuth(req, res);
  const targetId = parseId(req.params.userId);
  if (viewerId === null || targetId === null) return null;
  if (viewerId === targetId || !(await userExists(targetId))) {
    res.status(400).json({ error: "Choose another existing user." });
    return null;
  }
  if (await isBlocked(viewerId, targetId)) {
    res.status(403).json({ error: "This relationship is unavailable." });
    return null;
  }
  return { viewerId, targetId };
}

router.put("/social/users/:userId/follow", async (req, res): Promise<void> => {
  const target = await relationshipTarget(req, res);
  if (!target) return;
  await db
    .insert(socialFollowsTable)
    .values({
      followerId: target.viewerId,
      followingId: target.targetId,
      createdAt: Date.now(),
    })
    .onConflictDoNothing();
  res.json({ success: true, following: true });
});

router.delete("/social/users/:userId/follow", async (req, res): Promise<void> => {
  const target = await relationshipTarget(req, res);
  if (!target) return;
  await db
    .delete(socialFollowsTable)
    .where(
      and(
        eq(socialFollowsTable.followerId, target.viewerId),
        eq(socialFollowsTable.followingId, target.targetId),
      ),
    );
  res.json({ success: true, following: false });
});

router.get("/social/message-requests", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res);
  if (viewerId === null) return;
  const box = req.query.box === "outgoing" ? "outgoing" : "incoming";
  const where = box === "outgoing"
    ? and(eq(chatMessageRequestsTable.senderId, viewerId), eq(chatMessageRequestsTable.status, "pending"))
    : and(eq(chatMessageRequestsTable.recipientId, viewerId), eq(chatMessageRequestsTable.status, "pending"));
  const requests = await db
    .select()
    .from(chatMessageRequestsTable)
    .where(where)
    .orderBy(desc(chatMessageRequestsTable.updatedAt))
    .limit(50);
  const blocked = await blockedUserIds(viewerId);
  const visible = requests.filter((request) =>
    !blocked.has(box === "outgoing" ? request.recipientId : request.senderId),
  );
  res.json({ items: await Promise.all(visible.map(serializeMessageRequest)) });
});

router.post("/social/message-requests/to/:userId", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res);
  const targetId = parseId(req.params.userId);
  if (viewerId === null || targetId === null) return;
  if (viewerId === targetId || !(await userExists(targetId))) {
    res.status(400).json({ error: "Choose another existing user." });
    return;
  }
  if (await isBlocked(viewerId, targetId)) {
    res.status(404).json({ error: "User not found." });
    return;
  }
  const [recipient] = await db
    .select({ id: usersTable.id, contactPermission: usersTable.contactPermission })
    .from(usersTable)
    .where(eq(usersTable.id, targetId))
    .limit(1);
  if (!recipient) {
    res.status(404).json({ error: "User not found." });
    return;
  }
  const [existingChat] = await Promise.all([
    directChatForUsers(viewerId, targetId),
  ]);
  if (existingChat) {
    res.status(409).json({ error: "You already have a conversation with this user.", chatId: existingChat.id });
    return;
  }
  if (recipient.contactPermission === "nobody") {
    res.status(403).json({ error: "This user is not accepting new message requests." });
    return;
  }
  if (recipient.contactPermission === "followers") {
    const [follow] = await db
      .select({ followerId: socialFollowsTable.followerId })
      .from(socialFollowsTable)
      .where(
        and(
          eq(socialFollowsTable.followerId, viewerId),
          eq(socialFollowsTable.followingId, targetId),
        ),
      )
      .limit(1);
    if (!follow) {
      res.status(403).json({ error: "Follow this user before sending a message request." });
      return;
    }
  }
  const timestamp = Date.now();
  const [existing] = await db
    .select()
    .from(chatMessageRequestsTable)
    .where(
      and(
        eq(chatMessageRequestsTable.senderId, viewerId),
        eq(chatMessageRequestsTable.recipientId, targetId),
      ),
    )
    .limit(1);
  const request = existing
    ? (await db
        .update(chatMessageRequestsTable)
        .set({ status: "pending", chatId: null, createdAt: timestamp, updatedAt: timestamp })
        .where(eq(chatMessageRequestsTable.id, existing.id))
        .returning())[0]
    : (await db
        .insert(chatMessageRequestsTable)
        .values({
          senderId: viewerId,
          recipientId: targetId,
          status: "pending",
          createdAt: timestamp,
          updatedAt: timestamp,
        })
        .returning())[0];
  res.status(201).json(await serializeMessageRequest(request));
});

router.put("/social/message-requests/:requestId/accept", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res);
  const requestId = parseId(req.params.requestId);
  if (viewerId === null || requestId === null) return;
  const [messageRequest] = await db
    .select()
    .from(chatMessageRequestsTable)
    .where(
      and(
        eq(chatMessageRequestsTable.id, requestId),
        eq(chatMessageRequestsTable.recipientId, viewerId),
        eq(chatMessageRequestsTable.status, "pending"),
      ),
    )
    .limit(1);
  if (!messageRequest || await isBlocked(viewerId, messageRequest.senderId)) {
    res.status(404).json({ error: "Message request not found." });
    return;
  }
  let chat = await directChatForUsers(messageRequest.senderId, messageRequest.recipientId);
  if (!chat) {
    const timestamp = Date.now();
    const [created] = await db
      .insert(chatsTable)
      .values({ isGroup: false, name: "", createdAt: timestamp })
      .returning();
    await db.insert(chatParticipantsTable).values([
      { chatId: created.id, userId: messageRequest.senderId },
      { chatId: created.id, userId: messageRequest.recipientId },
    ]);
    chat = created;
  }
  const [updated] = await db
    .update(chatMessageRequestsTable)
    .set({ status: "accepted", chatId: chat.id, updatedAt: Date.now() })
    .where(
      and(
        eq(chatMessageRequestsTable.id, requestId),
        eq(chatMessageRequestsTable.status, "pending"),
      ),
    )
    .returning();
  if (!updated) {
    res.status(409).json({ error: "This message request was already handled." });
    return;
  }
  res.json({ success: true, chatId: chat.id });
});

router.delete("/social/message-requests/:requestId", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res);
  const requestId = parseId(req.params.requestId);
  if (viewerId === null || requestId === null) return;
  const [declined] = await db
    .update(chatMessageRequestsTable)
    .set({ status: "declined", updatedAt: Date.now() })
    .where(
      and(
        eq(chatMessageRequestsTable.id, requestId),
        eq(chatMessageRequestsTable.recipientId, viewerId),
        eq(chatMessageRequestsTable.status, "pending"),
      ),
    )
    .returning({ id: chatMessageRequestsTable.id });
  if (!declined) {
    res.status(404).json({ error: "Message request not found." });
    return;
  }
  res.json({ success: true });
});

router.get("/social/privacy/exclusions", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res);
  if (viewerId === null) return;
  const rows = await db
    .select({ id: usersTable.id, name: usersTable.name, username: usersTable.username, bio: usersTable.bio })
    .from(socialSharingExclusionsTable)
    .innerJoin(usersTable, eq(usersTable.id, socialSharingExclusionsTable.excludedUserId))
    .where(eq(socialSharingExclusionsTable.ownerId, viewerId))
    .orderBy(asc(usersTable.name));
  res.json({ items: rows.map((user) => ({ ...user, username: handleForUser(user), bio: user.bio ?? "" })) });
});

router.put("/social/privacy/exclusions/:userId", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res);
  const targetId = parseId(req.params.userId);
  if (viewerId === null) return;
  if (targetId === null || targetId === viewerId || !(await userExists(targetId))) {
    res.status(400).json({ error: "Choose another Old Time user to exclude." });
    return;
  }
  await db.insert(socialSharingExclusionsTable).values({
    ownerId: viewerId,
    excludedUserId: targetId,
    createdAt: Date.now(),
  }).onConflictDoNothing();
  res.json({ success: true, active: true });
});

router.delete("/social/privacy/exclusions/:userId", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res);
  const targetId = parseId(req.params.userId);
  if (viewerId === null) return;
  if (targetId === null) {
    res.status(400).json({ error: "A valid user ID is required." });
    return;
  }
  await db.delete(socialSharingExclusionsTable).where(and(
    eq(socialSharingExclusionsTable.ownerId, viewerId),
    eq(socialSharingExclusionsTable.excludedUserId, targetId),
  ));
  res.json({ success: true, active: false });
});

router.put("/social/users/:userId/block", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res);
  const targetId = parseId(req.params.userId);
  if (viewerId === null || targetId === null) return;
  if (viewerId === targetId || !(await userExists(targetId))) {
    res.status(400).json({ error: "Choose another existing user." });
    return;
  }
  await db.transaction(async (tx) => {
    await tx
      .insert(socialBlocksTable)
      .values({ blockerId: viewerId, blockedId: targetId, createdAt: Date.now() })
      .onConflictDoNothing();
    await tx
      .delete(socialFollowsTable)
      .where(
        or(
          and(
            eq(socialFollowsTable.followerId, viewerId),
            eq(socialFollowsTable.followingId, targetId),
          ),
          and(
            eq(socialFollowsTable.followerId, targetId),
            eq(socialFollowsTable.followingId, viewerId),
          ),
        ),
      );
  });
  res.json({ success: true, blocked: true });
});

router.delete("/social/users/:userId/block", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res);
  const targetId = parseId(req.params.userId);
  if (viewerId === null || targetId === null) return;
  await db
    .delete(socialBlocksTable)
    .where(
      and(
        eq(socialBlocksTable.blockerId, viewerId),
        eq(socialBlocksTable.blockedId, targetId),
      ),
    );
  res.json({ success: true, blocked: false });
});

router.put("/social/users/:userId/mute", async (req, res): Promise<void> => {
  const target = await relationshipTarget(req, res);
  if (!target) return;
  await db
    .insert(socialMutesTable)
    .values({ muterId: target.viewerId, mutedUserId: target.targetId, createdAt: Date.now() })
    .onConflictDoNothing();
  res.json({ success: true, muted: true });
});

router.delete("/social/users/:userId/mute", async (req, res): Promise<void> => {
  const target = await relationshipTarget(req, res);
  if (!target) return;
  await db
    .delete(socialMutesTable)
    .where(
      and(
        eq(socialMutesTable.muterId, target.viewerId),
        eq(socialMutesTable.mutedUserId, target.targetId),
      ),
    );
  res.json({ success: true, muted: false });
});

router.post("/social/reports", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res);
  if (viewerId === null) return;
  const parsed = z
    .object({
      targetType: z.enum(["post", "comment", "user"]),
      targetId: z.number().int().positive(),
      reason: reportReasons,
      details: z.string().trim().max(1_000).default(""),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "A valid report reason is required." });
    return;
  }
  if (parsed.data.targetType === "post") {
    if (!(await visiblePostFor(viewerId, parsed.data.targetId))) {
      res.status(404).json({ error: "Post not found." });
      return;
    }
  } else if (parsed.data.targetType === "comment") {
    const post = await postForComment(parsed.data.targetId);
    if (!post || !(await visiblePostFor(viewerId, post.id))) {
      res.status(404).json({ error: "Comment not found." });
      return;
    }
  } else if (!(await userExists(parsed.data.targetId)) || await isBlocked(viewerId, parsed.data.targetId)) {
    res.status(404).json({ error: "User not found." });
    return;
  }
  await db
    .insert(socialReportsTable)
    .values({
      reporterId: viewerId,
      targetType: parsed.data.targetType,
      targetId: parsed.data.targetId,
      reason: parsed.data.reason,
      details: parsed.data.details,
      createdAt: Date.now(),
    })
    .onConflictDoNothing();
  res.status(201).json({ success: true });
});

router.get("/social/users/search", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res);
  if (viewerId === null) return;
  const query = String(req.query.q ?? "").trim();
  if (query.length < 2) {
    res.json({ users: [], posts: [] });
    return;
  }
  const blocked = await blockedUserIds(viewerId);
  const users = await db
    .select({ id: usersTable.id, name: usersTable.name, username: usersTable.username, bio: usersTable.bio, contactPermission: usersTable.contactPermission })
    .from(usersTable)
    .where(
      and(
        ne(usersTable.id, viewerId),
        or(
          ilike(usersTable.name, `%${query.slice(0, 80)}%`),
          ilike(usersTable.username, `%${query.slice(0, 80)}%`),
        ),
      ),
    )
    .orderBy(asc(usersTable.name))
    .limit(20);
  const visibleUsers = users
    .filter((user) => !blocked.has(user.id))
    .map((user) => ({
      id: user.id,
      name: user.name,
      username: handleForUser(user),
      bio: user.bio ?? "",
    }));
  const posts = await db
    .select()
    .from(socialPostsTable)
    .where(
      and(
        eq(socialPostsTable.deleted, false),
        ilike(socialPostsTable.content, `%${query.slice(0, 80)}%`),
      ),
    )
    .orderBy(desc(socialPostsTable.createdAt))
    .limit(20);
  const following = await followingUserIds(viewerId);
  const visiblePosts: SocialPost[] = [];
  for (const post of posts) {
    if (await canSeePost(viewerId, post, following, blocked)) visiblePosts.push(post);
  }
  res.json({ users: visibleUsers, posts: await serializePosts(visiblePosts, viewerId) });
});

router.get("/social/users/:userId/card", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res);
  const targetId = parseId(req.params.userId);
  if (viewerId === null || targetId === null) return;
  const [user] = await db
    .select({ id: usersTable.id, name: usersTable.name, username: usersTable.username, bio: usersTable.bio, contactPermission: usersTable.contactPermission })
    .from(usersTable)
    .where(eq(usersTable.id, targetId))
    .limit(1);
  if (!user || (await isBlocked(viewerId, targetId))) {
    res.status(404).json({ error: "User not found." });
    return;
  }
  const [followers, following, follow, muted] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(socialFollowsTable)
      .where(eq(socialFollowsTable.followingId, targetId)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(socialFollowsTable)
      .where(eq(socialFollowsTable.followerId, targetId)),
    db
      .select({ followerId: socialFollowsTable.followerId })
      .from(socialFollowsTable)
      .where(
        and(
          eq(socialFollowsTable.followerId, viewerId),
          eq(socialFollowsTable.followingId, targetId),
        ),
      )
      .limit(1),
    db
      .select({ muterId: socialMutesTable.muterId })
      .from(socialMutesTable)
      .where(
        and(
          eq(socialMutesTable.muterId, viewerId),
          eq(socialMutesTable.mutedUserId, targetId),
        ),
      )
      .limit(1),
  ]);
  res.json({
    id: user.id,
    name: user.name,
    username: handleForUser(user),
    bio: user.bio ?? "",
    followerCount: Number(followers[0]?.count ?? 0),
    followingCount: Number(following[0]?.count ?? 0),
    following: follow.length > 0,
    muted: muted.length > 0,
    canMessage: user.contactPermission !== "nobody" || user.id === viewerId,
  });
});

router.get("/social/users/:userId/posts", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res);
  const authorId = parseId(req.params.userId);
  if (viewerId === null || authorId === null) return;
  if (!(await userExists(authorId)) || await isBlocked(viewerId, authorId)) {
    res.status(404).json({ error: "User not found." });
    return;
  }
  const candidates = await db
    .select()
    .from(socialPostsTable)
    .where(
      and(
        eq(socialPostsTable.authorId, authorId),
        eq(socialPostsTable.deleted, false),
      ),
    )
    .orderBy(desc(socialPostsTable.createdAt))
    .limit(parseLimit(req.query.limit));
  const following = await followingUserIds(viewerId);
  const blocked = await blockedUserIds(viewerId);
  const visible = [];
  for (const post of candidates) {
    if (await canSeePost(viewerId, post, following, blocked)) visible.push(post);
  }
  res.json({ items: await serializePosts(visible, viewerId) });
});

router.get("/social/saved", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res);
  if (viewerId === null) return;
  const rows = await db
    .select({ post: socialPostsTable })
    .from(socialPostSavesTable)
    .innerJoin(socialPostsTable, eq(socialPostsTable.id, socialPostSavesTable.postId))
    .where(
      and(
        eq(socialPostSavesTable.userId, viewerId),
        eq(socialPostsTable.deleted, false),
      ),
    )
    .orderBy(desc(socialPostSavesTable.createdAt))
    .limit(50);
  const [following, blocked] = await Promise.all([followingUserIds(viewerId), blockedUserIds(viewerId)]);
  const visible: SocialPost[] = [];
  for (const { post } of rows) {
    if (await canSeePost(viewerId, post, following, blocked)) visible.push(post);
  }
  res.json({ items: await serializePosts(visible, viewerId) });
});

type Story = typeof socialStoriesTable.$inferSelect;

async function canSeeStory(viewerId: number, story: Story): Promise<boolean> {
  if (story.deleted || story.expiresAt <= Date.now()) return false;
  if (story.authorId === viewerId) return true;
  if (await isBlocked(viewerId, story.authorId)) return false;
  if (await isExcludedFromSharing(story.authorId, viewerId)) return false;
  if (story.visibility === "public") return true;
  if (story.visibility === "private") return false;
  const following = await followingUserIds(viewerId);
  if (story.visibility === "followers") return following.has(story.authorId);
  if (story.visibility === "close_friends") {
    const [member] = await db.select({ ownerId: socialCloseFriendsTable.ownerId }).from(socialCloseFriendsTable)
      .where(and(eq(socialCloseFriendsTable.ownerId, story.authorId), eq(socialCloseFriendsTable.memberId, viewerId))).limit(1);
    return Boolean(member);
  }
  if (!following.has(story.authorId)) return false;
  const [reciprocal] = await db.select({ followerId: socialFollowsTable.followerId }).from(socialFollowsTable)
    .where(and(eq(socialFollowsTable.followerId, story.authorId), eq(socialFollowsTable.followingId, viewerId))).limit(1);
  return Boolean(reciprocal);
}

async function storyById(storyId: number): Promise<Story | undefined> {
  const [story] = await db.select().from(socialStoriesTable).where(eq(socialStoriesTable.id, storyId)).limit(1);
  return story;
}

async function serializeStories(stories: Story[], viewerId: number) {
  if (!stories.length) return [];
  const storyIds = stories.map((story) => story.id);
  const authorIds = [...new Set(stories.map((story) => story.authorId))];
  const [authors, views, reactions, mine] = await Promise.all([
    db.select({ id: usersTable.id, name: usersTable.name, username: usersTable.username, bio: usersTable.bio }).from(usersTable).where(inArray(usersTable.id, authorIds)),
    db.select({ storyId: socialStoryViewersTable.storyId, count: sql<number>`count(*)` }).from(socialStoryViewersTable).where(inArray(socialStoryViewersTable.storyId, storyIds)).groupBy(socialStoryViewersTable.storyId),
    db.select({ storyId: socialStoryReactionsTable.storyId, count: sql<number>`count(*)` }).from(socialStoryReactionsTable).where(inArray(socialStoryReactionsTable.storyId, storyIds)).groupBy(socialStoryReactionsTable.storyId),
    db.select({ storyId: socialStoryViewersTable.storyId }).from(socialStoryViewersTable).where(and(eq(socialStoryViewersTable.viewerId, viewerId), inArray(socialStoryViewersTable.storyId, storyIds))),
  ]);
  const authorById = new Map(authors.map((author) => [author.id, author]));
  const viewsById = new Map(views.map((row) => [row.storyId, Number(row.count)]));
  const reactionsById = new Map(reactions.map((row) => [row.storyId, Number(row.count)]));
  const viewed = new Set(mine.map((row) => row.storyId));
  return stories.map((story) => {
    const author = authorById.get(story.authorId);
    return {
      id: story.id, kind: story.kind, content: story.content, visibility: story.visibility, media: story.media,
      createdAt: story.createdAt, expiresAt: story.expiresAt,
      location: story.latitude !== null && story.longitude !== null ? { latitude: story.latitude, longitude: story.longitude } : null,
      author: author ? publicUser(author) : { id: story.authorId, name: "Old Time user", username: `user${story.authorId}`, bio: "" },
      viewer: { viewed: viewed.has(story.id), isOwner: story.authorId === viewerId },
      counts: { views: viewsById.get(story.id) ?? 0, reactions: reactionsById.get(story.id) ?? 0 },
    };
  });
}

async function accessibleStory(req: Request, res: Response): Promise<{ viewerId: number; story: Story } | null> {
  const viewerId = await requireChatAuth(req, res);
  if (viewerId === null) return null;
  const storyId = parseId(req.params.storyId);
  if (storyId === null) {
    res.status(400).json({ error: "A valid story ID is required." });
    return null;
  }
  const story = await storyById(storyId);
  if (!story || !(await canSeeStory(viewerId, story))) {
    res.status(404).json({ error: "Story not found." });
    return null;
  }
  return { viewerId, story };
}

router.get("/social/stories", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res);
  if (viewerId === null) return;
  const candidates = await db.select().from(socialStoriesTable)
    .where(and(eq(socialStoriesTable.deleted, false), gt(socialStoriesTable.expiresAt, Date.now())))
    .orderBy(desc(socialStoriesTable.createdAt)).limit(200);
  const visible: Story[] = [];
  for (const story of candidates) if (await canSeeStory(viewerId, story)) visible.push(story);
  res.json({ items: await serializeStories(visible, viewerId) });
});

router.get("/social/stories/nearby", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res);
  if (viewerId === null) return;
  const latitude = parseGeoQuery(req.query.latitude);
  const longitude = parseGeoQuery(req.query.longitude);
  const radiusKm = Math.min(25, Math.max(0.25, parseGeoQuery(req.query.radiusKm) ?? 5));
  const limit = parseLimit(req.query.limit);
  if (latitude === null || latitude < -90 || latitude > 90 || longitude === null || longitude < -180 || longitude > 180) {
    res.status(400).json({ error: "A valid latitude and longitude are required." });
    return;
  }
  const latitudeDelta = radiusKm / 111;
  const longitudeDelta = radiusKm / (111 * Math.max(0.2, Math.cos(latitude * Math.PI / 180)));
  const candidates = await db.select().from(socialStoriesTable).where(and(
    eq(socialStoriesTable.deleted, false),
    gt(socialStoriesTable.expiresAt, Date.now()),
    gt(socialStoriesTable.latitude, latitude - latitudeDelta),
    lt(socialStoriesTable.latitude, latitude + latitudeDelta),
    gt(socialStoriesTable.longitude, longitude - longitudeDelta),
    lt(socialStoriesTable.longitude, longitude + longitudeDelta),
  )).orderBy(desc(socialStoriesTable.createdAt)).limit(200);
  const visible: Story[] = [];
  for (const story of candidates) {
    if (story.latitude === null || story.longitude === null || distanceKm({ latitude, longitude }, { latitude: story.latitude, longitude: story.longitude }) > radiusKm) continue;
    if (await canSeeStory(viewerId, story)) visible.push(story);
  }
  res.json({ items: (await serializeStories(visible, viewerId)).slice(0, limit) });
});

router.post("/social/stories", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res);
  const parsed = storyInput.safeParse(req.body);
  if (viewerId === null) return;
  if (!parsed.success || (!parsed.data.content && !parsed.data.media)) {
    res.status(400).json({ error: "Add text or media before publishing a story." }); return;
  }
  const input = parsed.data;
  const now = Date.now();
  const expiresAt = input.expiresAt ?? now + 24 * 60 * 60 * 1000;
  if (expiresAt <= now || expiresAt > now + 7 * 24 * 60 * 60 * 1000) {
    res.status(400).json({ error: "Story expiry must be in the next seven days." }); return;
  }
  let claimedUploadId: string | null = null;
  if (input.media) {
    if ((input.media.type === "image" && !input.media.mimeType.toLowerCase().startsWith("image/")) ||
      (input.media.type === "video" && !input.media.mimeType.toLowerCase().startsWith("video/"))) {
      res.status(400).json({ error: "Story media type must match its MIME type." }); return;
    }
    const [slot] = await db.update(uploadSlotsTable).set({ status: "committing" }).where(and(
      eq(uploadSlotsTable.objectPath, input.media.objectPath),
      eq(uploadSlotsTable.userId, viewerId),
      eq(uploadSlotsTable.status, "uploaded"),
      gt(uploadSlotsTable.expiresAt, now),
    )).returning();
    if (!slot || slot.contentType !== input.media.mimeType.toLowerCase()) {
      if (slot) await db.update(uploadSlotsTable).set({ status: "uploaded" }).where(eq(uploadSlotsTable.id, slot.id));
      res.status(400).json({ error: "Story media must be an uploaded file you own." }); return;
    }
    claimedUploadId = slot.id;
    try {
      const file = fileForObjectPath(slot.objectPath);
      const [[exists], [metadata]] = await Promise.all([file.exists(), file.getMetadata()]);
      const size = Number(metadata.size ?? 0);
      if (!exists || !Number.isFinite(size) || size < 1 || size > MAX_UPLOAD_BYTES ||
        (metadata.contentType ?? "").toLowerCase() !== slot.contentType) throw new Error("Invalid uploaded media");
    } catch {
      await db.update(uploadSlotsTable).set({ status: "uploaded" })
        .where(and(eq(uploadSlotsTable.id, slot.id), eq(uploadSlotsTable.status, "committing")));
      res.status(400).json({ error: "The uploaded story media could not be verified." }); return;
    }
  }
  let created: Story;
  try {
    [created] = await db.transaction(async (tx) => {
      const inserted = await tx.insert(socialStoriesTable).values({
        authorId: viewerId, kind: input.media?.type ?? "text", content: input.content,
         visibility: input.visibility, media: input.media ?? null,
         latitude: input.location?.latitude ?? null, longitude: input.location?.longitude ?? null,
         createdAt: now, expiresAt,
      }).returning();
      if (claimedUploadId) {
        const committed = await tx.update(uploadSlotsTable)
          .set({ status: "committed", referenceType: "social_story", referenceId: inserted[0].id })
          .where(and(eq(uploadSlotsTable.id, claimedUploadId), eq(uploadSlotsTable.status, "committing")))
          .returning({ id: uploadSlotsTable.id });
        if (committed.length !== 1) throw new Error("UPLOAD_COMMIT_CONFLICT");
      }
      return inserted;
    });
  } catch {
    if (claimedUploadId) await db.update(uploadSlotsTable).set({ status: "uploaded" })
      .where(and(eq(uploadSlotsTable.id, claimedUploadId), eq(uploadSlotsTable.status, "committing")));
    res.status(500).json({ error: "Unable to publish story." }); return;
  }
  res.status(201).json((await serializeStories([created], viewerId))[0]);
});

router.get("/social/stories/:storyId", async (req, res): Promise<void> => {
  const access = await accessibleStory(req, res); if (!access) return;
  res.json((await serializeStories([access.story], access.viewerId))[0]);
});
router.delete("/social/stories/:storyId", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res); if (viewerId === null) return;
  const storyId = parseId(req.params.storyId); if (storyId === null) { res.status(400).json({ error: "A valid story ID is required." }); return; }
  const [deleted] = await db.update(socialStoriesTable).set({ deleted: true }).where(and(eq(socialStoriesTable.id, storyId), eq(socialStoriesTable.authorId, viewerId), eq(socialStoriesTable.deleted, false))).returning({ id: socialStoriesTable.id });
  if (!deleted) { res.status(404).json({ error: "Story not found or not owned by you." }); return; }
  res.json({ success: true });
});
router.put("/social/stories/:storyId/view", async (req, res): Promise<void> => {
  const access = await accessibleStory(req, res); if (!access) return;
  if (access.story.authorId !== access.viewerId) await db.insert(socialStoryViewersTable).values({ storyId: access.story.id, viewerId: access.viewerId, viewedAt: Date.now() }).onConflictDoNothing();
  res.json({ success: true });
});
router.put("/social/stories/:storyId/reaction", async (req, res): Promise<void> => {
  const access = await accessibleStory(req, res); if (!access) return;
  const parsed = storyReactionInput.safeParse(req.body); if (!parsed.success) { res.status(400).json({ error: "Invalid reaction." }); return; }
  await db.insert(socialStoryReactionsTable).values({ storyId: access.story.id, userId: access.viewerId, reaction: parsed.data.reaction, createdAt: Date.now() }).onConflictDoUpdate({ target: [socialStoryReactionsTable.storyId, socialStoryReactionsTable.userId], set: { reaction: parsed.data.reaction, createdAt: Date.now() } });
  if (access.story.authorId !== access.viewerId) await db.insert(socialNotificationsTable).values({ recipientId: access.story.authorId, actorId: access.viewerId, type: "story_reaction", storyId: access.story.id, createdAt: Date.now() });
  res.json({ success: true, active: true });
});
router.delete("/social/stories/:storyId/reaction", async (req, res): Promise<void> => {
  const access = await accessibleStory(req, res); if (!access) return;
  await db.delete(socialStoryReactionsTable).where(and(eq(socialStoryReactionsTable.storyId, access.story.id), eq(socialStoryReactionsTable.userId, access.viewerId)));
  res.json({ success: true, active: false });
});
router.post("/social/stories/:storyId/replies", async (req, res): Promise<void> => {
  const access = await accessibleStory(req, res); if (!access) return;
  const parsed = storyReplyInput.safeParse(req.body); if (!parsed.success) { res.status(400).json({ error: "A valid reply is required." }); return; }
  const [reply] = await db.insert(socialStoryRepliesTable).values({ storyId: access.story.id, authorId: access.viewerId, content: parsed.data.content, createdAt: Date.now() }).returning();
  if (access.story.authorId !== access.viewerId) await db.insert(socialNotificationsTable).values({ recipientId: access.story.authorId, actorId: access.viewerId, type: "story_reply", storyId: access.story.id, replyId: reply.id, createdAt: Date.now() });
  res.status(201).json(reply);
});
router.get("/social/stories/:storyId/viewers", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res); if (viewerId === null) return;
  const storyId = parseId(req.params.storyId); if (storyId === null) { res.status(400).json({ error: "A valid story ID is required." }); return; }
  const story = await storyById(storyId);
  if (!story || story.authorId !== viewerId) { res.status(404).json({ error: "Story not found." }); return; }
  const viewers = await db.select({ id: usersTable.id, name: usersTable.name, username: usersTable.username, viewedAt: socialStoryViewersTable.viewedAt }).from(socialStoryViewersTable).innerJoin(usersTable, eq(usersTable.id, socialStoryViewersTable.viewerId)).where(eq(socialStoryViewersTable.storyId, storyId)).orderBy(desc(socialStoryViewersTable.viewedAt));
  res.json({ items: viewers.map((item) => ({ ...item, username: handleForUser(item) })) });
});

router.put("/social/close-friends/:userId", async (req, res): Promise<void> => {
  const target = await relationshipTarget(req, res); if (!target) return;
  await db.insert(socialCloseFriendsTable).values({ ownerId: target.viewerId, memberId: target.targetId, createdAt: Date.now() }).onConflictDoNothing();
  res.json({ success: true, active: true });
});
router.delete("/social/close-friends/:userId", async (req, res): Promise<void> => {
  const target = await relationshipTarget(req, res); if (!target) return;
  await db.delete(socialCloseFriendsTable).where(and(eq(socialCloseFriendsTable.ownerId, target.viewerId), eq(socialCloseFriendsTable.memberId, target.targetId)));
  res.json({ success: true, active: false });
});
router.get("/social/close-friends", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res); if (viewerId === null) return;
  const rows = await db.select({ id: usersTable.id, name: usersTable.name, username: usersTable.username, bio: usersTable.bio }).from(socialCloseFriendsTable).innerJoin(usersTable, eq(usersTable.id, socialCloseFriendsTable.memberId)).where(eq(socialCloseFriendsTable.ownerId, viewerId));
  res.json({ items: rows.map((row) => ({ ...row, username: handleForUser(row), bio: row.bio ?? "" })) });
});

router.post("/social/highlights", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res); const parsed = z.object({ title: z.string().trim().min(1).max(80), coverObjectPath: z.string().max(500).nullable().optional() }).safeParse(req.body); if (viewerId === null || !parsed.success) { if (!parsed.success) res.status(400).json({ error: "A highlight title is required." }); return; }
  const now = Date.now(); const [highlight] = await db.insert(socialHighlightsTable).values({ ownerId: viewerId, title: parsed.data.title, coverObjectPath: parsed.data.coverObjectPath ?? null, createdAt: now, updatedAt: now }).returning(); res.status(201).json(highlight);
});
router.put("/social/highlights/:highlightId/stories/:storyId", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res); if (viewerId === null) return;
  const highlightId = parseId(req.params.highlightId); const storyId = parseId(req.params.storyId);
  if (highlightId === null || storyId === null) { res.status(400).json({ error: "Valid highlight and story IDs are required." }); return; }
  const [highlight] = await db.select().from(socialHighlightsTable).where(and(eq(socialHighlightsTable.id, highlightId), eq(socialHighlightsTable.ownerId, viewerId), eq(socialHighlightsTable.deleted, false))).limit(1);
  const story = await storyById(storyId);
  if (!highlight || !story || story.authorId !== viewerId) { res.status(404).json({ error: "Highlight or owned story not found." }); return; }
  await db.insert(socialHighlightItemsTable).values({ highlightId, storyId, addedAt: Date.now() }).onConflictDoNothing(); await db.update(socialHighlightsTable).set({ updatedAt: Date.now() }).where(eq(socialHighlightsTable.id, highlightId)); res.json({ success: true });
});
router.delete("/social/highlights/:highlightId/stories/:storyId", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res); if (viewerId === null) return;
  const highlightId = parseId(req.params.highlightId); const storyId = parseId(req.params.storyId);
  if (highlightId === null || storyId === null) { res.status(400).json({ error: "Valid highlight and story IDs are required." }); return; }
  const [highlight] = await db.select({ id: socialHighlightsTable.id }).from(socialHighlightsTable).where(and(eq(socialHighlightsTable.id, highlightId), eq(socialHighlightsTable.ownerId, viewerId), eq(socialHighlightsTable.deleted, false))).limit(1); if (!highlight) { res.status(404).json({ error: "Highlight not found." }); return; }
  await db.delete(socialHighlightItemsTable).where(and(eq(socialHighlightItemsTable.highlightId, highlightId), eq(socialHighlightItemsTable.storyId, storyId))); res.json({ success: true });
});
router.get("/social/highlights", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res); if (viewerId === null) return;
  const highlights = await db.select().from(socialHighlightsTable).where(and(eq(socialHighlightsTable.ownerId, viewerId), eq(socialHighlightsTable.deleted, false))).orderBy(desc(socialHighlightsTable.updatedAt));
  const ids = highlights.map((row) => row.id); const items = ids.length ? await db.select().from(socialHighlightItemsTable).where(inArray(socialHighlightItemsTable.highlightId, ids)) : [];
  res.json({ items: highlights.map((highlight) => ({ ...highlight, storyIds: items.filter((item) => item.highlightId === highlight.id).map((item) => item.storyId) })) });
});
router.get("/social/notifications", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res); if (viewerId === null) return;
  const rows = await db.select({ notification: socialNotificationsTable, name: usersTable.name, username: usersTable.username, bio: usersTable.bio }).from(socialNotificationsTable).innerJoin(usersTable, eq(usersTable.id, socialNotificationsTable.actorId)).where(eq(socialNotificationsTable.recipientId, viewerId)).orderBy(desc(socialNotificationsTable.createdAt)).limit(parseLimit(req.query.limit));
  res.json({ items: rows.map(({ notification, name, username, bio }) => ({ ...notification, actor: { id: notification.actorId, name, username: handleForUser({ id: notification.actorId, name, username }), bio: bio ?? "" } })) });
});
router.put("/social/notifications/:notificationId/read", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res); if (viewerId === null) return;
  const notificationId = parseId(req.params.notificationId); if (notificationId === null) { res.status(400).json({ error: "A valid notification ID is required." }); return; }
  await db.update(socialNotificationsTable).set({ readAt: Date.now() }).where(and(eq(socialNotificationsTable.id, notificationId), eq(socialNotificationsTable.recipientId, viewerId))); res.json({ success: true });
});
router.post("/social/stories/cleanup", async (req, res): Promise<void> => {
  const viewerId = await requireChatAuth(req, res); if (viewerId === null) return;
  const result = await db.update(socialStoriesTable).set({ deleted: true }).where(and(eq(socialStoriesTable.authorId, viewerId), eq(socialStoriesTable.deleted, false), lt(socialStoriesTable.expiresAt, Date.now()))).returning({ id: socialStoriesTable.id });
  res.json({ success: true, removed: result.length });
});

export default router;