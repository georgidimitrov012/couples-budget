import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Accent } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** "Alex Rivera" → "AR", "maria" → "M", empty → "?". */
export function initialsFor(name?: string | null): string {
  const n = (name ?? '').trim();
  if (!n) return '?';
  const parts = n.split(/\s+/);
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

/**
 * A round, initials-based avatar. The couple is made visible by colour — one
 * partner teal (Ours), the other coral (Mine). A ring lets avatars overlap
 * cleanly when paired.
 */
export function Avatar({
  name,
  color = Accent.primary,
  size = 36,
  ring = false,
}: {
  name?: string | null;
  color?: string;
  size?: number;
  ring?: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          borderWidth: ring ? 2.5 : 0,
          borderColor: theme.backgroundElement,
        },
      ]}>
      <ThemedText style={[styles.text, { fontSize: Math.round(size * 0.4) }]}>
        {initialsFor(name)}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center' },
  text: { color: '#ffffff', fontWeight: '800' },
});
