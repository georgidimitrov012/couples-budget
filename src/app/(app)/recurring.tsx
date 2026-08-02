import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/empty-state';
import { ScopeToggle } from '@/components/scope-toggle';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Accent, MaxContentWidth, Radius, Shadow, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { parseAmount } from '../../../lib/format';
import { parseDayOfMonth } from '../../../lib/recurring';
import { useCategories } from '../../../hooks/useCategories';
import { useCurrency } from '../../../hooks/useCurrency';
import {
  useRecurringRules,
  type RecurringRule,
  type RecurringScope,
} from '../../../hooks/useRecurringRules';
import { useTranslation } from '../../../hooks/useTranslation';

export default function RecurringScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { categories } = useCategories();
  const { rules, loading, error, addRule, removeRule } = useRecurringRules();

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [day, setDay] = useState('1');
  const [scope, setScope] = useState<RecurringScope>('shared');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const parsedAmount = parseAmount(amount);

  async function handleAdd() {
    if (saving || parsedAmount == null || parsedAmount <= 0) return;
    setSaving(true);
    setFormError(null);
    const { error: addError } = await addRule({
      amount: parsedAmount,
      description,
      scope,
      categoryId,
      dayOfMonth: parseDayOfMonth(day),
    });
    if (addError) {
      setFormError(addError);
      setSaving(false);
      return;
    }
    setAmount('');
    setDescription('');
    setDay('1');
    setScope('shared');
    setCategoryId(null);
    setSaving(false);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.inner}>
          <View style={styles.header}>
            <ThemedText type="subtitle">{t('recurring.title')}</ThemedText>
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              hitSlop={8}
              style={({ pressed }) => pressed && styles.pressed}>
              <ThemedText style={styles.close}>{t('common.done')}</ThemedText>
            </Pressable>
          </View>

          <ThemedText type="small" themeColor="textSecondary" style={styles.explainer}>
            {t('recurring.explainer')}
          </ThemedText>

          <ThemedView type="backgroundElement" style={styles.addCard}>
            <View style={styles.amountRow}>
              <TextInput
                style={[
                  styles.amountInput,
                  { color: theme.text, borderColor: theme.backgroundSelected },
                ]}
                placeholder="0.00"
                placeholderTextColor={theme.textSecondary}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                accessibilityLabel={t('recurring.amountA11y')}
              />
              <View style={styles.dayField}>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('recurring.dayLabel')}
                </ThemedText>
                <TextInput
                  style={[styles.dayInput, { color: theme.text, borderColor: theme.backgroundSelected }]}
                  value={day}
                  onChangeText={setDay}
                  keyboardType="number-pad"
                  maxLength={2}
                  accessibilityLabel={t('recurring.dayA11y')}
                />
              </View>
            </View>

            <TextInput
              style={[
                styles.input,
                { color: theme.text, backgroundColor: theme.background, borderColor: theme.backgroundSelected },
              ]}
              placeholder={t('recurring.descPlaceholder')}
              placeholderTextColor={theme.textSecondary}
              value={description}
              onChangeText={setDescription}
              returnKeyType="done"
              onSubmitEditing={handleAdd}
            />

            {categories.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.chipRow}>
                <Chip
                  label={t('budget.none')}
                  active={categoryId === null}
                  onPress={() => setCategoryId(null)}
                />
                {categories.map((c) => (
                  <Chip
                    key={c.id}
                    label={c.name}
                    color={c.color}
                    icon={c.icon}
                    active={categoryId === c.id}
                    onPress={() => setCategoryId(c.id)}
                  />
                ))}
              </ScrollView>
            )}

            <View style={styles.formRow}>
              <ScopeToggle scope={scope} onChange={setScope} />
              <Pressable
                onPress={handleAdd}
                disabled={parsedAmount == null || parsedAmount <= 0 || saving}
                accessibilityRole="button"
                accessibilityLabel={t('recurring.addRule')}
                style={({ pressed }) => [
                  styles.addButton,
                  { opacity: pressed || parsedAmount == null || parsedAmount <= 0 || saving ? 0.6 : 1 },
                ]}>
                {saving ? (
                  <ActivityIndicator color={Accent.onPrimary} />
                ) : (
                  <ThemedText style={styles.addButtonText}>{t('recurring.add')}</ThemedText>
                )}
              </Pressable>
            </View>

            {formError && (
              <ThemedText type="small" style={styles.errorText}>
                {formError}
              </ThemedText>
            )}
          </ThemedView>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator testID="recurring-loading" />
            </View>
          ) : error ? (
            <View style={styles.center}>
              <ThemedText type="small" style={styles.errorText}>
                {error}
              </ThemedText>
            </View>
          ) : rules.length === 0 ? (
            <EmptyState emoji="🔁" title={t('recurring.emptyTitle')} hint={t('recurring.emptyHint')} />
          ) : (
            <FlatList
              data={rules}
              keyExtractor={(r) => r.id}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => {
                const cat = item.category_id ? categoryById.get(item.category_id) : undefined;
                return (
                  <RuleRow
                    rule={item}
                    categoryName={cat?.name ?? null}
                    categoryColor={cat?.color ?? null}
                    categoryIcon={cat?.icon ?? null}
                    onRemove={() => removeRule(item)}
                  />
                );
              }}
            />
          )}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

