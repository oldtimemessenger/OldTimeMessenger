import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

type EmailCodeInputProps = {
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
  accessibilityLabel?: string;
};

export function EmailCodeInput({ value, onChange, autoFocus = false, accessibilityLabel = 'Six digit verification code' }: EmailCodeInputProps) {
  const colors = useColors();
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(autoFocus);
  const digits = value.padEnd(6, ' ').slice(0, 6).split('');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() => inputRef.current?.focus()}
      style={styles.wrapper}
    >
      <TextInput
        ref={inputRef}
        autoFocus={autoFocus}
        autoComplete="one-time-code"
        caretHidden
        keyboardType="number-pad"
        maxLength={6}
        onBlur={() => setFocused(false)}
        onChangeText={(next) => onChange(next.replace(/\D/g, '').slice(0, 6))}
        onFocus={() => setFocused(true)}
        textContentType="oneTimeCode"
        value={value}
        accessibilityLabel={accessibilityLabel}
        style={styles.input}
      />
      <View pointerEvents="none" style={styles.cells}>
        {digits.map((digit, index) => (
          <View
            key={index}
            style={[
              styles.cell,
              { backgroundColor: colors.secondary, borderColor: focused && index === value.length ? colors.action : colors.border },
              focused && index === value.length && { borderWidth: 2 },
            ]}
          >
            <Text style={[styles.digit, { color: colors.foreground }]}>{digit.trim()}</Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: { minHeight: 62, position: 'relative' },
  input: { ...StyleSheet.absoluteFillObject, zIndex: 2, opacity: 0.02 },
  cells: { flexDirection: 'row', gap: 8 },
  cell: { flex: 1, height: 58, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  digit: { fontFamily: 'NunitoSans_700Bold', fontSize: 24 },
});