import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { CreatorHubApi } from '@/lib/api-creator-hub';
import { CH_KEYS, useShopProduct } from '@/hooks/useCreatorHub';
import { resolveRemoteMediaUrl } from '@/lib/api';
import { Image } from 'expo-image';
import { useAuth } from '@/lib/auth';
import { useQueryClient, useMutation } from '@tanstack/react-query';

export default function ProductDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { productId, referralSlug } = useLocalSearchParams<{ productId: string; referralSlug?: string }>();
  const id = Number(productId);
  const { getToken, isSignedIn } = useAuth();
  const queryClient = useQueryClient();

  const { data: product, isLoading, isError, refetch } = useShopProduct(id);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (referralSlug && id) {
      CreatorHubApi.recordAffiliateClick(getToken, { productId: id, referralSlug }).catch(() => {});
    }
  }, [id, referralSlug, getToken]);

  const addToCart = async () => {
    if (!isSignedIn) {
      Alert.alert('Sign in required', 'Please sign in to add items to your cart.');
      return;
    }
    setAdding(true);
    try {
      await CreatorHubApi.addCartItem(getToken, { productId: id, quantity: 1, referralSlug: referralSlug ?? null });
      await queryClient.invalidateQueries({ queryKey: CH_KEYS.cart() });
      router.push('/cart' as never);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Could not add to cart.');
    } finally {
      setAdding(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top, height: insets.top + 56, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </Pressable>
        <Pressable onPress={() => router.push('/cart' as never)} style={styles.headerButton}>
          <Ionicons name="cart-outline" size={22} color={colors.foreground} />
        </Pressable>
      </View>
      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : isError || !product ? (
        <View style={styles.center}>
          <Text style={{ color: colors.destructive }}>Product not found.</Text>
          <Pressable onPress={() => refetch()} style={[styles.retry, { borderColor: colors.border }]}><Text style={{ color: colors.foreground }}>Retry</Text></Pressable>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 100 }} showsVerticalScrollIndicator={false}>
            <View style={[styles.imageWrap, { backgroundColor: colors.muted }]}>
              {product.imageObjectPaths[0] ? (
                <Image source={resolveRemoteMediaUrl(product.imageObjectPaths[0])} style={styles.image} contentFit="cover" />
              ) : (
                <Ionicons name="image-outline" size={48} color={colors.mutedForeground} />
              )}
            </View>
            <View style={styles.content}>
              <Text style={[styles.title, { color: colors.foreground }]}>{product.name}</Text>
              <Text style={[styles.price, { color: colors.foreground }]}>${(product.priceCents / 100).toFixed(2)}</Text>
              {product.reviews.count > 0 && (
                <View style={styles.reviews}>
                  <Ionicons name="star" size={16} color="#EAB308" />
                  <Text style={[styles.reviewAvg, { color: colors.foreground }]}>{product.reviews.average?.toFixed(1)}</Text>
                  <Text style={[styles.reviewCount, { color: colors.mutedForeground }]}>({product.reviews.count} reviews)</Text>
                </View>
              )}
              <Text style={[styles.description, { color: colors.foreground }]}>{product.description || 'No description provided.'}</Text>
              
              {product.reviews.items.length > 0 && (
                <View style={styles.reviewList}>
                  <Text style={[styles.reviewSectionTitle, { color: colors.foreground }]}>Reviews</Text>
                  {product.reviews.items.map((r, i) => (
                    <View key={i} style={[styles.reviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <View style={styles.reviewStars}>
                        {Array.from({ length: 5 }).map((_, j) => (
                          <Ionicons key={j} name={j < r.rating ? "star" : "star-outline"} size={14} color="#EAB308" />
                        ))}
                      </View>
                      {r.body ? <Text style={[styles.reviewBody, { color: colors.foreground }]}>{r.body}</Text> : null}
                    </View>
                  ))}
                </View>
              )}
            </View>
          </ScrollView>
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16), backgroundColor: colors.background, borderTopColor: colors.border }]}>
            <Pressable disabled={adding || !product.active || product.inventory <= 0} onPress={addToCart} style={[styles.buyBtn, { backgroundColor: colors.action, opacity: (adding || !product.active || product.inventory <= 0) ? 0.5 : 1 }]}>
              {adding ? <ActivityIndicator color="#fff" /> : <Text style={styles.buyBtnText}>{!product.active ? 'Unavailable' : product.inventory <= 0 ? 'Out of stock' : 'Add to cart'}</Text>}
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
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  retry: { marginTop: 16, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderRadius: 16 },
  imageWrap: { width: '100%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  content: { padding: 20 },
  title: { fontFamily: 'NunitoSans_800ExtraBold', fontSize: 24, marginBottom: 8 },
  price: { fontFamily: 'NunitoSans_700Bold', fontSize: 20, marginBottom: 12 },
  reviews: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20 },
  reviewAvg: { fontFamily: 'NunitoSans_700Bold', fontSize: 15 },
  reviewCount: { fontFamily: 'NunitoSans_600SemiBold', fontSize: 14 },
  description: { fontFamily: 'NunitoSans_400Regular', fontSize: 16, lineHeight: 24 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, borderTopWidth: StyleSheet.hairlineWidth },
  buyBtn: { height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  buyBtnText: { color: '#fff', fontFamily: 'NunitoSans_800ExtraBold', fontSize: 18 },
  reviewList: { marginTop: 32 },
  reviewSectionTitle: { fontFamily: 'NunitoSans_800ExtraBold', fontSize: 18, marginBottom: 16 },
  reviewCard: { padding: 16, borderWidth: 1, borderRadius: 16, marginBottom: 12 },
  reviewStars: { flexDirection: 'row', gap: 2, marginBottom: 8 },
  reviewBody: { fontFamily: 'NunitoSans_400Regular', fontSize: 15, lineHeight: 22 },
});