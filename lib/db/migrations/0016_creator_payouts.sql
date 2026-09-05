CREATE TABLE IF NOT EXISTS "creator_payout_accounts" (
  "user_id" integer PRIMARY KEY NOT NULL,
  "stripe_account_id" text NOT NULL,
  "details_submitted" boolean NOT NULL DEFAULT false,
  "payouts_enabled" boolean NOT NULL DEFAULT false,
  "status" text NOT NULL DEFAULT 'pending',
  "created_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS "creator_withdrawals" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "gold" integer NOT NULL,
  "amount_cents" integer NOT NULL,
  "currency" text NOT NULL DEFAULT 'usd',
  "status" text NOT NULL DEFAULT 'processing',
  "stripe_transfer_id" text,
  "stripe_payout_id" text,
  "failure_reason" text,
  "created_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL,
  CONSTRAINT "creator_withdrawals_gold_positive" CHECK ("gold" > 0),
  CONSTRAINT "creator_withdrawals_amount_positive" CHECK ("amount_cents" > 0),
  CONSTRAINT "creator_withdrawals_currency_usd" CHECK ("currency" = 'usd')
);

CREATE INDEX IF NOT EXISTS "creator_withdrawals_user_created_idx"
  ON "creator_withdrawals" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "creator_withdrawals_user_status_idx"
  ON "creator_withdrawals" ("user_id", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "creator_withdrawals_transfer_idx"
  ON "creator_withdrawals" ("stripe_transfer_id") WHERE "stripe_transfer_id" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "creator_withdrawals_payout_idx"
  ON "creator_withdrawals" ("stripe_payout_id") WHERE "stripe_payout_id" IS NOT NULL;