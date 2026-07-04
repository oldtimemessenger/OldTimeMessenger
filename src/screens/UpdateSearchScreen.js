import React, { useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import { Search, ArrowLeft } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';

export default function UpdateSearchScreen({ navigation }) {
  const { theme } = useTheme();
  const [q, setQ] = useState('');
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10 }}>
        <ArrowLeft size={21} color={theme.text} onPress={() => navigation.goBack()} />
        <View style={{ flex: 1, backgroundColor: theme.elevated, borderRadius: 10, padding: 9, flexDirection: 'row', alignItems: 'center' }}>
          <Search size={16} color={theme.muted} />
          <TextInput autoFocus value={q} onChangeText={setQ} placeholder="Search Updates" placeholderTextColor={theme.muted}
            style={{ flex: 1, color: theme.text, fontSize: 14.5, marginLeft: 8 }} />
        </View>
      </View>
      <Text style={{ color: theme.muted, textAlign: 'center', marginTop: 30 }}>Search results appear here</Text>
    </View>
  );
}
