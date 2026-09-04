import { Router, type IRouter } from "express";
import { handleCompleteBirthday } from "../lib/complete-birthday-handler";

const router: IRouter = Router();

// Mounted before chat.ts so the Firebase-safe implementation wins.
router.post("/auth/complete-birthday", handleCompleteBirthday);

export default router;
