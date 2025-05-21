/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

// ADDED: StyleIt specific color palette
export const AppColors = {
  screenBackground: '#e7d4bf',
  cardBackground: '#f8efe4',
  primaryButtonBackground: '#000000',
  primaryButtonText: '#FFFFFF',
  secondaryCardBackground: '#f8efe4',
  primaryText: '#000000',
  secondaryText: '#555555', 
  iconColor: '#000000',
  inputBackground: '#f8efe4', 
  inputBorder: '#E0E0E0',
  errorText: '#D32F2F', 
  errorBackground: '#FFEBEE',
  loadingText: '#555555',
  buttonDisabledBackground: '#A9A9A9',
  // Added for Gallery delete button
  dangerButtonBackground: '#D32F2F',
  dangerButtonText: '#FFFFFF',
};
