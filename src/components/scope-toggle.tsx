import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Accent, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type Scope = 'private' | 'shared';

const OPTIONS: { value: Scope; label: string }[] = [
  { value: 'shared', label: 'Ours' },
  { value: 'private', label: 'Mine' },
];

// Each scope wears its identity colour when active: Ours teal, Mine coral.
const ACTIVE_COLOR: Record<Scope, string> = { shared: Accent.ours, private: Accent.mine };

/**
 * The Ours/Mine segmented control used by the budget and categories forms.
 * "Ours" = scope 'shared' (visible to both partners), "Mine" = scope 'private'
 * (visible only to the owner) — see the scope rule in AGENTS.md.
 */
export function ScopeToggle({ scope, onChange }: { scope: Scope; onChange: (s: Scope) => void }) {
  const theme = useTheme();
  return (
    <View style={[styles.toggle, { backgroundColor: theme.background }]}>
      {OPTIONS.map((o) => {
        const active = scope === o.value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`Scope: ${o.label}`}
            style={[styles.option, active && { backgroundColor: ACTIVE_COLOR[o.value] }]}>
            <ThemedText
              type="smallBold"
              style={{ color: active ? Accent.onScope : theme.textSecondary }}>
              {o.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  toggle: { flexDirection: 'row', borderRadius: Spacing.two, padding: 2 },
  option: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two - 2,
  },
});
