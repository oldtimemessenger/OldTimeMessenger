import type { Request, Response, NextFunction, IRouter } from "express";
import { Router } from "express";

/**
 * Mobile generated client calls /api/posts* while the server implements /api/social/posts*.
 * Rewrite those paths before the social router runs.
 */
const router: IRouter = Router();

router.use((req: Request, _res: Response, next: NextFunction) => {
  const path = req.url.split("?")[0] ?? "";
  if (path === "/posts" || path.startsWith("/posts/")) {
    const suffix = req.url.slice("/posts".length);
    req.url = "/social/posts" + suffix;
  }
  next();
});

export default router;
