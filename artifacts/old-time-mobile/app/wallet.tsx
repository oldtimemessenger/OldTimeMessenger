import { Ionicons } from '@expo/vector-icons';
import { type CurrentEventWallet, useGetCurrentEventWallet } from '@workspace/api-client-react';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PrimaryButton, Screen } from '@/components/ui';
import { useApp } from '@/context/app-state';
import { useColors } from '@/hooks/useColors';
import { useRevenueCat } from '@/lib/revenuecat';

const giftCatalog = [
  { key: 'coffee', label: 'Coffee', icon: 'cafe-outline' as const, cost: 25 },
  { key: 'idea', label: 'Idea', icon: 'bulb-outline' as const, cost: 100 },
  { key: 'heart', label: 'Heart', icon: 'heart-outline' as const, cost: 200 },
  { key: 'gem', label: 'Gem', icon: 'diamond-outline' as const, cost: 500 },
  { key: 'studio', label: 'Studio', icon: 'radio-outline' as const, cost: 1000 },
];

const emptyWallet: CurrentEventWallet = { coins: 0, gold: 0, pendingGold: 0 };

function revenueCatErrorDetails(error: unknown) {
  if (error instanceof Error) return { message: error.message, userCancelled: false };
  if (!error || typeof error !== 'object') return { message: null, userCancelled: false };
  const candidate = error as { message?: unknown; userCancelled?: unknown };
  return {
    message: typeof candidate.message === 'string' ? candidate.message : null,
    userCancelled: candidate.userCancelled === true,
  };
}

