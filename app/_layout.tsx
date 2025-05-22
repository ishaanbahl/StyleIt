import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { AppColors } from '../constants/Colors';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

// Define a single custom theme using AppColors
const MyCustomTheme = {
  ...DefaultTheme, // Start with React Navigation's default light theme
  colors: {
    ...DefaultTheme.colors,
    primary: AppColors.primaryButtonBackground, // Example: using black as primary
    background: AppColors.screenBackground,
    card: AppColors.cardBackground,
    text: AppColors.primaryText,
    border: AppColors.inputBorder, 
    // You might want to map other React Navigation theme colors if needed
    // notification: AppColors.accentColor, // Example if you add an accent color
  },
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    'Wasted-Vindey': require('../assets/fonts/Wasted-Vindey.ttf'),
  });

  useEffect(() => {
    if (fontError) {
      console.error("Font loading error:", fontError);
    }
    if (fontsLoaded || fontError) {
      // Hide the splash screen after the fonts have loaded (or an error occurred)
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // Don't render anything until the fonts are loaded or an error occurs
  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <ThemeProvider value={MyCustomTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="dark" />
    </ThemeProvider>
  );
}
