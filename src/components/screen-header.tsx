import { type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Spacing } from '@/constants/theme';
import { ThemedText } from './themed-text';

type Props = {
  title: string;
  /** Right-hand action(s) — a Done link, a "clear checked" button, a row of links. */
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * The screen title + right-hand action row every screen shares.
 *
 * Exists because each screen used to inline this, and none of them constrained
 * the title: at `subtitle` size (32) a long title took its full intrinsic width
 * and pushed the action off the edge of the screen. Bulgarian hit it first
 * ("Списък за пазаруване" clipped "Изчисти", "Повтарящи се разходи" clipped
 * "Готово") but any long translation would.
 *
 * So: the title shrinks and wraps to two lines, the action never shrinks.
 */
export function ScreenHeader({ title, children, style }: Props) {
  return (
    <View style={[styles.header, style]}>
      <ThemedText type="subtitle" numberOfLines={2} style={styles.title}>
        {title}
      </ThemedText>
      {children != null && <View style={styles.action}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
  },
  // flexShrink (not flex) so a short title still hugs its text and the action
  // stays hard right; numberOfLines={2} above turns overflow into a wrap.
  title: { flexShrink: 1 },
  // The action is the thing that must never be clipped — it's how you leave the
  // screen. It keeps its intrinsic width and the title gives way instead.
  action: { flexShrink: 0 },
});
