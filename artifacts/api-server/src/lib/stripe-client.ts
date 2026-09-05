import Stripe from "stripe";

/**
 * Fetches a fresh key so Replit connector credential rotation is respected.
 */
async function getStripeCredentials(): Promise<{ secretKey: string }> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const token = process.env.REPL_IDENTITY
    ? `repl ${process.env.REPL_IDENTITY}`
    : process.env.WEB_REPL_RENEWAL
      ? `depl ${process.env.WEB_REPL_RENEWAL}`
      : null;
  if (!hostname || !token) {
    throw new Error("Stripe is not configured. Connect Stripe in the Integrations tab.");
  }
  const response = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=stripe`,
    { headers: { Accept: "application/json", X_REPLIT_TOKEN: token }, signal: AbortSignal.timeout(10_000) },
  );
  if (!response.ok) throw new Error(`Unable to load Stripe credentials (${response.status}).`);
  const data = await response.json() as { items?: Array<{ settings?: { secret_key?: unknown } }> };
  const secretKey = data.items?.[0]?.settings?.secret_key;
  if (typeof secretKey !== "string" || !secretKey) {
    throw new Error("Stripe is not configured. Connect Stripe in the Integrations tab.");
  }
  return { secretKey };
}

export async function getUncachableStripeClient(): Promise<Stripe> {
  const { secretKey } = await getStripeCredentials();
  return new Stripe(secretKey);
}