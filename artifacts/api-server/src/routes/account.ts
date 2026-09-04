import { and, eq, inArray, or } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  authChallengesTable, authSessionsTable, chatMessageRequestsTable, chatNotesTable,
  chatParticipantsTable, callsTable, currentEventParticipantsTable, currentEventWalletsTable,
  db, discoveryCreatorClaimsTable, mapPinCommentsTable,
  mapPinReactionsTable, mapPinReportsTable, mapPinSavesTable, mapPinsTable, messagesTable,
  pushTokensTable, socialBlocksTable, socialCloseFriendsTable, socialCommentLikesTable,
  socialCommentsTable, socialFollowsTable, socialHighlightItemsTable, socialHighlightsTable,
  socialMutesTable, socialNotificationsTable, socialPostLikesTable, socialPostRepostsTable,
  socialPostSavesTable, socialPostsTable, socialReportsTable, socialSharingExclusionsTable,
  socialStoriesTable, socialStoryReactionsTable, socialStoryRepliesTable,
  socialStoryViewersTable, uploadSlotsTable, usersTable,
} from "@workspace/db";
import { requireChatAuth } from "../lib/chat-auth";
import { deleteObject } from "../lib/chat-storage";
import { deleteFirebaseAuthUser, verifyFirebaseIdToken } from "../lib/firebase-auth";
import { deleteSupabaseProfileByFirebaseUid } from "../lib/supabase-profiles";

const router: IRouter = Router();
const sharedVisibilities = ["public", "followers", "friends", "close_friends"] as const;

