import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { LANGUAGES } from '../../data/languages';
import Header from '../../components/Header';

export default function LanguageScreen({ navigation }) {
  const { theme } = useTheme();
  const { user, profile, refreshProfile } = useAuth();
  const current = profile?.language || 'English';

  const select = async (name) => {
    if (!user) return;
    await supabase.from('profiles').update({ language: name }).eq('id', user.id);
    await refreshProfile();
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Header title="Language" onBack={() => navigation.goBack()} />
      <FlatList
        data={LANGUAGES}
        keyExtractor={(item) => item[1]}
        renderItem={({ item }) => {
          const [flag, name] = item;
          const selected = current === name;
          return (
            <TouchableOpacity onPress={() => select(name)} style={[styles.row, { borderBottomColor: theme.divider }]}>
              <Text style={{ fontSize: 22, marginRight: 12 }}>{flag}</Text>
              <Text style={{ color: theme.text, fontSize: 16, flex: 1 }}>{name}</Text>
              {selected && <Check size={18} color={theme.greenBright} />}
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, minHeight: 52, borderBottomWidth: StyleSheet.hairlineWidth },
});
