import { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const light = {
  bg: '#FFFFFF',
  bgSecondary: '#F7F7F5',
  bgTertiary: '#EFEFED',
  text: '#0A0A0A',
  textSecondary: '#6B6B6B',
  textTertiary: '#A8A8A8',
  border: '#E8E8E6',
  borderStrong: '#C8C8C6',
  accent: '#1A1A1A',
  accentText: '#FFFFFF',
  tint: '#E8C547',
  tintText: '#1A1A1A',
  success: '#16A34A',
  warning: '#D97706',
  danger: '#DC2626',
  surface: '#FFFFFF',
  surfaceRaised: '#F7F7F5',
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

export const spacing = {
  xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48,
};

export const radius = {
  sm: 6, md: 10, lg: 16, xl: 24, full: 9999,
};

export const type = {
  h1: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  h2: { fontSize: 22, fontWeight: '600', letterSpacing: -0.3 },
  h3: { fontSize: 17, fontWeight: '600', letterSpacing: -0.1 },
  body: { fontSize: 15, fontWeight: '400' },
  bodyMed: { fontSize: 15, fontWeight: '500' },
  caption: { fontSize: 13, fontWeight: '400' },
  label: { fontSize: 12, fontWeight: '600', letterSpacing: 0.4 },
};

const ThemeContext = createContext({ mode: 'system', setMode: () => {} });

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

export function useThemeMode() {
  return useContext(ThemeContext);
}

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
