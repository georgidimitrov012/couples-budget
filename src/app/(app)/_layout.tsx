import { Stack } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Accent, Spacing } from '@/constants/theme';
import { CategoriesProvider } from '../../../hooks/useCategories';
import { HouseholdProvider, useHousehold } from '../../../hooks/useHousehold';
import { useTranslation } from '../../../hooks/useTranslation';

function AppNavigator() {
  const { household, loading, error, refresh } = useHousehold();
  const { t } = useTranslation();

  // The splash is already gone by now, so show an explicit loading/error state
  // while the household membership resolves.
  if (loading) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  if (error) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText type="small" style={styles.error}>
          {error}
        </ThemedText>
        <Pressable onPress={refresh} style={({ pressed }) => [styles.retry, { opacity: pressed ? 0.7 : 1 }]}>
          <ThemedText style={styles.retryText}>{t('common.tryAgain')}</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!household}>
        <Stack.Screen name="(onboarding)" />
      </Stack.Protected>
      <Stack.Protected guard={!!household}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="categories" options={{ presentation: 'modal' }} />
        <Stack.Screen name="receipt" options={{ presentation: 'modal' }} />
        <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function AppLayout() {
  return (
    <HouseholdProvider>
      <CategoriesProvider>
        <AppNavigator />
      </CategoriesProvider>
    </HouseholdProvider>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  error: { color: Accent.danger, textAlign: 'center' },
  retry: { paddingVertical: Spacing.two, paddingHorizontal: Spacing.four },
  retryText: { color: Accent.primary, fontWeight: '600' },
});
