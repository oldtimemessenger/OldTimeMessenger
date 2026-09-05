import { Ionicons } from '@expo/vector-icons';
import {
  getGetCurrentEventWalletQueryOptions,
  type CurrentEventWallet,
  useGetCurrentEventWallet,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Screen } from '@/components/ui';
import { useApp } from '@/context/app-state';
import { useColors } from '@/hooks/useColors';
import { useRevenueCat } from '@/lib/revenuecat';

const COINS_PER_DOLLAR = 90;
const RECOMMENDED_AMOUNTS = [1_000, 5_000, 10_000, 25_000, 50_000, 100_000];
const emptyWallet: CurrentEventWallet = { coins: 0, gold: 0, pendingGold: 0 };
const balanceArt = require('../assets/coins/balance-bag.png');
const coinStackArt = require('../assets/coins/coin-stack.png');

function coinAmountFromProduct(item: { product: { identifier: string; title: string; description: string; price: number } }) {
  const text = `${item.product.identifier} ${item.product.title} ${item.product.description}`;
  const match = text.match(/(\d[\d,_]*)\s*(?:coins?)?/i);
  if (match) return Number(match[1].replace(/[,_]/g, ''));
  return Math.round(item.product.price * COINS_PER_DOLLAR);
}

function purchaseError(error: unknown) {
  if (error && typeof error === 'object' && 'userCancelled' in error && error.userCancelled === true) return null;
  return error instanceof Error ? error.message : 'The purchase could not be completed.';
}

