export const MIN_COMMISSION_BPS = 1000;
export function commissionCents(amountCents: number, bps: number) {
  if (!Number.isInteger(amountCents) || amountCents < 0 || !Number.isInteger(bps) || bps < MIN_COMMISSION_BPS) throw new Error("Commission must be at least 10%.");
  return Math.floor(amountCents * bps / 10000);
}
export function isMediaPost(media: unknown): boolean {
  return Array.isArray(media) && media.some(item => item && (item.type === "image" || item.type === "video"));
}
export function payoutReady(status: string, shippedAt: number | null, deliveredAt: number | null) {
  return status === "paid" && (Boolean(deliveredAt) || Boolean(shippedAt));
}
export function referralAttribution(slug: string | null | undefined, approval: { referralSlug: string | null; creatorUserId: number } | null) {
  return Boolean(slug && approval?.referralSlug === slug) ? approval!.creatorUserId : null;
}