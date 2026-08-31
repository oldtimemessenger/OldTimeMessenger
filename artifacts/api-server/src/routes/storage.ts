import { RequestUploadUrlBody, RequestUploadUrlResponse } from "@workspace/api-zod";
import { randomUUID } from "node:crypto";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { and, eq, gt } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  chatParticipantsTable,
  db,
  messagesTable,
  uploadSlotsTable,
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
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

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
  if (!messages.some((message) => message.attachment?.objectPath === objectPath)) {
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