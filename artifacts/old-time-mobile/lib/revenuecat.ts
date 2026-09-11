import Purchases, { type PurchasesPackage } from 'react-native-purchases';
import { Platform } from 'react-native';
import { syncCurrentEventWalletPurchases, type CurrentEventWalletSyncResult } from '@workspace/api-client-react';

export type CoinPack = {
  identifier: string;
  title: string;
  price: string;
  coins: number | null;
};

const REVENUECAT_TEST_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY;
const REVENUECAT_IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
const REVENUECAT_ANDROID_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;
const COIN_OFFERING_IDENTIFIER = process.env.REVENUECAT_OFFERING_IDENTIFIER ?? 'coin_packs';

let configured = false;
let configuredUserId: string | null = null;
let currentPackages: PurchasesPackage[] = [];

function revenueCatCustomerId(userId?: string) {
  const trimmed = userId?.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('oldtime-user-')) return trimmed;
  if (!/^\d+$/.test(trimmed)) {
    throw new Error('Your Old Time profile is still loading. Please try again in a moment.');
  }
  return `oldtime-user-${trimmed}`;
}

function apiKey() {
  if (__DEV__ || Platform.OS === 'web') return REVENUECAT_TEST_API_KEY;
  if (Platform.OS === 'ios') return REVENUECAT_IOS_API_KEY;
  if (Platform.OS === 'android') return REVENUECAT_ANDROID_API_KEY;
  return REVENUECAT_TEST_API_KEY;
}

async function ensureConfigured(userId?: string) {
  const key = apiKey();
  if (!key) throw new Error('Coin purchases are not configured for this build.');
  const customerId = revenueCatCustomerId(userId);

  if (!(await Purchases.isConfigured())) {
    Purchases.configure({ apiKey: key });
    configured = true;
  } else {
    configured = true;
  }

  if (customerId && configuredUserId !== customerId) {
    await Purchases.logIn(customerId);
    configuredUserId = customerId;
  }
}

function coinAmount(packageToPurchase: PurchasesPackage) {
  const identifier = packageToPurchase.product.identifier;
  const match = identifier.match(/(?:coins?_)(\d+)/i) ?? packageToPurchase.identifier.match(/(?:coins?_)(\d+)/i);
  return match ? Number(match[1]) : null;
}

async function availablePackages(userId?: string) {
  await ensureConfigured(userId);
  const offerings = await Purchases.getOfferings();
  const offering = offerings.all[COIN_OFFERING_IDENTIFIER] ?? offerings.current;
  if (!offering) throw new Error('Coin packs are not available right now.');
  currentPackages = offering.availablePackages;
  return currentPackages;
}

async function syncWalletPurchasesWithRetry() {
  let result = await syncCurrentEventWalletPurchases();
  for (let attempt = 0; attempt < 4 && result.creditedCoins === 0; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 750 * (attempt + 1)));
    result = await syncCurrentEventWalletPurchases();
  }
  return result;
}

export async function loadCoinPacks(userId?: string): Promise<CoinPack[]> {
  const packages = await availablePackages(userId);
  return packages.map((packageToPurchase) => ({
    identifier: packageToPurchase.identifier,
    title: packageToPurchase.product.title,
    price: packageToPurchase.product.priceString,
    coins: coinAmount(packageToPurchase),
  }));
}

export async function purchaseCoinPack(userId: string | undefined, identifier: string): Promise<CurrentEventWalletSyncResult> {
  const packages = await availablePackages(userId);
  const packageToPurchase = packages.find((item) => item.identifier === identifier);
  if (!packageToPurchase) throw new Error('That Coin pack is no longer available.');
  await Purchases.purchasePackage(packageToPurchase);
  return syncWalletPurchasesWithRetry();
}

export async function restoreCoinPurchases(userId?: string): Promise<CurrentEventWalletSyncResult> {
  await ensureConfigured(userId);
  await Purchases.restorePurchases();
  return syncWalletPurchasesWithRetry();
}