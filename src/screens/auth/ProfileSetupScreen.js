import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../context/AuthContext';

export default function ProfileSetupScreen() {
  const { theme } = useTheme();
  const { completeProfile } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    if (!displayName.trim() || saving) return;
    try {
      setSaving(true);
      const { error } = await completeProfile({ displayName: displayName.trim() });
      if (error) throw error;
    } catch (error) {
      Alert.alert('Could not save profile', error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <Text style={[styles.title, { color: theme.text }]}>Set up your profile</Text>
      <TextInput
        value={displayName}
        onChangeText={setDisplayName}
        placeholder="Display name"
        placeholderTextColor={theme.muted}
        style={[styles.input, { color: theme.text, borderColor: theme.divider, backgroundColor: theme.header }]}
      />
      <TouchableOpacity style={[styles.button, { backgroundColor: saving ? theme.green : theme.greenBright }]} onPress={onSave}>
        <Text style={styles.buttonText}>{saving ? 'Saving...' : 'Finish'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 18 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16 },
  button: { marginTop: 14, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  buttonText: { color: '#06140F', fontWeight: '700', fontSize: 15 },
});
