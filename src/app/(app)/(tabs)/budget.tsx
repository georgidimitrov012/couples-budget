import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { ProgressBar } from '@/components/progress-bar';
import { ScopeToggle } from '@/components/scope-toggle';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Accent, BottomTabInset, MaxContentWidth, Radius, Shadow, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { monthlySpendByCategory, progressRatio } from '../../../../lib/budget';
import { formatAmount, parseAmount } from '../../../../lib/format';
import { useAuth } from '../../../../hooks/useAuth';
import { useCategories, type Category } from '../../../../hooks/useCategories';
import { useHousehold } from '../../../../hooks/useHousehold';
import { useSettleUp } from '../../../../hooks/useSettleUp';
import {
  useTransactions,
  type Transaction,
  type TransactionScope,
} from '../../../../hooks/useTransactions';

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export default function BudgetScreen() {
  const theme = useTheme();
  const { items, loading, error, addTransaction, removeTransaction, retry } = useTransactions();
  const { categories } = useCategories();
  const { user } = useAuth();
  const { members } = useHousehold();
  const settle = useSettleUp(items);
  const partner = members.find((m) => m.user_id !== user?.id) ?? null;
  const myName =
    (user?.user_metadata?.display_name as string | undefined) ?? user?.email ?? 'You';

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [scope, setScope] = useState<TransactionScope>('shared');
  const [categoryId, setCategoryId] = useState<string | null>(null);

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );
  const parsedAmount = parseAmount(amount);
  const canAdd = parsedAmount != null;

  const monthKey = currentMonthKey();
  const thisMonth = items.filter((t) => t.occurred_on.startsWith(monthKey));
  // Every private row RLS returns is the caller's own, so "Mine" = private here.
  const oursTotal = thisMonth
    .filter((t) => t.scope === 'shared')
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const mineTotal = thisMonth
    .filter((t) => t.scope === 'private')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const spendByCategory = useMemo(() => monthlySpendByCategory(items, monthKey), [items, monthKey]);
  const budgets = useMemo(
    () => categories.filter((c) => c.monthly_limit != null && c.monthly_limit > 0),
    [categories]
  );

  async function handleAdd() {
    if (parsedAmount == null) return;
    const selectedCategoryId = categoryId;
    setAmount('');
    setDescription('');
    setCategoryId(null);
    await addTransaction({
      amount: parsedAmount,
      description,
      scope,
      categoryId: selectedCategoryId ?? undefined,
    });
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.inner}>
          <View style={styles.headerRow}>
            <ThemedText type="subtitle">Budget</ThemedText>
            <Link href="/categories" asChild>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Manage categories"
                hitSlop={8}
                style={({ pressed }) => pressed && styles.pressed}>
                <ThemedText type="smallBold" style={styles.link}>
                  Categories
                </ThemedText>
              </Pressable>
            </Link>
          </View>

          <View style={styles.summaryRow}>
            <SummaryCard label="Ours" sublabel="this month" value={oursTotal} tone="ours" />
            <SummaryCard label="Mine" sublabel="this month" value={mineTotal} tone="mine" />
          </View>

          {partner && (
            <SettleCard
              partnerName={partner.display_name ?? 'Your partner'}
              myName={myName}
              balance={settle.balance}
              lastSettledOn={settle.lastSettledOn}
              settling={settle.settling}
              error={settle.error}
              onSettle={settle.settleUp}
            />
          )}

          {budgets.length > 0 && (
            <CategoryBudgets budgets={budgets} spendByCategory={spendByCategory} />
          )}

          <ThemedView type="backgroundElement" style={styles.addCard}>
            <View style={styles.amountRow}>
              <TextInput
                style={[styles.amountInput, { color: theme.text, borderColor: theme.backgroundSelected }]}
                placeholder="0.00"
                placeholderTextColor={theme.textSecondary}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                returnKeyType="done"
              />
              <ScopeToggle scope={scope} onChange={setScope} />
            </View>
            <TextInput
              style={[
                styles.descInput,
                { color: theme.text, backgroundColor: theme.background, borderColor: theme.backgroundSelected },
              ]}
              placeholder="What was it for? (optional)"
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
                contentContainerStyle={styles.chipRow}>
                <CategoryChip
                  label="None"
                  active={categoryId === null}
                  onPress={() => setCategoryId(null)}
                />
                {categories.map((c) => (
                  <CategoryChip
                    key={c.id}
                    label={c.name}
                    color={c.color}
                    active={categoryId === c.id}
                    onPress={() => setCategoryId(c.id)}
                  />
                ))}
              </ScrollView>
            )}

            <Pressable
              onPress={handleAdd}
              disabled={!canAdd}
              accessibilityRole="button"
              accessibilityLabel="Add expense"
              style={({ pressed }) => [styles.addButton, { opacity: pressed || !canAdd ? 0.6 : 1 }]}>
              <ThemedText style={styles.addButtonText}>Add expense</ThemedText>
            </Pressable>
          </ThemedView>

          {error && (
            <Pressable
              onPress={retry}
              accessibilityRole="button"
              accessibilityLabel="Retry"
              style={({ pressed }) => pressed && styles.pressed}>
              <ThemedView type="backgroundElement" style={styles.banner}>
                <ThemedText type="small" style={styles.bannerText}>
                  {error} — tap to retry
                </ThemedText>
              </ThemedView>
            </Pressable>
          )}

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator testID="budget-loading" />
            </View>
          ) : items.length === 0 ? (
            <View style={styles.center}>
              <ThemedText themeColor="textSecondary" style={styles.centerText}>
                No expenses yet.{'\n'}Add your first one above.
              </ThemedText>
            </View>
          ) : (
            <FlatList
              data={items}
              keyExtractor={(t) => t.id}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => (
                <TransactionRow
                  item={item}
                  category={item.category_id ? categoryById.get(item.category_id) : undefined}
                  onRemove={() => removeTransaction(item)}
                />
              )}
            />
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

