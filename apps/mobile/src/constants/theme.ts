import '@/global.css';

import { Platform } from 'react-native';

export const Palette = {
  // Light Mode Colors
  alabaster: '#FAF9F6',
  oatmeal: '#E5DED2',
  espresso: '#544339',

  // Accents
  roseGoldDark: '#B76E79',
  roseGoldMid: '#D98D78',
  roseGoldLight: '#E8B4B8',
  mutedSage: '#A3B899',

  // Dark Mode Colors
  obsidian: '#1E1E1F',
  platinum: '#E2DCD8',
} as const;

export const Colors = {
  light: {
    text: Palette.espresso,
    background: Palette.alabaster,
    backgroundElement: Palette.oatmeal,
    backgroundSelected: '#EAE5E0', // Warm sand selection
    textSecondary: '#8D7B70', // Warm taupe-espresso
    accent: Palette.mutedSage,
    roseGoldDark: Palette.roseGoldDark,
    roseGoldMid: Palette.roseGoldMid,
    roseGoldLight: Palette.roseGoldLight,
  },
  dark: {
    text: Palette.platinum,
    background: Palette.obsidian,
    backgroundElement: 'rgba(30, 30, 31, 0.75)', // Dark glass card
    backgroundSelected: Palette.roseGoldDark,
    textSecondary: '#A09A96',
    accent: Palette.mutedSage,
    roseGoldDark: Palette.roseGoldDark,
    roseGoldMid: Palette.roseGoldMid,
    roseGoldLight: Palette.roseGoldLight,
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = {
  sans: {
    fontFamily: Platform.select({
      ios: 'Outfit-Regular',
      android: 'Outfit-Regular',
      web: 'Outfit, sans-serif',
      default: 'Outfit-Regular',
    }),
    semibold: Platform.select({
      ios: 'Outfit-SemiBold',
      android: 'Outfit-SemiBold',
      web: 'Outfit, sans-serif',
      default: 'Outfit-SemiBold',
    }),
    bold: Platform.select({
      ios: 'Outfit-Bold',
      android: 'Outfit-Bold',
      web: 'Outfit, sans-serif',
      default: 'Outfit-Bold',
    }),
  },
  serif: {
    fontFamily: Platform.select({
      ios: 'PlayfairDisplay-Regular',
      android: 'PlayfairDisplay-Regular',
      web: 'Playfair Display, serif',
      default: 'PlayfairDisplay-Regular',
    }),
    semibold: Platform.select({
      ios: 'PlayfairDisplay-SemiBold',
      android: 'PlayfairDisplay-SemiBold',
      web: 'Playfair Display, serif',
      default: 'PlayfairDisplay-SemiBold',
    }),
    bold: Platform.select({
      ios: 'PlayfairDisplay-Bold',
      android: 'PlayfairDisplay-Bold',
      web: 'Playfair Display, serif',
      default: 'PlayfairDisplay-Bold',
    }),
  },
  mono: Platform.select({
    ios: 'ui-monospace',
    android: 'monospace',
    web: 'monospace',
    default: 'monospace',
  }),
};

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 70, android: 80, default: 80 }) ?? 80;
export const MaxContentWidth = 800;
