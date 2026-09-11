import colors from '@/constants/colors';

/**
 * Returns the design tokens for the current color scheme.
 *
 * The returned object contains all color tokens for the active palette
 * plus scheme-independent values like `radius`.
 *
 * Old Time uses a white canvas across platforms so content stays visually
 * consistent between web preview and native devices.
 */
export function useColors() {
  return { ...colors.light, radius: colors.radius };
}
