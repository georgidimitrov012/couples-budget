import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { categorize } from '../../../../lib/groceries';
import { useAuth } from '../../../../hooks/useAuth';
import { useCategories, type Category } from '../../../../hooks/useCategories';
import { useHousehold } from '../../../../hooks/useHousehold';
import { useListItems, type ListItem } from '../../../../hooks/useListItems';
import { useSettleUp } from '../../../../hooks/useSettleUp';
import { useShoppingList } from '../../../../hooks/useShoppingList';
import { useTranslation } from '../../../../hooks/useTranslation';
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
  const { t } = useTranslation();
  const { items, loading, error, addTransaction, removeTransaction, retry } = useTransactions();
  const { categories } = useCategories();
  const { user } = useAuth();
  const { members } = useHousehold();
  const { listId } = useShoppingList();
  const { items: listItems, addItem: addListItem, completeItem } = useListItems(listId);
  const settle = useSettleUp(items);
  const partner = members.find((m) => m.user_id !== user?.id) ?? null;
  const myName =
    (user?.user_metadata?.display_name as string | undefined) ?? user?.email ?? 'You';

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [scope, setScope] = useState<TransactionScope>('shared');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  // Optional wiring to the shopping list (see the "List↔Budget model" in AGENTS): an
  // expense can complete a listed item (quantity-aware) or log an off-list buy onto it.
  const [linkedItemId, setLinkedItemId] = useState<string | null>(null);
  const [boughtQty, setBoughtQty] = useState(1);
  const [addToList, setAddToList] = useState(false);

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );
  const parsedAmount = parseAmount(amount);
  const canAdd = parsedAmount != null;

  const activeItems = useMemo(() => listItems.filter((i) => !i.is_checked), [listItems]);
  const linkedItem = activeItems.find((i) => i.id === linkedItemId) ?? null;
  const trimmedDesc = description.trim();
  const activeNames = useMemo(
    () => new Set(activeItems.map((i) => i.name.toLowerCase())),
    [activeItems]
  );
  // Offer "also add to the list" only for a fresh off-list name (not one already listed).
  const showAddToList =
    !linkedItemId && trimmedDesc.length > 0 && !activeNames.has(trimmedDesc.toLowerCase());

  function selectListItem(item: ListItem | null) {
    if (!item) {
      setLinkedItemId(null);
      return;
    }
    setLinkedItemId(item.id);
    setBoughtQty(item.quantity);
    setAddToList(false);
    if (!description.trim()) setDescription(item.name);
  }

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
    const linked = linkedItem;
    const finalDesc = trimmedDesc || linked?.name || '';
    const bought = boughtQty;
    const alsoAdd = showAddToList && addToList;

    setAmount('');
    setDescription('');
    setCategoryId(null);
    setLinkedItemId(null);
    setBoughtQty(1);
    setAddToList(false);

    await addTransaction({
      amount: parsedAmount,
      description: finalDesc,
      scope,
      categoryId: selectedCategoryId ?? undefined,
    });

    // Reflect the spend on the shopping list: complete a listed item (quantity-aware),
    // or drop an off-list purchase onto the list as already-bought.
    if (linked) {
      await completeItem(linked, bought);
    } else if (alsoAdd && finalDesc) {
      await addListItem(finalDesc, { checked: true, category: categorize(finalDesc) });
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.inner}>
          <View style={styles.headerRow}>
            <ThemedText type="subtitle">{t('budget.title')}</ThemedText>
            <Link href="/categories" asChild>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('budget.manageCategories')}
                hitSlop={8}
                style={({ pressed }) => pressed && styles.pressed}>
                <ThemedText type="smallBold" style={styles.link}>
                  {t('budget.categories')}
                </ThemedText>
              </Pressable>
            </Link>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <View style={styles.summaryRow}>
              <SummaryCard
                label={t('scope.ours')}
                sublabel={t('budget.thisMonth')}
                value={oursTotal}
                tone="ours"
              />
              <SummaryCard
                label={t('scope.mine')}
                sublabel={t('budget.thisMonth')}
                value={mineTotal}
                tone="mine"
              />
            </View>

            {partner && (
              <SettleCard
                partnerName={partner.display_name ?? t('settle.yourPartner')}
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
                placeholder={t('budget.descPlaceholder')}
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
                  <CategoryChip
                    label={t('budget.none')}
                    active={categoryId === null}
                    onPress={() => setCategoryId(null)}
                  />
                  {categories.map((c) => (
                    <CategoryChip
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

              <ListLink
                activeItems={activeItems}
                linkedItem={linkedItem}
                onSelect={selectListItem}
                boughtQty={boughtQty}
                onBoughtQty={setBoughtQty}
                showAddToList={showAddToList}
                addToList={addToList}
                onToggleAddToList={() => setAddToList((v) => !v)}
                descLabel={trimmedDesc}
              />

              <Pressable
                onPress={handleAdd}
                disabled={!canAdd}
                accessibilityRole="button"
                accessibilityLabel={t('budget.addExpense')}
                style={({ pressed }) => [styles.addButton, { opacity: pressed || !canAdd ? 0.6 : 1 }]}>
                <ThemedText style={styles.addButtonText}>{t('budget.addExpense')}</ThemedText>
              </Pressable>
            </ThemedView>

            {error && (
              <Pressable
                onPress={retry}
                accessibilityRole="button"
                accessibilityLabel={t('common.retry')}
                style={({ pressed }) => pressed && styles.pressed}>
                <ThemedView type="backgroundElement" style={styles.banner}>
                  <ThemedText type="small" style={styles.bannerText}>
                    {t('error.tapRetry', { error })}
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
                  {t('budget.empty')}
                </ThemedText>
              </View>
            ) : (
              <View style={styles.listContent}>
                {items.map((item) => (
                  <TransactionRow
                    key={item.id}
                    item={item}
                    category={item.category_id ? categoryById.get(item.category_id) : undefined}
                    onRemove={() => removeTransaction(item)}
                  />
                ))}
              </View>
            )}
          </ScrollView>
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
  const { t } = useTranslation();
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
        <ThemedText testID="settle-balance" style={styles.settleText}>
          {square
            ? t('settle.allSquare')
            : balance > 0
              ? t('settle.owesYou', { name: partnerName, amount: owed })
              : t('settle.youOwe', { name: partnerName, amount: owed })}
        </ThemedText>
        {square && lastSettledOn ? (
          <ThemedText type="small" themeColor="textSecondary">
            {t('settle.lastSettled', { date: lastSettledOn })}
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
          accessibilityLabel={t('settle.markSettled')}
          style={({ pressed }) => [
            styles.settleButton,
            { opacity: pressed || settling ? 0.6 : 1 },
          ]}>
          {settling ? (
            <ActivityIndicator color={Accent.onScope} />
          ) : (
            <ThemedText type="smallBold" style={styles.settleButtonText}>
              {t('settle.settle')}
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
  const { t } = useTranslation();
  return (
    <ThemedView type="backgroundElement" style={styles.budgetsCard} testID="category-budgets">
      <ThemedText type="smallBold" themeColor="textSecondary">
        {t('budget.categoryBudgets')}
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
  icon,
  active,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  color?: string | null;
  icon?: string | null;
  active: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `Category: ${label}`}
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

// The optional bridge to the shopping list inside the add-expense card: pick a
// listed item to complete (with a "bought N of Y" stepper), or tick a fresh
// off-list name to drop it onto the list as already-bought.
function ListLink({
  activeItems,
  linkedItem,
  onSelect,
  boughtQty,
  onBoughtQty,
  showAddToList,
  addToList,
  onToggleAddToList,
  descLabel,
}: {
  activeItems: ListItem[];
  linkedItem: ListItem | null;
  onSelect: (item: ListItem | null) => void;
  boughtQty: number;
  onBoughtQty: (n: number) => void;
  showAddToList: boolean;
  addToList: boolean;
  onToggleAddToList: () => void;
  descLabel: string;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  if (activeItems.length === 0 && !showAddToList) return null;

  return (
    <View style={styles.linkSection}>
      {activeItems.length > 0 && (
        <>
          <ThemedText type="smallBold" themeColor="textSecondary">
            {t('budget.forListItem')}
          </ThemedText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.chipRow}>
            <CategoryChip
              label={t('budget.none')}
              accessibilityLabel={t('budget.noListItem')}
              active={linkedItem === null}
              onPress={() => onSelect(null)}
            />
            {activeItems.map((it) => (
              <CategoryChip
                key={it.id}
                label={it.quantity > 1 ? `${it.name} ×${it.quantity}` : it.name}
                accessibilityLabel={t('budget.listItem', { name: it.name })}
                active={linkedItem?.id === it.id}
                onPress={() => onSelect(it)}
              />
            ))}
          </ScrollView>
        </>
      )}

      {linkedItem && (
        <View style={styles.boughtRow}>
          <ThemedText type="small" themeColor="textSecondary">
            {t('budget.bought')}
          </ThemedText>
          <View style={styles.stepper}>
            <Pressable
              onPress={() => onBoughtQty(Math.max(1, boughtQty - 1))}
              disabled={boughtQty <= 1}
              accessibilityRole="button"
              accessibilityLabel={t('budget.decreaseBought')}
              hitSlop={6}
              style={({ pressed }) => [
                styles.stepBtn,
                { backgroundColor: theme.tint, opacity: boughtQty <= 1 ? 0.35 : pressed ? 0.6 : 1 },
              ]}>
              <ThemedText style={styles.stepBtnText}>−</ThemedText>
            </Pressable>
            <ThemedText style={styles.stepValue} testID="bought-qty">
              {boughtQty}
            </ThemedText>
            <Pressable
              onPress={() => onBoughtQty(Math.min(linkedItem.quantity, boughtQty + 1))}
              disabled={boughtQty >= linkedItem.quantity}
              accessibilityRole="button"
              accessibilityLabel={t('budget.increaseBought')}
              hitSlop={6}
              style={({ pressed }) => [
                styles.stepBtn,
                { backgroundColor: theme.tint, opacity: boughtQty >= linkedItem.quantity ? 0.35 : pressed ? 0.6 : 1 },
              ]}>
              <ThemedText style={styles.stepBtnText}>＋</ThemedText>
            </Pressable>
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {t('budget.of', { qty: linkedItem.quantity })}
          </ThemedText>
        </View>
      )}

      {showAddToList && (
        <Pressable
          onPress={onToggleAddToList}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: addToList }}
          accessibilityLabel={t('budget.addToListA11y')}
          style={({ pressed }) => [styles.addToListRow, pressed && styles.pressed]}>
          <View
            style={[
              styles.checkboxSm,
              { borderColor: theme.textSecondary },
              addToList && styles.checkboxSmChecked,
            ]}>
            {addToList && <ThemedText style={styles.checkmarkSm}>✓</ThemedText>}
          </View>
          <ThemedText type="small" numberOfLines={1} style={styles.flexShrink}>
            {t('budget.addToList', { name: descLabel })}
          </ThemedText>
        </Pressable>
      )}
    </View>
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
  const { t } = useTranslation();
  const desc = item.description || t('budget.expense');
  return (
    <ThemedView type="backgroundElement" style={styles.row}>
      <View style={styles.rowMain}>
        <ThemedText numberOfLines={1} style={styles.rowDesc}>
          {desc}
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
              {item.scope === 'shared' ? t('scope.ours') : t('scope.mine')}
            </ThemedText>
          </View>
          {category ? (
            <View style={styles.rowCategory}>
              {category.icon ? (
                <ThemedText type="small">{category.icon}</ThemedText>
              ) : (
                <View style={[styles.chipDot, { backgroundColor: category.color ?? '#60646c' }]} />
              )}
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
        accessibilityLabel={t('budget.removeExpense', { name: desc })}
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
  settleText: { fontVariant: ['tabular-nums'] },
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
  budgetAmount: { marginLeft: 'auto', fontVariant: ['tabular-nums'] },
  overText: { color: Accent.danger },
  summaryCard: {
    flex: 1,
    borderRadius: Radius.lg,
    padding: Spacing.three,
    gap: Spacing.half,
  },
  summaryLabel: { color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: '800', letterSpacing: 0.7 },
  summaryValue: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },
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
    fontWeight: '800',
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
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
  chipIcon: { fontSize: 15 },
  linkSection: { gap: Spacing.one },
  boughtRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.one },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  stepBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { fontSize: 20, fontWeight: '700', lineHeight: 22, color: Accent.primary },
  stepValue: {
    fontSize: 16,
    fontWeight: '700',
    minWidth: 18,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  addToListRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.one },
  checkboxSm: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSmChecked: { backgroundColor: Accent.primary, borderColor: Accent.primary },
  checkmarkSm: { color: Accent.onPrimary, fontSize: 12, fontWeight: '700', lineHeight: 14 },
  flexShrink: { flexShrink: 1 },
  scrollContent: { paddingBottom: Spacing.four },
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
  rowAmount: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3, fontVariant: ['tabular-nums'] },
  remove: { paddingHorizontal: Spacing.one, paddingVertical: Spacing.one },
  pressed: { opacity: 0.6 },
});
