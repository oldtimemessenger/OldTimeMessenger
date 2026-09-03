CREATE TABLE IF NOT EXISTS "current_event_coin_purchases" (
  "purchase_id" text PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "product_id" text NOT NULL,
  "store_identifier" text NOT NULL,
  "coins" integer NOT NULL,
  "purchased_at" bigint NOT NULL,
  "credited_at" bigint NOT NULL
);

CREATE INDEX IF NOT EXISTS "current_event_coin_purchases_user_purchased_idx"
  ON "current_event_coin_purchases" ("user_id", "purchased_at");