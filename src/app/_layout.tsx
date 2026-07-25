import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { ErrorBoundary } from '@/components/error-boundary';
import { AuthProvider, useAuth } from '../../hooks/useAuth';
import { CurrencyProvider } from '../../hooks/useCurrency';
import { TranslationProvider } from '../../hooks/useTranslation';
import { initCrashReporting } from '../../lib/crash-reporting';

SplashScreen.preventAutoHideAsync();
initCrashReporting();

function RootNavigator() {
  const { session, initializing } = useAuth();

  // While the persisted session restores, render nothing — the splash overlay
  // stays on top and provides the loading state.
  if (initializing) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <TranslationProvider>
      <ErrorBoundary>
        <CurrencyProvider>
          <AuthProvider>
            <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
              <AnimatedSplashOverlay />
              <RootNavigator />
            </ThemeProvider>
          </AuthProvider>
        </CurrencyProvider>
      </ErrorBoundary>
    </TranslationProvider>
  );
}
