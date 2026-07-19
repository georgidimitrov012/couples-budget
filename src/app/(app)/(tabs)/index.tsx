import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { IntroOverlay } from '@/components/intro-overlay';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Accent, BottomTabInset, Radius, Shadow, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '../../../../hooks/useAuth';
import { useHousehold } from '../../../../hooks/useHousehold';
import { useIntroSeen } from '../../../../hooks/useIntroSeen';
import { useTranslation } from '../../../../hooks/useTranslation';
import { supabase } from '../../../../lib/supabase';

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useTranslation();
  const { household, members, regenerateInviteCode } = useHousehold();
  const { seen: introSeen, ready: introReady, markSeen } = useIntroSeen();
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
            accessibilityLabel={t('home.settings')}
            hitSlop={8}
            style={({ pressed }) => pressed && styles.pressed}>
            <ThemedText style={styles.settingsLink}>{t('home.settings')}</ThemedText>
          </Pressable>
        </View>

        <View style={styles.content}>
          <View style={styles.greeting}>
            <Avatar name={displayName} color={Accent.ours} size={64} />
            <ThemedText type="subtitle" style={styles.centerText}>
              {t('home.greeting', { name: displayName })}
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
                {t('home.shareCode')}
              </ThemedText>
              <ThemedText style={[styles.code, { color: Accent.primary }]} selectable>
                {household?.invite_code ?? '——————'}
              </ThemedText>
              <View style={styles.waitingRow}>
                <ActivityIndicator size="small" color={Accent.mine} />
                <ThemedText type="small" themeColor="textSecondary">
                  {t('home.waiting')}
                </ThemedText>
              </View>
              <Pressable
                onPress={handleRegenerate}
                disabled={regenerating}
                accessibilityRole="button"
                accessibilityLabel={t('home.regenerate')}
                hitSlop={8}
                style={({ pressed }) => (pressed || regenerating) && styles.pressed}>
                {regenerating ? (
                  <ActivityIndicator size="small" color={Accent.primary} />
                ) : (
                  <ThemedText type="small" style={styles.regenerateText}>
                    {t('home.regenerate')}
                  </ThemedText>
                )}
              </Pressable>
            </ThemedView>
          ) : (
            <View style={styles.nextWrap}>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.nextLabel}>
                {t('home.nextSteps')}
              </ThemedText>
              <NextStepCard
                emoji="🛒"
                title={t('home.stepListTitle')}
                body={t('home.stepListBody')}
                onPress={() => router.push('/list')}
              />
              <NextStepCard
                emoji="💸"
                title={t('home.stepBudgetTitle')}
                body={t('home.stepBudgetBody')}
                onPress={() => router.push('/budget')}
              />
            </View>
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
            <ThemedText style={styles.signOutText}>{t('common.signOut')}</ThemedText>
          )}
        </Pressable>
      </SafeAreaView>

      {introReady && !introSeen && <IntroOverlay onDismiss={markSeen} />}
    </ThemedView>
  );
}

function NextStepCard({
  emoji,
  title,
  body,
  onPress,
}: {
  emoji: string;
  title: string;
  body: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView type="backgroundElement" style={[styles.stepCard, Shadow.card]}>
        <View style={[styles.stepBadge, { backgroundColor: theme.tint }]}>
          <ThemedText style={styles.stepEmoji}>{emoji}</ThemedText>
        </View>
        <View style={styles.stepText}>
          <ThemedText style={styles.stepTitle}>{title}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {body}
          </ThemedText>
        </View>
        <ThemedText style={styles.chevron} themeColor="textSecondary">
          ›
        </ThemedText>
      </ThemedView>
    </Pressable>
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
  nextWrap: { alignSelf: 'stretch', gap: Spacing.two },
  nextLabel: { letterSpacing: 0.6, marginLeft: Spacing.one, marginBottom: Spacing.one },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.lg,
  },
  stepBadge: { width: 44, height: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  stepEmoji: { fontSize: 22 },
  stepText: { flex: 1, gap: Spacing.half },
  stepTitle: { fontSize: 16, fontWeight: '700' },
  chevron: { fontSize: 24, fontWeight: '700' },
  signOut: { paddingVertical: Spacing.three, alignItems: 'center', justifyContent: 'center' },
  signOutText: { color: Accent.primary, fontWeight: '600', fontSize: 16 },
});
