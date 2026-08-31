import { Router, type IRouter } from "express";
import chatRouter from "./chat";
import healthRouter from "./health";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(chatRouter);
router.use(storageRouter);

export default router;
