import colors from '@/constants/colors';
import { useApp } from '@/context/app-state';

/**
 * Returns the design tokens for the current color scheme.
 *
 * The returned object contains all color tokens for the active palette
 * plus scheme-independent values like `radius`.
 *
 * Falls back to the light palette when no dark key is defined in
 * constants/colors.ts (the scaffold ships light-only by default).
 * When a sibling web artifact's dark tokens are synced into a `dark`
 * key, this hook will automatically switch palettes based on the
 * device's appearance setting.
 */
export function useColors() {
  const { settings } = useApp();
  const palette =
    settings.darkMode && 'dark' in colors
      ? colors.dark
      : colors.light;
  return {
    ...palette,
    primary: settings.accent,
    tint: settings.accent,
    accent: settings.accent,
    secondary: settings.darkMode ? `${settings.accent}22` : `${settings.accent}18`,
    radius: colors.radius,
  };
}
