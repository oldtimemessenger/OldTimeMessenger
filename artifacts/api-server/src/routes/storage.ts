import { RequestUploadUrlBody, RequestUploadUrlResponse } from "@workspace/api-zod";
import { randomUUID } from "node:crypto";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { and, eq, gt, or, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  chatParticipantsTable,
  db,
  messagesTable,
  socialBlocksTable,
  socialCloseFriendsTable,
  socialFollowsTable,
  socialPostsTable,
  socialSharingExclusionsTable,
  socialStoriesTable,
  uploadSlotsTable,
  usersTable,
} from "@workspace/db";
import { requireChatAuth } from "../lib/chat-auth";
import { fileForObjectPath, MAX_UPLOAD_BYTES } from "../lib/chat-storage";

const router: IRouter = Router();
const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/aac",
  "audio/webm",
  "audio/ogg",
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

async function canSeePostMedia(userId: number, post: typeof socialPostsTable.$inferSelect): Promise<boolean> {
  const [block, follow, exclusion] = await Promise.all([
    db.select({ blockerId: socialBlocksTable.blockerId }).from(socialBlocksTable).where(or(
      and(eq(socialBlocksTable.blockerId, userId), eq(socialBlocksTable.blockedId, post.authorId)),
      and(eq(socialBlocksTable.blockerId, post.authorId), eq(socialBlocksTable.blockedId, userId)),
    )).limit(1),
    db.select({ followingId: socialFollowsTable.followingId }).from(socialFollowsTable)
      .where(and(eq(socialFollowsTable.followerId, userId), eq(socialFollowsTable.followingId, post.authorId))).limit(1),
    db.select({ ownerId: socialSharingExclusionsTable.ownerId }).from(socialSharingExclusionsTable)
      .where(and(eq(socialSharingExclusionsTable.ownerId, post.authorId), eq(socialSharingExclusionsTable.excludedUserId, userId))).limit(1),
  ]);
  if (block.length || exclusion.length) return false;
  if (post.authorId === userId || post.visibility === "public") return true;
  if (post.visibility === "private" || !follow.length) return false;
  if (post.visibility === "followers") return true;
  const [reciprocal] = await db.select({ followerId: socialFollowsTable.followerId }).from(socialFollowsTable)
    .where(and(eq(socialFollowsTable.followerId, post.authorId), eq(socialFollowsTable.followingId, userId))).limit(1);
  return Boolean(reciprocal);
}

router.post("/storage/uploads/request-url", async (req, res): Promise<void> => {
  const userId = await requireChatAuth(req, res);
  if (userId === null) return;
  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid upload metadata." });
    return;
  }
  if (parsed.data.size > MAX_UPLOAD_BYTES) {
    res.status(413).json({ error: "Attachments must be 25 MB or smaller." });
    return;
  }
  if (!ALLOWED_CONTENT_TYPES.has(parsed.data.contentType.toLowerCase())) {
    res.status(415).json({ error: "This attachment type is not supported." });
    return;
  }
  try {
    const uploadId = randomUUID();
    const objectPath = `/objects/uploads/${uploadId}`;
    await db.insert(uploadSlotsTable).values({
      id: uploadId,
      userId,
      objectPath,
      contentType: parsed.data.contentType.toLowerCase(),
      declaredSize: parsed.data.size,
      status: "issued",
      createdAt: Date.now(),
      expiresAt: Date.now() + 15 * 60 * 1000,
    });
    const value = {
      uploadURL: `/api/storage/uploads/${uploadId}`,
      objectPath,
    };
    res.json(RequestUploadUrlResponse.parse(value));
  } catch (error) {
    req.log.error({ err: error }, "Unable to create media upload URL");
    res.status(500).json({ error: "Unable to create media upload URL." });
  }
});

router.put("/storage/uploads/:uploadId", async (req, res): Promise<void> => {
  const userId = await requireChatAuth(req, res);
  if (userId === null) return;
  const uploadId = Array.isArray(req.params.uploadId) ? req.params.uploadId[0] : req.params.uploadId;
  const [slot] = await db
    .update(uploadSlotsTable)
    .set({ status: "uploading" })
    .where(
      and(
        eq(uploadSlotsTable.id, uploadId),
        eq(uploadSlotsTable.userId, userId),
        eq(uploadSlotsTable.status, "issued"),
        gt(uploadSlotsTable.expiresAt, Date.now()),
      ),
    )
    .returning();
  if (!slot) {
    res.status(404).json({ error: "Upload slot not found or expired." });
    return;
  }
  if ((req.header("content-type") ?? "").split(";")[0].toLowerCase() !== slot.contentType) {
    res.status(415).json({ error: "The upload content type does not match the request." });
    return;
  }

  const file = fileForObjectPath(slot.objectPath);
  let received = 0;
  const limiter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      received += chunk.length;
      if (received > MAX_UPLOAD_BYTES || received > slot.declaredSize) {
        callback(new Error("UPLOAD_TOO_LARGE"));
        return;
      }
      callback(null, chunk);
    },
  });

  try {
    await pipeline(
      req,
      limiter,
      file.createWriteStream({
        resumable: false,
        metadata: { contentType: slot.contentType },
      }),
    );
    if (received < 1) {
      await file.delete({ ignoreNotFound: true });
      await db.delete(uploadSlotsTable).where(eq(uploadSlotsTable.id, slot.id));
      res.status(400).json({ error: "The uploaded file was empty." });
      return;
    }
    await db
      .update(uploadSlotsTable)
      .set({ status: "uploaded" })
      .where(eq(uploadSlotsTable.id, slot.id));
    res.status(204).end();
  } catch (error) {
    await file.delete({ ignoreNotFound: true }).catch(() => undefined);
    await db.delete(uploadSlotsTable).where(eq(uploadSlotsTable.id, slot.id));
    if (error instanceof Error && error.message === "UPLOAD_TOO_LARGE") {
      res.status(413).json({ error: "Upload exceeded its declared size or the 25 MB limit." });
      return;
    }
    req.log.error({ err: error }, "Unable to store media upload");
    res.status(500).json({ error: "Unable to store media upload." });
  }
});

