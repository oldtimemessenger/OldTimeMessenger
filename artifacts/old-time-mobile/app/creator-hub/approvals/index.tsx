import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { CreatorHubApi } from '@/lib/api-creator-hub';
import { useAuth } from '@/lib/auth';
import { useBusinessApprovals } from '@/hooks/useCreatorHub';

export default function ApprovalsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { getToken } = useAuth();

  const { data: approvals, isLoading, isError, refetch } = useBusinessApprovals();

  const review = async (id: number, approved: boolean) => {
    try {
      await CreatorHubApi.reviewApproval(getToken, id, approved);
      refetch();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Could not review approval.');
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top, height: insets.top + 56, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Approvals</Text>
        <View style={styles.headerButton} />
      </View>
      
      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : isError ? (
        <View style={styles.center}>
          <Text style={{ color: colors.destructive }}>Could not load approvals.</Text>
          <Pressable onPress={() => refetch()} style={[styles.retry, { borderColor: colors.border }]}><Text style={{ color: colors.foreground }}>Retry</Text></Pressable>
        </View>
      ) : !approvals?.length ? (
        <View style={styles.center}>
          <Text style={[styles.empty, { color: colors.mutedForeground }]}>No pending approvals.</Text>
        </View>
      ) : (
        <FlatList
          data={approvals}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 20 }]}
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.name, { color: colors.foreground }]}>Creator #{item.creatorUserId}</Text>
                <Text style={[styles.status, { color: item.status === 'pending' ? '#EAB308' : item.status === 'approved' ? colors.primary : colors.destructive }]}>{item.status}</Text>
              </View>
              <Text style={[styles.desc, { color: colors.mutedForeground }]}>Applied for Product #{item.productId}</Text>
              {item.status === 'pending' && (
                <View style={styles.actions}>
                  <Pressable onPress={() => review(item.id, true)} style={[styles.actionBtn, { backgroundColor: colors.foreground }]}>
                    <Text style={[styles.actionBtnText, { color: colors.background }]}>Approve</Text>
                  </Pressable>
                  <Pressable onPress={() => review(item.id, false)} style={[styles.actionBtn, { borderColor: colors.border, borderWidth: 1 }]}>
                    <Text style={[styles.actionBtnText, { color: colors.foreground }]}>Decline</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16 },
  headerTitle: { fontFamily: 'NunitoSans_800ExtraBold', fontSize: 20 },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  retry: { marginTop: 16, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderRadius: 16 },
  empty: { fontFamily: 'NunitoSans_600SemiBold', fontSize: 16 },
  list: { padding: 16, gap: 12 },
  card: { padding: 16, borderWidth: 1, borderRadius: 16 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  name: { fontFamily: 'NunitoSans_700Bold', fontSize: 16 },
  status: { fontFamily: 'NunitoSans_800ExtraBold', fontSize: 14, textTransform: 'uppercase' },
  desc: { fontFamily: 'NunitoSans_400Regular', fontSize: 14, marginBottom: 16 },
  actions: { flexDirection: 'row', gap: 12 },
  actionBtn: { flex: 1, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  actionBtnText: { fontFamily: 'NunitoSans_700Bold', fontSize: 14 },
});