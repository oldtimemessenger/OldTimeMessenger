import type { Request } from "express";

export type WalletAccount = "coins" | "gold" | "pending_gold";

export const COINS_PER_USD = 90;
export const GOLD_PER_USD = 90;
export const MINIMUM_WITHDRAWAL_GOLD = 900;

export const giftPrices = {
  coffee: 25,
  idea: 100,
  heart: 200,
  gem: 500,
  studio: 1000,
  time_is_up: 10000,
} as const;

export type GiftName = keyof typeof giftPrices;

export function requestIdempotencyKey(req: Request, userId: number, scope: string): string | null {
  const raw = req.get("idempotency-key")?.trim();
  if (!raw || raw.length > 160 || !/^[A-Za-z0-9._:-]{8,160}$/.test(raw)) return null;
  return `${scope}:${userId}:${raw}`;
}

export function centsForGold(gold: number): number {
  return (gold / GOLD_PER_USD) * 100;
}