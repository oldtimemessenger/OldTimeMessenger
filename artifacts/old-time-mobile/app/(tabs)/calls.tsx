import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getListUsersQueryKey, listCalls, startCall, useListUsers, type Call } from '@workspace/api-client-react';
import { Avatar, EmptyState, Screen, SectionLabel } from '@/components/ui';
import { useApp } from '@/context/app-state';
import { useColors } from '@/hooks/useColors';
import { t } from '@/lib/i18n';

export default function CallsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { session, settings } = useApp();
  const translate = (key: Parameters<typeof t>[1]) => t(settings.language, key);
  const contacts = useListUsers({ viewerId: session?.id ?? 0 }, { query: { enabled: Boolean(session), queryKey: getListUsersQueryKey({ viewerId: session?.id ?? 0 }) } });
  const history = useQuery({ queryKey: ['calls'], queryFn: listCalls, enabled: Boolean(session), refetchInterval: 8_000 });
  const users = contacts.data ?? [];

  async function start(calleeId: number) {
    try {
      const call = await startCall({ calleeId });
      router.push({ pathname: '/call/[id]', params: { id: String(call.id) } } as any);
    } catch (error) {
      Alert.alert('Call not started', error instanceof Error ? error.message : 'Please try again.');
    }
  }
  const nameFor = (call: Call) => users.find((user) => user.id === (call.callerId === session?.id ? call.calleeId : call.callerId))?.name ?? 'Old Time member';
  const detailFor = (call: Call) => call.callerId === session?.id ? 'outgoing' : call.status === 'missed' ? 'missed' : 'incoming';

  return <Screen title={translate('calls')}>
    <ScrollView contentContainerStyle={styles.content}>
      <SectionLabel>{translate('contacts')}</SectionLabel>
      {contacts.isLoading ? <View style={styles.stateRow}><Ionicons name="hourglass-outline" size={20} color={colors.primary} /><Text style={[styles.stateText, { color: colors.mutedForeground }]}>{translate('loadingContacts')}</Text></View> : null}
      {contacts.isError ? <Pressable onPress={() => void contacts.refetch()} style={[styles.stateRow, { borderColor: colors.border }]}><Text style={[styles.stateText, { color: colors.foreground }]}>Contacts could not load. Tap to retry.</Text></Pressable> : null}
      {users.map((contact) => <Pressable key={contact.id} onPress={() => void start(contact.id)} style={[styles.row, { borderBottomColor: colors.border }]} testID={`call-contact-${contact.id}`}>
        <Avatar name={contact.name} size={46} /><View style={styles.grow}><Text style={[styles.name, { color: colors.foreground }]}>{contact.name}</Text><Text style={[styles.meta, { color: colors.mutedForeground }]}>Old Time audio call</Text></View><Ionicons name="call-outline" size={22} color={colors.primary} />
      </Pressable>)}
      {!contacts.isLoading && !contacts.isError && !users.length ? <EmptyState icon="people-outline" title={translate('noContacts')} description={translate('noContactsDescription')} /> : null}
      <SectionLabel>{translate('recent')}</SectionLabel>
      {history.isLoading ? <Text style={[styles.meta, { color: colors.mutedForeground }]}>Loading call history…</Text> : null}
      {history.isError ? <Pressable onPress={() => void history.refetch()}><Text style={[styles.meta, { color: colors.primary }]}>Call history could not load. Tap to retry.</Text></Pressable> : null}
      {history.data?.items.map((call) => <Pressable key={call.id} onPress={() => router.push({ pathname: '/call/[id]', params: { id: String(call.id) } } as any)} style={[styles.row, { borderBottomColor: colors.border }]}>
        <Avatar name={nameFor(call)} size={46} /><View style={styles.grow}><Text style={[styles.name, { color: colors.foreground }]}>{nameFor(call)}</Text><Text style={[styles.meta, { color: call.status === 'missed' ? colors.destructive : colors.mutedForeground }]}>{detailFor(call)} · {new Date(call.createdAt).toLocaleString()}</Text></View><Ionicons name={call.status === 'missed' ? 'call-outline' : 'chevron-forward'} size={20} color={colors.primary} />
      </Pressable>)}
    </ScrollView>
  </Screen>;
}
const styles = StyleSheet.create({ content: { paddingHorizontal: 16, paddingBottom: 100 }, row: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: StyleSheet.hairlineWidth }, grow: { flex: 1 }, name: { fontSize: 15, fontWeight: '700' }, meta: { fontSize: 12, marginTop: 4 }, stateRow: { minHeight: 58, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, marginBottom: 14 }, stateText: { flex: 1, fontSize: 14, lineHeight: 19 } });