import { Router, type IRouter } from "express";
import chatRouter from "./chat";
import healthRouter from "./health";
import storageRouter from "./storage";
import socialRouter from "./social";

const router: IRouter = Router();

router.use(healthRouter);
router.use(chatRouter);
router.use(storageRouter);
router.use(socialRouter);

export default router;
