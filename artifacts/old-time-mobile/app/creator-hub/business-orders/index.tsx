import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { CreatorHubApi, CreatorHubOrderItem } from '@/lib/api-creator-hub';
import { useAuth } from '@/lib/auth';
import { useBusinessOrders } from '@/hooks/useCreatorHub';

export default function BusinessOrdersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { getToken } = useAuth();

  const { data: orders, isLoading, isError, refetch } = useBusinessOrders();

  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<CreatorHubOrderItem | null>(null);
  const [status, setStatus] = useState<'shipped' | 'delivered'>('shipped');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [saving, setSaving] = useState(false);

  const openEdit = (item: CreatorHubOrderItem) => {
    setEditingItem(item);
    setStatus(item.fulfillmentStatus === 'delivered' ? 'delivered' : 'shipped');
    setTrackingNumber(item.trackingNumber || '');
    setModalVisible(true);
  };

  const updateShipping = async () => {
    if (!editingItem) return;
    setSaving(true);
    try {
      await CreatorHubApi.updateBusinessOrderItemShipping(getToken, editingItem.id, status, trackingNumber || null);
      setModalVisible(false);
      refetch();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Could not update shipping.');
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
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Business Orders</Text>
        <View style={styles.headerButton} />
      </View>
      
      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : isError ? (
        <View style={styles.center}>
          <Text style={{ color: colors.destructive }}>Could not load orders.</Text>
          <Pressable onPress={() => refetch()} style={[styles.retry, { borderColor: colors.border }]}><Text style={{ color: colors.foreground }}>Retry</Text></Pressable>
        </View>
      ) : !orders?.length ? (
        <View style={styles.center}>
          <Text style={[styles.empty, { color: colors.mutedForeground }]}>No orders yet.</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 20 }]}
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.name, { color: colors.foreground }]}>Order #{item.orderId}</Text>
                <Text style={[styles.status, { color: item.fulfillmentStatus === 'unfulfilled' ? '#EAB308' : colors.primary }]}>{item.fulfillmentStatus}</Text>
              </View>
              <Text style={[styles.desc, { color: colors.foreground }]}>Product #{item.productId} (x{item.quantity})</Text>
              <Text style={[styles.desc, { color: colors.mutedForeground }]}>Commission: ${(item.commissionCents / 100).toFixed(2)}</Text>
              
              <View style={styles.actions}>
                <Pressable onPress={() => openEdit(item)} style={[styles.actionBtn, { borderColor: colors.border }]}>
                  <Text style={[styles.actionBtnText, { color: colors.foreground }]}>Update Shipping</Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      )}

      {/* Edit Modal */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.modalScreen, { backgroundColor: colors.background }]}>
          <View style={[styles.header, { paddingTop: insets.top, height: insets.top + 56, borderBottomColor: colors.border }]}>
            <Pressable onPress={() => setModalVisible(false)} style={styles.headerButton}>
              <Ionicons name="close" size={26} color={colors.foreground} />
            </Pressable>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>Update Shipping</Text>
            <View style={styles.headerButton} />
          </View>
          <ScrollView contentContainerStyle={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]} keyboardShouldPersistTaps="handled">
            <Text style={[styles.label, { color: colors.foreground }]}>Status</Text>
            <View style={styles.segmented}>
              <Pressable onPress={() => setStatus('shipped')} style={[styles.segmentBtn, status === 'shipped' && { backgroundColor: colors.foreground }]}>
                <Text style={[styles.segmentText, { color: status === 'shipped' ? colors.background : colors.foreground }]}>Shipped</Text>
              </Pressable>
              <Pressable onPress={() => setStatus('delivered')} style={[styles.segmentBtn, status === 'delivered' && { backgroundColor: colors.foreground }]}>
                <Text style={[styles.segmentText, { color: status === 'delivered' ? colors.background : colors.foreground }]}>Delivered</Text>
              </Pressable>
            </View>

            <Text style={[styles.label, { color: colors.foreground }]}>Tracking Number</Text>
            <TextInput style={[styles.input, { color: colors.foreground, borderColor: colors.border }]} value={trackingNumber} onChangeText={setTrackingNumber} autoCapitalize="none" />
            
            <View style={{ height: 40 }} />
            <Pressable disabled={saving} onPress={updateShipping} style={[styles.submitBtn, { backgroundColor: colors.action, opacity: saving ? 0.5 : 1 }]}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Save</Text>}
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
  status: { fontFamily: 'NunitoSans_800ExtraBold', fontSize: 14, textTransform: 'uppercase' },
  desc: { fontFamily: 'NunitoSans_400Regular', fontSize: 14, marginBottom: 4 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 12 },
  actionBtn: { paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderRadius: 16 },
  actionBtnText: { fontFamily: 'NunitoSans_600SemiBold', fontSize: 14 },
  
  modalScreen: { flex: 1 },
  modalContent: { flex: 1, padding: 20 },
  label: { fontFamily: 'NunitoSans_700Bold', fontSize: 15, marginBottom: 8 },
  segmented: { flexDirection: 'row', borderWidth: 1, borderColor: '#E4E4E4', borderRadius: 12, overflow: 'hidden', marginBottom: 20 },
  segmentBtn: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  segmentText: { fontFamily: 'NunitoSans_600SemiBold', fontSize: 15 },
  input: { height: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, fontFamily: 'NunitoSans_400Regular', fontSize: 16 },
  submitBtn: { height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  submitBtnText: { color: '#fff', fontFamily: 'NunitoSans_800ExtraBold', fontSize: 18 },
});