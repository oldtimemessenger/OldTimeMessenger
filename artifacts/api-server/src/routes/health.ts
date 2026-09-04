import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/readyz", async (req, res) => {
  const required = [
    "SESSION_SECRET",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "FIREBASE_PROJECT_ID",
  ];
  const missing = required.filter((name) => !process.env[name]);
  if (!process.env.SUPABASE_DATABASE_URL && !process.env.DATABASE_URL) {
    missing.push("SUPABASE_DATABASE_URL");
  }
  try {
    await db.execute(sql`select 1`);
  } catch (error) {
    req.log.error({ err: error }, "Readiness database check failed");
    res.status(503).json(HealthCheckResponse.parse({ status: "database_unavailable" }));
    return;
  }
  if (missing.length > 0) {
    req.log.warn({ missingConfiguration: missing }, "Production dependencies are not ready");
    res.status(503).json(HealthCheckResponse.parse({ status: "configuration_incomplete" }));
    return;
  }
  res.json(HealthCheckResponse.parse({ status: "ready" }));
});

export default router;
