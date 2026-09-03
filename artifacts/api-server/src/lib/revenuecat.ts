import { ReplitConnectors } from "@replit/connectors-sdk";

type RevenueCatPurchase = {
  id: string;
  product_id: string;
  purchased_at: number;
  quantity: number;
  status: "owned" | "refunded";
};

type RevenueCatProduct = {
  id: string;
  store_identifier: string;
  state: "active" | "inactive";
};

async function request(path: string) {
  const connectors = new ReplitConnectors();
  const response = await connectors.proxy("revenuecat", path, { method: "GET" });
  const text = await response.text();
  if (!response.ok) {
    const error = new Error(`RevenueCat request failed (${response.status}).`) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return JSON.parse(text);
}

export async function getVerifiedCoinPurchases(userId: number) {
  const projectId = process.env.REVENUECAT_PROJECT_ID;
  if (!projectId) throw new Error("RevenueCat project is not configured.");
  const customerId = encodeURIComponent(`oldtime-user-${userId}`);
  let purchases: RevenueCatPurchase[];
  try {
    purchases = (await request(`/v2/projects/${projectId}/customers/${customerId}/purchases?limit=100`)).items ?? [];
  } catch (error) {
    if ((error as { status?: number }).status === 404) return [];
    throw error;
  }
  const products: RevenueCatProduct[] = (await request(`/v2/projects/${projectId}/products?limit=100`)).items ?? [];
  const productById = new Map(products.map((product) => [product.id, product]));
  const coinAmounts: Record<string, number> = {
    oldtime_coins_100: 100,
    oldtime_coins_550: 550,
    oldtime_coins_1200: 1200,
  };
  return purchases.flatMap((purchase) => {
    const product = productById.get(purchase.product_id);
    const amount = product ? coinAmounts[product.store_identifier] : undefined;
    if (!product || product.state !== "active" || !amount || purchase.status !== "owned") return [];
    return [{
      purchaseId: purchase.id,
      productId: purchase.product_id,
      storeIdentifier: product.store_identifier,
      coins: amount * Math.max(1, purchase.quantity || 1),
      purchasedAt: purchase.purchased_at,
    }];
  });
}