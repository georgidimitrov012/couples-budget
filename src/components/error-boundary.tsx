import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Accent, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '../../hooks/useTranslation';
import { reportError } from '../../lib/crash-reporting';

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * App-wide safety net. Catches render/lifecycle errors anywhere below it, reports
 * them to crash reporting, and shows a friendly recovery screen with a retry —
 * instead of the app dying with a white screen (which is exactly what the launch
 * crash did). Kept above the theme/auth providers but inside TranslationProvider
 * so the fallback stays localized even when everything below has thrown.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportError(error, { componentStack: info.componentStack });
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) return <ErrorFallback onRetry={this.reset} />;
    return this.props.children;
  }
}

function ErrorFallback({ onRetry }: { onRetry: () => void }) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <View style={[styles.wrap, { backgroundColor: theme.background }]}>
      <ThemedText style={styles.emoji}>😵‍💫</ThemedText>
      <ThemedText style={styles.title}>{t('crash.title')}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.body}>
        {t('crash.body')}
      </ThemedText>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
        <ThemedText style={styles.buttonLabel}>{t('common.tryAgain')}</ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  emoji: { fontSize: 48 },
  title: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  body: { textAlign: 'center', maxWidth: 320, lineHeight: 20 },
  button: {
    marginTop: Spacing.three,
    backgroundColor: Accent.primary,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.five,
  },
  buttonLabel: { color: Accent.onPrimary, fontWeight: '700', fontSize: 16 },
  pressed: { opacity: 0.7 },
});
