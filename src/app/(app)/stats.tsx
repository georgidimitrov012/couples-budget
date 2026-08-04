import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/empty-state';
import { ProgressBar } from '@/components/progress-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Accent, MaxContentWidth, Radius, Shadow, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { transactionsToCsv } from '../../../lib/csv';
import { shareCsv } from '../../../lib/export-csv';
import { monthLong, monthShort } from '../../../lib/month';
import {
  biggestExpense,
  categoryBreakdown,
  deltaFraction,
  monthKeyOf,
  monthlyTotalsSeries,
  monthTotal,
  monthTotals,
  nextMonthKey,
  previousMonthKey,
  type MonthPoint,
} from '../../../lib/stats';
import { useCategories } from '../../../hooks/useCategories';
import { useCurrency } from '../../../hooks/useCurrency';
import { useListItems } from '../../../hooks/useListItems';
import { useShoppingList } from '../../../hooks/useShoppingList';
import { useTransactions } from '../../../hooks/useTransactions';
import { useTranslation } from '../../../hooks/useTranslation';

const TREND_MONTHS = 6;

export default function StatsScreen() {
  const router = useRouter();
  const { t, lang } = useTranslation();
  const { format } = useCurrency();
  const { items, loading } = useTransactions();
  const { categories } = useCategories();
  const { listId } = useShoppingList();
  const { items: listItems } = useListItems(listId);

  const currentMonth = monthKeyOf(new Date());
  const [monthKey, setMonthKey] = useState(currentMonth);
  const [exporting, setExporting] = useState(false);

  const totals = useMemo(() => monthTotals(items, monthKey), [items, monthKey]);
  const prevTotal = useMemo(() => monthTotal(items, previousMonthKey(monthKey)), [items, monthKey]);
  const breakdown = useMemo(() => categoryBreakdown(items, monthKey), [items, monthKey]);
  const biggest = useMemo(() => biggestExpense(items, monthKey), [items, monthKey]);
  const series = useMemo(() => monthlyTotalsSeries(items, monthKey, TREND_MONTHS), [items, monthKey]);
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const delta = deltaFraction(totals.total, prevTotal);
  const avg = totals.count > 0 ? totals.total / totals.count : 0;
  const boughtCount = listItems.filter((i) => i.is_checked).length;
  const toBuyCount = listItems.filter((i) => !i.is_checked).length;
  const hasAnyData = items.length > 0;
  const hasMonthData = totals.count > 0;
  const isCurrentMonth = monthKey === currentMonth;

  const deltaLabel =
    delta == null
      ? t('stats.noBaseline')
      : Math.abs(delta) < 0.005
        ? t('stats.deltaFlat')
        : delta > 0
          ? t('stats.deltaUp', { pct: Math.round(delta * 100) })
          : t('stats.deltaDown', { pct: Math.round(Math.abs(delta) * 100) });

  // Export every transaction the user can see (all months) to a CSV and open the
  // share sheet. Ordered oldest-first so the file reads like a ledger.
  async function handleExport() {
    if (exporting || items.length === 0) return;
    setExporting(true);
    const rows = [...items]
      .sort((a, b) => a.occurred_on.localeCompare(b.occurred_on))
      .map((tx) => ({
        occurred_on: tx.occurred_on,
        description: tx.description,
        categoryName: tx.category_id ? categoryById.get(tx.category_id)?.name ?? null : null,
        scope: tx.scope,
        amount: Number(tx.amount),
      }));
    const csv = transactionsToCsv(rows, {
      date: t('csv.date'),
      description: t('csv.description'),
      category: t('csv.category'),
      scope: t('csv.scope'),
      amount: t('csv.amount'),
    });
    const filename = `couples-budget-${new Date().toISOString().slice(0, 10)}.csv`;
    await shareCsv(filename, csv, t('stats.exportTitle'));
    setExporting(false);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.inner}>
          <View style={styles.header}>
            <ThemedText type="subtitle">{t('stats.title')}</ThemedText>
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              hitSlop={8}
              style={({ pressed }) => pressed && styles.pressed}>
              <ThemedText style={styles.close}>{t('common.done')}</ThemedText>
            </Pressable>
          </View>

          {loading && !hasAnyData ? (
            <View style={styles.center}>
              <ActivityIndicator testID="stats-loading" />
            </View>
          ) : !hasAnyData ? (
            <EmptyState emoji="📊" title={t('stats.emptyTitle')} hint={t('stats.emptyHint')} />
          ) : (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}>
              <View style={styles.switcher}>
                <Pressable
                  onPress={() => setMonthKey(previousMonthKey(monthKey))}
                  accessibilityRole="button"
                  accessibilityLabel={t('stats.prevMonth')}
                  hitSlop={8}
                  style={({ pressed }) => pressed && styles.pressed}>
                  <ThemedText style={styles.switchArrow}>‹</ThemedText>
                </Pressable>
                <ThemedText style={styles.switchLabel}>{monthLong(monthKey, lang)}</ThemedText>
                <Pressable
                  onPress={() => setMonthKey(nextMonthKey(monthKey))}
                  disabled={isCurrentMonth}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isCurrentMonth }}
                  accessibilityLabel={t('stats.nextMonth')}
                  hitSlop={8}
                  style={({ pressed }) => pressed && styles.pressed}>
                  <ThemedText style={[styles.switchArrow, isCurrentMonth && styles.switchArrowOff]}>
                    ›
                  </ThemedText>
                </Pressable>
              </View>

              {hasMonthData ? (
                <ThemedView type="backgroundElement" style={[styles.hero, Shadow.card]}>
                  <ThemedText type="smallBold" themeColor="textSecondary" style={styles.heroLabel}>
                    {t('stats.spent')}
                  </ThemedText>
                  <ThemedText style={styles.heroValue}>{format(totals.total)}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {deltaLabel}
                  </ThemedText>
                </ThemedView>
              ) : (
                <ThemedView type="backgroundElement" style={[styles.hero, Shadow.card]}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('stats.noMonthData')}
                  </ThemedText>
                </ThemedView>
              )}

              <ThemedView type="backgroundElement" style={styles.card}>
                <ThemedText type="smallBold" themeColor="textSecondary" style={styles.cardLabel}>
                  {t('stats.trend')}
                </ThemedText>
                <TrendChart series={series} selected={monthKey} lang={lang} onSelect={setMonthKey} />
              </ThemedView>

              {hasMonthData && (
                <>
                  <View style={styles.splitRow}>
                    <SplitCard label={t('scope.ours')} value={totals.ours} tone="ours" />
                    <SplitCard label={t('scope.mine')} value={totals.mine} tone="mine" />
                  </View>

                  <ThemedView type="backgroundElement" style={styles.factsCard}>
                    <Fact label={t('stats.expenses')} value={String(totals.count)} />
                    <View style={styles.factDivider} />
                    <Fact label={t('stats.avg')} value={format(avg)} />
                    <View style={styles.factDivider} />
                    <Fact label={t('stats.biggest')} value={format(Number(biggest?.amount ?? 0))} />
                  </ThemedView>

                  <ThemedView type="backgroundElement" style={styles.card}>
                    <ThemedText type="smallBold" themeColor="textSecondary" style={styles.cardLabel}>
                      {t('stats.byCategory')}
                    </ThemedText>
                    {breakdown.map((slice) => {
                      const cat = slice.id ? categoryById.get(slice.id) : undefined;
                      const name = cat?.name ?? t('stats.uncategorized');
                      const color = cat?.color ?? Accent.primary;
                      return (
                        <View key={slice.id ?? 'none'} style={styles.catRow}>
                          <View style={styles.catHead}>
                            {cat?.icon ? (
                              <ThemedText type="small">{cat.icon}</ThemedText>
                            ) : (
                              <View style={[styles.dot, { backgroundColor: color }]} />
                            )}
                            <ThemedText type="small" numberOfLines={1} style={styles.catName}>
                              {name}
                            </ThemedText>
                            <ThemedText type="small" themeColor="textSecondary" style={styles.catAmount}>
                              {format(slice.amount)}
                            </ThemedText>
                          </View>
                          <ProgressBar ratio={slice.share} color={color} />
                        </View>
                      );
                    })}
                  </ThemedView>
                </>
              )}

              {isCurrentMonth && (
                <ThemedView type="backgroundElement" style={styles.card}>
                  <ThemedText type="smallBold" themeColor="textSecondary" style={styles.cardLabel}>
                    {t('stats.shopping')}
                  </ThemedText>
                  <View style={styles.shopRow}>
                    <Fact label={t('stats.toBuy')} value={String(toBuyCount)} />
                    <View style={styles.factDivider} />
                    <Fact label={t('stats.bought')} value={String(boughtCount)} />
                  </View>
                </ThemedView>
              )}

              <Pressable
                onPress={handleExport}
                disabled={exporting}
                accessibilityRole="button"
                accessibilityLabel={t('stats.exportCsv')}
                style={({ pressed }) => [styles.exportButton, { opacity: pressed || exporting ? 0.6 : 1 }]}>
                {exporting ? (
                  <ActivityIndicator testID="stats-exporting" />
                ) : (
                  <ThemedText type="smallBold" style={styles.exportText}>
                    {t('stats.exportCsv')}
                  </ThemedText>
                )}
              </Pressable>
            </ScrollView>
          )}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

