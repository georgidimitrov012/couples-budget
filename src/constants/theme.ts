/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

// "Yours, Mine, Ours" — a two-tone identity. Teal = shared, coral = private.
// Neutrals lean subtly green rather than flat grey; dark uses off-white on a
// deep teal-black (not pure white on black) to avoid glare.
export const Colors = {
  light: {
    text: '#12211e',
    background: '#f5f8f7',
    backgroundElement: '#ffffff',
    backgroundSelected: '#e6ebe9',
    textSecondary: '#66746f',
    tint: '#e2f3f0', // subtle teal wash (active tabs / selected chips)
  },
  dark: {
    text: '#e8edeb',
    background: '#0b1211',
    backgroundElement: '#141e1c',
    backgroundSelected: '#28352f',
    textSecondary: '#94a29d',
    tint: '#123029',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

// Scheme-independent accents (same in light and dark). `ours`/`mine` carry the
// scope identity; `primary` is the brand (teal, == ours).
export const Accent = {
  primary: '#10a597',
  onPrimary: '#ffffff',
  ours: '#10a597',
  mine: '#f26a4b',
  onScope: '#ffffff',
  warning: '#e9a23b',
  danger: '#e5484d',
} as const;

// Corner radii — generous and tactile.
export const Radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 } as const;

// Soft card elevation. On dark grounds the shadow is barely visible; the
// stepped surface colours carry the depth there instead.
export const Shadow = {
  card: {
    shadowColor: '#0b1211',
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
} as const;

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