// Profile images are deliberately readable without a session so native image
// components can render social cards. Uploading and assigning the object path
// remain authenticated and ownership-checked by the profile endpoint.
router.get("/storage/profile-images/*objectPath", async (req, res): Promise<void> => {
  const raw = req.params.objectPath;
  const key = Array.isArray(raw) ? raw.join("/") : raw;
  const objectPath = `/objects/${key}`;
  const [owner] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.avatarObjectPath, objectPath))
    .limit(1);
  if (!owner) {
    res.status(404).json({ error: "Profile image not found." });
    return;
  }
  try {
    const file = fileForObjectPath(objectPath);
    const [exists] = await file.exists();
    if (!exists) {
      res.status(404).json({ error: "Profile image not found." });
      return;
    }
    const [metadata] = await file.getMetadata();
    res.setHeader("Content-Type", metadata.contentType || "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=3600");
    file.createReadStream().pipe(res);
  } catch (error) {
    req.log.error({ err: error, objectPath }, "Unable to serve profile image");
    res.status(500).json({ error: "Unable to serve profile image." });
  }
});

router.get("/storage/objects/*objectPath", async (req, res): Promise<void> => {
  const userId = await requireChatAuth(req, res);
  if (userId === null) return;
  const raw = req.params.objectPath;
  const key = Array.isArray(raw) ? raw.join("/") : raw;
  const objectPath = `/objects/${key}`;
  const messages = await db
    .select({ id: messagesTable.id, attachment: messagesTable.attachment })
    .from(messagesTable)
    .innerJoin(chatParticipantsTable, eq(chatParticipantsTable.chatId, messagesTable.chatId))
    .where(eq(chatParticipantsTable.userId, userId));
  const chatAuthorized = messages.some((message) => message.attachment?.objectPath === objectPath);
  const [story] = await db
    .select()
    .from(socialStoriesTable)
    .where(and(
      eq(socialStoriesTable.deleted, false),
      gt(socialStoriesTable.expiresAt, Date.now()),
      sql`${socialStoriesTable.media}->>'objectPath' = ${objectPath}`,
    ))
    .limit(1);
  let storyAuthorized = false;
  if (story) {
    if (story.authorId === userId) {
      storyAuthorized = true;
    } else {
      const [block, follows, reciprocal, closeFriend, exclusion] = await Promise.all([
        db.select({ blockerId: socialBlocksTable.blockerId }).from(socialBlocksTable).where(or(
          and(eq(socialBlocksTable.blockerId, userId), eq(socialBlocksTable.blockedId, story.authorId)),
          and(eq(socialBlocksTable.blockerId, story.authorId), eq(socialBlocksTable.blockedId, userId)),
        )).limit(1),
        db.select({ followerId: socialFollowsTable.followerId }).from(socialFollowsTable).where(and(eq(socialFollowsTable.followerId, userId), eq(socialFollowsTable.followingId, story.authorId))).limit(1),
        db.select({ followerId: socialFollowsTable.followerId }).from(socialFollowsTable).where(and(eq(socialFollowsTable.followerId, story.authorId), eq(socialFollowsTable.followingId, userId))).limit(1),
        db.select({ ownerId: socialCloseFriendsTable.ownerId }).from(socialCloseFriendsTable).where(and(eq(socialCloseFriendsTable.ownerId, story.authorId), eq(socialCloseFriendsTable.memberId, userId))).limit(1),
        db.select({ ownerId: socialSharingExclusionsTable.ownerId }).from(socialSharingExclusionsTable).where(and(eq(socialSharingExclusionsTable.ownerId, story.authorId), eq(socialSharingExclusionsTable.excludedUserId, userId))).limit(1),
      ]);
      if (!block.length && !exclusion.length) {
        storyAuthorized = story.visibility === "public"
          || (story.visibility === "followers" && follows.length > 0)
          || (story.visibility === "friends" && follows.length > 0 && reciprocal.length > 0)
          || (story.visibility === "close_friends" && closeFriend.length > 0);
      }
    }
  }
  const posts = await db.select().from(socialPostsTable).where(and(
    eq(socialPostsTable.deleted, false),
    sql`exists (select 1 from jsonb_array_elements(coalesce(${socialPostsTable.media}, '[]'::jsonb)) media where media->>'objectPath' = ${objectPath})`,
  ));
  let postAuthorized = false;
  for (const post of posts) {
    if (await canSeePostMedia(userId, post)) {
      postAuthorized = true;
      break;
    }
  }
  if (!chatAuthorized && !storyAuthorized && !postAuthorized) {
    res.status(403).json({ error: "You cannot access this attachment." });
    return;
  }
  try {
    const file = fileForObjectPath(objectPath);
    const [exists] = await file.exists();
    if (!exists) {
      res.status(404).json({ error: "Attachment not found." });
      return;
    }
    const [metadata] = await file.getMetadata();
    res.setHeader("Content-Type", metadata.contentType || "application/octet-stream");
    file.createReadStream().pipe(res);
  } catch (error) {
    req.log.error({ err: error }, "Unable to serve media attachment");
    res.status(500).json({ error: "Unable to serve attachment." });
  }
});

export default router;