/**
 * theme/index.js — Zentrales Design-System
 *
 * Exports:
 *   spacing      — { xs, sm, md, lg, xl, xxl }
 *   radius       — { sm, md, lg, xl, full }
 *   type         — Typografie-Preset-Objekte (h1, h2, h3, body, bodyMed, caption, label)
 *   ThemeProvider — Context-Provider für Light/Dark-Mode-Auswahl
 *   useThemeMode  — Hook: { mode, setMode } — 'light'|'dark'|'system'
 *   useTheme      — Hook: { colors, spacing, radius, type, isDark }
 *
 * Verwendung in Screens:
 *   const { colors: C, spacing: S, radius: R, type: T, isDark } = useTheme();
 *   // Immer C.bg, C.text, C.accent verwenden — niemals Farben hardcoden
 */

// React/RN
import { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';

// Third-party
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Farbpaletten ──────────────────────────────────────────────────────────────

const light = {
  bg: '#F5F4F0',
  bgSecondary: '#EEEDEA',
  bgTertiary: '#E4E3DF',
  text: '#0A0A0A',
  textSecondary: '#6B6B6B',
  textTertiary: '#A8A8A8',
  border: '#DDDCDA',
  borderStrong: '#BDBBB9',
  accent: '#1A1A1A',
  accentText: '#FFFFFF',
  tint: '#E8C547',
  tintText: '#1A1A1A',
  success: '#16A34A',
  warning: '#D97706',
  danger: '#DC2626',
  surface: '#FAFAF8',
  surfaceRaised: '#EEEDEA',
};

const dark = {
  bg: '#0F0E0C',
  bgSecondary: '#1A1917',
  bgTertiary: '#242220',
  text: '#F5F4F0',
  textSecondary: '#9A9894',
  textTertiary: '#5A5856',
  border: '#2A2926',
  borderStrong: '#3A3936',
  accent: '#F5F4F0',
  accentText: '#0F0E0C',
  tint: '#E8C547',
  tintText: '#0F0E0C',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
  surface: '#1A1917',
  surfaceRaised: '#242220',
};

// ── Design-Tokens ─────────────────────────────────────────────────────────────

/** Abstands-Skala in Pixeln. */
export const spacing = {
  xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48,
};

/** Border-Radius-Skala in Pixeln. */
export const radius = {
  sm: 6, md: 10, lg: 16, xl: 24, full: 9999,
};

/** Typografie-Presets — als Style-Objekte verwendbar. */
export const type = {
  h1: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  h2: { fontSize: 22, fontWeight: '600', letterSpacing: -0.3 },
  h3: { fontSize: 17, fontWeight: '600', letterSpacing: -0.1 },
  body: { fontSize: 15, fontWeight: '400' },
  bodyMed: { fontSize: 15, fontWeight: '500' },
  caption: { fontSize: 13, fontWeight: '400' },
  label: { fontSize: 12, fontWeight: '600', letterSpacing: 0.4 },
};

// ── Theme Context ─────────────────────────────────────────────────────────────

const ThemeContext = createContext({ mode: 'system', setMode: () => {} });

/**
 * ThemeProvider — Umschließt die App und stellt den Theme-Mode-Context bereit.
 * Lädt den gespeicherten Mode aus AsyncStorage beim Startup.
 * Muss in App.js als Root-Provider gesetzt sein.
 */
export function ThemeProvider({ children }) {
  const [mode, setModeState] = useState('system');

  useEffect(() => {
    AsyncStorage.getItem('theme_mode').then(v => { if (v) setModeState(v); });
  }, []);

  const setMode = async (m) => {
    setModeState(m);
    await AsyncStorage.setItem('theme_mode', m);
  };

  return (
    <ThemeContext.Provider value={{ mode, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * useThemeMode — Liest und setzt den Theme-Mode ('light'|'dark'|'system').
 * Für den Einstellungen-Screen.
 */
export function useThemeMode() {
  return useContext(ThemeContext);
}

/**
 * useTheme — Haupt-Hook für alle Screens und Komponenten.
 * Gibt die aktuell gültige Farbpalette + Design-Tokens zurück.
 *
 * @returns {{ colors: object, spacing: object, radius: object, type: object, isDark: boolean }}
 */
export function useTheme() {
  const scheme = useColorScheme();
  const { mode } = useContext(ThemeContext);
  const isDark = mode === 'dark' || (mode === 'system' && scheme === 'dark');
  return {
    colors: isDark ? dark : light,
    spacing,
    radius,
    type,
    isDark,
  };
}
