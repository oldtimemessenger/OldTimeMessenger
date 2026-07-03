import React from 'react';
import { TouchableOpacity } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

export default function CallBtn({ icon: Icon, active, danger, onPress }) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity onPress={onPress} style={{
      width: 58, height: 58, borderRadius: 29, justifyContent: 'center', alignItems: 'center',
      backgroundColor: danger ? theme.danger : active ? '#fff' : '#2A3A36',
    }}>
      <Icon size={23} color={danger ? '#fff' : active ? '#0B141A' : '#fff'} />
    </TouchableOpacity>
  );
}
