import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

/**
 * A consistent empty state: a big emoji, a short headline, and a hint that tells
 * the user what the screen is for and what to do next. Used across the list,
 * budget and categories screens so every empty screen explains itself.
 */
export function EmptyState({ emoji, title, hint }: { emoji: string; title: string; hint?: string }) {
  return (
    <View style={styles.wrap}>
      <ThemedText style={styles.emoji}>{emoji}</ThemedText>
      <ThemedText style={styles.title}>{title}</ThemedText>
      {hint ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
          {hint}
        </ThemedText>
      ) : null}
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
    paddingVertical: Spacing.six,
  },
  emoji: { fontSize: 44 },
  title: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  hint: { textAlign: 'center', maxWidth: 320, lineHeight: 20 },
});
