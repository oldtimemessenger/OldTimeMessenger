import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MessageCircle } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';

export default function WelcomeScreen({ navigation }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: theme.bg, paddingBottom: insets.bottom + 24 }]}>
      <View style={[styles.mark, { backgroundColor: theme.green }]}>
        <MessageCircle size={36} color="#fff" fill="#fff" />
      </View>
      <Text style={[styles.title, { color: theme.text }]}>Old Time</Text>
      <Text style={[styles.subtitle, { color: theme.muted }]}>
        Private chats, disappearing notes, live location, and lightweight calls — without the noise.
      </Text>
      <TouchableOpacity
        style={[styles.button, { backgroundColor: theme.greenBright }]}
        onPress={() => navigation.navigate('PhoneLogin')}
      >
        <Text style={styles.buttonText}>Get Started</Text>
      </TouchableOpacity>
      <Text style={{ color: theme.muted, fontSize: 12, textAlign: 'center', marginTop: 16 }}>
        By continuing you agree to the Terms of Service and Privacy Policy.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 28 },
  mark: { width: 72, height: 72, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 34, fontWeight: '800', marginBottom: 10 },
  subtitle: { fontSize: 16, lineHeight: 22, textAlign: 'center', marginBottom: 36 },
  button: { width: '100%', paddingVertical: 15, borderRadius: 12, alignItems: 'center' },
  buttonText: { color: '#06140F', fontSize: 16, fontWeight: '700' },
});
