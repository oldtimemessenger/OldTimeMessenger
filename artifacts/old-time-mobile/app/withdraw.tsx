import { Ionicons } from '@expo/vector-icons';
import {
  getGetCurrentEventWalletQueryOptions,
  getGetCreatorPayoutSettingsQueryOptions,
  getGetCreatorWithdrawalHistoryQueryOptions,
  useGetCurrentEventWallet,
  useGetCreatorPayoutSettings,
  useGetCreatorWithdrawalHistory,
  useRequestCreatorWithdrawal,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';

const GOLD_PER_USD = 90;
const MIN_GOLD = 900;

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Your withdrawal could not be requested.';
}

export default function WithdrawScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [usd, setUsd] = useState('');
  const [result, setResult] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const walletOptions = getGetCurrentEventWalletQueryOptions();
  const historyOptions = getGetCreatorWithdrawalHistoryQueryOptions();
  const payoutOptions = getGetCreatorPayoutSettingsQueryOptions();
  const wallet = useGetCurrentEventWallet({ query: { queryKey: walletOptions.queryKey } });
  const history = useGetCreatorWithdrawalHistory({ query: { queryKey: historyOptions.queryKey } });
  const payout = useGetCreatorPayoutSettings({ query: { queryKey: payoutOptions.queryKey } });
  const request = useRequestCreatorWithdrawal();
  const actionColor = colors.authNavy;
  const availableGold = wallet.data?.gold ?? 0;
  const gold = useMemo(() => {
    const clean = usd.trim();
    if (!/^\d+(?:\.\d{1,2})?$/.test(clean)) return 0;
    return Math.round(Number(clean) * GOLD_PER_USD);
  }, [usd]);
  const valid = gold >= MIN_GOLD && gold <= availableGold && gold % GOLD_PER_USD === 0;
  const refresh = useCallback(() => Promise.all([
    queryClient.invalidateQueries({ queryKey: walletOptions.queryKey }),
    queryClient.invalidateQueries({ queryKey: historyOptions.queryKey }),
    queryClient.invalidateQueries({ queryKey: payoutOptions.queryKey }),
  ]), [historyOptions.queryKey, payoutOptions.queryKey, queryClient, walletOptions.queryKey]);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const submit = async () => {
    setResult(null);
    try {
      await request.mutateAsync({ data: { gold } });
      setUsd('');
      await refresh();
      setResult({ kind: 'success', text: 'Withdrawal requested. Stripe is processing the transfer.' });
    } catch (error) {
      setResult({ kind: 'error', text: errorMessage(error) });
    }
  };

  const confirm = () => {
    if (!payout.data?.account.payoutsEnabled) {
      Alert.alert('Complete payout setup', 'Set up your Stripe payout details before requesting a withdrawal.', [
        { text: 'Payment Settings', onPress: () => router.push('/payment-settings' as never) },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    if (!valid) {
      Alert.alert('Check your amount', `Enter a whole-dollar amount of at least $10.00, up to your available $${(availableGold / GOLD_PER_USD).toFixed(2)}.`);
      return;
    }
    Alert.alert('Confirm withdrawal', `Request $${(gold / GOLD_PER_USD).toFixed(2)} (${gold.toLocaleString()} Gold) to your Stripe payout account?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Request withdrawal', onPress: () => void submit() },
    ]);
  };

  return (
    <ScrollView style={[styles.screen, { backgroundColor: colors.background }]} contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back" style={[styles.backButton, { backgroundColor: colors.card, borderColor: colors.border }]}><Ionicons name="chevron-back" size={20} color={colors.foreground} /></Pressable>
       <Text style={[styles.title, { color: colors.foreground }]}>Withdraw</Text>
        <View style={styles.headerSpacer} />
      </View>
      <View style={[styles.balance, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.muted, { color: colors.mutedForeground }]}>Available creator earnings</Text>
        <Text style={[styles.amount, { color: colors.foreground }]}>{availableGold.toLocaleString()} Gold</Text>
        <Text style={[styles.muted, { color: colors.mutedForeground }]}>${(availableGold / GOLD_PER_USD).toFixed(2)} USD available · Pending: {(wallet.data?.pendingGold ?? 0).toLocaleString()} Gold</Text>
      </View>
      <Text style={[styles.label, { color: colors.foreground }]}>Withdrawal amount (USD)</Text>
      <TextInput value={usd} onChangeText={(value) => setUsd(value.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder="$10.00" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]} accessibilityLabel="Withdrawal amount in US dollars" />
      <Text style={[styles.muted, { color: colors.mutedForeground }]}>{gold ? `${gold.toLocaleString()} Gold` : '90 Gold = $1.00'} · Minimum $10.00 / 900 Gold</Text>
      {!payout.data?.account.payoutsEnabled ? (
         <Pressable onPress={() => router.push('/payment-settings' as never)} style={[styles.warning, { backgroundColor: colors.muted }]} accessibilityRole="button" accessibilityLabel="Open creator payout settings">
           <Ionicons name="alert-circle-outline" size={21} color={actionColor} />
           <Text style={[styles.warningText, { color: colors.foreground }]}>Payout setup is required. Open Payment Settings to finish securely with Stripe.</Text>
        </Pressable>
      ) : null}
       <Pressable disabled={request.isPending} onPress={confirm} style={[styles.button, { backgroundColor: actionColor, opacity: request.isPending ? 0.6 : 1 }]}>{request.isPending ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.buttonText}>Request withdrawal</Text>}</Pressable>
       {result ? <Text style={[styles.result, { color: result.kind === 'error' ? colors.destructive : actionColor }]}>{result.text}</Text> : null}
      <Text style={[styles.section, { color: colors.foreground }]}>Withdrawal history</Text>
       {history.isLoading ? <ActivityIndicator color={actionColor} /> : history.data?.items.length ? history.data.items.map((item) => <View key={item.id} style={[styles.history, { backgroundColor: colors.card, borderColor: colors.border }]}><View><Text style={[styles.historyAmount, { color: colors.foreground }]}>${(item.amountCents / 100).toFixed(2)}</Text><Text style={[styles.muted, { color: colors.mutedForeground }]}>{item.gold.toLocaleString()} Gold · {new Date(item.createdAt).toLocaleDateString()}</Text></View><Text style={[styles.status, { color: item.status === 'failed' ? colors.destructive : colors.mutedForeground }]}>{item.status.replace(/_/g, ' ')}</Text></View>) : <Text style={[styles.muted, { color: colors.mutedForeground }]}>No withdrawal requests yet.</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  backButton: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerSpacer: { width: 44 },
  title: { fontFamily: 'Fraunces_900Black', fontSize: 24 },
  balance: { borderWidth: 1, borderRadius: 24, padding: 20 },
  muted: { fontFamily: 'Outfit_500Medium', fontSize: 13, lineHeight: 19 },
  amount: { fontFamily: 'Fraunces_900Black', fontSize: 34, marginVertical: 6 },
  label: { marginTop: 10, fontFamily: 'Outfit_700Bold', fontSize: 16 },
  input: { height: 60, borderWidth: 1, borderRadius: 16, paddingHorizontal: 18, fontFamily: 'Outfit_700Bold', fontSize: 20 },
  warning: { padding: 16, borderRadius: 16, flexDirection: 'row', gap: 12, alignItems: 'center' },
  warningText: { flex: 1, fontFamily: 'Outfit_500Medium', fontSize: 14, lineHeight: 20 },
  button: { height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 28, marginTop: 8 },
  buttonText: { color: '#ffffff', fontFamily: 'Outfit_800ExtraBold', fontSize: 16 },
  result: { textAlign: 'center', fontFamily: 'Outfit_700Bold', fontSize: 14 },
  section: { fontFamily: 'Fraunces_900Black', fontSize: 20, marginTop: 20 },
  history: { borderWidth: 1, borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  historyAmount: { fontFamily: 'Outfit_700Bold', fontSize: 17 },
  status: { textTransform: 'capitalize', fontFamily: 'Outfit_600SemiBold', fontSize: 13, maxWidth: 110, textAlign: 'right' },
});