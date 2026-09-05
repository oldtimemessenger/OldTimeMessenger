import { Ionicons } from '@expo/vector-icons';
import {
  getGetCreatorPayoutSettingsQueryOptions,
  useCreateCreatorPayoutOnboardingLink,
  useGetCreatorPayoutSettings,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect } from 'react';
import { ActivityIndicator, Alert, AppState, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/ui';
import { useApp } from '@/context/app-state';
import { useColors } from '@/hooks/useColors';

function errorMessage(error: unknown) {
  if (error && typeof error === 'object') {
    const value = error as { message?: unknown; error?: unknown; data?: { error?: unknown; message?: unknown }; body?: { error?: unknown; message?: unknown } };
    for (const item of [value.data?.error, value.data?.message, value.body?.error, value.body?.message, value.error, value.message]) {
      if (typeof item === 'string' && item) return item;
    }
  }
  return 'Old Time could not update payout settings. Please try again.';
}

export default function PaymentSettingsScreen() {
  const colors = useColors();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session } = useApp();
  const options = getGetCreatorPayoutSettingsQueryOptions();
  const settingsQuery = useGetCreatorPayoutSettings({ query: { queryKey: options.queryKey, enabled: Boolean(session?.authToken), retry: 1 } });
  const onboarding = useCreateCreatorPayoutOnboardingLink();
  const refresh = useCallback(() => queryClient.invalidateQueries({ queryKey: options.queryKey }), [options.queryKey, queryClient]);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => { if (state === 'active') void refresh(); });
    const links = Linking.addEventListener('url', () => void refresh());
    return () => { listener.remove(); links.remove(); };
  }, [refresh]);

  const account = settingsQuery.data?.account;
  const enabled = account?.payoutsEnabled === true;
  const payoutDestination = settingsQuery.data?.payoutDestination;
  async function openStripe() {
    try {
      const link = await onboarding.mutateAsync(undefined);
      const supported = await Linking.canOpenURL(link.url);
      if (!supported) throw new Error('This device cannot open the secure Stripe setup page.');
      await Linking.openURL(link.url);
    } catch (error) {
      Alert.alert('Stripe setup unavailable', errorMessage(error));
    }
  }

  return (
    <Screen>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.icon} accessibilityRole="button" accessibilityLabel="Go back"><Ionicons name="chevron-back" size={28} color={colors.foreground} /></Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>Payment Settings</Text><View style={styles.icon} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name={enabled ? 'checkmark-circle' : 'business-outline'} size={30} color={enabled ? colors.primary : colors.mutedForeground} />
          <View style={{ flex: 1 }}><Text style={[styles.cardTitle, { color: colors.foreground }]}>{enabled ? 'Payouts enabled' : 'Stripe payout setup'}</Text>
            <Text style={[styles.sub, { color: colors.mutedForeground }]}>{enabled ? 'Your creator earnings are ready for withdrawal.' : 'Complete secure setup with Stripe to receive creator earnings.'}</Text></View>
        </View>
        {settingsQuery.isLoading ? <ActivityIndicator color={colors.primary} /> : (
          <View style={[styles.list, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Row label="Account status" value={account?.status?.replace('_', ' ') ?? 'Unavailable'} colors={colors} />
            <Row label="Details submitted" value={account?.detailsSubmitted ? 'Yes' : 'No'} colors={colors} />
            <Row label="Payouts enabled" value={enabled ? 'Yes' : 'No'} colors={colors} last />
          </View>
        )}
        {payoutDestination ? <View style={[styles.bank, { backgroundColor: colors.secondary }]}><Ionicons name={payoutDestination.type === 'card' ? 'card-outline' : 'business-outline'} size={20} color={colors.primary} /><Text style={[styles.bankText, { color: colors.foreground }]}>{payoutDestination.label} ending in {payoutDestination.last4}</Text></View> : null}
        {settingsQuery.isError ? <Text style={[styles.error, { color: colors.destructive }]}>{errorMessage(settingsQuery.error)}</Text> : null}
        <Pressable disabled={onboarding.isPending} onPress={() => void openStripe()} style={[styles.button, { backgroundColor: colors.primary, opacity: onboarding.isPending ? 0.6 : 1 }]} accessibilityRole="button" accessibilityLabel="Open secure Stripe payout setup">
          {onboarding.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{enabled ? 'Manage payout details in Stripe' : 'Set up payouts in Stripe'}</Text>}
        </Pressable>
        <Text style={[styles.note, { color: colors.mutedForeground }]}>Bank and card details are collected and managed only by Stripe. Old Time does not collect or store them.</Text>
      </ScrollView>
    </Screen>
  );
}
function Row({ label, value, colors, last }: { label: string; value: string; colors: ReturnType<typeof useColors>; last?: boolean }) {
  return <View style={[styles.row, !last && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}><Text style={[styles.rowLabel, { color: colors.foreground }]}>{label}</Text><Text style={[styles.rowValue, { color: colors.mutedForeground }]}>{value}</Text></View>;
}
const styles = StyleSheet.create({
  header: { height: 58, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10 }, icon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' }, title: { fontSize: 20, fontWeight: '800' },
  content: { padding: 20, gap: 16 }, card: { borderWidth: 1, borderRadius: 18, padding: 17, flexDirection: 'row', gap: 13 }, cardTitle: { fontSize: 17, fontWeight: '800' }, sub: { fontSize: 14, lineHeight: 20, marginTop: 4 }, list: { borderWidth: 1, borderRadius: 18, overflow: 'hidden' }, row: { minHeight: 55, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, rowLabel: { fontSize: 15 }, rowValue: { fontSize: 14, textTransform: 'capitalize' }, bank: { borderRadius: 14, padding: 14, flexDirection: 'row', gap: 10, alignItems: 'center' }, bankText: { fontSize: 14, fontWeight: '600' }, button: { height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }, buttonText: { color: '#fff', fontSize: 16, fontWeight: '800' }, note: { textAlign: 'center', fontSize: 13, lineHeight: 19, paddingHorizontal: 12 }, error: { fontSize: 14, lineHeight: 19 },
});