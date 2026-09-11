import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { CreatorHubApi } from '@/lib/api-creator-hub';
import { useAuth } from '@/lib/auth';
import { useQueryClient } from '@tanstack/react-query';
import { CH_KEYS } from '@/hooks/useCreatorHub';
import { uploadMedia } from '@/lib/api';

type VerificationDocument = {
  uri: string;
  name: string;
  size: number;
  mimeType: string;
};

export default function BusinessApplicationScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  
  const [legalName, setLegalName] = useState('');
  const [taxIdLast4, setTaxIdLast4] = useState('');
  const [documents, setDocuments] = useState<VerificationDocument[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [pickingDocuments, setPickingDocuments] = useState(false);

  const pickDocuments = async () => {
    if (documents.length >= 5) {
      Alert.alert('Document limit reached', 'You can attach up to five documents.');
      return;
    }
    setPickingDocuments(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const next = result.assets
        .filter((asset) => typeof asset.size === 'number' && asset.size > 0 && asset.size <= 25 * 1024 * 1024)
        .map((asset) => ({
          uri: asset.uri,
          name: asset.name,
          size: asset.size as number,
          mimeType: asset.mimeType ?? 'application/octet-stream',
        }));
      if (next.length !== result.assets.length) {
        Alert.alert('Some files were skipped', 'Documents must be non-empty PDF or image files no larger than 25 MB.');
      }
      setDocuments((current) => [...current, ...next].slice(0, 5));
    } catch (error) {
      Alert.alert('Could not choose documents', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setPickingDocuments(false);
    }
  };

  const removeDocument = (uri: string) => {
    setDocuments((current) => current.filter((document) => document.uri !== uri));
  };

  const submit = async () => {
    if (!legalName.trim()) {
      Alert.alert('Required', 'Please enter your legal business name.');
      return;
    }
    setSubmitting(true);
    try {
      const documentObjectPaths: string[] = [];
      for (const document of documents) {
        documentObjectPaths.push(await uploadMedia({
          uri: document.uri,
          mediaType: 'document',
          name: document.name,
          contentType: document.mimeType,
          size: document.size,
          getToken,
        }));
      }
      await CreatorHubApi.applyBusiness(getToken, { legalName, taxIdLast4: taxIdLast4 || null, documentObjectPaths });
      await queryClient.invalidateQueries({ queryKey: CH_KEYS.me() });
      Alert.alert('Success', 'Your business verification has been submitted.');
      router.back();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Could not submit verification.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top, height: insets.top + 56, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="chevron-back" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Business Verification</Text>
        <View style={styles.headerButton} />
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]} keyboardShouldPersistTaps="handled">
        <Text style={[styles.notice, { color: colors.mutedForeground }]}>To sell products on Old Time, please verify your business entity. We never request bank or card details here; payouts are configured securely via Stripe later.</Text>
        
        <Text style={[styles.label, { color: colors.foreground }]}>Legal Business Name *</Text>
        <TextInput
          style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
          placeholder="Acme Corp LLC"
          placeholderTextColor={colors.mutedForeground}
          value={legalName}
          onChangeText={setLegalName}
        />
        
        <Text style={[styles.label, { color: colors.foreground }]}>Tax ID Last 4 Digits (Optional)</Text>
        <TextInput
          style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
          placeholder="1234"
          placeholderTextColor={colors.mutedForeground}
          value={taxIdLast4}
          onChangeText={setTaxIdLast4}
          keyboardType="number-pad"
          maxLength={4}
        />

        <Text style={[styles.label, { color: colors.foreground }]}>Verification Documents (Optional)</Text>
        <Text style={[styles.helper, { color: colors.mutedForeground }]}>Upload a PDF or image of a business document. Each file must be 25 MB or smaller.</Text>
        <Pressable disabled={pickingDocuments || documents.length >= 5} onPress={() => void pickDocuments()} style={[styles.documentButton, { borderColor: colors.border, backgroundColor: colors.card, opacity: pickingDocuments ? 0.5 : 1 }]}>
          {pickingDocuments ? <ActivityIndicator color={colors.foreground} /> : <Ionicons name="document-attach-outline" size={19} color={colors.foreground} />}
          <Text style={[styles.documentButtonText, { color: colors.foreground }]}>{pickingDocuments ? 'Choosing…' : 'Choose documents'}</Text>
        </Pressable>
        {documents.map((document) => (
          <View key={document.uri} style={[styles.documentRow, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Ionicons name="document-text-outline" size={20} color={colors.foreground} />
            <Text numberOfLines={1} style={[styles.documentName, { color: colors.foreground }]}>{document.name}</Text>
            <Pressable onPress={() => removeDocument(document.uri)} accessibilityRole="button" accessibilityLabel={`Remove ${document.name}`}>
              <Ionicons name="close-circle-outline" size={21} color={colors.mutedForeground} />
            </Pressable>
          </View>
        ))}
        
        <View style={{ height: 40 }} />
        <Pressable disabled={submitting} onPress={submit} style={[styles.submitBtn, { backgroundColor: colors.action, opacity: submitting ? 0.5 : 1 }]}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Submit Verification</Text>}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16 },
  headerTitle: { fontFamily: 'NunitoSans_800ExtraBold', fontSize: 20 },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20 },
  notice: { fontFamily: 'NunitoSans_400Regular', fontSize: 14, lineHeight: 20, marginBottom: 24 },
  label: { fontFamily: 'NunitoSans_700Bold', fontSize: 16, marginBottom: 8 },
  input: { height: 52, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, fontFamily: 'NunitoSans_400Regular', fontSize: 16, marginBottom: 20 },
  helper: { fontFamily: 'NunitoSans_400Regular', fontSize: 13, lineHeight: 18, marginTop: -2, marginBottom: 10 },
  documentButton: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  documentButtonText: { fontFamily: 'NunitoSans_700Bold', fontSize: 15 },
  documentRow: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 8 },
  documentName: { flex: 1, fontFamily: 'NunitoSans_600SemiBold', fontSize: 14 },
  submitBtn: { height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  submitBtnText: { color: '#fff', fontFamily: 'NunitoSans_800ExtraBold', fontSize: 18 },
});