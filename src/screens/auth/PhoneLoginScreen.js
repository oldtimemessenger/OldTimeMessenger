import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../context/AuthContext';

export default function PhoneLoginScreen({ navigation }) {
  const { theme } = useTheme();
  const { sendOtp } = useAuth();
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onContinue = async () => {
    if (!phone.trim() || submitting) return;
    try {
      setSubmitting(true);
      const { error } = await sendOtp(phone.trim());
      if (error) throw error;
      navigation.navigate('Otp', { phone: phone.trim() });
    } catch (error) {
      Alert.alert('Could not send code', error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <Text style={[styles.title, { color: theme.text }]}>Enter your phone number</Text>
      <TextInput
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        placeholder="+1 555 000 0000"
        placeholderTextColor={theme.muted}
        style={[styles.input, { color: theme.text, borderColor: theme.divider, backgroundColor: theme.header }]}
      />
      <TouchableOpacity
        style={[styles.button, { backgroundColor: submitting ? theme.green : theme.greenBright }]}
        onPress={onContinue}
      >
        <Text style={styles.buttonText}>{submitting ? 'Sending...' : 'Continue'}</Text>
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
