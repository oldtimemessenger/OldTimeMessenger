import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { Avatar } from '@/components/OldTimeUi';
import { useOldTime } from '@/context/OldTimeContext';
import { useColors } from '@/hooks/useColors';

export default function EditProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, updateProfile } = useOldTime();
  const [name, setName] = useState(profile?.name ?? '');
  const [username, setUsername] = useState(profile?.handle ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setName(profile.name);
    setUsername(profile.handle);
    setBio(profile.bio);
  }, [profile]);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await updateProfile({ name, username, bio });
      router.back();
    } catch (error) {
      Alert.alert('Could not save profile', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAwareScrollViewCompat
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 28 }]}
      bottomOffset={84}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Cancel editing profile" onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="close" size={25} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>Edit profile</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Save profile" onPress={() => void save()} disabled={saving} style={[styles.headerButton, saving && styles.disabled]}>
          {saving ? <ActivityIndicator color={colors.action} size="small" /> : <Ionicons name="checkmark" size={25} color={colors.action} />}
        </Pressable>
      </View>

      <View style={styles.avatarSection}>
        <Avatar source={profile?.avatar} name={profile?.name} size={92} accent={profile?.accent} />
        <Text style={[styles.avatarHint, { color: colors.mutedForeground }]}>Your profile photo can be changed from your profile.</Text>
      </View>

      <Field label="Name" value={name} onChangeText={setName} placeholder="Your name" colors={colors} autoCapitalize="words" maxLength={80} />
      <Field label="Username" value={username} onChangeText={(value) => setUsername(value.replace(/\s/g, ''))} placeholder="your_username" colors={colors} autoCapitalize="none" maxLength={24} prefix="@" />
      <View style={styles.fieldGroup}>
        <View style={styles.labelRow}>
          <Text style={[styles.label, { color: colors.foreground }]}>Bio</Text>
          <Text style={[styles.counter, { color: colors.mutedForeground }]}>{bio.length}/150</Text>
        </View>
        <TextInput
          value={bio}
          onChangeText={setBio}
          placeholder="Tell people a little about you"
          placeholderTextColor={colors.mutedForeground}
          multiline
          maxLength={150}
          textAlignVertical="top"
          style={[styles.bioInput, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border }]}
        />
      </View>

      <Pressable accessibilityRole="button" accessibilityLabel="Save profile changes" onPress={() => void save()} disabled={saving} style={[styles.saveButton, { backgroundColor: colors.action }, saving && styles.disabled]}>
        {saving ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={[styles.saveText, { color: colors.primaryForeground }]}>Save changes</Text>}
      </Pressable>
    </KeyboardAwareScrollViewCompat>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  colors,
  autoCapitalize,
  maxLength,
  prefix,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  colors: ReturnType<typeof useColors>;
  autoCapitalize: 'none' | 'words';
  maxLength: number;
  prefix?: string;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
      <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {prefix ? <Text style={[styles.prefix, { color: colors.mutedForeground }]}>{prefix}</Text> : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          maxLength={maxLength}
          style={[styles.input, { color: colors.foreground }]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 22 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 30 },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'Fraunces_900Black', fontSize: 24 },
  avatarSection: { alignItems: 'center', marginBottom: 30 },
  avatarHint: { fontFamily: 'Outfit_400Regular', fontSize: 13, marginTop: 12, textAlign: 'center' },
  fieldGroup: { marginBottom: 22 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  label: { fontFamily: 'Outfit_700Bold', fontSize: 14, marginBottom: 8 },
  counter: { fontFamily: 'Outfit_500Medium', fontSize: 12 },
  inputWrap: { minHeight: 54, borderWidth: 1, borderRadius: 16, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  prefix: { fontFamily: 'Outfit_500Medium', fontSize: 16 },
  input: { flex: 1, minHeight: 52, paddingHorizontal: 4, fontFamily: 'Outfit_400Regular', fontSize: 16 },
  bioInput: { minHeight: 118, borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, paddingTop: 15, fontFamily: 'Outfit_400Regular', fontSize: 16, lineHeight: 22 },
  saveButton: { minHeight: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  saveText: { fontFamily: 'Outfit_700Bold', fontSize: 16 },
  disabled: { opacity: 0.55 },
});