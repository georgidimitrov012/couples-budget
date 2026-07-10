import { Stack } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { HouseholdProvider, useHousehold } from '../../../hooks/useHousehold';

function AppNavigator() {
  const { household, loading, error, refresh } = useHousehold();

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
          <ThemedText style={styles.retryText}>Try again</ThemedText>
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
      </Stack.Protected>
    </Stack>
  );
}

export default function AppLayout() {
  return (
    <HouseholdProvider>
      <AppNavigator />
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
  error: { color: '#e5484d', textAlign: 'center' },
  retry: { paddingVertical: Spacing.two, paddingHorizontal: Spacing.four },
  retryText: { color: '#3c87f7', fontWeight: '600' },
});