export default function WalletScreen() {
  const colors = useColors();
  const router = useRouter();
  const { session } = useApp();
  const revenueCat = useRevenueCat();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const loadFailureMessageRef = useRef<string | null>(null);
  const walletQuery = useGetCurrentEventWallet({
    query: {
      enabled: Boolean(session?.authToken),
      retry: 1,
    },
  });
  const wallet = walletQuery.data ?? emptyWallet;
  const loading = walletQuery.isLoading;
  const refreshing = walletQuery.isFetching && !walletQuery.isLoading;

  useEffect(() => {
    if (walletQuery.error && !walletQuery.data) {
      const message = walletQuery.error instanceof Error ? walletQuery.error.message : 'Wallet unavailable.';
      if (loadFailureMessageRef.current !== message) {
        loadFailureMessageRef.current = message;
        setFeedback(message);
      }
      return;
    }
    if (walletQuery.data && loadFailureMessageRef.current) {
      const lastFailure = loadFailureMessageRef.current;
      loadFailureMessageRef.current = null;
      setFeedback((current) => current === lastFailure ? null : current);
    }
  }, [walletQuery.data, walletQuery.error]);

  async function refreshWallet() {
    if (!session?.authToken) {
      return {
        ok: false as const,
        message: 'Sign in again to refresh your wallet.',
      };
    }
    const result = await walletQuery.refetch();
    if (result.status === 'error' || !result.data) {
      return {
        ok: false as const,
        message: result.error instanceof Error ? result.error.message : 'Wallet unavailable.',
      };
    }
    return {
      ok: true as const,
      data: result.data,
    };
  }

  async function handlePurchase(item: (typeof revenueCat.packages)[number]) {
    try {
      const credited = await revenueCat.purchase(item);
      const refreshed = await refreshWallet();
      if (!refreshed.ok) {
        setFeedback(credited > 0
          ? `${credited} coins added. The wallet balance will refresh when the connection returns.`
          : 'Purchase confirmed. The wallet balance will refresh when the connection returns.');
        return;
      }
      setFeedback(credited > 0 ? `${credited} coins added.` : 'Purchase confirmed. Your wallet is already up to date.');
    } catch (error) {
      const details = revenueCatErrorDetails(error);
      if (!details.userCancelled) setFeedback(details.message ?? 'Purchase unavailable.');
    }
  }

  async function handleRestore() {
    if (restoring) return;
    setRestoring(true);
    try {
      const credited = await revenueCat.restore();
      const refreshed = await refreshWallet();
      if (!refreshed.ok) {
        setFeedback(credited
          ? `${credited} coins restored. The wallet balance will refresh when the connection returns.`
          : 'Wallet is up to date. The balance will refresh when the connection returns.');
        return;
      }
      setFeedback(credited ? `${credited} coins restored.` : 'Wallet is up to date.');
    } catch (error) {
      const details = revenueCatErrorDetails(error);
      if (!details.userCancelled) setFeedback(details.message ?? 'Restore unavailable.');
    } finally {
      setRestoring(false);
    }
  }

  return (
    <Screen
      title="Wallet"
      left={(
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
        </Pressable>
      )}
      right={(
        <Pressable accessibilityRole="button" accessibilityLabel="Refresh wallet" disabled={loading || refreshing || !session?.authToken} onPress={async () => {
          setFeedback(null);
          const refreshed = await refreshWallet();
          if (!refreshed.ok) Alert.alert('Wallet not updated', refreshed.message);
        }} style={({ pressed }) => [{ opacity: loading || refreshing || !session?.authToken ? 0.45 : pressed ? 0.65 : 1 }]}>
          <Text style={[styles.refreshText, { color: colors.primary }]}>{refreshing ? 'Refreshing…' : 'Refresh'}</Text>
        </Pressable>
      )}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.balanceCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.balanceLabel, { color: colors.mutedForeground }]}>Access balance</Text>
          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 18 }} />
          ) : (
            <>
              <Text style={[styles.balanceCoins, { color: colors.foreground }]}>◈ {wallet.coins}</Text>
              <Text style={[styles.balanceHint, { color: colors.mutedForeground }]}>Use coins in Access rooms to support speakers and unlock gifts.</Text>
              <View style={styles.summaryRow}>
                <View style={[styles.summaryChip, { backgroundColor: colors.muted }]}>
                  <Text style={[styles.summaryValue, { color: colors.foreground }]}>{wallet.gold}</Text>
                  <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Gold</Text>
                </View>
                <View style={[styles.summaryChip, { backgroundColor: colors.muted }]}>
                  <Text style={[styles.summaryValue, { color: colors.foreground }]}>{wallet.pendingGold}</Text>
                  <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Pending gold</Text>
                </View>
              </View>
              <PrimaryButton label={restoring ? 'Restoring…' : 'Restore purchases'} onPress={() => void handleRestore()} disabled={revenueCat.purchasing || restoring || !session?.authToken} />
            </>
          )}
        </View>

        {feedback ? (
          <View style={[styles.feedbackCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Text style={[styles.feedbackText, { color: colors.foreground }]}>{feedback}</Text>
          </View>
        ) : null}

        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>GET COINS</Text>
        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionIntro, { color: colors.mutedForeground }]}>Store pricing appears here when coin packs are available for this device.</Text>
          {revenueCat.loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 18 }} />
          ) : revenueCat.packages.length > 0 ? revenueCat.packages.map((item, index) => (
            <Pressable
              key={item.identifier}
              accessibilityRole="button"
              accessibilityLabel={`Buy ${item.product.title}`}
              accessibilityState={{ disabled: revenueCat.purchasing || !session?.authToken }}
              disabled={revenueCat.purchasing || !session?.authToken}
              onPress={() => void handlePurchase(item)}
              style={({ pressed }) => [
                styles.packageRow,
                {
                  backgroundColor: pressed ? colors.muted : 'transparent',
                  borderBottomColor: index === revenueCat.packages.length - 1 ? 'transparent' : colors.border,
                  opacity: revenueCat.purchasing ? 0.55 : 1,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.packageTitle, { color: colors.foreground }]}>{item.product.title}</Text>
                <Text style={[styles.packageSubtitle, { color: colors.mutedForeground }]}>{item.product.description || 'Access coins'}</Text>
              </View>
              <Text style={[styles.packagePrice, { color: colors.primary }]}>{item.product.priceString}</Text>
            </Pressable>
          )) : (
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Coin packs are not available from this store yet.</Text>
          )}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>HOW COINS WORK</Text>
        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {giftCatalog.map((gift, index) => (
            <View key={gift.key} style={[styles.giftRow, { borderBottomColor: index === giftCatalog.length - 1 ? 'transparent' : colors.border }]}>
              <View style={[styles.giftIcon, { backgroundColor: colors.muted }]}>
                <Ionicons name={gift.icon} size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.giftLabel, { color: colors.foreground }]}>{gift.label}</Text>
                <Text style={[styles.giftHint, { color: colors.mutedForeground }]}>Support a speaker in a live Access room.</Text>
              </View>
              <Text style={[styles.giftCost, { color: colors.mutedForeground }]}>◈ {gift.cost}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  backButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -8,
  },
  refreshText: {
    fontSize: 15,
    fontWeight: '600',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 100,
  },
  balanceCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  balanceCoins: {
    fontSize: 40,
    fontWeight: '800',
    marginTop: 10,
  },
  balanceHint: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 18,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginBottom: 18,
  },
  summaryChip: {
    flex: 1,
    minHeight: 72,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  summaryLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  feedbackCard: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 14,
  },
  feedbackText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  sectionTitle: {
    textTransform: 'uppercase',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginLeft: 4,
    marginTop: 24,
    marginBottom: 6,
  },
  sectionCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sectionIntro: {
    fontSize: 12,
    lineHeight: 17,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 4,
  },
  packageRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  packageTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  packageSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },
  packagePrice: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  giftRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  giftIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  giftLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  giftHint: {
    fontSize: 12,
    marginTop: 3,
  },
  giftCost: {
    fontSize: 13,
    fontWeight: '700',
  },
});
