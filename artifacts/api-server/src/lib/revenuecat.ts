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

type RevenueCatV1Purchase = {
  id?: string;
  purchase_date?: string;
  purchase_date_ms?: number;
  store_transaction_id?: string;
};

type RevenueCatV1Subscriber = {
  subscriber?: {
    non_subscriptions?: Record<string, RevenueCatV1Purchase[]>;
  };
};

async function request(path: string) {
  const secretKey = process.env.REVENUECAT_SECRET_KEY;
  if (!secretKey) {
    throw new Error("REVENUECAT_SECRET_KEY is not configured.");
  }
  const response = await fetch(`https://api.revenuecat.com${path}`, {
    method: "GET",
    headers: {
      authorization: `Bearer ${secretKey}`,
      accept: "application/json",
    },
  });
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
  const useV2 = process.env.REVENUECAT_API_VERSION === "v2" && projectId;
  const customerId = encodeURIComponent(`oldtime-user-${userId}`);
  const coinAmounts: Record<string, number> = {
    oldtime_coins_100: 100,
    oldtime_coins_550: 550,
    oldtime_coins_1200: 1200,
  };

  if (!useV2) {
    let payload: RevenueCatV1Subscriber;
    try {
      payload = await request(`/v1/subscribers/${customerId}`);
    } catch (error) {
      if ((error as { status?: number }).status === 404) return [];
      throw error;
    }
    const purchases = payload.subscriber?.non_subscriptions ?? {};
    return Object.entries(purchases).flatMap(([storeIdentifier, entries]) => {
      const coins = coinAmounts[storeIdentifier];
      if (!coins) return [];
      return entries.flatMap((purchase) => {
        const purchaseId = purchase.store_transaction_id ?? purchase.id;
        const purchasedAt = purchase.purchase_date_ms
          ?? (purchase.purchase_date
            ? Date.parse(purchase.purchase_date)
            : Number.NaN);
        if (!purchaseId || !Number.isFinite(purchasedAt)) return [];
        return [{
          purchaseId,
          productId: storeIdentifier,
          storeIdentifier,
          coins,
          purchasedAt,
        }];
      });
    });
  }

  let purchases: RevenueCatPurchase[];
  try {
    purchases = (await request(`/v2/projects/${useV2}/customers/${customerId}/purchases?limit=100`)).items ?? [];
  } catch (error) {
    if ((error as { status?: number }).status === 404) return [];
    throw error;
  }
  const products: RevenueCatProduct[] = (await request(`/v2/projects/${useV2}/products?limit=100`)).items ?? [];
  const productById = new Map(products.map((product) => [product.id, product]));
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