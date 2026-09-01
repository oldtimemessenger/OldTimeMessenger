import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getListUsersQueryKey, useListUsers } from '@workspace/api-client-react';
import { Avatar, EmptyState, Screen, SectionLabel } from '@/components/ui';
import { useApp } from '@/context/app-state';
import { useColors } from '@/hooks/useColors';

export default function CallsScreen() {
  const colors = useColors();
  const { calls, addCall, session } = useApp();
  const contacts = useListUsers(
    { viewerId: session?.id ?? 0 },
    { query: { enabled: Boolean(session), queryKey: getListUsersQueryKey({ viewerId: session?.id ?? 0 }) } },
  );
  const others = (contacts.data ?? []).filter((contact) => contact.id !== session?.id);

  async function call(name: string, phone: string) {
    try {
      await Linking.openURL(`tel:${phone}`);
      addCall({ name, type: 'voice', direction: 'outgoing' });
    } catch {
      Alert.alert('Call unavailable', 'This device cannot open the phone dialer.');
    }
  }

  return <Screen title="Calls">
    <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}>
      <SectionLabel>Contacts</SectionLabel>
      {others.length ? others.map((contact) => (
        <Pressable key={contact.id} onPress={() => void call(contact.name, contact.phone)} style={[styles.callRow, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
          <Avatar name={contact.name} size={46} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: colors.foreground }]}>{contact.name}</Text>
            <Text style={[styles.meta, { color: colors.mutedForeground }]}>{contact.phone}</Text>
          </View>
          <Ionicons name="call" size={20} color={colors.primary} />
        </Pressable>
      )) : <EmptyState icon="people-outline" title="No contacts yet" description="Other Old Time users will appear here when they are available." />}
      {calls.length ? <>
        <SectionLabel>Recent</SectionLabel>
        {calls.map((item) => (
          <View key={item.id} style={[styles.callRow, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
            <Avatar name={item.name} size={46} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: colors.foreground }]}>{item.name}</Text>
              <Text style={[styles.meta, { color: item.direction === 'missed' ? colors.destructive : colors.mutedForeground }]}>
                {item.direction === 'missed' ? 'Missed' : item.direction === 'incoming' ? 'Incoming' : 'Outgoing'} · {new Date(item.createdAt).toLocaleString()}
              </Text>
            </View>
            <Ionicons name={item.type === 'video' ? 'videocam-outline' : 'call-outline'} size={18} color={colors.mutedForeground} />
          </View>
        ))}
      </> : null}
    </ScrollView>
  </Screen>;
}

const styles = StyleSheet.create({
  callRow: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 10, borderRadius: 12, marginBottom: 6 },
  name: { fontSize: 15, fontWeight: '700' },
  meta: { fontSize: 12, marginTop: 4 },
});
