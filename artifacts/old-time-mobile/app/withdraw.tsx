import { Ionicons } from '@expo/vector-icons';
import {
  getGetCreatorPayoutSettingsQueryOptions, getGetCreatorWithdrawalHistoryQueryOptions, getGetCurrentEventWalletQueryOptions,
  useGetCreatorPayoutSettings, useGetCreatorWithdrawalHistory, useGetCurrentEventWallet, useRequestCreatorWithdrawal,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Screen } from '@/components/ui';
import { useApp } from '@/context/app-state';
import { useColors } from '@/hooks/useColors';

const GOLD_PER_USD = 90; const MIN_GOLD = 900;
const message = (e: unknown) => { const x = e as { message?: unknown; error?: unknown; data?: { error?: unknown; message?: unknown }; body?: { error?: unknown; message?: unknown } }; for (const v of [x?.data?.error, x?.data?.message, x?.body?.error, x?.body?.message, x?.error, x?.message]) if (typeof v === 'string') return v; return 'Your withdrawal could not be requested. Please try again.'; };
export default function WithdrawScreen() {
  const colors = useColors(); const router = useRouter(); const qc = useQueryClient(); const { session } = useApp(); const [usd, setUsd] = useState(''); const [result, setResult] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const walletOptions = getGetCurrentEventWalletQueryOptions(); const historyOptions = getGetCreatorWithdrawalHistoryQueryOptions(); const payoutOptions = getGetCreatorPayoutSettingsQueryOptions();
  const wallet = useGetCurrentEventWallet({ query: { queryKey: walletOptions.queryKey, enabled: !!session?.authToken } });
  const history = useGetCreatorWithdrawalHistory({ query: { queryKey: historyOptions.queryKey, enabled: !!session?.authToken } });
  const payout = useGetCreatorPayoutSettings({ query: { queryKey: payoutOptions.queryKey, enabled: !!session?.authToken } }); const request = useRequestCreatorWithdrawal();
  const availableGold = wallet.data?.gold ?? 0;
  const gold = useMemo(() => { const clean = usd.trim(); if (!/^\d+(?:\.\d{1,2})?$/.test(clean)) return 0; return Math.round(Number(clean) * GOLD_PER_USD); }, [usd]);
  const valid = gold >= MIN_GOLD && gold <= availableGold && gold % GOLD_PER_USD === 0;
  const refresh = useCallback(() => Promise.all([qc.invalidateQueries({ queryKey: walletOptions.queryKey }), qc.invalidateQueries({ queryKey: historyOptions.queryKey })]), [historyOptions.queryKey, qc, walletOptions.queryKey]);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  function confirm() {
    if (!payout.data?.account.payoutsEnabled) { Alert.alert('Complete payout setup', 'Set up your Stripe payout details before requesting a withdrawal.', [{ text: 'Payment Settings', onPress: () => router.push('/payment-settings') }, { text: 'Cancel', style: 'cancel' }]); return; }
    if (!valid) { Alert.alert('Check your amount', `Enter $10.00 or more, up to your available $${(availableGold / GOLD_PER_USD).toFixed(2)}.`); return; }
    Alert.alert('Confirm withdrawal', `Request $${(gold / GOLD_PER_USD).toFixed(2)} (${gold.toLocaleString()} Gold) to your Stripe payout account?`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Request withdrawal', onPress: () => void submit() }]);
  }
  async function submit() { setResult(null); try { await request.mutateAsync({ data: { gold } }); setUsd(''); await refresh(); setResult({ kind: 'success', text: 'Withdrawal requested. Its status is processing.' }); } catch (e) { setResult({ kind: 'error', text: message(e) }); } }
  return <Screen><View style={[s.header, { borderBottomColor: colors.border }]}><Pressable onPress={() => router.back()} style={s.icon} accessibilityLabel="Go back"><Ionicons name="chevron-back" size={28} color={colors.foreground} /></Pressable><Text style={[s.title, { color: colors.foreground }]}>Withdraw</Text><View style={s.icon} /></View>
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <View style={[s.balance, { backgroundColor: colors.card, borderColor: colors.border }]}><Text style={[s.muted, { color: colors.mutedForeground }]}>Available creator earnings</Text><Text style={[s.amount, { color: colors.foreground }]}>{availableGold.toLocaleString()} Gold</Text><Text style={[s.muted, { color: colors.mutedForeground }]}>${(availableGold / GOLD_PER_USD).toFixed(2)} USD available • Pending: {(wallet.data?.pendingGold ?? 0).toLocaleString()} Gold</Text></View>
      <Text style={[s.label, { color: colors.foreground }]}>Withdrawal amount (USD)</Text><TextInput value={usd} onChangeText={v => setUsd(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder="$10.00" placeholderTextColor={colors.mutedForeground} style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]} accessibilityLabel="Withdrawal amount in US dollars" />
      <Text style={[s.muted, { color: colors.mutedForeground }]}>{gold ? `${gold.toLocaleString()} Gold` : '90 Gold = $1.00'} • Minimum $10.00 / 900 Gold</Text>
      {!payout.data?.account.payoutsEnabled && <Pressable onPress={() => router.push('/payment-settings')} style={[s.warning, { backgroundColor: colors.secondary }]} accessibilityRole="button" accessibilityLabel="Open Payment Settings"><Ionicons name="alert-circle-outline" size={21} color={colors.primary} /><Text style={[s.warningText, { color: colors.foreground }]}>Payout setup is required. Open Payment Settings to finish securely with Stripe.</Text></Pressable>}
      <Pressable disabled={request.isPending} onPress={confirm} style={[s.button, { backgroundColor: colors.primary, opacity: request.isPending ? .6 : 1 }]}>{request.isPending ? <ActivityIndicator color="#fff" /> : <Text style={s.buttonText}>Request withdrawal</Text>}</Pressable>
      {result ? <Text accessibilityLiveRegion="polite" style={[s.result, { color: result.kind === 'error' ? colors.destructive : colors.primary }]}>{result.text}</Text> : null}
      <Text style={[s.section, { color: colors.foreground }]}>Withdrawal history</Text>
      {history.isLoading ? <ActivityIndicator color={colors.primary} /> : history.data?.items.length ? history.data.items.map(item => <View key={item.id} style={[s.history, { backgroundColor: colors.card, borderColor: colors.border }]}><View><Text style={[s.historyAmount, { color: colors.foreground }]}>${(item.amountCents / 100).toFixed(2)}</Text><Text style={[s.muted, { color: colors.mutedForeground }]}>{item.gold.toLocaleString()} Gold • {new Date(item.createdAt).toLocaleDateString()}</Text></View><Text style={[s.status, { color: colors.mutedForeground }]}>{item.status.replace(/_/g, ' ')}</Text></View>) : <Text style={[s.muted, { color: colors.mutedForeground }]}>No withdrawal requests yet.</Text>}
    </ScrollView></Screen>;
}
const s = StyleSheet.create({ header: { height: 58, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10 }, icon: { width: 42, height: 42, justifyContent: 'center', alignItems: 'center' }, title: { fontSize: 20, fontWeight: '800' }, content: { padding: 20, gap: 12, paddingBottom: 50 }, balance: { borderWidth: 1, borderRadius: 18, padding: 18 }, muted: { fontSize: 13, lineHeight: 19 }, amount: { fontSize: 30, fontWeight: '800', marginVertical: 4 }, label: { marginTop: 8, fontSize: 16, fontWeight: '700' }, input: { height: 54, borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, fontSize: 19, fontWeight: '700' }, warning: { padding: 14, borderRadius: 14, flexDirection: 'row', gap: 10 }, warningText: { flex: 1, fontSize: 13, lineHeight: 19 }, button: { height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 26, marginTop: 4 }, buttonText: { color: '#fff', fontWeight: '800', fontSize: 16 }, result: { textAlign: 'center', fontSize: 14, fontWeight: '600' }, section: { fontSize: 18, fontWeight: '800', marginTop: 16 }, history: { borderWidth: 1, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, historyAmount: { fontSize: 16, fontWeight: '800' }, status: { textTransform: 'capitalize', fontSize: 13, maxWidth: 110, textAlign: 'right' } });