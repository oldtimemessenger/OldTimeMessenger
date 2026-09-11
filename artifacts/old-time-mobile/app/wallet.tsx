import { Ionicons } from '@expo/vector-icons';
import {
  getGetCurrentEventWalletQueryOptions,
  useGetCurrentEventWallet,
  type CurrentEventWallet,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useOldTime } from '@/context/OldTimeContext';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { loadCoinPacks, purchaseCoinPack, restoreCoinPurchases, type CoinPack } from '@/lib/revenuecat';

const emptyWallet: CurrentEventWallet = { coins: 0, gold: 0, pendingGold: 0 };
const balanceArt = require('@/assets/coins/balance-bag.png');
const coinStackArt = require('@/assets/coins/coin-stack.png');

function purchaseError(error: unknown) {
  return error instanceof Error ? error.message : 'The purchase could not be completed.';
}

export default function WalletScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { currentUserId } = useOldTime();
  const actionColor = colors.authNavy;
  const queryClient = useQueryClient();
  const walletOptions = getGetCurrentEventWalletQueryOptions();
  const walletQuery = useGetCurrentEventWallet({ query: { queryKey: walletOptions.queryKey, retry: 1 } });
  const wallet = walletQuery.data ?? emptyWallet;
  const [storeOpen, setStoreOpen] = useState(false);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [coinPacks, setCoinPacks] = useState<CoinPack[]>([]);
  const [coinPacksLoading, setCoinPacksLoading] = useState(true);
  const [coinPacksError, setCoinPacksError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setCoinPacksLoading(true);
    setCoinPacksError(null);
    void loadCoinPacks(currentUserId || undefined).then((packs) => {
      if (!cancelled) {
        setCoinPacks(packs);
        setSelectedPackageId((current) => packs.some((pack) => pack.identifier === current) ? current : packs[0]?.identifier ?? null);
      }
    }).catch((error) => {
      if (!cancelled) {
        setCoinPacks([]);
        setSelectedPackageId(null);
        setCoinPacksError(error instanceof Error ? error.message : 'App Store products could not be loaded.');
      }
    }).finally(() => {
      if (!cancelled) setCoinPacksLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [currentUserId]);

  const availablePacks = useMemo(
    () => coinPacks.filter((pack): pack is CoinPack & { coins: number } => pack.coins !== null && Number.isInteger(pack.coins) && pack.coins > 0 && pack.price.trim().length > 0),
    [coinPacks],
  );
  const selectedPack = availablePacks.find((pack) => pack.identifier === selectedPackageId);

  const refreshWallet = async () => {
    await queryClient.invalidateQueries({ queryKey: walletOptions.queryKey });
  };

  const buySelected = async () => {
    if (!selectedPack) {
      Alert.alert('Purchases unavailable', 'No Coin packs are currently available from the App Store.');
      return;
    }
    setPurchasingId(selectedPack.identifier);
    try {
      const result = await purchaseCoinPack(currentUserId || undefined, selectedPack.identifier);
      await refreshWallet();
      setStoreOpen(false);
      Alert.alert('Coins added', `${result.creditedCoins.toLocaleString()} Coins were added to your balance.`);
    } catch (error) {
      Alert.alert('Purchase unavailable', purchaseError(error));
    } finally {
      setPurchasingId(null);
    }
  };

  const restore = async () => {
    setRestoring(true);
    try {
      const result = await restoreCoinPurchases(currentUserId || undefined);
      await refreshWallet();
      Alert.alert('Restored', result.creditedCoins ? `${result.creditedCoins.toLocaleString()} Coins were restored.` : 'Your wallet is already up to date.');
    } catch (error) {
      Alert.alert('Restore unavailable', purchaseError(error));
    } finally {
      setRestoring(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top, height: insets.top + 56, borderBottomColor: colors.border }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Balance</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Refresh balance" disabled={walletQuery.isFetching} onPress={() => void refreshWallet()} style={styles.headerButton}>
          {walletQuery.isFetching ? <ActivityIndicator size="small" color={actionColor} /> : <Ionicons name="refresh" size={21} color={actionColor} />}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 34 }]} showsVerticalScrollIndicator={false}>
        <Image source={balanceArt} contentFit="contain" style={styles.balanceArt} />
        <Text style={[styles.balanceLabel, { color: colors.mutedForeground }]}>Purchased Coins</Text>
        <Text style={[styles.estimatedValue, { color: colors.foreground }]}>{wallet.coins.toLocaleString()} Coins</Text>
        <View style={[styles.coinPill, { backgroundColor: colors.card, borderColor: colors.border }]}>
           <Text style={[styles.coinPillText, { color: colors.foreground }]}>Coins <Text style={{ color: actionColor }}>{wallet.coins.toLocaleString()}</Text></Text>
          <View style={[styles.pillDivider, { backgroundColor: colors.border }]} />
          <Pressable onPress={() => setStoreOpen(true)} hitSlop={8}><Text style={[styles.getCoinsText, { color: colors.foreground }]}>Get Coins →</Text></Pressable>
        </View>
        <Text style={[styles.nonWithdrawable, { color: colors.mutedForeground }]}>Purchased Coins are for spending in Old Time and cannot be withdrawn.</Text>

        <View style={[styles.earningsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.earningsCopy}>
            <Text style={[styles.infoTitle, { color: colors.foreground }]}>Creator Earnings</Text>
            <Text style={[styles.earningsAmount, { color: colors.foreground }]}>{wallet.gold.toLocaleString()} Gold</Text>
            <Text style={[styles.infoHint, { color: colors.mutedForeground }]}>Available: {wallet.gold.toLocaleString()} Gold · Pending: {wallet.pendingGold.toLocaleString()} Gold</Text>
          </View>
           <Pressable onPress={() => router.push('/withdraw' as never)} style={[styles.withdrawButton, { backgroundColor: actionColor }]} accessibilityRole="button" accessibilityLabel="Withdraw creator earnings">
             <Text style={styles.withdrawText}>Withdraw</Text>
          </Pressable>
        </View>

        <Pressable onPress={() => router.push('/payment-settings' as never)} style={[styles.settingsRow, { borderColor: colors.border, backgroundColor: colors.card }]} accessibilityRole="button" accessibilityLabel="Open payment settings">
           <Ionicons name="card-outline" size={21} color={actionColor} />
          <Text style={[styles.infoTitle, { flex: 1, color: colors.foreground }]}>Payment Settings</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
        </Pressable>

        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
           <View style={[styles.infoIcon, { backgroundColor: `${actionColor}18` }]}><Ionicons name="wallet-outline" size={22} color={actionColor} /></View>
          <View style={styles.earningsCopy}><Text style={[styles.infoTitle, { color: colors.foreground }]}>Transactions</Text><Text style={[styles.infoHint, { color: colors.mutedForeground }]}>Your Coin activity will appear here.</Text></View>
        </View>
      </ScrollView>

      <Modal visible={storeOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setStoreOpen(false)}>
        <View style={[styles.store, { backgroundColor: colors.background }]}>
          <View style={styles.storeHeader}>
            <Pressable onPress={() => setStoreOpen(false)} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Close Coin store"><Ionicons name="close" size={26} color={colors.foreground} /></Pressable>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>Get Coins</Text>
            <Pressable disabled={restoring} onPress={() => void restore()} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Restore Coin purchases">
              {restoring ? <ActivityIndicator size="small" color={actionColor} /> : <Ionicons name="receipt-outline" size={22} color={actionColor} />}
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.storeContent} keyboardShouldPersistTaps="handled">
            <Image source={balanceArt} contentFit="contain" style={styles.storeArt} />
            <Text style={[styles.storeBalanceLabel, { color: colors.mutedForeground }]}>Coin balance</Text>
            <Text style={[styles.storeBalance, { color: colors.foreground }]}>{wallet.coins.toLocaleString()}</Text>
            {coinPacksLoading ? (
              <View style={styles.storeStatus}>
                <ActivityIndicator color={actionColor} />
                <Text style={[styles.statusText, { color: colors.mutedForeground }]}>Loading App Store products…</Text>
              </View>
            ) : availablePacks.length > 0 ? (
              <View style={styles.packGrid}>
              {availablePacks.map((pack) => {
                const selected = selectedPackageId === pack.identifier;
                return (
                  <Pressable key={pack.identifier} onPress={() => setSelectedPackageId(pack.identifier)} style={[styles.packCard, { backgroundColor: selected ? `${actionColor}12` : colors.card, borderColor: selected ? actionColor : colors.border }]}>
                    <Image source={coinStackArt} contentFit="contain" style={styles.packArt} />
                    <Text style={[styles.packCoins, { color: colors.foreground }]}>{pack.coins.toLocaleString()} Coins</Text>
                    <Text style={[styles.packPrice, { color: selected ? actionColor : colors.mutedForeground }]}>{pack.price}</Text>
                  </Pressable>
                );
              })}
              </View>
            ) : (
              <View style={[styles.unavailableCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name="alert-circle-outline" size={24} color={colors.mutedForeground} />
                <Text style={[styles.unavailableTitle, { color: colors.foreground }]}>Purchases unavailable</Text>
                <Text style={[styles.statusText, { color: colors.mutedForeground }]}>{coinPacksError ?? 'No Coin packs are currently available from the App Store. Please try again later.'}</Text>
              </View>
            )}
            <Text style={[styles.disclaimer, { color: colors.mutedForeground }]}>Purchases are processed securely by the App Store. The final price is shown before confirmation.</Text>
          </ScrollView>
          <View style={[styles.purchaseBar, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
            <View><Text style={[styles.purchaseAmount, { color: colors.foreground }]}>{selectedPack ? `${selectedPack.coins.toLocaleString()} Coins` : 'Purchases unavailable'}</Text>{selectedPack ? <Text style={[styles.purchaseEstimate, { color: colors.mutedForeground }]}>{selectedPack.price}</Text> : null}</View>
             <Pressable disabled={Boolean(purchasingId) || !selectedPack || coinPacksLoading} onPress={() => void buySelected()} style={[styles.rechargeButton, { backgroundColor: actionColor, opacity: purchasingId || !selectedPack || coinPacksLoading ? 0.45 : 1 }]} accessibilityRole="button" accessibilityState={{ disabled: Boolean(purchasingId) || !selectedPack || coinPacksLoading }}>{purchasingId ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.rechargeText}>Recharge</Text>}</Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { height: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16 },
  headerTitle: { fontFamily: 'Fraunces_900Black', fontSize: 22 },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  content: { alignItems: 'center', paddingHorizontal: 18, paddingTop: 10 },
  balanceArt: { width: 176, height: 154, marginTop: 2 },
  balanceLabel: { fontFamily: 'Outfit_600SemiBold', fontSize: 16 },
  estimatedValue: { fontFamily: 'Fraunces_900Black', fontSize: 48, letterSpacing: -1.4, marginTop: 4 },
  coinPill: { minHeight: 52, borderRadius: 26, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginTop: 16 },
  coinPillText: { fontFamily: 'Outfit_700Bold', fontSize: 16 },
  pillDivider: { width: 1, height: 26, marginHorizontal: 16 },
  getCoinsText: { fontFamily: 'Outfit_700Bold', fontSize: 16 },
  nonWithdrawable: { fontFamily: 'Outfit_500Medium', fontSize: 13, lineHeight: 18, textAlign: 'center', marginTop: 10, paddingHorizontal: 12 },
  earningsCard: { width: '100%', borderWidth: 1, borderRadius: 22, marginTop: 24, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 },
  earningsCopy: { flex: 1 },
  earningsAmount: { fontFamily: 'Fraunces_900Black', fontSize: 24, marginTop: 4 },
  withdrawButton: { minHeight: 44, paddingHorizontal: 16, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  withdrawText: { color: '#ffffff', fontFamily: 'Outfit_700Bold', fontSize: 15 },
  settingsRow: { width: '100%', minHeight: 64, borderWidth: 1, borderRadius: 20, marginTop: 14, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 14 },
  infoCard: { width: '100%', minHeight: 88, borderWidth: 1, borderRadius: 22, marginTop: 14, padding: 16, flexDirection: 'row', gap: 14, alignItems: 'center' },
  infoIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  infoTitle: { fontFamily: 'Outfit_700Bold', fontSize: 16 },
  infoHint: { fontFamily: 'Outfit_400Regular', fontSize: 14, lineHeight: 20, marginTop: 4 },
  store: { flex: 1 },
  storeHeader: { height: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  storeContent: { paddingHorizontal: 20, paddingBottom: 140, alignItems: 'center' },
  storeArt: { width: 180, height: 150 },
  storeBalanceLabel: { fontFamily: 'Outfit_600SemiBold', fontSize: 16 },
  storeBalance: { fontFamily: 'Fraunces_900Black', fontSize: 44, marginTop: 4 },
  packGrid: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 24 },
  packCard: { width: '31%', minWidth: 100, flexGrow: 1, borderRadius: 20, borderWidth: 1.5, paddingVertical: 16, alignItems: 'center' },
  packArt: { width: 74, height: 58 },
  packCoins: { fontFamily: 'Outfit_700Bold', fontSize: 15 },
  packPrice: { fontFamily: 'Outfit_600SemiBold', fontSize: 13, marginTop: 4 },
  storeStatus: { minHeight: 160, alignItems: 'center', justifyContent: 'center', gap: 12 },
  statusText: { fontFamily: 'Outfit_400Regular', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  unavailableCard: { width: '100%', borderWidth: 1, borderRadius: 22, marginTop: 24, padding: 24, alignItems: 'center', gap: 10 },
  unavailableTitle: { fontFamily: 'Outfit_700Bold', fontSize: 18 },
  disclaimer: { fontFamily: 'Outfit_500Medium', fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 22, paddingHorizontal: 20 },
  purchaseBar: { position: 'absolute', left: 0, right: 0, bottom: 0, minHeight: 104, borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 20, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  purchaseAmount: { fontFamily: 'Outfit_700Bold', fontSize: 17 },
  purchaseEstimate: { fontFamily: 'Outfit_500Medium', fontSize: 13, marginTop: 4 },
  rechargeButton: { minWidth: 170, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  rechargeText: { color: '#ffffff', fontFamily: 'Outfit_800ExtraBold', fontSize: 18 },
});