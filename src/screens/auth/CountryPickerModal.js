import React from 'react';
import { View, FlatList, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { COUNTRIES } from '../../data/countries';

export default function CountryPickerModal({ navigation, route }) {
  const { theme } = useTheme();
  const onSelect = route.params?.onSelect;
  const countries = COUNTRIES.map(([flag, name, dial_code]) => ({ flag, name, dial_code, code: `${name}-${dial_code}` }));

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}> 
      <FlatList
        data={countries}
        keyExtractor={(item) => item.code}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => {
              onSelect?.(item);
              navigation.goBack();
            }}
            style={[styles.row, { borderBottomColor: theme.divider }]}
          >
            <Text style={{ color: theme.text, fontSize: 15 }}>{item.flag} {item.name} ({item.dial_code})</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  row: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
});
