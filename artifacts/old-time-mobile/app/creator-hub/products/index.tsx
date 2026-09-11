import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { CreatorHubApi, CreatorHubProduct } from '@/lib/api-creator-hub';
import { useAuth } from '@/lib/auth';
import { useBusinessProducts } from '@/hooks/useCreatorHub';

export default function CatalogManagementScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { getToken } = useAuth();
  
  const { data: products, isLoading, isError, refetch } = useBusinessProducts();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<CreatorHubProduct | null>(null);
  
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [inventory, setInventory] = useState('');
  const [slug, setSlug] = useState('');
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditingProduct(null);
    setName('');
    setDescription('');
    setPrice('');
    setInventory('');
    setSlug('');
    setModalVisible(true);
  };

  const openEdit = (prod: CreatorHubProduct) => {
    setEditingProduct(prod);
    setName(prod.name);
    setDescription(prod.description);
    setPrice((prod.priceCents / 100).toString());
    setInventory(prod.inventory.toString());
    setSlug(prod.slug);
    setModalVisible(true);
  };

  const saveProduct = async () => {
    setSaving(true);
    try {
      const priceCents = Math.round(parseFloat(price) * 100);
      const inv = parseInt(inventory, 10);
      if (editingProduct) {
        await CreatorHubApi.updateBusinessProduct(getToken, editingProduct.id, {
          name, description, priceCents, inventory: inv, slug
        });
      } else {
        await CreatorHubApi.createBusinessProduct(getToken, {
          name, description, priceCents, inventory: inv, slug
        });
      }
      setModalVisible(false);
      refetch();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Could not save product.');
    } finally {
      setSaving(false);
    }
  };

  const archiveProduct = async (id: number) => {
    Alert.alert('Archive Product', 'Are you sure you want to archive this product?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Archive', style: 'destructive', onPress: async () => {
        try {
          await CreatorHubApi.deleteBusinessProduct(getToken, id);
          refetch();
        } catch (error) {
          Alert.alert('Error', error instanceof Error ? error.message : 'Could not archive product.');
        }
      }}
    ]);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top, height: insets.top + 56, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Products</Text>
        <Pressable onPress={openCreate} style={styles.headerButton}>
          <Ionicons name="add" size={26} color={colors.foreground} />
        </Pressable>
      </View>
      
      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : isError ? (
        <View style={styles.center}>
          <Text style={{ color: colors.destructive }}>Could not load catalog.</Text>
          <Pressable onPress={() => refetch()} style={[styles.retry, { borderColor: colors.border }]}><Text style={{ color: colors.foreground }}>Retry</Text></Pressable>
        </View>
      ) : !products?.length ? (
        <View style={styles.center}>
          <Text style={[styles.empty, { color: colors.mutedForeground }]}>No products found.</Text>
          <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>Create a product to start selling.</Text>
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 20 }]}
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.name, { color: colors.foreground }]}>{item.name}</Text>
                <Text style={[styles.price, { color: colors.foreground }]}>${(item.priceCents / 100).toFixed(2)}</Text>
              </View>
              <Text style={[styles.stock, { color: colors.mutedForeground }]}>Stock: {item.inventory}</Text>
              <View style={styles.actions}>
                <Pressable onPress={() => openEdit(item)} style={[styles.actionBtn, { borderColor: colors.border }]}>
                  <Text style={[styles.actionBtnText, { color: colors.foreground }]}>Edit</Text>
                </Pressable>
                <Pressable onPress={() => archiveProduct(item.id)} style={[styles.actionBtn, { borderColor: colors.border }]}>
                  <Text style={[styles.actionBtnText, { color: colors.destructive }]}>Archive</Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      )}

      {/* Editor Modal */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.modalScreen, { backgroundColor: colors.background }]}>
          <View style={[styles.header, { paddingTop: insets.top, height: insets.top + 56, borderBottomColor: colors.border }]}>
            <Pressable onPress={() => setModalVisible(false)} style={styles.headerButton}>
              <Ionicons name="close" size={26} color={colors.foreground} />
            </Pressable>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>{editingProduct ? 'Edit Product' : 'New Product'}</Text>
            <View style={styles.headerButton} />
          </View>
          <ScrollView contentContainerStyle={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]} keyboardShouldPersistTaps="handled">
            <Text style={[styles.label, { color: colors.foreground }]}>Product Name</Text>
            <TextInput style={[styles.input, { color: colors.foreground, borderColor: colors.border }]} value={name} onChangeText={setName} />
            <Text style={[styles.label, { color: colors.foreground }]}>Description</Text>
            <TextInput style={[styles.input, { color: colors.foreground, borderColor: colors.border }]} value={description} onChangeText={setDescription} />
            <Text style={[styles.label, { color: colors.foreground }]}>Price (USD)</Text>
            <TextInput style={[styles.input, { color: colors.foreground, borderColor: colors.border }]} value={price} onChangeText={setPrice} keyboardType="numeric" />
            <Text style={[styles.label, { color: colors.foreground }]}>Inventory</Text>
            <TextInput style={[styles.input, { color: colors.foreground, borderColor: colors.border }]} value={inventory} onChangeText={setInventory} keyboardType="number-pad" />
            <Text style={[styles.label, { color: colors.foreground }]}>Slug (url-friendly)</Text>
            <TextInput style={[styles.input, { color: colors.foreground, borderColor: colors.border }]} value={slug} onChangeText={setSlug} autoCapitalize="none" />
            <View style={{ height: 40 }} />
            <Pressable disabled={saving} onPress={saveProduct} style={[styles.submitBtn, { backgroundColor: colors.action, opacity: saving ? 0.5 : 1 }]}>
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
  empty: { fontFamily: 'NunitoSans_600SemiBold', fontSize: 16, marginBottom: 4 },
  emptySub: { fontFamily: 'NunitoSans_400Regular', fontSize: 14, marginBottom: 16 },
  list: { padding: 16, gap: 12 },
  card: { padding: 16, borderWidth: 1, borderRadius: 16 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  name: { fontFamily: 'NunitoSans_700Bold', fontSize: 16 },
  price: { fontFamily: 'NunitoSans_800ExtraBold', fontSize: 16 },
  stock: { fontFamily: 'NunitoSans_400Regular', fontSize: 14, marginBottom: 16 },
  actions: { flexDirection: 'row', gap: 12 },
  actionBtn: { paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderRadius: 16 },
  actionBtnText: { fontFamily: 'NunitoSans_600SemiBold', fontSize: 14 },
  modalScreen: { flex: 1 },
  modalContent: { flex: 1, padding: 20 },
  label: { fontFamily: 'NunitoSans_700Bold', fontSize: 15, marginBottom: 6 },
  input: { height: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, marginBottom: 16, fontFamily: 'NunitoSans_400Regular', fontSize: 16 },
  submitBtn: { height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  submitBtnText: { color: '#fff', fontFamily: 'NunitoSans_800ExtraBold', fontSize: 18 },
});