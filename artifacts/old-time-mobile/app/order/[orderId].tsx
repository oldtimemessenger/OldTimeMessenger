import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Modal, Pressable, StyleSheet, Text, TextInput, View, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { CH_KEYS, useOrder } from '@/hooks/useCreatorHub';
import { CreatorHubApi } from '@/lib/api-creator-hub';
import { useAuth } from '@/lib/auth';
import { useQueryClient } from '@tanstack/react-query';

export default function OrderDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const id = Number(orderId);
  const { data: order, isLoading, isError, refetch } = useOrder(id);
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  const [reviewingItem, setReviewingItem] = useState<number | null>(null);
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const submitReview = async () => {
    if (!reviewingItem) return;
    setSubmittingReview(true);
    try {
      await CreatorHubApi.reviewOrderItem(getToken, reviewingItem, { rating, body: body.trim() });
      Alert.alert('Success', 'Review submitted successfully.');
      setReviewingItem(null);
      setBody('');
      setRating(5);
      await queryClient.invalidateQueries({ queryKey: CH_KEYS.order(id) });
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Could not submit review.');
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top, height: insets.top + 56, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Order #{id}</Text>
        <View style={styles.headerButton} />
      </View>
      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : isError || !order ? (
        <View style={styles.center}>
          <Text style={{ color: colors.destructive }}>Could not load order.</Text>
          <Pressable onPress={() => refetch()} style={[styles.retry, { borderColor: colors.border }]}><Text style={{ color: colors.foreground }}>Retry</Text></Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]} showsVerticalScrollIndicator={false}>
          <View style={[styles.summary, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Status</Text>
              <Text style={[styles.summaryValue, { color: order.status === 'paid' ? colors.primary : colors.foreground, textTransform: 'uppercase' }]}>{order.status}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Total</Text>
              <Text style={[styles.summaryValue, { color: colors.foreground }]}>${(order.totalCents / 100).toFixed(2)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Date</Text>
              <Text style={[styles.summaryValue, { color: colors.foreground }]}>{new Date(order.createdAt).toLocaleString()}</Text>
            </View>
          </View>
          
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Items</Text>
          <View style={styles.items}>
            {order.items.map(item => (
              <View key={item.id} style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.itemHeader}>
                  <Text style={[styles.itemName, { color: colors.foreground }]}>Product {item.productId}</Text>
                  <Text style={[styles.itemPrice, { color: colors.foreground }]}>${(item.unitPriceCents / 100).toFixed(2)} × {item.quantity}</Text>
                </View>
                <View style={styles.itemMeta}>
                  <Text style={[styles.itemStatus, { color: colors.mutedForeground }]}>
                    Fulfillment: <Text style={{ color: colors.foreground }}>{item.fulfillmentStatus}</Text>
                  </Text>
                  {item.trackingNumber ? (
                    <Text style={[styles.itemStatus, { color: colors.mutedForeground }]}>Tracking: {item.trackingNumber}</Text>
                  ) : null}
                </View>
                {order.status === 'paid' && (
                  <Pressable onPress={() => setReviewingItem(item.id)} style={[styles.reviewBtn, { borderColor: colors.border }]}>
                    <Text style={[styles.reviewBtnText, { color: colors.foreground }]}>Leave a Review</Text>
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {/* Review Modal */}
      <Modal visible={reviewingItem !== null} transparent animationType="fade" onRequestClose={() => setReviewingItem(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background, paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Leave Review</Text>
              <Pressable onPress={() => setReviewingItem(null)} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={colors.foreground} />
              </Pressable>
            </View>
            <View style={styles.starRow}>
              {[1, 2, 3, 4, 5].map(star => (
                <Pressable key={star} onPress={() => setRating(star)} style={styles.starBtn}>
                  <Ionicons name={rating >= star ? 'star' : 'star-outline'} size={32} color="#EAB308" />
                </Pressable>
              ))}
            </View>
            <TextInput
              style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
              placeholder="What did you think? (Optional)"
              placeholderTextColor={colors.mutedForeground}
              value={body}
              onChangeText={setBody}
              multiline
              textAlignVertical="top"
              maxLength={2000}
            />
            <Pressable disabled={submittingReview} onPress={submitReview} style={[styles.submitBtn, { backgroundColor: colors.action, opacity: submittingReview ? 0.5 : 1 }]}>
              {submittingReview ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Submit</Text>}
            </Pressable>
          </View>
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
  content: { padding: 16 },
  summary: { padding: 16, borderWidth: 1, borderRadius: 16, marginBottom: 24, gap: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontFamily: 'NunitoSans_600SemiBold', fontSize: 15 },
  summaryValue: { fontFamily: 'NunitoSans_700Bold', fontSize: 15 },
  sectionTitle: { fontFamily: 'NunitoSans_800ExtraBold', fontSize: 18, marginBottom: 16 },
  items: { gap: 12 },
  itemCard: { padding: 16, borderWidth: 1, borderRadius: 16 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  itemName: { fontFamily: 'NunitoSans_700Bold', fontSize: 16 },
  itemPrice: { fontFamily: 'NunitoSans_700Bold', fontSize: 15 },
  itemMeta: { gap: 4, marginBottom: 12 },
  itemStatus: { fontFamily: 'NunitoSans_500Medium', fontSize: 14, textTransform: 'capitalize' },
  reviewBtn: { alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderRadius: 16 },
  reviewBtnText: { fontFamily: 'NunitoSans_700Bold', fontSize: 14 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontFamily: 'NunitoSans_800ExtraBold', fontSize: 20 },
  closeBtn: { padding: 4 },
  starRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 24 },
  starBtn: { padding: 4 },
  input: { minHeight: 120, borderWidth: 1, borderRadius: 16, padding: 16, fontFamily: 'NunitoSans_400Regular', fontSize: 16, marginBottom: 24 },
  submitBtn: { height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  submitBtnText: { color: '#fff', fontFamily: 'NunitoSans_800ExtraBold', fontSize: 18 },
});