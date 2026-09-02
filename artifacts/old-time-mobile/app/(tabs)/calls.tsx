import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getListUsersQueryKey, useListUsers } from '@workspace/api-client-react';
import { Avatar, EmptyState, Screen, SectionLabel } from '@/components/ui';
import { useApp, type CallRecord } from '@/context/app-state';
import { useColors } from '@/hooks/useColors';
import { t } from '@/lib/i18n';

export default function CallsScreen() {
  const colors = useColors();
  const { calls, addCall, session, settings } = useApp();
  const translate = (key: Parameters<typeof t>[1]) => t(settings.language, key);
  const contacts = useListUsers(
    { viewerId: session?.id ?? 0 },
    { query: { enabled: Boolean(session), queryKey: getListUsersQueryKey({ viewerId: session?.id ?? 0 }) } },
  );

  async function call(name: string, phone: string) {
    try {
      await Linking.openURL(`tel:${phone}`);
      addCall({ name, phone, type: 'voice', direction: 'outgoing' });
    } catch {
      Alert.alert('Call unavailable', 'This device cannot open the phone dialer.');
    }
  }

  return <Screen title={translate('calls')}>
    <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}>
      <SectionLabel>{translate('contacts')}</SectionLabel>
      {contacts.isLoading ? (
        <View style={styles.stateRow}><Ionicons name="hourglass-outline" size={20} color={colors.primary} /><Text style={[styles.stateText, { color: colors.mutedForeground }]}>{translate('loadingContacts')}</Text></View>
      ) : contacts.isError ? (
        <Pressable onPress={() => void contacts.refetch()} style={[styles.stateRow, { borderColor: colors.border }]} accessibilityRole="button">
          <Ionicons name="cloud-offline-outline" size={20} color={colors.destructive} />
          <Text style={[styles.stateText, { color: colors.foreground }]}>{translate('contactsLoadError')} {translate('tapToRetry')}</Text>
          <Ionicons name="refresh" size={18} color={colors.primary} />
        </Pressable>
      ) : contacts.data?.length ? contacts.data.map((contact) => (
        <Pressable key={contact.id} onPress={() => void call(contact.name, contact.phone)} style={[styles.callRow, { borderBottomColor: colors.border }]}>
          <Avatar name={contact.name} size={46} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: colors.foreground }]}>{contact.name}</Text>
            <Text style={[styles.meta, { color: colors.mutedForeground }]}>{contact.phone}</Text>
          </View>
          <Ionicons name="call-outline" size={22} color={colors.primary} />
        </Pressable>
      )) : <EmptyState icon="people-outline" title={translate('noContacts')} description={translate('noContactsDescription')} />}
      {calls.length ? <>
        <SectionLabel>{translate('recent')}</SectionLabel>
        {calls.map((item) => (
          <Pressable key={item.id} disabled={!item.phone} onPress={() => item.phone ? void call(item.name, item.phone) : undefined} style={[styles.callRow, { borderBottomColor: colors.border, opacity: item.phone ? 1 : 0.82 }]}>
            <Avatar name={item.name} size={46} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: colors.foreground }]}>{item.name}</Text>
              <Text style={[styles.meta, { color: item.direction === 'missed' ? colors.destructive : colors.mutedForeground }]}>
                {item.direction === 'missed' ? translate('missed') : item.direction === 'incoming' ? translate('incoming') : translate('outgoing')} · {new Date(item.createdAt).toLocaleString()}
              </Text>
            </View>
            {item.phone ? <Ionicons name="call-outline" size={20} color={colors.primary} /> : null}
          </Pressable>
        ))}
      </> : null}
    </ScrollView>
  </Screen>;
}

const styles = StyleSheet.create({
  callRow: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: StyleSheet.hairlineWidth },
  name: { fontSize: 15, fontWeight: '700' },
  meta: { fontSize: 12, marginTop: 4 },
  stateRow: { minHeight: 58, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, marginBottom: 14 },
  stateText: { flex: 1, fontSize: 14, lineHeight: 19 },
});