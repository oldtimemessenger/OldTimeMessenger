import React, { useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { WALLPAPERS } from '../../data/wallpapers';
import Header from '../../components/Header';

export default function WallpaperScreen({ navigation }) {
  const { theme } = useTheme();
  const [selected, setSelected] = useState('default');

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Header title="Wallpaper" onBack={() => navigation.goBack()} />
      <FlatList
        data={WALLPAPERS}
        numColumns={2}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 12 }}
        renderItem={({ item }) => {
          const bg = item.css || item.bgDark || item.from || theme.elevated;
          const active = selected === item.id;
          return (
            <TouchableOpacity onPress={() => setSelected(item.id)} style={styles.tileWrap}>
              <View style={[styles.tile, { backgroundColor: bg, borderColor: active ? theme.greenBright : theme.divider }]}>
                {active && (
                  <View style={[styles.check, { backgroundColor: theme.greenBright }]}>
                    <Check size={14} color="#fff" />
                  </View>
                )}
              </View>
              <Text style={{ color: theme.text, fontSize: 13, marginTop: 6 }}>{item.name}</Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tileWrap: { flex: 1, alignItems: 'center', margin: 8 },
  tile: { width: '100%', aspectRatio: 0.72, borderRadius: 14, borderWidth: 2, justifyContent: 'flex-end', alignItems: 'flex-end', padding: 8 },
  check: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
});