function tokenFromBody(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const value = (body as Record<string, unknown>).firebaseIdToken
    ?? (body as Record<string, unknown>).idToken;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

router.delete("/account", async (req, res): Promise<void> => {
  const userId = await requireChatAuth(req, res);
  if (userId === null) return;
  try {
    const [user] = await db.select({ firebaseUid: usersTable.firebaseUid, phone: usersTable.phone })
      .from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user?.firebaseUid) {
      res.status(409).json({ error: "This account cannot be deleted because its Firebase identity is unavailable." });
      return;
    }
    const token = tokenFromBody(req.body);
    if (!token) {
      res.status(400).json({ error: "A fresh Firebase identity token is required." });
      return;
    }
    let firebaseIdentity;
    try {
      firebaseIdentity = await verifyFirebaseIdToken(token);
    } catch {
      res.status(401).json({ error: "The Firebase identity token is invalid or expired." });
      return;
    }
    if (firebaseIdentity.uid !== user.firebaseUid) {
      res.status(403).json({ error: "The Firebase identity does not match the authenticated account." });
      return;
    }

    const [slots, messages, privatePosts, sharedPosts, privateStories, sharedStories, highlights, privatePins] = await Promise.all([
      db.select({ objectPath: uploadSlotsTable.objectPath }).from(uploadSlotsTable).where(eq(uploadSlotsTable.userId, userId)),
      db.select({ attachment: messagesTable.attachment }).from(messagesTable).where(eq(messagesTable.senderId, userId)),
      db.select({ id: socialPostsTable.id, media: socialPostsTable.media }).from(socialPostsTable).where(and(eq(socialPostsTable.authorId, userId), eq(socialPostsTable.visibility, "private"))),
      db.select({ media: socialPostsTable.media }).from(socialPostsTable).where(and(eq(socialPostsTable.authorId, userId), inArray(socialPostsTable.visibility, sharedVisibilities))),
      db.select({ id: socialStoriesTable.id, media: socialStoriesTable.media }).from(socialStoriesTable).where(and(eq(socialStoriesTable.authorId, userId), eq(socialStoriesTable.visibility, "private"))),
      db.select({ media: socialStoriesTable.media }).from(socialStoriesTable).where(and(eq(socialStoriesTable.authorId, userId), inArray(socialStoriesTable.visibility, sharedVisibilities))),
      db.select({ id: socialHighlightsTable.id }).from(socialHighlightsTable).where(eq(socialHighlightsTable.ownerId, userId)),
      db.select({ id: mapPinsTable.id }).from(mapPinsTable).where(and(eq(mapPinsTable.authorId, userId), eq(mapPinsTable.visibility, "private"))),
    ]);
    const paths = new Set<string>([
      ...slots.map((row) => row.objectPath),
      ...privatePosts.flatMap((row) => row.media?.map((media) => media.objectPath) ?? []),
      ...privateStories.flatMap((row) => row.media?.objectPath ? [row.media.objectPath] : []),
    ]);
    const retained = new Set<string>([
      ...messages.flatMap((row) => row.attachment?.objectPath ? [row.attachment.objectPath] : []),
      ...sharedPosts.flatMap((row) => row.media?.map((media) => media.objectPath) ?? []),
      ...sharedStories.flatMap((row) => row.media?.objectPath ? [row.media.objectPath] : []),
    ]);
    await Promise.all([...paths].filter((path) => !retained.has(path)).map(deleteObject));

    // Remove private data first, but preserve the authenticated identity and
    // current sessions until external deletion succeeds so failures are retryable.
    await db.transaction(async (tx) => {
      const postIds = privatePosts.map((row) => row.id);
      const storyIds = privateStories.map((row) => row.id);
      const highlightIds = highlights.map((row) => row.id);
      const pinIds = privatePins.map((row) => row.id);
      if (highlightIds.length) await tx.delete(socialHighlightItemsTable).where(inArray(socialHighlightItemsTable.highlightId, highlightIds));
      if (storyIds.length) {
        await tx.delete(socialHighlightItemsTable).where(inArray(socialHighlightItemsTable.storyId, storyIds));
        await tx.delete(socialStoryViewersTable).where(inArray(socialStoryViewersTable.storyId, storyIds));
        await tx.delete(socialStoryReactionsTable).where(inArray(socialStoryReactionsTable.storyId, storyIds));
        await tx.delete(socialStoryRepliesTable).where(inArray(socialStoryRepliesTable.storyId, storyIds));
      }
      if (postIds.length) {
        await tx.delete(socialCommentLikesTable).where(inArray(socialCommentLikesTable.commentId, tx.select({ id: socialCommentsTable.id }).from(socialCommentsTable).where(inArray(socialCommentsTable.postId, postIds))));
        await tx.delete(socialCommentsTable).where(inArray(socialCommentsTable.postId, postIds));
        await tx.delete(socialPostLikesTable).where(inArray(socialPostLikesTable.postId, postIds));
        await tx.delete(socialPostRepostsTable).where(inArray(socialPostRepostsTable.postId, postIds));
        await tx.delete(socialPostSavesTable).where(inArray(socialPostSavesTable.postId, postIds));
      }
      if (pinIds.length) {
        await tx.delete(mapPinCommentsTable).where(inArray(mapPinCommentsTable.pinId, pinIds));
        await tx.delete(mapPinReactionsTable).where(inArray(mapPinReactionsTable.pinId, pinIds));
        await tx.delete(mapPinSavesTable).where(inArray(mapPinSavesTable.pinId, pinIds));
        await tx.delete(mapPinReportsTable).where(inArray(mapPinReportsTable.pinId, pinIds));
      }
      await tx.delete(socialHighlightsTable).where(eq(socialHighlightsTable.ownerId, userId));
      await tx.delete(chatNotesTable).where(eq(chatNotesTable.ownerId, userId));
      await tx.delete(chatParticipantsTable).where(eq(chatParticipantsTable.userId, userId));
      await tx.delete(chatMessageRequestsTable).where(or(eq(chatMessageRequestsTable.senderId, userId), eq(chatMessageRequestsTable.recipientId, userId)));
      await tx.delete(uploadSlotsTable).where(eq(uploadSlotsTable.userId, userId));
      await tx.delete(socialPostLikesTable).where(eq(socialPostLikesTable.userId, userId));
      await tx.delete(socialPostRepostsTable).where(eq(socialPostRepostsTable.userId, userId));
      await tx.delete(socialPostSavesTable).where(eq(socialPostSavesTable.userId, userId));
      await tx.delete(socialCommentLikesTable).where(eq(socialCommentLikesTable.userId, userId));
      await tx.delete(socialStoryViewersTable).where(eq(socialStoryViewersTable.viewerId, userId));
      await tx.delete(socialStoryReactionsTable).where(eq(socialStoryReactionsTable.userId, userId));
      await tx.delete(socialFollowsTable).where(or(eq(socialFollowsTable.followerId, userId), eq(socialFollowsTable.followingId, userId)));
      await tx.delete(socialBlocksTable).where(or(eq(socialBlocksTable.blockerId, userId), eq(socialBlocksTable.blockedId, userId)));
      await tx.delete(socialMutesTable).where(or(eq(socialMutesTable.muterId, userId), eq(socialMutesTable.mutedUserId, userId)));
      await tx.delete(socialCloseFriendsTable).where(or(eq(socialCloseFriendsTable.ownerId, userId), eq(socialCloseFriendsTable.memberId, userId)));
      await tx.delete(socialSharingExclusionsTable).where(or(eq(socialSharingExclusionsTable.ownerId, userId), eq(socialSharingExclusionsTable.excludedUserId, userId)));
      await tx.delete(socialReportsTable).where(eq(socialReportsTable.reporterId, userId));
      await tx.delete(socialNotificationsTable).where(or(eq(socialNotificationsTable.recipientId, userId), eq(socialNotificationsTable.actorId, userId)));
      await tx.delete(socialPostsTable).where(and(eq(socialPostsTable.authorId, userId), eq(socialPostsTable.visibility, "private")));
      await tx.delete(socialStoriesTable).where(and(eq(socialStoriesTable.authorId, userId), eq(socialStoriesTable.visibility, "private")));
      await tx.delete(mapPinReactionsTable).where(eq(mapPinReactionsTable.userId, userId));
      await tx.delete(mapPinSavesTable).where(eq(mapPinSavesTable.userId, userId));
      await tx.delete(mapPinReportsTable).where(eq(mapPinReportsTable.reporterId, userId));
      await tx.delete(mapPinsTable).where(and(eq(mapPinsTable.authorId, userId), eq(mapPinsTable.visibility, "private")));
      await tx.delete(callsTable).where(or(eq(callsTable.callerId, userId), eq(callsTable.calleeId, userId)));
      await tx.delete(currentEventParticipantsTable).where(eq(currentEventParticipantsTable.userId, userId));
      await tx.delete(currentEventWalletsTable).where(eq(currentEventWalletsTable.userId, userId));
      await tx.delete(discoveryCreatorClaimsTable).where(eq(discoveryCreatorClaimsTable.claimantId, userId));
      await tx.delete(pushTokensTable).where(eq(pushTokensTable.userId, userId));
    });

    await deleteSupabaseProfileByFirebaseUid(user.firebaseUid);
    await deleteFirebaseAuthUser(user.firebaseUid);

    await db.transaction(async (tx) => {
      await tx.delete(authSessionsTable).where(eq(authSessionsTable.userId, userId));
      await tx.delete(authChallengesTable).where(eq(authChallengesTable.phone, user.phone));
      await tx.update(usersTable).set({ phone: `deleted:${userId}`, phoneDiscoveryHash: null, phoneVerified: false, firebaseUid: null, email: null, name: "Deleted user", username: `deleted-${userId}`, bio: "", birthday: null, contactPermission: "nobody", online: false, lastSeenVisible: false }).where(eq(usersTable.id, userId));
    });
    res.status(204).end();
  } catch (error) {
    req.log.error({ err: error, userId }, "Account deletion failed");
    res.status(500).json({ error: "Account deletion did not complete. Please contact support." });
  }
});

export default router;