function SettleCard({
  partnerName,
  myName,
  balance,
  lastSettledOn,
  settling,
  error,
  onSettle,
}: {
  partnerName: string;
  myName: string;
  balance: number;
  lastSettledOn: string | null;
  settling: boolean;
  error: string | null;
  onSettle: () => void;
}) {
  const square = Math.round(balance * 100) === 0;
  const owed = formatAmount(Math.abs(balance));
  return (
    <ThemedView type="backgroundElement" style={[styles.settleCard, Shadow.card]}>
      <View style={styles.settleAvatars}>
        <Avatar name={partnerName} color={Accent.mine} size={34} ring />
        <View style={styles.avatarOverlap}>
          <Avatar name={myName} color={Accent.ours} size={34} ring />
        </View>
      </View>
      <View style={styles.settleMain}>
        <ThemedText testID="settle-balance">
          {square
            ? "You're all square"
            : balance > 0
              ? `${partnerName} owes you ${owed}`
              : `You owe ${partnerName} ${owed}`}
        </ThemedText>
        {square && lastSettledOn ? (
          <ThemedText type="small" themeColor="textSecondary">
            Last settled {lastSettledOn}
          </ThemedText>
        ) : null}
        {error ? (
          <ThemedText type="small" style={styles.bannerText}>
            {error}
          </ThemedText>
        ) : null}
      </View>
      {!square && (
        <Pressable
          onPress={onSettle}
          disabled={settling}
          accessibilityRole="button"
          accessibilityLabel="Mark as settled"
          style={({ pressed }) => [
            styles.settleButton,
            { opacity: pressed || settling ? 0.6 : 1 },
          ]}>
          {settling ? (
            <ActivityIndicator color={Accent.onScope} />
          ) : (
            <ThemedText type="smallBold" style={styles.settleButtonText}>
              Settle
            </ThemedText>
          )}
        </Pressable>
      )}
    </ThemedView>
  );
}

function CategoryBudgets({
  budgets,
  spendByCategory,
}: {
  budgets: Category[];
  spendByCategory: Map<string, number>;
}) {
  return (
    <ThemedView type="backgroundElement" style={styles.budgetsCard} testID="category-budgets">
      <ThemedText type="smallBold" themeColor="textSecondary">
        CATEGORY BUDGETS · THIS MONTH
      </ThemedText>
      {budgets.map((c) => {
        const spent = spendByCategory.get(c.id) ?? 0;
        const limit = c.monthly_limit ?? 0;
        const ratio = progressRatio(spent, limit);
        const over = ratio > 1;
        return (
          <View key={c.id} style={styles.budgetRow} testID={`budget-${c.id}`}>
            <View style={styles.budgetHead}>
              <View style={[styles.chipDot, { backgroundColor: c.color ?? '#60646c' }]} />
              <ThemedText type="small">{c.name}</ThemedText>
              <ThemedText
                type="small"
                themeColor="textSecondary"
                style={[styles.budgetAmount, over && styles.overText]}
                testID={`budget-amount-${c.id}`}>
                {formatAmount(spent)} / {formatAmount(limit)}
              </ThemedText>
            </View>
            <ProgressBar ratio={ratio} color={over ? Accent.danger : c.color ?? Accent.primary} />
          </View>
        );
      })}
    </ThemedView>
  );
}

function SummaryCard({
  label,
  sublabel,
  value,
  tone,
}: {
  label: string;
  sublabel: string;
  value: number;
  tone: 'ours' | 'mine';
}) {
  return (
    <View style={[styles.summaryCard, { backgroundColor: Accent[tone] }, Shadow.card]}>
      <ThemedText type="smallBold" style={styles.summaryLabel}>
        {label.toUpperCase()}
      </ThemedText>
      <ThemedText
        type="subtitle"
        testID={`summary-${label.toLowerCase()}`}
        style={styles.summaryValue}>
        {formatAmount(value)}
      </ThemedText>
      <ThemedText type="small" style={styles.summarySub}>
        {sublabel}
      </ThemedText>
    </View>
  );
}

