import { Platform, type TextStyle } from 'react-native';

const systemFamily = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: 'system-ui',
});

function text(style: TextStyle): TextStyle {
  return { fontFamily: systemFamily, ...style };
}

export const typography = {
  navigationTitle: text({ fontSize: 24, lineHeight: 30, fontWeight: '600', letterSpacing: -0.4 }),
  sheetTitle: text({ fontSize: 22, lineHeight: 28, fontWeight: '600', letterSpacing: -0.25 }),
  sectionTitle: text({ fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: -0.15 }),
  username: text({ fontSize: 16, lineHeight: 21, fontWeight: '600', letterSpacing: -0.1 }),
  body: text({ fontSize: 16, lineHeight: 22, fontWeight: '400' }),
  bodyMedium: text({ fontSize: 16, lineHeight: 22, fontWeight: '500' }),
  button: text({ fontSize: 16, lineHeight: 21, fontWeight: '600' }),
  secondary: text({ fontSize: 14, lineHeight: 19, fontWeight: '400' }),
  timestamp: text({ fontSize: 12, lineHeight: 16, fontWeight: '400' }),
  label: text({ fontSize: 12, lineHeight: 16, fontWeight: '600', letterSpacing: 0.8 }),
  storyTitle: text({ fontSize: 28, lineHeight: 35, fontWeight: '600', letterSpacing: -0.35 }),
} satisfies Record<string, TextStyle>;