export default function WalletScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ showCoins?: string }>();
  const queryClient = useQueryClient();
  const { session } = useApp();
  const revenueCat = useRevenueCat();
  const walletOptions = getGetCurrentEventWalletQueryOptions();
  const walletQuery = useGetCurrentEventWallet({
    query: {
      queryKey: walletOptions.queryKey,
      enabled: Boolean(session?.authToken),
      retry: 1,
    },
  });
  const wallet = walletQuery.data ?? emptyWallet;
  const [storeOpen, setStoreOpen] = useState(params.showCoins === '1');
  const [selectedAmount, setSelectedAmount] = useState(5_000);
  const [customAmount, setCustomAmount] = useState('');
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  const packages = useMemo(
    () => revenueCat.packages
      .map((item) => ({ item, coins: coinAmountFromProduct(item) }))
      .sort((a, b) => a.coins - b.coins),
    [revenueCat.packages],
  );
  const selectedPackage = packages.find(({ coins }) => coins === selectedAmount);

  async function refreshWallet() {
    await queryClient.fetchQuery(getGetCurrentEventWalletQueryOptions());
  }

  async function buySelected() {
    if (!session?.authToken) {
      Alert.alert('Sign in required', 'Sign in again before purchasing coins.');
      return;
    }
    if (!selectedPackage) {
      Alert.alert(
        'Pack not available yet',
        `${selectedAmount.toLocaleString()} coins will be available after its App Store product is connected.`,
      );
      return;
    }
    setPurchasingId(selectedPackage.item.identifier);
    try {
      const credited = await revenueCat.purchase(selectedPackage.item);
      await refreshWallet();
      setStoreOpen(false);
      Alert.alert('Coins added', `${credited.toLocaleString()} coins were added to your balance.`);
    } catch (error) {
      const message = purchaseError(error);
      if (message) Alert.alert('Purchase unavailable', message);
    } finally {
      setPurchasingId(null);
    }
  }

  function applyCustomAmount() {
    const amount = Number(customAmount.replace(/[^\d]/g, ''));
    if (!Number.isInteger(amount) || amount < 450 || amount % 450 !== 0) {
      Alert.alert('Enter a coin amount', 'Choose at least 450 coins and use 450-coin increments.');
      return;
    }
    setSelectedAmount(amount);
  }

  return (
    <Screen>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.iconButton}>
          <Ionicons name="chevron-back" size={28} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Balance</Text>
        <Pressable disabled={walletQuery.isFetching} onPress={() => void refreshWallet()} style={styles.iconButton}>
          {walletQuery.isFetching
            ? <ActivityIndicator size="small" color={colors.primary} />
            : <Ionicons name="refresh" size={21} color={colors.primary} />}
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Image source={balanceArt} contentFit="contain" style={styles.balanceArt} />
        <Text style={[styles.balanceLabel, { color: colors.mutedForeground }]}>Purchased Coins</Text>
        <Text style={[styles.estimatedValue, { color: colors.foreground }]}>
          {wallet.coins.toLocaleString()} Coins
        </Text>
        <View style={[styles.coinPill, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.coinPillText, { color: colors.foreground }]}>
            Coins <Text style={{ color: colors.primary }}>{wallet.coins.toLocaleString()}</Text>
          </Text>
          <View style={[styles.pillDivider, { backgroundColor: colors.border }]} />
          <Pressable onPress={() => setStoreOpen(true)} hitSlop={8}>
            <Text style={[styles.getCoinsText, { color: colors.foreground }]}>Get Coins →</Text>
          </Pressable>
        </View>
        <Text style={[styles.nonWithdrawable, { color: colors.mutedForeground }]}>Purchased Coins are for spending in Old Time and cannot be withdrawn.</Text>
        <View style={[styles.earningsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={{ flex: 1 }}><Text style={[styles.infoTitle, { color: colors.foreground }]}>Creator Earnings</Text>
            <Text style={[styles.earningsAmount, { color: colors.foreground }]}>{wallet.gold.toLocaleString()} Gold · ${(wallet.gold / COINS_PER_DOLLAR).toFixed(2)}</Text>
            <Text style={[styles.infoHint, { color: colors.mutedForeground }]}>Available: {wallet.gold.toLocaleString()} Gold · Pending: {wallet.pendingGold.toLocaleString()} Gold</Text></View>
          <Pressable onPress={() => router.push('/withdraw')} style={[styles.withdrawButton, { backgroundColor: colors.primary }]} accessibilityRole="button" accessibilityLabel="Withdraw creator earnings"><Text style={styles.withdrawText}>Withdraw</Text></Pressable>
        </View>
        <Pressable onPress={() => router.push('/payment-settings')} style={[styles.settingsRow, { borderColor: colors.border, backgroundColor: colors.card }]} accessibilityRole="button" accessibilityLabel="Open Payment Settings"><Ionicons name="card-outline" size={21} color={colors.primary} /><Text style={[styles.infoTitle, { flex: 1, color: colors.foreground }]}>Payment Settings</Text><Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} /></Pressable>

        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.infoIcon, { backgroundColor: `${colors.primary}18` }]}>
            <Ionicons name="wallet-outline" size={22} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.infoTitle, { color: colors.foreground }]}>Transactions</Text>
            <Text style={[styles.infoHint, { color: colors.mutedForeground }]}>Your coin activity will appear here.</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
        </View>

        <Pressable onPress={() => setStoreOpen(true)} style={[styles.rechargeCard, { backgroundColor: `${colors.primary}12` }]}>
          <View style={[styles.infoIcon, { backgroundColor: `${colors.primary}20` }]}>
            <Ionicons name="cash-outline" size={21} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.infoTitle, { color: colors.foreground }]}>Get more coins</Text>
            <Text style={[styles.infoHint, { color: colors.mutedForeground }]}>90 coins for every $1 of value.</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.primary} />
        </Pressable>
      </ScrollView>

      <Modal visible={storeOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setStoreOpen(false)}>
        <View style={[styles.store, { backgroundColor: colors.background }]}>
          <View style={styles.storeHeader}>
            <Pressable onPress={() => setStoreOpen(false)} style={styles.iconButton}>
              <Ionicons name="close" size={26} color={colors.foreground} />
            </Pressable>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>Get Coins</Text>
            <Pressable
              disabled={restoring || revenueCat.purchasing}
              onPress={() => {
                setRestoring(true);
                void revenueCat.restore()
                  .then(refreshWallet)
                  .then(() => Alert.alert('Restored', 'Your wallet is up to date.'))
                  .catch((error) => Alert.alert('Restore unavailable', purchaseError(error) ?? 'Please try again.'))
                  .finally(() => setRestoring(false));
              }}
              style={styles.iconButton}
            >
              {restoring ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="receipt-outline" size={22} color={colors.primary} />}
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.storeContent} keyboardShouldPersistTaps="handled">
            <Image source={balanceArt} contentFit="contain" style={styles.storeArt} />
            <Text style={[styles.storeBalanceLabel, { color: colors.mutedForeground }]}>Coin balance</Text>
            <Text style={[styles.storeBalance, { color: colors.foreground }]}>{wallet.coins.toLocaleString()}</Text>
            <Text style={[styles.ratioText, { color: colors.mutedForeground }]}>90 coins = $1 value</Text>

            <View style={styles.packGrid}>
              {RECOMMENDED_AMOUNTS.map((amount) => {
                const pack = packages.find(({ coins }) => coins === amount);
                const selected = selectedAmount === amount;
                return (
                  <Pressable
                    key={amount}
                    onPress={() => setSelectedAmount(amount)}
                    style={[
                      styles.packCard,
                      {
                        backgroundColor: selected ? `${colors.primary}12` : colors.card,
                        borderColor: selected ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Image source={coinStackArt} contentFit="contain" style={styles.packArt} />
                    <Text style={[styles.packCoins, { color: colors.foreground }]}>{amount.toLocaleString()}</Text>
                    <Text style={[styles.packPrice, { color: selected ? colors.primary : colors.mutedForeground }]}>
                      {pack?.item.product.priceString ?? `≈ $${(amount / COINS_PER_DOLLAR).toFixed(2)}`}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={[styles.customCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.customTitle, { color: colors.foreground }]}>Custom recharge</Text>
                <Text style={[styles.infoHint, { color: colors.mutedForeground }]}>Starts at 450 coins ($5), in 450-coin steps.</Text>
              </View>
              <TextInput
                value={customAmount}
                onChangeText={setCustomAmount}
                onSubmitEditing={applyCustomAmount}
                keyboardType="number-pad"
                placeholder="450"
                placeholderTextColor={colors.mutedForeground}
                style={[styles.customInput, { color: colors.foreground, borderColor: colors.border }]}
              />
              <Pressable onPress={applyCustomAmount} style={[styles.customApply, { backgroundColor: colors.primary }]}>
                <Ionicons name="checkmark" size={20} color="#fff" />
              </Pressable>
            </View>

            <Text style={[styles.disclaimer, { color: colors.mutedForeground }]}>
              Purchases are processed securely by the App Store. The final price is shown before confirmation.
            </Text>
          </ScrollView>
          <View style={[styles.purchaseBar, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
            <View>
              <Text style={[styles.purchaseAmount, { color: colors.foreground }]}>{selectedAmount.toLocaleString()} coins</Text>
              <Text style={[styles.purchaseEstimate, { color: colors.mutedForeground }]}>
                {selectedPackage?.item.product.priceString ?? `About $${(selectedAmount / COINS_PER_DOLLAR).toFixed(2)}`}
              </Text>
            </View>
            <Pressable
              disabled={Boolean(purchasingId) || revenueCat.purchasing}
              onPress={() => void buySelected()}
              style={[styles.rechargeButton, { backgroundColor: colors.primary, opacity: purchasingId ? 0.6 : 1 }]}
            >
              {purchasingId ? <ActivityIndicator color="#fff" /> : <Text style={styles.rechargeText}>Recharge</Text>}
            </Pressable>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { height: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 10 },
  storeHeader: { height: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10 },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  iconButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  content: { alignItems: 'center', paddingHorizontal: 20, paddingBottom: 100 },
  balanceArt: { width: 260, height: 245, marginTop: 8 },
  balanceLabel: { fontSize: 19, fontWeight: '600' },
  estimatedValue: { fontSize: 45, fontWeight: '800', letterSpacing: -1.5, marginTop: 2 },
  coinPill: { minHeight: 48, borderRadius: 24, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginTop: 18 },
  coinPillText: { fontSize: 16, fontWeight: '700' },
  nonWithdrawable: { fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 8, paddingHorizontal: 8 },
  earningsCard: { width: '100%', borderWidth: 1, borderRadius: 20, marginTop: 20, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  earningsAmount: { fontSize: 17, fontWeight: '800', marginTop: 4 },
  withdrawButton: { minHeight: 38, paddingHorizontal: 13, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  withdrawText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  settingsRow: { width: '100%', minHeight: 62, borderWidth: 1, borderRadius: 16, marginTop: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  pillDivider: { width: 1, height: 22, marginHorizontal: 15 },
  getCoinsText: { fontSize: 16, fontWeight: '700' },
  infoCard: { width: '100%', minHeight: 92, borderWidth: 1, borderRadius: 20, marginTop: 28, padding: 16, flexDirection: 'row', gap: 13, alignItems: 'center' },
  rechargeCard: { width: '100%', minHeight: 86, borderRadius: 20, marginTop: 14, padding: 16, flexDirection: 'row', gap: 13, alignItems: 'center' },
  infoIcon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  infoTitle: { fontSize: 17, fontWeight: '700' },
  infoHint: { fontSize: 13, lineHeight: 18, marginTop: 3 },
  store: { flex: 1 },
  storeContent: { paddingHorizontal: 18, paddingBottom: 130, alignItems: 'center' },
  storeArt: { width: 180, height: 150 },
  storeBalanceLabel: { fontSize: 16, fontWeight: '600' },
  storeBalance: { fontSize: 38, fontWeight: '800', marginTop: 2 },
  ratioText: { fontSize: 13, marginTop: 4, marginBottom: 20 },
  packGrid: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  packCard: { width: '31%', minWidth: 96, flexGrow: 1, borderRadius: 16, borderWidth: 1.5, paddingVertical: 12, alignItems: 'center' },
  packArt: { width: 70, height: 54 },
  packCoins: { fontSize: 16, fontWeight: '800' },
  packPrice: { fontSize: 13, fontWeight: '600', marginTop: 3 },
  customCard: { width: '100%', borderWidth: 1, borderRadius: 18, marginTop: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  customTitle: { fontSize: 15, fontWeight: '700' },
  customInput: { width: 84, height: 42, borderWidth: 1, borderRadius: 11, paddingHorizontal: 10, fontSize: 14 },
  customApply: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  disclaimer: { fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 18, paddingHorizontal: 18 },
  purchaseBar: { position: 'absolute', left: 0, right: 0, bottom: 0, minHeight: 92, borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 18, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  purchaseAmount: { fontSize: 16, fontWeight: '800' },
  purchaseEstimate: { fontSize: 12, marginTop: 3 },
  rechargeButton: { minWidth: 160, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  rechargeText: { color: '#fff', fontSize: 17, fontWeight: '800' },
});