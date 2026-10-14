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
 * Then the opposite broke: a wide action (Budget's three links in Bulgarian)
 * squeezed the title to "Бю / д…". So now the row wraps: the title keeps at least
 * its own width and, when the action can't fit beside it, the action drops to
 * its own line (still right-aligned). Neither side can crush the other.
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
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: Spacing.three,
    rowGap: Spacing.two,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
  },
  // flexShrink (not flex) so a short title still hugs its text; a title longer
  // than the screen wraps to two lines (numberOfLines above).
  title: { flexShrink: 1 },
  // The action must never be clipped — it's how you leave the screen. It keeps
  // its width; auto margin keeps it right-aligned even after wrapping.
  action: { flexShrink: 0, marginLeft: 'auto' },
});
