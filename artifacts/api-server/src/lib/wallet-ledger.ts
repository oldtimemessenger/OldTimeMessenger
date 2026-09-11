import { db, currentEventWalletsTable, virtualCurrencyLedgerTable } from "@workspace/db";

type WalletExecutor = Pick<typeof db, "insert">;

export async function ensureWalletWithLedger(executor: WalletExecutor, userId: number, now = Date.now()) {
  const [wallet] = await executor.insert(currentEventWalletsTable)
    .values({ userId, updatedAt: now })
    .onConflictDoNothing()
    .returning({
      coins: currentEventWalletsTable.coins,
      gold: currentEventWalletsTable.gold,
      pendingGold: currentEventWalletsTable.pendingGold,
    });
  if (wallet && wallet.coins > 0) {
    await executor.insert(virtualCurrencyLedgerTable).values({
      idempotencyKey: `opening-balance:coins:${userId}`,
      userId,
      account: "coins",
      delta: wallet.coins,
      balanceAfter: wallet.coins,
      entryType: "opening_balance",
      referenceId: `current_event_wallets:${userId}`,
      createdAt: now,
    }).onConflictDoNothing();
  }
  return wallet;
}