function RuleRow({
  rule,
  categoryName,
  categoryColor,
  categoryIcon,
  onRemove,
}: {
  rule: RecurringRule;
  categoryName: string | null;
  categoryColor: string | null;
  categoryIcon: string | null;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const { format } = useCurrency();
  const title = rule.description?.trim() || categoryName || t('recurring.defaultName');
  return (
    <ThemedView type="backgroundElement" style={styles.rowCard}>
      <View style={styles.iconBadge}>
        {categoryIcon ? (
          <ThemedText style={styles.rowIcon}>{categoryIcon}</ThemedText>
        ) : (
          <View style={[styles.dot, { backgroundColor: categoryColor ?? '#60646c' }]} />
        )}
      </View>
      <View style={styles.rowMain}>
        <ThemedText style={styles.rowName} numberOfLines={1}>
          {title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {t('recurring.onDay', { day: rule.day_of_month })} ·{' '}
          {rule.scope === 'shared' ? t('scope.ours') : t('scope.mine')}
        </ThemedText>
      </View>
      <ThemedText style={styles.rowAmount}>{format(rule.amount)}</ThemedText>
      <Pressable
        onPress={onRemove}
        accessibilityRole="button"
        accessibilityLabel={t('recurring.removeRule', { name: title })}
        hitSlop={8}
        style={({ pressed }) => [styles.remove, pressed && styles.pressed]}>
        <ThemedText type="small" themeColor="textSecondary">
          ✕
        </ThemedText>
      </Pressable>
    </ThemedView>
  );
}

function Chip({
  label,
  color,
  icon,
  active,
  onPress,
}: {
  label: string;
  color?: string | null;
  icon?: string | null;
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Category: ${label}`}
      accessibilityState={{ selected: active }}
      style={[
        styles.chip,
        { backgroundColor: theme.background, borderColor: theme.backgroundSelected },
        active && { borderColor: Accent.primary, backgroundColor: theme.tint },
      ]}>
      {icon ? (
        <ThemedText style={styles.chipIcon}>{icon}</ThemedText>
      ) : color ? (
        <View style={[styles.chipDot, { backgroundColor: color }]} />
      ) : null}
      <ThemedText type="small" themeColor={active ? 'text' : 'textSecondary'}>
        {label}
      </ThemedText>
    </Pressable>
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  close: { color: Accent.primary, fontWeight: '600', fontSize: 16 },
  pressed: { opacity: 0.6 },
  explainer: { marginBottom: Spacing.three },
  addCard: {
    borderRadius: Radius.lg,
    padding: Spacing.three,
    gap: Spacing.three,
    marginBottom: Spacing.three,
    ...Shadow.card,
  },
  amountRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.three },
  amountInput: {
    flex: 1,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.two,
    fontSize: 28,
    fontWeight: '700',
  },
  dayField: { alignItems: 'center', gap: Spacing.one },
  dayInput: {
    width: 56,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    fontSize: 16,
    textAlign: 'center',
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
  chipRow: { gap: Spacing.two, paddingVertical: Spacing.one },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  chipIcon: { fontSize: 15 },
  chipDot: { width: 10, height: 10, borderRadius: 5 },
  formRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  addButton: {
    backgroundColor: Accent.primary,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: { color: Accent.onPrimary, fontWeight: '600', fontSize: 16 },
  errorText: { color: Accent.danger },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { gap: Spacing.two, paddingVertical: Spacing.one },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    gap: Spacing.three,
    ...Shadow.card,
  },
  iconBadge: { width: 32, alignItems: 'center', justifyContent: 'center' },
  rowIcon: { fontSize: 22 },
  dot: { width: 16, height: 16, borderRadius: 8 },
  rowMain: { flex: 1, gap: Spacing.half },
  rowName: { fontSize: 16 },
  rowAmount: { fontSize: 16, fontWeight: '700', fontVariant: ['tabular-nums'] },
  remove: { paddingHorizontal: Spacing.one, paddingVertical: Spacing.one },
});
