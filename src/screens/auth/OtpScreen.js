import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../context/AuthContext';

export default function OtpScreen({ navigation, route }) {
  const { theme } = useTheme();
  const { verifyOtp } = useAuth();
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const phone = route.params?.phone || '';

  const onVerify = async () => {
    if (!phone || !code.trim() || submitting) return;
    try {
      setSubmitting(true);
      const { error } = await verifyOtp(phone, code.trim());
      if (error) throw error;
      navigation.navigate('ProfileSetup');
    } catch (error) {
      Alert.alert('Could not verify code', error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}> 
      <Text style={[styles.title, { color: theme.text }]}>Verification code</Text>
      <Text style={{ color: theme.muted, marginBottom: 14 }}>Sent to {phone}</Text>
      <TextInput
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        placeholder="123456"
        placeholderTextColor={theme.muted}
        style={[styles.input, { color: theme.text, borderColor: theme.divider, backgroundColor: theme.header }]}
      />
      <TouchableOpacity
        style={[styles.button, { backgroundColor: submitting ? theme.green : theme.greenBright }]}
        onPress={onVerify}
      >
        <Text style={styles.buttonText}>{submitting ? 'Verifying...' : 'Verify'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 10 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16 },
  button: { marginTop: 14, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  buttonText: { color: '#06140F', fontWeight: '700', fontSize: 15 },
});
