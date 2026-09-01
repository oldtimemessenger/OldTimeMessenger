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
  usersTable,
} from "@workspace/db";
import { requireChatAuth } from "../lib/chat-auth";

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
  visibility: postVisibility.default("public"),
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

type SocialPost = typeof socialPostsTable.$inferSelect;

function parseId(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseLimit(value: unknown): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.min(30, Math.max(1, parsed)) : 20;
}

function handleForUser(user: { id: number; name: string }): string {
  const normalized = user.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 18);
  return normalized || `user${user.id}`;
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

async function postById(postId: number): Promise<SocialPost | undefined> {
  const [post] = await db
    .select()
    .from(socialPostsTable)
    .where(and(eq(socialPostsTable.id, postId), eq(socialPostsTable.deleted, false)))
    .limit(1);
  return post;
}

async function canSeePost(
  viewerId: number,
  post: SocialPost,
  following: Set<number>,
  blocked: Set<number>,
): Promise<boolean> {
  if (blocked.has(post.authorId)) return false;
  if (post.authorId === viewerId || post.visibility === "public") return true;
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
        .select({ id: usersTable.id, name: usersTable.name })
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
  const timestamp = Date.now();
  const [created] = await db
    .insert(socialPostsTable)
    .values({
      authorId: viewerId,
      kind: input.kind,
      content: input.content,
      visibility: input.visibility,
      media: input.media ?? null,
      linkUrl: input.linkUrl ?? null,
      linkTitle: input.linkTitle ?? null,
      linkDescription: input.linkDescription ?? null,
      linkImageUrl: input.linkImageUrl ?? null,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    .returning();
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
  const post = await postById(postId);
  if (!post || (await isBlocked(viewerId, post.authorId))) {
    res.status(404).json({ error: "Post not found." });
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
        username: handleForUser({ id: comment.authorId, name: comment.authorName }),
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
  const [comment] = await db
    .select({ id: socialCommentsTable.id })
    .from(socialCommentsTable)
    .where(and(eq(socialCommentsTable.id, commentId), eq(socialCommentsTable.deleted, false)))
    .limit(1);
  if (!comment) {
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
    .select({ id: usersTable.id, name: usersTable.name })
    .from(usersTable)
    .where(
      and(
        ne(usersTable.id, viewerId),
        ilike(usersTable.name, `%${query.slice(0, 80)}%`),
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
    .select({ id: usersTable.id, name: usersTable.name })
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
    followerCount: Number(followers[0]?.count ?? 0),
    followingCount: Number(following[0]?.count ?? 0),
    following: follow.length > 0,
    muted: muted.length > 0,
    canMessage: true,
  });
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
  res.json({ items: await serializePosts(rows.map((row) => row.post), viewerId) });
});

export default router;