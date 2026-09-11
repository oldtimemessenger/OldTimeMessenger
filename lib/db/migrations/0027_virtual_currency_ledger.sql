CREATE TABLE IF NOT EXISTS "virtual_currency_ledger" (
  "id" serial PRIMARY KEY NOT NULL,
  "idempotency_key" text NOT NULL,
  "user_id" integer NOT NULL,
  "account" text NOT NULL,
  "delta" integer NOT NULL,
  "balance_after" integer NOT NULL,
  "entry_type" text NOT NULL,
  "reference_id" text,
  "related_user_id" integer,
  "room_id" integer,
  "created_at" bigint NOT NULL,
  CONSTRAINT "virtual_currency_ledger_account_check" CHECK ("account" IN ('coins', 'gold', 'pending_gold')),
  CONSTRAINT "virtual_currency_ledger_delta_check" CHECK (
    "delta" <> 0 OR "entry_type" IN ('payout_submitted', 'payout_paid', 'payout_failed', 'payout_reversal_pending')
  ),
  CONSTRAINT "virtual_currency_ledger_balance_check" CHECK ("balance_after" >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "virtual_currency_ledger_idempotency_idx"
  ON "virtual_currency_ledger" ("idempotency_key");
CREATE INDEX IF NOT EXISTS "virtual_currency_ledger_user_account_created_idx"
  ON "virtual_currency_ledger" ("user_id", "account", "created_at");
CREATE INDEX IF NOT EXISTS "virtual_currency_ledger_reference_idx"
  ON "virtual_currency_ledger" ("reference_id");

DO $$
BEGIN
  ALTER TABLE "current_event_wallets"
    ADD CONSTRAINT "current_event_wallets_nonnegative_check"
    CHECK ("coins" >= 0 AND "gold" >= 0 AND "pending_gold" >= 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION "reject_virtual_currency_ledger_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'virtual_currency_ledger is append-only';
END;
$$;

DROP TRIGGER IF EXISTS "virtual_currency_ledger_immutable_trigger" ON "virtual_currency_ledger";
CREATE TRIGGER "virtual_currency_ledger_immutable_trigger"
  BEFORE UPDATE OR DELETE ON "virtual_currency_ledger"
  FOR EACH ROW EXECUTE FUNCTION "reject_virtual_currency_ledger_mutation"();

ALTER TABLE "current_event_gifts"
  ADD COLUMN IF NOT EXISTS "idempotency_key" text;
UPDATE "current_event_gifts"
SET "idempotency_key" = 'legacy-current-event-gift:' || "id"
WHERE "idempotency_key" IS NULL;
ALTER TABLE "current_event_gifts"
  ALTER COLUMN "idempotency_key" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "current_event_gifts_idempotency_idx"
  ON "current_event_gifts" ("idempotency_key");

ALTER TABLE "pace_route_gifts"
  ADD COLUMN IF NOT EXISTS "idempotency_key" text;
UPDATE "pace_route_gifts"
SET "idempotency_key" = 'legacy-pace-gift:' || "id"
WHERE "idempotency_key" IS NULL;
ALTER TABLE "pace_route_gifts"
  ALTER COLUMN "idempotency_key" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "pace_route_gifts_idempotency_idx"
  ON "pace_route_gifts" ("idempotency_key");

ALTER TABLE "creator_withdrawals"
  ADD COLUMN IF NOT EXISTS "idempotency_key" text;
UPDATE "creator_withdrawals"
SET "idempotency_key" = 'legacy-withdrawal:' || "id"
WHERE "idempotency_key" IS NULL;
ALTER TABLE "creator_withdrawals"
  ALTER COLUMN "idempotency_key" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "creator_withdrawals_idempotency_idx"
  ON "creator_withdrawals" ("idempotency_key");

INSERT INTO "virtual_currency_ledger"
  ("idempotency_key", "user_id", "account", "delta", "balance_after", "entry_type", "reference_id", "created_at")
SELECT
  'opening-balance:coins:' || "user_id",
  "user_id",
  'coins',
  "coins",
  "coins",
  'opening_balance',
  'current_event_wallets:' || "user_id",
  "updated_at"
FROM "current_event_wallets"
WHERE "coins" > 0
ON CONFLICT ("idempotency_key") DO NOTHING;

INSERT INTO "virtual_currency_ledger"
  ("idempotency_key", "user_id", "account", "delta", "balance_after", "entry_type", "reference_id", "created_at")
SELECT
  'opening-balance:gold:' || "user_id",
  "user_id",
  'gold',
  "gold",
  "gold",
  'opening_balance',
  'current_event_wallets:' || "user_id",
  "updated_at"
FROM "current_event_wallets"
WHERE "gold" > 0
ON CONFLICT ("idempotency_key") DO NOTHING;

INSERT INTO "virtual_currency_ledger"
  ("idempotency_key", "user_id", "account", "delta", "balance_after", "entry_type", "reference_id", "created_at")
SELECT
  'opening-balance:pending-gold:' || "user_id",
  "user_id",
  'pending_gold',
  "pending_gold",
  "pending_gold",
  'opening_balance',
  'current_event_wallets:' || "user_id",
  "updated_at"
FROM "current_event_wallets"
WHERE "pending_gold" > 0
ON CONFLICT ("idempotency_key") DO NOTHING;