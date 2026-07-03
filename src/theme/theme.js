export const BASE = {
  dark: {
    bg: '#0B1717', panel: '#111E1E', header: '#1B2B2B', elevated: '#1E3131',
    text: '#E9EDEF', muted: '#8FA3A3', divider: '#213636', online: '#25D366', away: '#FFC107',
    danger: '#F15C5C', inputBorder: 'transparent', bubbleThem: '#1E3131',
  },
  light: {
    bg: '#FFFFFF', panel: '#F5F9F9', header: '#F5F9F9', elevated: '#EDF5F5',
    text: '#111B21', muted: '#5E7676', divider: '#E4EFEF', online: '#25D366', away: '#E8A20B',
    danger: '#D9483C', inputBorder: '#E4EFEF', bubbleThem: '#FFFFFF',
  },
};

export const ACCENTS = {
  blue: { name: 'Blue', green: '#0A84FF', greenBright: '#0A84FF', bubbleMeLight: '#DCEBFF', bubbleMeDark: '#123659' },
  green: { name: 'Green', green: '#00A884', greenBright: '#25D366', bubbleMeLight: '#D9FDD3', bubbleMeDark: '#124F3F' },
  teal: { name: 'Teal', green: '#178484', greenBright: '#2BC4C0', bubbleMeLight: '#D2F3F1', bubbleMeDark: '#124F4D' },
};

export function buildTheme(mode, accentKey) {
  const base = BASE[mode] || BASE.dark;
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
