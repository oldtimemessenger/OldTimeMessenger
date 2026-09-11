import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { CreatorHubApi } from '@/lib/api-creator-hub';
import { useAuth } from '@/lib/auth';
import { useQueryClient } from '@tanstack/react-query';
import { CH_KEYS } from '@/hooks/useCreatorHub';

export default function CreatorApplicationScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!notes.trim()) {
      Alert.alert('Required', 'Please add some notes about what you want to create.');
      return;
    }
    setSubmitting(true);
    try {
      await CreatorHubApi.applyCreator(getToken, { portfolioUrl: portfolioUrl || null, notes });
      await queryClient.invalidateQueries({ queryKey: CH_KEYS.me() });
      Alert.alert('Success', 'Your application has been submitted.');
      router.back();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Could not submit application.');
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
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Creator Application</Text>
        <View style={styles.headerButton} />
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]} keyboardShouldPersistTaps="handled">
        <Text style={[styles.label, { color: colors.foreground }]}>Portfolio URL (Optional)</Text>
        <TextInput
          style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
          placeholder="https://..."
          placeholderTextColor={colors.mutedForeground}
          value={portfolioUrl}
          onChangeText={setPortfolioUrl}
          autoCapitalize="none"
          keyboardType="url"
        />
        <Text style={[styles.label, { color: colors.foreground }]}>Why do you want to join? *</Text>
        <TextInput
          style={[styles.textArea, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]}
          placeholder="Tell us about yourself..."
          placeholderTextColor={colors.mutedForeground}
          value={notes}
          onChangeText={setNotes}
          multiline
          textAlignVertical="top"
        />
        <View style={{ height: 40 }} />
        <Pressable disabled={submitting} onPress={submit} style={[styles.submitBtn, { backgroundColor: colors.action, opacity: submitting ? 0.5 : 1 }]}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Submit Application</Text>}
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
  content: { flex: 1, padding: 20 },
  label: { fontFamily: 'NunitoSans_700Bold', fontSize: 16, marginBottom: 8 },
  input: { height: 52, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, fontFamily: 'NunitoSans_400Regular', fontSize: 16, marginBottom: 20 },
  textArea: { minHeight: 120, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontFamily: 'NunitoSans_400Regular', fontSize: 16 },
  submitBtn: { height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  submitBtnText: { color: '#fff', fontFamily: 'NunitoSans_800ExtraBold', fontSize: 18 },
});