import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { coinAmountForStoreIdentifier, KNOWN_COIN_PRODUCTS } from "./revenuecat";
import {
  COINS_PER_USD,
  GOLD_PER_USD,
  MINIMUM_WITHDRAWAL_GOLD,
  centsForGold,
  giftPrices,
  requestIdempotencyKey,
} from "./money";

const request = (value?: string) => ({
  get: (name: string) => name.toLowerCase() === "idempotency-key" ? value : undefined,
}) as never;

assert.equal(coinAmountForStoreIdentifier("oldtime_coins_1000"), 1000);
assert.equal(coinAmountForStoreIdentifier("oldtime_coins_100000"), 100000);
assert.equal(coinAmountForStoreIdentifier("oldtime_coins_450"), undefined);
assert.equal(coinAmountForStoreIdentifier("oldtime_coins_999999"), undefined);
assert.equal(Object.keys(KNOWN_COIN_PRODUCTS).length, 9);

assert.equal(requestIdempotencyKey(request("gift-123456"), 7, "pace-gift"), "pace-gift:7:gift-123456");
assert.equal(requestIdempotencyKey(request("gift-123456"), 8, "pace-gift"), "pace-gift:8:gift-123456");
assert.equal(requestIdempotencyKey(request("short"), 7, "pace-gift"), null);
assert.equal(requestIdempotencyKey(request("contains spaces"), 7, "pace-gift"), null);
assert.equal(requestIdempotencyKey(request("x".repeat(161)), 7, "pace-gift"), null);
assert.equal(requestIdempotencyKey(request(), 7, "pace-gift"), null);

assert.equal(COINS_PER_USD, 90);
assert.equal(GOLD_PER_USD, 90);
assert.equal(MINIMUM_WITHDRAWAL_GOLD, 900);
assert.equal(centsForGold(900), 1000);
assert.equal(centsForGold(1800), 2000);
assert.equal(giftPrices.coffee, 25);
assert.equal(giftPrices.time_is_up, 10000);
assert.equal(Math.floor(giftPrices.studio * 0.8), 800);

const migration = readFileSync(join(process.cwd(), "../../lib/db/migrations/0027_virtual_currency_ledger.sql"), "utf8");
assert.match(migration, /UNIQUE INDEX IF NOT EXISTS "virtual_currency_ledger_idempotency_idx"/);
assert.match(migration, /current_event_wallets_nonnegative_check/);
assert.match(migration, /virtual_currency_ledger_immutable_trigger/);
assert.match(migration, /ON CONFLICT \("idempotency_key"\) DO NOTHING/);
assert.match(migration, /opening-balance:coins/);

const currentEventsRoute = readFileSync(join(process.cwd(), "src/routes/current-events.ts"), "utf8");
assert.match(currentEventsRoute, /purchase:\$\{purchase\.purchaseId\}/);
assert.match(currentEventsRoute, /withdrawal:\$\{created\.id\}:hold/);
assert.match(currentEventsRoute, /requestIdempotencyKey\(req, viewerId, "current-event-gift"\)/);
assert.match(currentEventsRoute, /coffee: 1,[\s\S]*idea: 5,[\s\S]*heart: 15,[\s\S]*gem: 30,[\s\S]*time_is_up: 60/);
assert.match(currentEventsRoute, /another real participant in this LIVE room/);
assert.match(currentEventsRoute, /cameraAccessUntil: sql`GREATEST\([\s\S]*\) \+ \$\{accessDuration\}`/);
assert.match(currentEventsRoute, /emitToCurrentEventRoom\(roomId, "current-event-gift"/);
assert.match(currentEventsRoute, /benefit: result\.benefit/);
assert.match(currentEventsRoute, /stripe\.webhooks\.constructEvent/);

const giftBenefitsMigration = readFileSync(join(process.cwd(), "../../lib/db/migrations/0029_current_event_gift_benefits.sql"), "utf8");
assert.match(giftBenefitsMigration, /ADD COLUMN IF NOT EXISTS "live_until" bigint/);
assert.match(giftBenefitsMigration, /ADD COLUMN IF NOT EXISTS "camera_access_until" bigint/);
assert.match(giftBenefitsMigration, /UNIQUE INDEX IF NOT EXISTS "current_event_gifts_idempotency_idx"/);

const paceRoute = readFileSync(join(process.cwd(), "src/routes/pace.ts"), "utf8");
assert.match(paceRoute, /requestIdempotencyKey\(req, viewerId, "pace-gift"\)/);
assert.match(paceRoute, /paceRouteGiftsTable\.idempotencyKey/);

console.log("Phase 6 product-map, idempotency, ledger, gift, payout, and webhook checks passed.");