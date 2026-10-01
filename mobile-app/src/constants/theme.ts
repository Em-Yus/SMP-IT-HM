/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

// Palette Resmi dari warna.json
export const AppColors = {
  // Brand Colors
  primary: '#1E257F',
  primaryContainer: '#ECEEFF',
  secondary: '#84D43F',
  secondaryContainer: '#F2FBEB',

  // Neutral Colors
  background: '#FFFFFF',
  surface: '#F8F9FA',
  surfaceVariant: '#F1F3F5',
  border: '#E2E8F0',
  divider: '#CBD5E1',

  // Typography Colors
  textPrimary: '#1A1818',
  textSecondary: '#6C757D',
  textTertiary: '#ADB5BD',
  onPrimary: '#FFFFFF',
  onSecondary: '#1A1818',

  // Semantic Status Colors
  success: '#2EC4B6',
  error: '#E63946',
  warning: '#FFB703',
  info: '#00B4D8',
} as const;

export const Colors = {
  light: {
    text: '#1A1818',
    background: '#FFFFFF',
    backgroundElement: '#F1F3F5',
    backgroundSelected: '#ECEEFF',
    textSecondary: '#6C757D',
    primary: '#1E257F',
    secondary: '#84D43F',
    border: '#E2E8F0',
    surface: '#F8F9FA',
  },
  dark: {
    text: '#FFFFFF',
    background: '#121212',
    backgroundElement: '#1E1E1E',
    backgroundSelected: '#2A2C87',
    textSecondary: '#ADB5BD',
    primary: '#7679FF',
    secondary: '#84D43F',
    border: '#2E3135',
    surface: '#1A1818',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
