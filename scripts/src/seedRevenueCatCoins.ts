import { ReplitConnectors } from "@replit/connectors-sdk";

const PROJECT_ID = "proj2b9a6899";
const OFFERING_KEY = "coin_packs";
const packs = [
  { identifier: "oldtime_coins_100", title: "100 Old Time Coins", amount: 100, usdMicros: 990_000 },
  { identifier: "oldtime_coins_550", title: "550 Old Time Coins", amount: 550, usdMicros: 4_990_000 },
  { identifier: "oldtime_coins_1200", title: "1,200 Old Time Coins", amount: 1200, usdMicros: 9_990_000 },
] as const;

type JsonObject = Record<string, any>;

async function request(path: string, method = "GET", body?: JsonObject) {
  const connectors = new ReplitConnectors();
  const response = await connectors.proxy("revenuecat", path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${method} ${path} failed (${response.status}): ${text.slice(0, 500)}`);
  }
  let data: JsonObject = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`${method} ${path} returned a non-JSON response: ${text.slice(0, 500)}`);
    }
  }
  return data;
}

async function seed() {
  const apps = (await request(`/v2/projects/${PROJECT_ID}/apps?limit=100`)).items as JsonObject[];
  const supportedApps = apps.filter((app) => ["test_store", "app_store", "play_store"].includes(app.type));
  const products = (await request(`/v2/projects/${PROJECT_ID}/products?limit=100`)).items as JsonObject[];

  for (const pack of packs) {
    for (const app of supportedApps) {
      let product = products.find(
        (item) => item.app_id === app.id && item.store_identifier === pack.identifier,
      );
      if (!product) {
        product = await request(`/v2/projects/${PROJECT_ID}/products`, "POST", {
          store_identifier: pack.identifier,
          app_id: app.id,
          type: "consumable",
          display_name: pack.title,
          ...(app.type === "test_store" ? { title: pack.title } : {}),
        });
        products.push(product);
        console.log(`Created ${pack.identifier} for ${app.type}`);
      }
      if (app.type === "test_store") {
        try {
          await request(
            `/v2/projects/${PROJECT_ID}/products/${product.id}/test_store_prices`,
            "POST",
            { prices: [{ amount_micros: pack.usdMicros, currency: "USD" }] },
          );
        } catch (error) {
          if (!String(error).toLowerCase().includes("already")) throw error;
        }
      }
    }
  }

  const offerings = (await request(`/v2/projects/${PROJECT_ID}/offerings?limit=100`)).items as JsonObject[];
  let offering = offerings.find((item) => item.lookup_key === OFFERING_KEY);
  if (!offering) {
    offering = await request(`/v2/projects/${PROJECT_ID}/offerings`, "POST", {
      lookup_key: OFFERING_KEY,
      display_name: "Old Time Coin Packs",
    });
    console.log("Created coin_packs offering");
  }

  const packages = (
    await request(`/v2/projects/${PROJECT_ID}/offerings/${offering.id}/packages?limit=100`)
  ).items as JsonObject[];
  for (const pack of packs) {
    const lookupKey = `coins_${pack.amount}`;
    let itemPackage = packages.find((item) => item.lookup_key === lookupKey);
    if (!itemPackage) {
      itemPackage = await request(
        `/v2/projects/${PROJECT_ID}/offerings/${offering.id}/packages`,
        "POST",
        { lookup_key: lookupKey, display_name: pack.title },
      );
      packages.push(itemPackage);
    }
    const attachedProducts = products
      .filter((product) => product.store_identifier === pack.identifier)
      .map((product) => ({ product_id: product.id, eligibility_criteria: "all" }));
    try {
      await request(`/v2/projects/${PROJECT_ID}/packages/${itemPackage.id}/actions/attach_products`, "POST", {
        products: attachedProducts,
      });
    } catch (error) {
      const message = String(error).toLowerCase();
      if (!message.includes("already") && !message.includes("cannot attach product")) throw error;
    }
  }

  console.log("Old Time coin catalog is ready.");
}

seed().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});