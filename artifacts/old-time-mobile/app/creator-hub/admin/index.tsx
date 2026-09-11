import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Alert, ScrollView, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { CreatorHubApi } from '@/lib/api-creator-hub';
import { useAuth } from '@/lib/auth';
import { useAdminQueues } from '@/hooks/useCreatorHub';

export default function AdminScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { getToken } = useAuth();
  
  const { data: queues, isLoading, isError, refetch } = useAdminQueues();

  const reviewCreator = async (id: number, approved: boolean) => {
    try {
      await CreatorHubApi.reviewCreatorApplication(getToken, id, approved);
      refetch();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Could not review creator.');
    }
  };

  const reviewBusiness = async (id: number, approved: boolean) => {
    try {
      await CreatorHubApi.reviewBusinessVerification(getToken, id, approved);
      refetch();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Could not review business.');
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top, height: insets.top + 56, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Admin Reviews</Text>
        <View style={styles.headerButton} />
      </View>
      
      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : isError ? (
        <View style={styles.center}>
          <Text style={{ color: colors.destructive }}>Could not load admin queues.</Text>
          <Pressable onPress={() => refetch()} style={[styles.retry, { borderColor: colors.border }]}><Text style={{ color: colors.foreground }}>Retry</Text></Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]} showsVerticalScrollIndicator={false}>
          
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Creator Applications</Text>
          {!queues?.creatorApplications.length ? (
            <Text style={[styles.empty, { color: colors.mutedForeground }]}>No pending creator applications.</Text>
          ) : (
            <View style={styles.list}>
              {queues.creatorApplications.map(app => (
                <View key={app.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.cardTitle, { color: colors.foreground }]}>User #{app.userId}</Text>
                  {app.portfolioUrl ? (
                    <Text style={[styles.cardText, { color: colors.action }]}>{app.portfolioUrl}</Text>
                  ) : null}
                  <Text style={[styles.cardText, { color: colors.foreground }]}>{app.notes}</Text>
                  <View style={styles.actions}>
                    <Pressable onPress={() => reviewCreator(app.id, true)} style={[styles.actionBtn, { backgroundColor: colors.foreground }]}>
                      <Text style={[styles.actionBtnText, { color: colors.background }]}>Approve</Text>
                    </Pressable>
                    <Pressable onPress={() => reviewCreator(app.id, false)} style={[styles.actionBtn, { borderColor: colors.border, borderWidth: 1 }]}>
                      <Text style={[styles.actionBtnText, { color: colors.foreground }]}>Reject</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}

          <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 24 }]}>Business Verifications</Text>
          {!queues?.businessVerifications.length ? (
            <Text style={[styles.empty, { color: colors.mutedForeground }]}>No pending business verifications.</Text>
          ) : (
            <View style={styles.list}>
              {queues.businessVerifications.map(biz => (
                <View key={biz.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.cardTitle, { color: colors.foreground }]}>{biz.legalName}</Text>
                  <Text style={[styles.cardText, { color: colors.mutedForeground }]}>User #{biz.userId}</Text>
                  <Text style={[styles.cardText, { color: colors.foreground }]}>Tax ID (Last 4): {biz.taxIdLast4 || 'N/A'}</Text>
                  <View style={styles.actions}>
                    <Pressable onPress={() => reviewBusiness(biz.id, true)} style={[styles.actionBtn, { backgroundColor: colors.foreground }]}>
                      <Text style={[styles.actionBtnText, { color: colors.background }]}>Approve</Text>
                    </Pressable>
                    <Pressable onPress={() => reviewBusiness(biz.id, false)} style={[styles.actionBtn, { borderColor: colors.border, borderWidth: 1 }]}>
                      <Text style={[styles.actionBtnText, { color: colors.foreground }]}>Reject</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
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
  content: { padding: 16 },
  sectionTitle: { fontFamily: 'NunitoSans_800ExtraBold', fontSize: 18, marginBottom: 12 },
  empty: { fontFamily: 'NunitoSans_400Regular', fontSize: 15, fontStyle: 'italic' },
  list: { gap: 12 },
  card: { padding: 16, borderWidth: 1, borderRadius: 16 },
  cardTitle: { fontFamily: 'NunitoSans_700Bold', fontSize: 16, marginBottom: 4 },
  cardText: { fontFamily: 'NunitoSans_400Regular', fontSize: 15, marginBottom: 6 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 12 },
  actionBtn: { flex: 1, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  actionBtnText: { fontFamily: 'NunitoSans_700Bold', fontSize: 14 },
});