function TrendChart({
  series,
  selected,
  lang,
  onSelect,
}: {
  series: MonthPoint[];
  selected: string;
  lang: 'bg' | 'en';
  onSelect: (monthKey: string) => void;
}) {
  const theme = useTheme();
  const max = Math.max(...series.map((s) => s.total), 0);
  return (
    <View style={styles.trendRow}>
      {series.map((point) => {
        const active = point.monthKey === selected;
        const pct = max > 0 ? Math.round((point.total / max) * 100) : 0;
        return (
          <Pressable
            key={point.monthKey}
            onPress={() => onSelect(point.monthKey)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={monthLong(point.monthKey, lang)}
            style={styles.trendCol}>
            <View style={[styles.trendTrack, { backgroundColor: theme.backgroundSelected }]}>
              <View
                style={[
                  styles.trendFill,
                  { height: `${pct}%`, backgroundColor: active ? Accent.primary : theme.textSecondary },
                ]}
              />
            </View>
            <ThemedText type="small" themeColor={active ? 'text' : 'textSecondary'}>
              {monthShort(point.monthKey, lang)}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

function SplitCard({ label, value, tone }: { label: string; value: number; tone: 'ours' | 'mine' }) {
  const { format } = useCurrency();
  return (
    <View style={[styles.splitCard, { backgroundColor: Accent[tone] }, Shadow.card]}>
      <ThemedText type="smallBold" style={styles.splitLabel}>
        {label.toUpperCase()}
      </ThemedText>
      <ThemedText style={styles.splitValue}>{format(value)}</ThemedText>
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <ThemedText style={styles.factValue}>{value}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.factLabel}>
        {label}
      </ThemedText>
    </View>
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
    paddingBottom: Spacing.three,
  },
  close: { color: Accent.primary, fontWeight: '600', fontSize: 16 },
  pressed: { opacity: 0.6 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: Spacing.five, gap: Spacing.three },
  exportButton: {
    alignSelf: 'center',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportText: { color: Accent.primary },
  switcher: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.two,
  },
  switchArrow: { fontSize: 26, fontWeight: '700', color: Accent.primary, lineHeight: 30 },
  switchArrowOff: { opacity: 0.3 },
  switchLabel: { fontSize: 17, fontWeight: '700' },
  hero: { borderRadius: Radius.lg, padding: Spacing.four, gap: Spacing.one, alignItems: 'flex-start' },
  heroLabel: { letterSpacing: 0.6 },
  heroValue: { fontSize: 40, fontWeight: '800', letterSpacing: -0.6, fontVariant: ['tabular-nums'] },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: Spacing.one,
    marginTop: Spacing.one,
  },
  trendCol: { flex: 1, alignItems: 'center', gap: Spacing.one },
  trendTrack: {
    width: '64%',
    height: 72,
    justifyContent: 'flex-end',
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  trendFill: { width: '100%', borderRadius: Radius.sm },
  splitRow: { flexDirection: 'row', gap: Spacing.three },
  splitCard: { flex: 1, borderRadius: Radius.lg, padding: Spacing.three, gap: Spacing.half },
  splitLabel: { color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: '800', letterSpacing: 0.7 },
  splitValue: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
  factsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.lg,
    paddingVertical: Spacing.three,
    ...Shadow.card,
  },
  fact: { flex: 1, alignItems: 'center', gap: Spacing.half },
  factValue: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3, fontVariant: ['tabular-nums'] },
  factLabel: { textAlign: 'center' },
  factDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: 'rgba(128,128,128,0.25)' },
  card: { borderRadius: Radius.lg, padding: Spacing.three, gap: Spacing.two, ...Shadow.card },
  cardLabel: { letterSpacing: 0.6 },
  catRow: { gap: Spacing.one, marginTop: Spacing.one },
  catHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  dot: { width: 10, height: 10, borderRadius: 5 },
  catName: { flex: 1 },
  catAmount: { fontVariant: ['tabular-nums'] },
  shopRow: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.one },
});
