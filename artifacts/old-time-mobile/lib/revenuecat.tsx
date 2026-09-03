import Constants from "expo-constants";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import Purchases, { LOG_LEVEL, type PurchasesPackage } from "react-native-purchases";
import { syncCurrentEventWalletPurchases } from "@workspace/api-client-react";
import { useApp } from "@/context/app-state";

type RevenueCatContextValue = {
  packages: PurchasesPackage[];
  loading: boolean;
  purchasing: boolean;
  purchase: (item: PurchasesPackage) => Promise<number>;
  restore: () => Promise<number>;
};

const Context = createContext<RevenueCatContextValue | null>(null);
let configured = false;

function apiKey() {
  if (__DEV__ || Platform.OS === "web" || Constants.executionEnvironment === "storeClient") {
    return process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY;
  }
  return Platform.OS === "ios"
    ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY
    : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;
}

export function RevenueCatProvider({ children }: { children: React.ReactNode }) {
  const { session } = useApp();
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const key = apiKey();
      if (!key) {
        setLoading(false);
        return;
      }
      if (!configured) {
        Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);
        Purchases.configure({ apiKey: key });
        configured = true;
      }
      if (session?.id) await Purchases.logIn(`oldtime-user-${session.id}`);
      const offerings = await Purchases.getOfferings();
      if (!cancelled) setPackages(offerings.all.coin_packs?.availablePackages ?? []);
      if (!cancelled) setLoading(false);
    }
    void load().catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [session?.id]);

  const value = useMemo<RevenueCatContextValue>(() => ({
    packages,
    loading,
    purchasing,
    purchase: async (item) => {
      setPurchasing(true);
      try {
        await Purchases.purchasePackage(item);
        const result = await syncCurrentEventWalletPurchases();
        return result.creditedCoins;
      } finally {
        setPurchasing(false);
      }
    },
    restore: async () => {
      setPurchasing(true);
      try {
        await Purchases.restorePurchases();
        const result = await syncCurrentEventWalletPurchases();
        return result.creditedCoins;
      } finally {
        setPurchasing(false);
      }
    },
  }), [loading, packages, purchasing]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useRevenueCat() {
  const value = useContext(Context);
  if (!value) throw new Error("useRevenueCat must be used within RevenueCatProvider");
  return value;
}