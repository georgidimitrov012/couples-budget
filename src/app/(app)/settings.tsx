import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Accent, MaxContentWidth, Radius, Shadow, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { LANG_LABEL, LANGS } from '../../../lib/i18n';
import { useAccount } from '../../../hooks/useAccount';
import { useAuth } from '../../../hooks/useAuth';
import { useHousehold } from '../../../hooks/useHousehold';
import { useTranslation } from '../../../hooks/useTranslation';

export default function SettingsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { t, lang, setLang } = useTranslation();
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
      Alert.alert(t('settings.leaveFailed'), error);
    }
    // On success the (app) guard swaps to the create/join onboarding screen and
    // this modal unmounts, so there's nothing more to do here.
  }

  async function doDelete() {
    setBusy('delete');
    const { error } = await deleteAccount();
    if (error) {
      setBusy(null);
      Alert.alert(t('settings.deleteFailed'), error);
    }
    // On success the session is cleared and the app routes back to sign-in.
  }

  function confirmLeave() {
    Alert.alert(
      t('settings.leaveTitle'),
      soloHousehold ? t('settings.leaveSolo') : t('settings.leaveCouple'),
      [
        { text: t('settings.leaveCancel'), style: 'cancel' },
        { text: t('settings.leaveConfirm'), style: 'destructive', onPress: doLeave },
      ]
    );
  }

  function confirmDelete() {
    Alert.alert(t('settings.deleteTitle'), t('settings.deleteBody'), [
      { text: t('settings.leaveCancel'), style: 'cancel' },
      { text: t('settings.deleteConfirm'), style: 'destructive', onPress: doDelete },
    ]);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.inner}>
          <View style={styles.header}>
            <ThemedText type="subtitle">{t('settings.title')}</ThemedText>
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              hitSlop={8}
              style={({ pressed }) => pressed && styles.pressed}>
              <ThemedText style={styles.close}>{t('common.done')}</ThemedText>
            </Pressable>
          </View>

          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {t('settings.account')}
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
            <ThemedText type="smallBold" themeColor="textSecondary">
              {t('settings.language')}
            </ThemedText>
            <View style={styles.langRow}>
              {LANGS.map((l) => {
                const active = lang === l;
                return (
                  <Pressable
                    key={l}
                    onPress={() => setLang(l)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={LANG_LABEL[l]}
                    style={[
                      styles.langOption,
                      { borderColor: active ? Accent.primary : theme.backgroundSelected },
                      active && { backgroundColor: theme.tint },
                    ]}>
                    <ThemedText
                      style={active ? styles.langActive : undefined}
                      themeColor={active ? 'text' : 'textSecondary'}>
                      {LANG_LABEL[l]}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.card}>
            <Pressable
              onPress={confirmLeave}
              disabled={busy != null}
              accessibilityRole="button"
              accessibilityLabel={t('settings.leave')}
              style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
              {busy === 'leave' ? (
                <ActivityIndicator />
              ) : (
                <ThemedText style={styles.actionText}>{t('settings.leave')}</ThemedText>
              )}
              <ThemedText type="small" themeColor="textSecondary">
                {t('settings.leaveDesc')}
              </ThemedText>
            </Pressable>
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.card}>
            <Pressable
              onPress={confirmDelete}
              disabled={busy != null}
              accessibilityRole="button"
              accessibilityLabel={t('settings.delete')}
              style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
              {busy === 'delete' ? (
                <ActivityIndicator color={Accent.danger} />
              ) : (
                <ThemedText style={[styles.actionText, styles.danger]}>
                  {t('settings.delete')}
                </ThemedText>
              )}
              <ThemedText type="small" themeColor="textSecondary">
                {t('settings.deleteDesc')}
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
  langRow: { flexDirection: 'row', gap: Spacing.two },
  langOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  langActive: { fontWeight: '700' },
});
