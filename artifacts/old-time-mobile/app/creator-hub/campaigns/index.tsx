import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { CreatorHubApi } from '@/lib/api-creator-hub';
import { useAuth } from '@/lib/auth';
import { CH_KEYS, useCampaigns, useCreatorHubMe } from '@/hooks/useCreatorHub';
import { useQueryClient } from '@tanstack/react-query';

export default function CampaignsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  const { data: me } = useCreatorHubMe();
  const isBusiness = me?.profile?.role === 'business';

  const { data: campaigns, isLoading, isError, refetch } = useCampaigns();
  
  const [modalVisible, setModalVisible] = useState(false);
  const [productId, setProductId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [commissionBps, setCommissionBps] = useState('1000');
  const [saving, setSaving] = useState(false);

  const applyCampaign = async (id: number) => {
    if (isBusiness) {
      Alert.alert('Notice', 'Businesses cannot apply to campaigns.');
      return;
    }
    Alert.alert('Apply to Campaign', 'Do you want to request a referral link for this campaign?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Apply', onPress: async () => {
        try {
          await CreatorHubApi.applyCampaign(getToken, id);
          Alert.alert('Applied', 'Your application is pending business approval.');
        } catch (error) {
          Alert.alert('Error', error instanceof Error ? error.message : 'Could not apply.');
        }
      }}
    ]);
  };

  const createCampaign = async () => {
    if (!productId || !name || !commissionBps) {
      Alert.alert('Required', 'Product ID, Name, and Commission are required.');
      return;
    }
    setSaving(true);
    try {
      await CreatorHubApi.createCampaign(getToken, {
        productId: Number(productId),
        name,
        description,
        commissionBps: Number(commissionBps),
        status: 'active'
      });
      setModalVisible(false);
      refetch();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Could not create campaign.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top, height: insets.top + 56, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Campaigns</Text>
        <View style={styles.headerButton}>
          {isBusiness && (
            <Pressable onPress={() => setModalVisible(true)} style={styles.headerButton}>
              <Ionicons name="add" size={26} color={colors.foreground} />
            </Pressable>
          )}
        </View>
      </View>
      
      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : isError ? (
        <View style={styles.center}>
          <Text style={{ color: colors.destructive }}>Could not load campaigns.</Text>
          <Pressable onPress={() => refetch()} style={[styles.retry, { borderColor: colors.border }]}><Text style={{ color: colors.foreground }}>Retry</Text></Pressable>
        </View>
      ) : !campaigns?.length ? (
        <View style={styles.center}>
          <Text style={[styles.empty, { color: colors.mutedForeground }]}>No active campaigns.</Text>
        </View>
      ) : (
        <FlatList
          data={campaigns}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 20 }]}
          renderItem={({ item }) => (
            <Pressable onPress={() => applyCampaign(item.id)} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.name, { color: colors.foreground }]}>{item.name}</Text>
                <Text style={[styles.rate, { color: colors.action }]}>{(item.commissionBps / 100).toFixed(1)}%</Text>
              </View>
              <Text style={[styles.desc, { color: colors.mutedForeground }]}>{item.description || 'Promote this product to earn commissions on every sale.'}</Text>
              {!isBusiness && (
                <View style={styles.actionRow}>
                  <Text style={[styles.applyText, { color: colors.foreground }]}>Tap to apply</Text>
                  <Ionicons name="arrow-forward" size={16} color={colors.foreground} />
                </View>
              )}
            </Pressable>
          )}
        />
      )}

      {/* Create Modal */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.modalScreen, { backgroundColor: colors.background }]}>
          <View style={[styles.header, { paddingTop: insets.top, height: insets.top + 56, borderBottomColor: colors.border }]}>
            <Pressable onPress={() => setModalVisible(false)} style={styles.headerButton}>
              <Ionicons name="close" size={26} color={colors.foreground} />
            </Pressable>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>New Campaign</Text>
            <View style={styles.headerButton} />
          </View>
          <ScrollView contentContainerStyle={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]} keyboardShouldPersistTaps="handled">
            <Text style={[styles.label, { color: colors.foreground }]}>Product ID</Text>
            <TextInput style={[styles.input, { color: colors.foreground, borderColor: colors.border }]} value={productId} onChangeText={setProductId} keyboardType="number-pad" />
            <Text style={[styles.label, { color: colors.foreground }]}>Campaign Name</Text>
            <TextInput style={[styles.input, { color: colors.foreground, borderColor: colors.border }]} value={name} onChangeText={setName} />
            <Text style={[styles.label, { color: colors.foreground }]}>Description</Text>
            <TextInput style={[styles.input, { color: colors.foreground, borderColor: colors.border }]} value={description} onChangeText={setDescription} />
            <Text style={[styles.label, { color: colors.foreground }]}>Commission Rate (bps, e.g. 1000 = 10%)</Text>
            <TextInput style={[styles.input, { color: colors.foreground, borderColor: colors.border }]} value={commissionBps} onChangeText={setCommissionBps} keyboardType="number-pad" />
            <View style={{ height: 40 }} />
            <Pressable disabled={saving} onPress={createCampaign} style={[styles.submitBtn, { backgroundColor: colors.action, opacity: saving ? 0.5 : 1 }]}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Create Campaign</Text>}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
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
  rate: { fontFamily: 'NunitoSans_800ExtraBold', fontSize: 16 },
  desc: { fontFamily: 'NunitoSans_400Regular', fontSize: 14, marginBottom: 16 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  applyText: { fontFamily: 'NunitoSans_700Bold', fontSize: 14 },
  modalScreen: { flex: 1 },
  modalContent: { flex: 1, padding: 20 },
  label: { fontFamily: 'NunitoSans_700Bold', fontSize: 15, marginBottom: 6 },
  input: { height: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, marginBottom: 16, fontFamily: 'NunitoSans_400Regular', fontSize: 16 },
  submitBtn: { height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  submitBtnText: { color: '#fff', fontFamily: 'NunitoSans_800ExtraBold', fontSize: 18 },
});