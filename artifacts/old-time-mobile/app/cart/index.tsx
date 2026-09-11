import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { CH_KEYS, useCart } from '@/hooks/useCreatorHub';
import { CreatorHubApi } from '@/lib/api-creator-hub';
import { useAuth } from '@/lib/auth';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { resolveRemoteMediaUrl } from '@/lib/api';
import { confirmStripePayment } from '@/lib/stripe-payment';

export default function CartScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: cart, isLoading, isError, refetch } = useCart();
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const [checkingOut, setCheckingOut] = useState(false);

  const updateQuantity = async (id: number, quantity: number) => {
    try {
      if (quantity < 1) {
        await CreatorHubApi.deleteCartItem(getToken, id);
      } else {
        await CreatorHubApi.updateCartItem(getToken, id, quantity);
      }
      queryClient.invalidateQueries({ queryKey: CH_KEYS.cart() });
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Could not update item.');
    }
  };

  const checkout = async () => {
    if (!cart?.items.length) return;
    setCheckingOut(true);
    try {
      const idempotencyKey = Date.now().toString() + Math.random().toString(36).substring(7);
      const order = await CreatorHubApi.createOrder(getToken, idempotencyKey);
      await queryClient.invalidateQueries({ queryKey: CH_KEYS.cart() });
      await queryClient.invalidateQueries({ queryKey: CH_KEYS.orders() });
      const result = await CreatorHubApi.checkoutOrder(getToken, order.id);
      const payment = await confirmStripePayment({
        publishableKey: result.publishableKey,
        clientSecret: result.clientSecret,
      });
      if (payment.canceled) return;
      Alert.alert(
        'Payment submitted',
        'Your payment is being confirmed securely. The order will update when Stripe confirms it.',
        [{ text: 'View Order', onPress: () => router.replace(`/order/${order.id}` as never) }]
      );
    } catch (error) {
      Alert.alert('Checkout Failed', error instanceof Error ? error.message : 'Could not place order.');
      setCheckingOut(false);
    }
  };

  const totalCents = cart?.items.reduce((sum, item) => sum + item.lineTotalCents, 0) ?? 0;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top, height: insets.top + 56, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Your Cart</Text>
        <View style={styles.headerButton} />
      </View>
      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : isError ? (
        <View style={styles.center}>
          <Text style={{ color: colors.destructive }}>Could not load cart.</Text>
          <Pressable onPress={() => refetch()} style={[styles.retry, { borderColor: colors.border }]}><Text style={{ color: colors.foreground }}>Retry</Text></Pressable>
        </View>
      ) : !cart?.items.length ? (
        <View style={styles.center}>
          <Ionicons name="cart-outline" size={64} color={colors.mutedForeground} style={{ marginBottom: 16 }} />
          <Text style={[styles.empty, { color: colors.mutedForeground }]}>Your cart is empty.</Text>
          <Pressable onPress={() => router.replace('/shop' as never)} style={[styles.retry, { borderColor: colors.border, marginTop: 24 }]}><Text style={{ color: colors.foreground }}>Browse Shop</Text></Pressable>
        </View>
      ) : (
        <>
          <FlatList
            data={cart.items}
            keyExtractor={item => String(item.id)}
            contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <View style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.imageWrap, { backgroundColor: colors.muted }]}>
                  {item.product?.imageObjectPaths[0] ? (
                    <Image source={resolveRemoteMediaUrl(item.product.imageObjectPaths[0])} style={styles.image} contentFit="cover" />
                  ) : (
                    <Ionicons name="image-outline" size={24} color={colors.mutedForeground} />
                  )}
                </View>
                <View style={styles.itemInfo}>
                  <Text numberOfLines={1} style={[styles.itemName, { color: colors.foreground }]}>{item.product?.name ?? 'Unknown Product'}</Text>
                  <Text style={[styles.itemPrice, { color: colors.foreground }]}>${(item.lineTotalCents / 100).toFixed(2)}</Text>
                  <View style={styles.qtyControls}>
                    <Pressable onPress={() => updateQuantity(item.id, item.quantity - 1)} style={[styles.qtyBtn, { backgroundColor: colors.secondary }]}>
                      <Ionicons name="remove" size={16} color={colors.foreground} />
                    </Pressable>
                    <Text style={[styles.qtyText, { color: colors.foreground }]}>{item.quantity}</Text>
                    <Pressable onPress={() => updateQuantity(item.id, item.quantity + 1)} style={[styles.qtyBtn, { backgroundColor: colors.secondary }]}>
                      <Ionicons name="add" size={16} color={colors.foreground} />
                    </Pressable>
                  </View>
                </View>
              </View>
            )}
          />
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16), backgroundColor: colors.background, borderTopColor: colors.border }]}>
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, { color: colors.foreground }]}>Total</Text>
              <Text style={[styles.totalAmount, { color: colors.foreground }]}>${(totalCents / 100).toFixed(2)}</Text>
            </View>
            <Pressable disabled={checkingOut} onPress={checkout} style={[styles.checkoutBtn, { backgroundColor: colors.action, opacity: checkingOut ? 0.5 : 1 }]}>
              {checkingOut ? <ActivityIndicator color="#fff" /> : <Text style={styles.checkoutBtnText}>Checkout</Text>}
            </Pressable>
          </View>
        </>
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
  list: { padding: 16, gap: 16 },
  itemCard: { flexDirection: 'row', padding: 12, borderWidth: 1, borderRadius: 16, gap: 16 },
  imageWrap: { width: 80, height: 80, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  itemInfo: { flex: 1, justifyContent: 'center' },
  itemName: { fontFamily: 'NunitoSans_700Bold', fontSize: 16, marginBottom: 4 },
  itemPrice: { fontFamily: 'NunitoSans_600SemiBold', fontSize: 14, marginBottom: 12 },
  qtyControls: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  qtyBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  qtyText: { fontFamily: 'NunitoSans_700Bold', fontSize: 16, minWidth: 20, textAlign: 'center' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, borderTopWidth: StyleSheet.hairlineWidth },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  totalLabel: { fontFamily: 'NunitoSans_600SemiBold', fontSize: 16 },
  totalAmount: { fontFamily: 'NunitoSans_800ExtraBold', fontSize: 22 },
  checkoutBtn: { height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  checkoutBtnText: { color: '#fff', fontFamily: 'NunitoSans_800ExtraBold', fontSize: 18 },
});