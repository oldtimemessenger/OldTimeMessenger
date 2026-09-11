import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useCreatorHubMe, useDashboard } from '@/hooks/useCreatorHub';

export default function CreatorHubScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: me, isLoading: meLoading, isError: meError, refetch: refetchMe } = useCreatorHubMe();
  const { data: dashboard, isLoading: dashLoading } = useDashboard();

  const isCreator = me?.profile?.role === 'creator' && me?.profile?.verificationState === 'approved';
  const isBusiness = me?.profile?.role === 'business' && me?.profile?.verificationState === 'approved';
  const isApproved = isCreator || isBusiness;
  const canManageReviews = me?.isSystemAdmin === true;

  const isLoading = meLoading || ((isApproved || canManageReviews) && dashLoading);
  
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top, height: insets.top + 56, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Creator Hub</Text>
        <View style={styles.headerButton} />
      </View>
      
      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : meError ? (
        <View style={styles.center}>
          <Text style={{ color: colors.destructive }}>Could not load Creator Hub.</Text>
          <Pressable onPress={() => refetchMe()} style={[styles.retry, { borderColor: colors.border }]}><Text style={{ color: colors.foreground }}>Retry</Text></Pressable>
        </View>
      ) : (isApproved || canManageReviews) && dashboard ? (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]} showsVerticalScrollIndicator={false}>
          <Text style={[styles.welcome, { color: colors.foreground }]}>Welcome back, {me.profile?.displayName}</Text>
          
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.statValue, { color: colors.foreground }]}>${(dashboard.totalCents / 100).toFixed(2)}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Total Sales</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.statValue, { color: colors.foreground }]}>${(dashboard.commissionCents / 100).toFixed(2)}</Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Commissions</Text>
            </View>
          </View>

          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Management</Text>
          <View style={[styles.menu, { borderColor: colors.border, backgroundColor: colors.card }]}>
            {canManageReviews && (
              <MenuRow title="Admin Reviews" icon="shield-checkmark-outline" onPress={() => router.push('/creator-hub/admin' as never)} colors={colors} />
            )}
            {isBusiness && (
              <>
                <MenuRow title="Products" icon="cube-outline" onPress={() => router.push('/creator-hub/products' as never)} colors={colors} />
                <MenuRow title="Campaigns" icon="megaphone-outline" onPress={() => router.push('/creator-hub/campaigns' as never)} colors={colors} />
                <MenuRow title="Approvals" icon="people-outline" onPress={() => router.push('/creator-hub/approvals' as never)} colors={colors} />
                <MenuRow title="Orders" icon="cube-outline" onPress={() => router.push('/creator-hub/business-orders' as never)} colors={colors} last />
              </>
            )}
            {isCreator && (
              <MenuRow title="Browse Campaigns" icon="search-outline" onPress={() => router.push('/creator-hub/campaigns' as never)} colors={colors} last />
            )}
          </View>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]} showsVerticalScrollIndicator={false}>
          <Text style={[styles.welcome, { color: colors.foreground }]}>Join Creator Hub</Text>
          <Text style={[styles.desc, { color: colors.mutedForeground }]}>Apply as a Creator to earn commissions, or verify as a Business to sell products.</Text>
          
          <View style={[styles.applyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.applyTitle, { color: colors.foreground }]}>Creator Application</Text>
            {me?.creatorApplication ? (
              <Text style={[styles.applyStatus, { color: colors.mutedForeground }]}>Status: <Text style={{ color: colors.foreground, textTransform: 'uppercase' }}>{me.creatorApplication.status}</Text></Text>
            ) : (
              <Pressable onPress={() => router.push('/creator-application' as never)} style={[styles.applyBtn, { backgroundColor: colors.foreground }]}>
                <Text style={[styles.applyBtnText, { color: colors.background }]}>Apply as Creator</Text>
              </Pressable>
            )}
          </View>

          <View style={[styles.applyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.applyTitle, { color: colors.foreground }]}>Business Verification</Text>
            {me?.businessVerification ? (
              <Text style={[styles.applyStatus, { color: colors.mutedForeground }]}>Status: <Text style={{ color: colors.foreground, textTransform: 'uppercase' }}>{me.businessVerification.status}</Text></Text>
            ) : (
              <Pressable onPress={() => router.push('/business-application' as never)} style={[styles.applyBtn, { backgroundColor: colors.foreground }]}>
                <Text style={[styles.applyBtnText, { color: colors.background }]}>Verify as Business</Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function MenuRow({ title, icon, onPress, colors, last = false }: any) {
  return (
    <Pressable onPress={onPress} style={[styles.menuRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
      <View style={styles.menuRowLeft}>
        <Ionicons name={icon} size={20} color={colors.foreground} />
        <Text style={[styles.menuRowText, { color: colors.foreground }]}>{title}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
    </Pressable>
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
  welcome: { fontFamily: 'NunitoSans_800ExtraBold', fontSize: 24, marginBottom: 8 },
  desc: { fontFamily: 'NunitoSans_400Regular', fontSize: 16, lineHeight: 24, marginBottom: 32 },
  statsGrid: { flexDirection: 'row', gap: 12, marginBottom: 32 },
  statCard: { flex: 1, padding: 16, borderWidth: 1, borderRadius: 16 },
  statValue: { fontFamily: 'NunitoSans_800ExtraBold', fontSize: 24, marginBottom: 4 },
  statLabel: { fontFamily: 'NunitoSans_600SemiBold', fontSize: 14 },
  sectionTitle: { fontFamily: 'NunitoSans_800ExtraBold', fontSize: 18, marginBottom: 16 },
  menu: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  menuRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  menuRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuRowText: { fontFamily: 'NunitoSans_700Bold', fontSize: 16 },
  applyCard: { padding: 20, borderWidth: 1, borderRadius: 16, marginBottom: 16 },
  applyTitle: { fontFamily: 'NunitoSans_800ExtraBold', fontSize: 18, marginBottom: 16 },
  applyStatus: { fontFamily: 'NunitoSans_700Bold', fontSize: 16 },
  applyBtn: { height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  applyBtnText: { fontFamily: 'NunitoSans_800ExtraBold', fontSize: 16 },
});