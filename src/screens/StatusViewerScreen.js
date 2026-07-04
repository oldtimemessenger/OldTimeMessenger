import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import Header from '../components/Header';

export default function StatusViewerScreen({ navigation, route }) {
  const { theme } = useTheme();
  const status = route.params?.status;

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <Header title="Status" onBack={() => navigation.goBack()} />
      <View style={styles.body}>
        <Text style={{ color: theme.text, fontSize: 16, fontWeight: '600' }}>
          {status?.profiles?.display_name || 'Status update'}
        </Text>
        <Text style={{ color: theme.muted, marginTop: 8 }}>
          {status?.text || 'No status text available.'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  body: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
});
