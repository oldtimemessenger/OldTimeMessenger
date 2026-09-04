import { Router, type IRouter } from "express";
import chatRouter from "./chat";
import healthRouter from "./health";
import storageRouter from "./storage";
import socialRouter from "./social";
import mapRouter from "./map";
import currentEventsRouter from "./current-events";
import discoveryRouter from "./discovery";
import callsRouter from "./calls";

const router: IRouter = Router();

router.use(healthRouter);
router.use(chatRouter);
router.use(storageRouter);
router.use(socialRouter);
router.use(mapRouter);
router.use(currentEventsRouter);
router.use(discoveryRouter);
router.use(callsRouter);

export default router;
