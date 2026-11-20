import { useColorScheme } from 'react-native';

export const lightColors = {
  primary: '#2E7D32',
  primaryDark: '#1B5E20',
  primaryLight: '#E8F5E9',
  background: '#F6F7F5',
  surface: '#FFFFFF',
  text: '#1B1F1B',
  textMuted: '#5F6B5F',
  border: '#D9DED9',
  danger: '#C62828',
  /** Text/icons on a primary-coloured fill. */
  onPrimary: '#FFFFFF',
  /** Text on a status-coloured fill. */
  onStatus: '#FFFFFF',
  status: {
    ok: '#2E7D32',
    bijna: '#F57C00',
    verlopen: '#C62828',
    onbekend: '#757575',
  },
};

export type Palette = typeof lightColors;

export const darkColors: Palette = {
  primary: '#81C784',
  primaryDark: '#A5D6A7',
  primaryLight: '#1E3A20',
  background: '#101210',
  surface: '#1B1F1B',
  text: '#E6EAE6',
  textMuted: '#9AA59A',
  border: '#2F362F',
  danger: '#EF5350',
  onPrimary: '#0D2E10',
  onStatus: '#FFFFFF',
  status: {
    ok: '#388E3C',
    bijna: '#EF6C00',
    verlopen: '#D32F2F',
    onbekend: '#757575',
  },
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16 } as const;

/** Palette for the active colour scheme (follows the app-level override set via Appearance). */
export function useColors(): Palette {
  return useColorScheme() === 'dark' ? darkColors : lightColors;
}

/** Build scheme-dependent styles once per scheme; returns a hook that picks the right sheet. */
export function makeStyles<T extends object>(
  factory: (c: Palette) => T,
): () => T {
  let light: T | undefined;
  let dark: T | undefined;
  return function useStyles() {
    if (useColorScheme() === 'dark') return (dark ??= factory(darkColors));
    return (light ??= factory(lightColors));
  };
}
