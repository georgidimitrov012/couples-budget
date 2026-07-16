import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Accent, MaxContentWidth, Radius, Shadow, Spacing } from '@/constants/theme';
import { useAccount } from '../../../hooks/useAccount';
import { useAuth } from '../../../hooks/useAuth';
import { useHousehold } from '../../../hooks/useHousehold';

export default function SettingsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { household, members, leaveHousehold } = useHousehold();
  const { deleteAccount } = useAccount();
  const [busy, setBusy] = useState<null | 'leave' | 'delete'>(null);

  const displayName =
    (user?.user_metadata?.display_name as string | undefined) ?? user?.email ?? 'You';
  const soloHousehold = members.length < 2;

  async function doLeave() {
    setBusy('leave');
    const { error } = await leaveHousehold();
    if (error) {
      setBusy(null);
      Alert.alert('Could not leave', error);
    }
    // On success the (app) guard swaps to the create/join onboarding screen and
    // this modal unmounts, so there's nothing more to do here.
  }

  async function doDelete() {
    setBusy('delete');
    const { error } = await deleteAccount();
    if (error) {
      setBusy(null);
      Alert.alert('Could not delete account', error);
    }
    // On success the session is cleared and the app routes back to sign-in.
  }

  function confirmLeave() {
    Alert.alert(
      'Leave household?',
      soloHousehold
        ? 'This deletes the household and everything in it. This cannot be undone.'
        : "Your budget entries, settlements and receipts in this household will be deleted, and it stays with your partner. This can't be undone.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: doLeave },
      ]
    );
  }

  function confirmDelete() {
    Alert.alert(
      'Delete account?',
      'This permanently deletes your account and your data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete account', style: 'destructive', onPress: doDelete },
      ]
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.inner}>
          <View style={styles.header}>
            <ThemedText type="subtitle">Settings</ThemedText>
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Close"
              hitSlop={8}
              style={({ pressed }) => pressed && styles.pressed}>
              <ThemedText style={styles.close}>Done</ThemedText>
            </Pressable>
          </View>

          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              ACCOUNT
            </ThemedText>
            <ThemedText style={styles.name} numberOfLines={1}>
              {displayName}
            </ThemedText>
            {user?.email ? (
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {user.email}
              </ThemedText>
            ) : null}
            {household ? (
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {household.name}
              </ThemedText>
            ) : null}
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.card}>
            <Pressable
              onPress={confirmLeave}
              disabled={busy != null}
              accessibilityRole="button"
              accessibilityLabel="Leave household"
              style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
              {busy === 'leave' ? (
                <ActivityIndicator />
              ) : (
                <ThemedText style={styles.actionText}>Leave household</ThemedText>
              )}
              <ThemedText type="small" themeColor="textSecondary">
                Exit this household and return to setup.
              </ThemedText>
            </Pressable>
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.card}>
            <Pressable
              onPress={confirmDelete}
              disabled={busy != null}
              accessibilityRole="button"
              accessibilityLabel="Delete account"
              style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
              {busy === 'delete' ? (
                <ActivityIndicator color={Accent.danger} />
              ) : (
                <ThemedText style={[styles.actionText, styles.danger]}>Delete account</ThemedText>
              )}
              <ThemedText type="small" themeColor="textSecondary">
                Permanently delete your account and your data.
              </ThemedText>
            </Pressable>
          </ThemedView>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  inner: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
  },
  close: { color: Accent.primary, fontWeight: '600', fontSize: 16 },
  pressed: { opacity: 0.6 },
  card: {
    borderRadius: Radius.lg,
    padding: Spacing.four,
    gap: Spacing.two,
    ...Shadow.card,
  },
  name: { fontSize: 18, fontWeight: '600' },
  action: { gap: Spacing.one },
  actionText: { fontSize: 16, fontWeight: '600', color: Accent.primary },
  danger: { color: Accent.danger },
});
