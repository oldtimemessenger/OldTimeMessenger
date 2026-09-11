import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useShopProducts } from '@/hooks/useCreatorHub';
import { resolveRemoteMediaUrl } from '@/lib/api';
import { Image } from 'expo-image';

export default function ShopScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data: products, isLoading, isError, refetch } = useShopProducts();

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top, height: insets.top + 56, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Shop</Text>
        <Pressable onPress={() => router.push('/cart' as never)} style={styles.headerButton}>
          <Ionicons name="cart-outline" size={22} color={colors.foreground} />
        </Pressable>
      </View>
      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : isError ? (
        <View style={styles.center}>
          <Text style={{ color: colors.destructive }}>Could not load products.</Text>
          <Pressable onPress={() => refetch()} style={[styles.retry, { borderColor: colors.border }]}><Text style={{ color: colors.foreground }}>Retry</Text></Pressable>
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 20 }]}
          numColumns={2}
          columnWrapperStyle={styles.row}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<View style={styles.center}><Text style={[styles.empty, { color: colors.mutedForeground }]}>No products available.</Text></View>}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/product/${item.id}` as never)}
              style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={[styles.imageWrap, { backgroundColor: colors.muted }]}>
                {item.imageObjectPaths[0] ? (
                  <Image source={resolveRemoteMediaUrl(item.imageObjectPaths[0])} style={styles.image} contentFit="cover" />
                ) : (
                  <Ionicons name="image-outline" size={32} color={colors.mutedForeground} />
                )}
              </View>
              <View style={styles.info}>
                <Text numberOfLines={1} style={[styles.name, { color: colors.foreground }]}>{item.name}</Text>
                <Text style={[styles.price, { color: colors.foreground }]}>${(item.priceCents / 100).toFixed(2)}</Text>
              </View>
            </Pressable>
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
  list: { padding: 16, gap: 16 },
  row: { gap: 16 },
  card: { flex: 1, borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  imageWrap: { width: '100%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  info: { padding: 12 },
  name: { fontFamily: 'NunitoSans_700Bold', fontSize: 15, marginBottom: 4 },
  price: { fontFamily: 'NunitoSans_600SemiBold', fontSize: 14 },
});