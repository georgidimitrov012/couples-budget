import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Accent, MaxContentWidth, Radius, Shadow, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '../../hooks/useTranslation';

type Point = { emoji: string; titleKey: string; bodyKey: string; tint: string };

const POINTS: Point[] = [
  { emoji: '⚖️', titleKey: 'intro.oursTitle', bodyKey: 'intro.oursBody', tint: Accent.ours },
  { emoji: '🛒', titleKey: 'intro.listTitle', bodyKey: 'intro.listBody', tint: Accent.mine },
  { emoji: '✅', titleKey: 'intro.linkTitle', bodyKey: 'intro.linkBody', tint: Accent.primary },
];

/**
 * One-time explainer shown on first run (see useIntroSeen). Renders as a full,
 * opaque overlay above the home screen and dismisses to never show again.
 */
export function IntroOverlay({ onDismiss }: { onDismiss: () => void }) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <ThemedView style={[StyleSheet.absoluteFill, styles.fill]} accessibilityViewIsModal>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.inner}>
          <ThemedText type="subtitle" style={styles.title}>
            {t('intro.title')}
          </ThemedText>

          <View style={styles.points}>
            {POINTS.map((p) => (
              <View key={p.titleKey} style={styles.point}>
                <View style={[styles.badge, { backgroundColor: theme.tint }]}>
                  <ThemedText style={styles.badgeEmoji}>{p.emoji}</ThemedText>
                </View>
                <View style={styles.pointText}>
                  <ThemedText style={[styles.pointTitle, { color: p.tint }]}>
                    {t(p.titleKey)}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t(p.bodyKey)}
                  </ThemedText>
                </View>
              </View>
            ))}
          </View>

          <Pressable
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel={t('intro.gotIt')}
            style={({ pressed }) => [styles.button, { opacity: pressed ? 0.8 : 1 }]}>
            <ThemedText style={styles.buttonText}>{t('intro.gotIt')}</ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fill: { zIndex: 10 },
  safeArea: { flex: 1 },
  inner: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.five,
  },
  title: { textAlign: 'center' },
  points: { gap: Spacing.four },
  point: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
  badge: {
    width: 48,
    height: 48,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeEmoji: { fontSize: 24 },
  pointText: { flex: 1, gap: Spacing.half },
  pointTitle: { fontSize: 16, fontWeight: '700' },
  button: {
    backgroundColor: Accent.primary,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.card,
  },
  buttonText: { color: Accent.onPrimary, fontWeight: '700', fontSize: 16 },
});
