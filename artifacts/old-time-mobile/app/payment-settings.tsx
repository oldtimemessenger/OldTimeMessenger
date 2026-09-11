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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Old Time could not update payout settings.';
}

export default function PaymentSettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const actionColor = colors.authNavy;
  const options = getGetCreatorPayoutSettingsQueryOptions();
  const settings = useGetCreatorPayoutSettings({ query: { queryKey: options.queryKey, retry: 1 } });
  const onboarding = useCreateCreatorPayoutOnboardingLink();
  const refresh = useCallback(() => queryClient.invalidateQueries({ queryKey: options.queryKey }), [options.queryKey, queryClient]);

  useFocusEffect(useCallback(() => {
    void refresh();
  }, [refresh]));

  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => listener.remove();
  }, [refresh]);

  const account = settings.data?.account;
  const enabled = account?.payoutsEnabled === true;

  const openStripe = async () => {
    try {
      const link = await onboarding.mutateAsync();
      if (!(await Linking.canOpenURL(link.url))) throw new Error('This device cannot open the secure Stripe setup page.');
      await Linking.openURL(link.url);
    } catch (error) {
      Alert.alert('Stripe setup unavailable', errorMessage(error));
    }
  };

  return (
    <ScrollView style={[styles.screen, { backgroundColor: colors.background }]} contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back" style={[styles.backButton, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="chevron-back" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>Payment Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={[styles.hero, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.heroIcon}><Ionicons name="business-outline" size={28} color={actionColor} /></View>
        <View style={styles.heroCopy}>
          <Text style={[styles.heroTitle, { color: colors.foreground }]}>Stripe payout setup</Text>
          <Text style={[styles.heroBody, { color: colors.mutedForeground }]}>Complete secure setup with Stripe to receive creator earnings.</Text>
        </View>
      </View>

      {settings.isLoading ? <ActivityIndicator color={actionColor} style={styles.loader} /> : (
        <View style={[styles.statusCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <StatusRow label="Account status" value={account?.status?.replace(/_/g, ' ') ?? 'Unavailable'} colors={colors} />
          <StatusRow label="Details submitted" value={account?.detailsSubmitted ? 'Yes' : 'Not yet'} colors={colors} />
          <StatusRow label="Payouts enabled" value={enabled ? 'Yes' : 'Not yet'} colors={colors} last />
        </View>
      )}

      {settings.isError ? <Text style={[styles.error, { color: colors.destructive }]}>{errorMessage(settings.error)}</Text> : null}

      <Pressable disabled={onboarding.isPending} onPress={() => void openStripe()} style={[styles.primaryButton, { backgroundColor: actionColor, opacity: onboarding.isPending ? 0.55 : 1 }]} accessibilityRole="button" accessibilityLabel="Open secure Stripe payout setup">
        {onboarding.isPending ? <ActivityIndicator color="#ffffff" /> : <><Ionicons name="open-outline" size={18} color="#ffffff" /><Text style={styles.primaryButtonText}>{enabled ? 'Manage payout details in Stripe' : 'Set up payouts in Stripe'}</Text></>}
      </Pressable>

      <Text style={[styles.note, { color: colors.mutedForeground }]}>Bank and card details are collected and managed only by Stripe. Old Time does not collect or store them.</Text>
    </ScrollView>
  );
}

function StatusRow({ label, value, colors, last }: { label: string; value: string; colors: ReturnType<typeof useColors>; last?: boolean }) {
  return <View style={[styles.statusRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}><Text style={[styles.statusLabel, { color: colors.foreground }]}>{label}</Text><Text style={[styles.statusValue, { color: colors.mutedForeground }]}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 18 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  backButton: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerSpacer: { width: 44 },
  title: { fontFamily: 'Fraunces_900Black', fontSize: 24 },
  hero: { borderRadius: 24, borderWidth: 1, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16 },
  heroIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  heroCopy: { flex: 1 },
  heroTitle: { fontFamily: 'Fraunces_900Black', fontSize: 20, letterSpacing: -0.3 },
  heroBody: { fontFamily: 'Outfit_500Medium', fontSize: 14, lineHeight: 20, marginTop: 4 },
  loader: { marginVertical: 28 },
  statusCard: { borderWidth: 1, borderRadius: 24, overflow: 'hidden' },
  statusRow: { minHeight: 64, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusLabel: { fontFamily: 'Outfit_700Bold', fontSize: 15 },
  statusValue: { fontFamily: 'Outfit_500Medium', fontSize: 14, textTransform: 'capitalize' },
  error: { fontFamily: 'Outfit_500Medium', fontSize: 14, lineHeight: 20 },
  primaryButton: { minHeight: 56, borderRadius: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  primaryButtonText: { color: '#ffffff', fontFamily: 'Outfit_700Bold', fontSize: 16 },
  secondaryButton: { minHeight: 56, borderRadius: 28, borderWidth: 1, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  secondaryButtonText: { flex: 1, fontFamily: 'Outfit_700Bold', fontSize: 15 },
  note: { fontFamily: 'Outfit_400Regular', fontSize: 13, lineHeight: 19, textAlign: 'center', paddingHorizontal: 12 },
});