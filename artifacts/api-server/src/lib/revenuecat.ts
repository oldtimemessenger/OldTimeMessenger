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

type RevenueCatPage<T> = {
  items: T[];
  nextPage: string | null;
};

const REVENUECAT_API_ORIGIN = "https://api.revenuecat.com";
const MAX_REVENUECAT_PAGES = 100;

async function request(path: string) {
  const secretKey = process.env.REVENUECAT_SECRET_KEY;
  if (!secretKey) {
    throw new Error("REVENUECAT_SECRET_KEY is not configured.");
  }
  const response = await fetch(`${REVENUECAT_API_ORIGIN}${path}`, {
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

function parsePage<T>(payload: unknown, resourceName: string): RevenueCatPage<T> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error(`RevenueCat ${resourceName} pagination response is malformed.`);
  }
  const page = payload as Record<string, unknown>;
  if (!Array.isArray(page.items) || !Object.hasOwn(page, "next_page")) {
    throw new Error(`RevenueCat ${resourceName} pagination response is malformed.`);
  }
  if (page.next_page !== null && typeof page.next_page !== "string") {
    throw new Error(`RevenueCat ${resourceName} pagination response is malformed.`);
  }
  return { items: page.items as T[], nextPage: page.next_page };
}

function getNextPagePath(nextPage: string, resourceName: string) {
  if (!nextPage) {
    throw new Error(`RevenueCat ${resourceName} pagination response has an invalid next_page.`);
  }
  if (nextPage.startsWith("/")) {
    if (nextPage.startsWith("//")) {
      throw new Error(`RevenueCat ${resourceName} pagination response has an invalid next_page.`);
    }
    return nextPage;
  }

  let url: URL;
  try {
    url = new URL(nextPage);
  } catch {
    throw new Error(`RevenueCat ${resourceName} pagination response has an invalid next_page.`);
  }
  if (url.origin !== REVENUECAT_API_ORIGIN) {
    throw new Error(`RevenueCat ${resourceName} pagination response has an invalid next_page.`);
  }
  return `${url.pathname}${url.search}`;
}

async function requestAllPages<T>(
  initialPath: string,
  resourceName: string,
  returnEmptyOnInitialNotFound = false,
): Promise<T[]> {
  const items: T[] = [];
  const visitedPaths = new Set<string>();
  let path = initialPath;

  for (let pageCount = 0; pageCount < MAX_REVENUECAT_PAGES; pageCount += 1) {
    if (visitedPaths.has(path)) {
      throw new Error(`RevenueCat ${resourceName} pagination repeated a page.`);
    }
    visitedPaths.add(path);

    let payload: unknown;
    try {
      payload = await request(path);
    } catch (error) {
      if (pageCount === 0 && returnEmptyOnInitialNotFound && (error as { status?: number }).status === 404) {
        return [];
      }
      throw error;
    }
    const page = parsePage<T>(payload, resourceName);
    items.push(...page.items);
    if (page.nextPage === null) return items;
    path = getNextPagePath(page.nextPage, resourceName);
  }

  throw new Error(`RevenueCat ${resourceName} pagination exceeded ${MAX_REVENUECAT_PAGES} pages.`);
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

  const purchases = await requestAllPages<RevenueCatPurchase>(
    `/v2/projects/${useV2}/customers/${customerId}/purchases?limit=100`,
    "purchases",
    true,
  );
  const products = await requestAllPages<RevenueCatProduct>(
    `/v2/projects/${useV2}/products?limit=100`,
    "products",
  );
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