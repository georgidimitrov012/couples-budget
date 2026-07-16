import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Accent, BottomTabInset, Radius, Shadow, Spacing } from '@/constants/theme';
import { useAuth } from '../../../../hooks/useAuth';
import { useHousehold } from '../../../../hooks/useHousehold';
import { supabase } from '../../../../lib/supabase';

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { household, members, regenerateInviteCode } = useHousehold();
  const [signingOut, setSigningOut] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const displayName =
    (user?.user_metadata?.display_name as string | undefined) ?? user?.email ?? 'there';
  const waitingForPartner = members.length < 2;

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    const { error } = await supabase.auth.signOut();
    if (error) setSigningOut(false);
  }

  async function handleRegenerate() {
    if (regenerating) return;
    setRegenerating(true);
    await regenerateInviteCode();
    setRegenerating(false);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.push('/settings')}
            accessibilityRole="button"
            accessibilityLabel="Settings"
            hitSlop={8}
            style={({ pressed }) => pressed && styles.pressed}>
            <ThemedText style={styles.settingsLink}>Settings</ThemedText>
          </Pressable>
        </View>

        <View style={styles.content}>
          <View style={styles.greeting}>
            <Avatar name={displayName} color={Accent.ours} size={64} />
            <ThemedText type="subtitle" style={styles.centerText}>
              Hi, {displayName}
            </ThemedText>
            {household && (
              <ThemedText themeColor="textSecondary" style={styles.centerText}>
                {household.name}
              </ThemedText>
            )}
          </View>

          {waitingForPartner ? (
            <ThemedView type="backgroundElement" style={[styles.inviteCard, Shadow.card]}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                SHARE THIS CODE WITH YOUR PARTNER
              </ThemedText>
              <ThemedText style={[styles.code, { color: Accent.primary }]} selectable>
                {household?.invite_code ?? '——————'}
              </ThemedText>
              <View style={styles.waitingRow}>
                <ActivityIndicator size="small" color={Accent.mine} />
                <ThemedText type="small" themeColor="textSecondary">
                  Waiting for your partner to join…
                </ThemedText>
              </View>
              <Pressable
                onPress={handleRegenerate}
                disabled={regenerating}
                accessibilityRole="button"
                accessibilityLabel="Regenerate code"
                hitSlop={8}
                style={({ pressed }) => (pressed || regenerating) && styles.pressed}>
                {regenerating ? (
                  <ActivityIndicator size="small" color={Accent.primary} />
                ) : (
                  <ThemedText type="small" style={styles.regenerateText}>
                    Regenerate code
                  </ThemedText>
                )}
              </Pressable>
            </ThemedView>
          ) : (
            <ThemedText themeColor="textSecondary" style={styles.centerText}>
              You&apos;re both set up. Next up: your shared shopping list and budget.
            </ThemedText>
          )}
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
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', paddingTop: Spacing.two },
  settingsLink: { color: Accent.primary, fontWeight: '600', fontSize: 16 },
  pressed: { opacity: 0.6 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.four },
  greeting: { gap: Spacing.two, alignItems: 'center' },
  centerText: { textAlign: 'center' },
  inviteCard: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
    borderRadius: Radius.xl,
  },
  code: { fontSize: 40, fontWeight: '800', letterSpacing: 6 },
  waitingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  regenerateText: { color: Accent.primary, fontWeight: '600' },
  signOut: { paddingVertical: Spacing.three, alignItems: 'center', justifyContent: 'center' },
  signOutText: { color: Accent.primary, fontWeight: '600', fontSize: 16 },
});
