import { Router, type IRouter } from "express";
import chatRouter from "./chat";
import healthRouter from "./health";
import storageRouter from "./storage";
import socialRouter from "./social";
import mapRouter from "./map";
import currentEventsRouter from "./current-events";

const router: IRouter = Router();

router.use(healthRouter);
router.use(chatRouter);
router.use(storageRouter);
router.use(socialRouter);
router.use(mapRouter);
router.use(currentEventsRouter);

export default router;
