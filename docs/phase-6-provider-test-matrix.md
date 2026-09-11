# Phase 6 provider and device test matrix

Phase 6 hardens the server and client paths without creating a production EAS build or submitting to TestFlight. These provider checks remain required before release.

## RevenueCat sandbox and TestFlight

- Configure only the explicit `oldtime_coins_*` products in the `coin_packs` offering.
- Confirm an authenticated sandbox purchase credits the mapped product quantity exactly once.
- Retry the same purchase and restore purchases; confirm the wallet and ledger do not increase twice.
- Attempt a product identifier that is not in the server map; confirm it is rejected and credits zero Coins.
- Remove the RevenueCat key or offering; confirm the wallet says the store is unavailable instead of showing a purchasable custom amount.
- Confirm Coins are spend-only and never appear as withdrawable Gold.

## Stripe Express and payouts

- Complete onboarding with an enabled payout account and confirm the destination is masked in the app.
- Leave required information incomplete; confirm the app reports that payout setup or action is required and blocks withdrawal.
- Request the minimum withdrawal and a larger whole-dollar withdrawal; confirm Gold is debited once and the ledger records a withdrawal hold.
- Retry the same withdrawal request key after a timeout; confirm one local withdrawal and one provider transfer/payout.
- Deliver duplicate `account.updated`, `payout.paid`, `payout.failed`, and `payout.canceled` webhook events with valid signatures; confirm they are harmless.
- Confirm a failed payout reverses the transfer when possible, restores Gold once, and records either `payout_failed` or `payout_reversal_pending`.
- Confirm a reversal failure leaves the withdrawal visibly in review and does not silently spend the creator's Gold.

## Gifts and wallet invariants

- Send every gift type in a LIVE room and from a visible Pace route.
- Retry a gift with the same idempotency key and confirm one gift row, one Coin debit, one Gold credit, and two ledger entries.
- Try an ended room, non-speaker recipient, self-recipient, private/inaccessible route, insufficient balance, and missing request key; confirm no financial mutation.
- Verify the database rejects a negative wallet balance and rejects updates/deletes against the append-only ledger.

## Current Event monetization

Paid room entry is intentionally unavailable in this release. Current Event rooms remain free, and no paid-entry entitlement or paid-room token path should be advertised until a separate product decision enables it.