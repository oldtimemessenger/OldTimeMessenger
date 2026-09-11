import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { z } from "@workspace/api-zod";
import { db, usersTable } from "@workspace/db";
import { requireChatAuth } from "../lib/chat-auth";

const router: IRouter = Router();
const verificationInput = z.object({ approved: z.boolean() });

function configuredSystemAdminIds(): Set<number> {
  return new Set(
    (process.env.OLD_TIME_SYSTEM_ADMIN_IDS ?? "")
      .split(",")
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value) && value > 0),
  );
}

async function requireSystemAdmin(req: Request, res: Response): Promise<number | null> {
  const viewerId = await requireChatAuth(req, res);
  if (viewerId === null) return null;
  if (!configuredSystemAdminIds().has(viewerId)) {
    res.status(403).json({ error: "System-admin approval is required." });
    return null;
  }
  return viewerId;
}

router.put("/admin/users/:userId/verification", async (req, res): Promise<void> => {
  const adminId = await requireSystemAdmin(req, res);
  const userId = Number(req.params.userId);
  const parsed = verificationInput.safeParse(req.body);
  if (adminId === null) return;
  if (!Number.isInteger(userId) || userId <= 0 || !parsed.success) {
    res.status(400).json({ error: "A valid user ID and approval value are required." });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set(
      parsed.data.approved
        ? { verificationApprovedAt: Date.now(), verificationApprovedBy: adminId }
        : { verificationApprovedAt: null, verificationApprovedBy: null },
    )
    .where(eq(usersTable.id, userId))
    .returning({
      id: usersTable.id,
      verificationApprovedAt: usersTable.verificationApprovedAt,
      verificationApprovedBy: usersTable.verificationApprovedBy,
    });
  if (!updated) {
    res.status(404).json({ error: "User not found." });
    return;
  }
  res.json({
    id: updated.id,
    approved: updated.verificationApprovedAt !== null,
    approvedAt: updated.verificationApprovedAt,
    approvedBy: updated.verificationApprovedBy,
  });
});

export default router;