import { Ionicons } from '@expo/vector-icons';
import { getCurrentEventWallet, type CurrentEventWallet } from '@workspace/api-client-react';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PrimaryButton, Screen } from '@/components/ui';
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

export default function WalletScreen() {
  const colors = useColors();
  const router = useRouter();
  const revenueCat = useRevenueCat();
  const [wallet, setWallet] = useState<CurrentEventWallet>(emptyWallet);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadWallet = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'refresh') setRefreshing(true);
    else setLoading(true);
    try {
      setWallet(await getCurrentEventWallet());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Wallet unavailable.';
      if (mode === 'initial') setFeedback(message);
      else Alert.alert('Wallet not updated', message);
    } finally {
      if (mode === 'refresh') setRefreshing(false);
      else setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWallet();
  }, [loadWallet]);

  async function handlePurchase(item: (typeof revenueCat.packages)[number]) {
    try {
      const credited = await revenueCat.purchase(item);
      await loadWallet('refresh');
      setFeedback(`${credited} coins added.`);
    } catch (error: any) {
      if (!error?.userCancelled) setFeedback(error?.message ?? 'Purchase unavailable.');
    }
  }

  async function handleRestore() {
    try {
      const credited = await revenueCat.restore();
      await loadWallet('refresh');
      setFeedback(credited ? `${credited} coins restored.` : 'Wallet is up to date.');
    } catch (error: any) {
      setFeedback(error?.message ?? 'Restore unavailable.');
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
        <Pressable accessibilityRole="button" accessibilityLabel="Refresh wallet" disabled={loading || refreshing} onPress={() => void loadWallet('refresh')} style={({ pressed }) => [{ opacity: loading || refreshing ? 0.45 : pressed ? 0.65 : 1 }]}>
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
            </>
          )}
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
          <PrimaryButton label="Restore purchases" onPress={() => void handleRestore()} disabled={revenueCat.purchasing || loading} />
        </View>

        {feedback ? (
          <View style={[styles.feedbackCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Text style={[styles.feedbackText, { color: colors.foreground }]}>{feedback}</Text>
          </View>
        ) : null}

        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>GET COINS</Text>
        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionIntro, { color: colors.mutedForeground }]}>App Store pricing appears here when coin packs are available for this device.</Text>
          {revenueCat.loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 18 }} />
          ) : revenueCat.packages.length > 0 ? revenueCat.packages.map((item, index) => (
            <Pressable
              key={item.identifier}
              accessibilityRole="button"
              accessibilityLabel={`Buy ${item.product.title}`}
              disabled={revenueCat.purchasing}
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
