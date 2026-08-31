import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';

export default function Header({ title, onBack, right }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { backgroundColor: theme.header, borderBottomColor: theme.divider, paddingTop: Math.max(insets.top, 10) }]}>
      {onBack && (
        <TouchableOpacity onPress={onBack} style={{ marginRight: 10 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ArrowLeft size={21} color={theme.text} />
        </TouchableOpacity>
      )}
      <Text style={{ color: theme.text, fontSize: 18, fontWeight: '600', flex: 1 }} numberOfLines={1}>{title}</Text>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
});
