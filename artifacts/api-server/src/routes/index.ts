import { Router, type IRouter } from "express";
import chatRouter from "./chat";
import healthRouter from "./health";
import storageRouter from "./storage";
import socialRouter from "./social";
import mapRouter from "./map";
import currentEventsRouter from "./current-events";
import discoveryRouter from "./discovery";
import callsRouter from "./calls";
import authBirthdayRouter from "./auth-birthday";

const router: IRouter = Router();

router.use(healthRouter);
// Firebase-safe birthday completion must win over the legacy handler in chat.ts.
router.use(authBirthdayRouter);
router.use(chatRouter);
router.use(storageRouter);
router.use(socialRouter);
router.use(mapRouter);
router.use(currentEventsRouter);
router.use(discoveryRouter);
router.use(callsRouter);

export default router;
