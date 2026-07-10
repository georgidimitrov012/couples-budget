import { Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Accent, Spacing } from '@/constants/theme';
import { supabase } from '../../../../lib/supabase';

export default function WelcomeScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <ThemedText type="subtitle" style={styles.centerText}>
            Set up your household
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.centerText}>
            A household links you and your partner. Create one and share the code, or join with a
            code you already have.
          </ThemedText>
        </View>

        <View style={styles.actions}>
          <Link href="/create" asChild>
            <Pressable style={({ pressed }) => [styles.primary, { opacity: pressed ? 0.8 : 1 }]}>
              <ThemedText style={styles.primaryText}>Create a household</ThemedText>
            </Pressable>
          </Link>
          <Link href="/join" asChild>
            <Pressable style={({ pressed }) => [styles.secondary, { opacity: pressed ? 0.6 : 1 }]}>
              <ThemedText style={styles.secondaryText}>Join with a code</ThemedText>
            </Pressable>
          </Link>
          <Pressable
            onPress={() => supabase.auth.signOut()}
            style={({ pressed }) => [styles.signOut, { opacity: pressed ? 0.6 : 1 }]}>
            <ThemedText type="small" themeColor="textSecondary">
              Sign out
            </ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingHorizontal: Spacing.four },
  content: { flex: 1, justifyContent: 'center', gap: Spacing.two },
  centerText: { textAlign: 'center' },
  actions: { gap: Spacing.three, paddingBottom: Spacing.four },
  primary: {
    backgroundColor: Accent.primary,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  primaryText: { color: Accent.onPrimary, fontWeight: '600', fontSize: 16 },
  secondary: { paddingVertical: Spacing.three, alignItems: 'center' },
  secondaryText: { color: Accent.primary, fontWeight: '600', fontSize: 16 },
  signOut: { alignItems: 'center', paddingVertical: Spacing.two },
});
