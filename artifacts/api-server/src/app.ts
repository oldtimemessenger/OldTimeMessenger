import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { getUncachableStripeClient } from "./lib/stripe-client";
import { db, creatorHubOrdersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use("/api/current-events/payouts/stripe/webhook", express.raw({ type: "application/json" }));
app.post("/api/creator-hub/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const signature = req.header("stripe-signature");
  if (!signature || !Buffer.isBuffer(req.body)) { res.status(400).json({ error: "A signed Stripe payload is required." }); return; }
  try {
    const stripe = await getUncachableStripeClient();
    const event = stripe.webhooks.constructEvent(req.body, signature, process.env.CREATOR_HUB_STRIPE_WEBHOOK_SECRET ?? "");
    if (event.type === "payment_intent.succeeded") {
      const intent = event.data.object;
      const [order] = await db.update(creatorHubOrdersTable)
        .set({ status: "paid", updatedAt: Date.now() })
        .where(eq(creatorHubOrdersTable.paymentIntentId, intent.id)).returning({ id: creatorHubOrdersTable.id });
      if (!order) logger.warn({ paymentIntentId: intent.id }, "CreatorHub order was not found for payment");
    }
    res.json({ received: true });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Stripe signature was invalid." });
  }
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