function CategoryChip({
  label,
  color,
  active,
  onPress,
}: {
  label: string;
  color?: string | null;
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
        active && { borderColor: Accent.primary },
      ]}>
      {color ? <View style={[styles.chipDot, { backgroundColor: color }]} /> : null}
      <ThemedText type="small" themeColor={active ? 'text' : 'textSecondary'}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function TransactionRow({
  item,
  category,
  onRemove,
}: {
  item: Transaction;
  category?: Category;
  onRemove: () => void;
}) {
  return (
    <ThemedView type="backgroundElement" style={styles.row}>
      <View style={styles.rowMain}>
        <ThemedText numberOfLines={1} style={styles.rowDesc}>
          {item.description || 'Expense'}
        </ThemedText>
        <View style={styles.rowMeta}>
          <ThemedText type="small" themeColor="textSecondary">
            {item.occurred_on}
          </ThemedText>
          <View
            style={[
              styles.scopeChip,
              { backgroundColor: item.scope === 'shared' ? Accent.ours : Accent.mine },
            ]}>
            <ThemedText type="small" style={styles.scopeChipText}>
              {item.scope === 'shared' ? 'Ours' : 'Mine'}
            </ThemedText>
          </View>
          {category ? (
            <View style={styles.rowCategory}>
              <View style={[styles.chipDot, { backgroundColor: category.color ?? '#60646c' }]} />
              <ThemedText type="small" themeColor="textSecondary">
                {category.name}
              </ThemedText>
            </View>
          ) : null}
        </View>
      </View>
      <ThemedText style={styles.rowAmount}>{formatAmount(Number(item.amount))}</ThemedText>
      <Pressable
        onPress={onRemove}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${item.description || 'expense'}`}
        hitSlop={8}
        style={({ pressed }) => [styles.remove, pressed && styles.pressed]}>
        <ThemedText type="small" themeColor="textSecondary">
          ✕
        </ThemedText>
      </Pressable>
    </ThemedView>
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
    paddingBottom: BottomTabInset + Spacing.three,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
  },
  link: { color: Accent.primary },
  summaryRow: { flexDirection: 'row', gap: Spacing.three, marginBottom: Spacing.three },
  settleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    marginBottom: Spacing.three,
  },
  settleAvatars: { flexDirection: 'row' },
  avatarOverlap: { marginLeft: -12 },
  settleMain: { flex: 1, gap: Spacing.half },
  settleButton: {
    backgroundColor: Accent.primary,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settleButtonText: { color: Accent.onScope },
  budgetsCard: {
    borderRadius: Radius.lg,
    padding: Spacing.three,
    gap: Spacing.two,
    marginBottom: Spacing.three,
    ...Shadow.card,
  },
  budgetRow: { gap: Spacing.one },
  budgetHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  budgetAmount: { marginLeft: 'auto' },
  overText: { color: Accent.danger },
  summaryCard: {
    flex: 1,
    borderRadius: Radius.lg,
    padding: Spacing.three,
    gap: Spacing.half,
  },
  summaryLabel: { color: 'rgba(255,255,255,0.85)' },
  summaryValue: { color: '#ffffff' },
  summarySub: { color: 'rgba(255,255,255,0.8)' },
  addCard: {
    borderRadius: Radius.lg,
    padding: Spacing.three,
    gap: Spacing.two,
    marginBottom: Spacing.three,
    ...Shadow.card,
  },
  amountRow: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center' },
  amountInput: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 24,
    fontWeight: '700',
  },
  descInput: {
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
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.four,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipDot: { width: 10, height: 10, borderRadius: 5 },
  addButton: {
    backgroundColor: Accent.primary,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: { color: Accent.onPrimary, fontWeight: '600', fontSize: 16 },
  banner: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    marginBottom: Spacing.two,
  },
  bannerText: { color: Accent.danger },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerText: { textAlign: 'center' },
  listContent: { gap: Spacing.two, paddingVertical: Spacing.one },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    gap: Spacing.three,
    ...Shadow.card,
  },
  rowMain: { flex: 1, gap: Spacing.half },
  rowDesc: { fontSize: 16 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexWrap: 'wrap' },
  scopeChip: { paddingHorizontal: Spacing.two, paddingVertical: 1, borderRadius: Radius.pill },
  scopeChipText: { color: '#ffffff', fontSize: 11, fontWeight: '700' },
  rowCategory: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  rowAmount: { fontSize: 18, fontWeight: '700' },
  remove: { paddingHorizontal: Spacing.one, paddingVertical: Spacing.one },
  pressed: { opacity: 0.6 },
});
