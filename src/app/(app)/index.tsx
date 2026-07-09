import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useAuth } from '../../../hooks/useAuth';
import { supabase } from '../../../lib/supabase';

export default function HomeScreen() {
  const { user } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const displayName =
    (user?.user_metadata?.display_name as string | undefined) ?? user?.email ?? 'there';

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    // Clears the session; onAuthStateChange flips the root guard back to (auth).
    const { error } = await supabase.auth.signOut();
    if (error) setSigningOut(false);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <ThemedText type="subtitle">Hi, {displayName}</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.centerText}>
            You&apos;re signed in. Next up: create or join your household.
          </ThemedText>
        </View>

        <Pressable
          onPress={handleSignOut}
          disabled={signingOut}
          accessibilityRole="button"
          style={({ pressed }) => [styles.signOut, { opacity: pressed || signingOut ? 0.6 : 1 }]}>
          {signingOut ? (
            <ActivityIndicator />
          ) : (
            <ThemedText style={styles.signOutText}>Sign out</ThemedText>
          )}
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  centerText: { textAlign: 'center' },
  signOut: {
    paddingVertical: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutText: { color: '#3c87f7', fontWeight: '600', fontSize: 16 },
});
