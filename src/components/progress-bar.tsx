import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

/**
 * A thin horizontal progress bar. `ratio` may exceed 1 (over budget); the fill
 * caps at full width and the caller passes the appropriate `color` for the state.
 */
export function ProgressBar({ ratio, color }: { ratio: number; color: string }) {
  const theme = useTheme();
  const pct = Math.max(0, Math.min(1, ratio)) * 100;
  return (
    <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
      <View style={[styles.fill, { width: `${pct}%`, backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
});
