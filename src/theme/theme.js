export const BASE = {
  dark: {
    bg: '#0B141A',
    panel: '#111B21',
    header: '#1F2C34',
    elevated: '#1F2C34',
    text: '#E9EDEF',
    muted: '#8696A0',
    divider: '#2A3942',
    online: '#00A884',
    away: '#FFC107',
    danger: '#EA4335',
    inputBorder: 'transparent',
    bubbleThem: '#1F2C34',
    card: '#111B21',
  },
  light: {
    bg: '#F0F2F5',
    panel: '#FFFFFF',
    header: '#FFFFFF',
    elevated: '#FFFFFF',
    text: '#111B21',
    muted: '#667781',
    divider: '#E9EDEF',
    online: '#00A884',
    away: '#E8A20B',
    danger: '#EA4335',
    inputBorder: '#E9EDEF',
    bubbleThem: '#FFFFFF',
    card: '#FFFFFF',
  },
};

export const ACCENTS = {
  blue: { name: 'Blue', green: '#0A84FF', greenBright: '#0A84FF', bubbleMeLight: '#DCEBFF', bubbleMeDark: '#123659' },
  green: { name: 'Green', green: '#00A884', greenBright: '#25D366', bubbleMeLight: '#D9FDD3', bubbleMeDark: '#124F3F' },
  teal: { name: 'Teal', green: '#178484', greenBright: '#2BC4C0', bubbleMeLight: '#D2F3F1', bubbleMeDark: '#124F4D' },
};

export function buildTheme(mode, accentKey) {
  const base = BASE[mode] || BASE.light;
  const accent = ACCENTS[accentKey] || ACCENTS.blue;
  return {
    ...base,
    mode,
    accentKey,
    green: accent.green,
    greenBright: accent.greenBright,
    bubbleMe: mode === 'dark' ? accent.bubbleMeDark : accent.bubbleMeLight,
  };
}
