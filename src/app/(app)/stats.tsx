import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/empty-state';
import { ProgressBar } from '@/components/progress-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Accent, MaxContentWidth, Radius, Shadow, Spacing } from '@/constants/theme';
import { formatAmount } from '../../../lib/format';
import {
  biggestExpense,
  categoryBreakdown,
  deltaFraction,
  monthKeyOf,
  monthTotal,
  monthTotals,
  previousMonthKey,
} from '../../../lib/stats';
import { useCategories } from '../../../hooks/useCategories';
import { useListItems } from '../../../hooks/useListItems';
import { useShoppingList } from '../../../hooks/useShoppingList';
import { useTransactions } from '../../../hooks/useTransactions';
import { useTranslation } from '../../../hooks/useTranslation';

export default function StatsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { items, loading } = useTransactions();
  const { categories } = useCategories();
  const { listId } = useShoppingList();
  const { items: listItems } = useListItems(listId);

  const monthKey = monthKeyOf(new Date());
  const totals = useMemo(() => monthTotals(items, monthKey), [items, monthKey]);
  const prevTotal = useMemo(() => monthTotal(items, previousMonthKey(monthKey)), [items, monthKey]);
  const breakdown = useMemo(() => categoryBreakdown(items, monthKey), [items, monthKey]);
  const biggest = useMemo(() => biggestExpense(items, monthKey), [items, monthKey]);
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const delta = deltaFraction(totals.total, prevTotal);
  const avg = totals.count > 0 ? totals.total / totals.count : 0;
  const boughtCount = listItems.filter((i) => i.is_checked).length;
  const toBuyCount = listItems.filter((i) => !i.is_checked).length;
  const hasData = totals.count > 0;

  const deltaLabel =
    delta == null
      ? t('stats.noBaseline')
      : Math.abs(delta) < 0.005
        ? t('stats.deltaFlat')
        : delta > 0
          ? t('stats.deltaUp', { pct: Math.round(delta * 100) })
          : t('stats.deltaDown', { pct: Math.round(Math.abs(delta) * 100) });

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

          {loading && !hasData ? (
            <View style={styles.center}>
              <ActivityIndicator testID="stats-loading" />
            </View>
          ) : !hasData ? (
            <EmptyState emoji="📊" title={t('stats.emptyTitle')} hint={t('stats.emptyHint')} />
          ) : (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}>
              <ThemedView type="backgroundElement" style={[styles.hero, Shadow.card]}>
                <ThemedText type="smallBold" themeColor="textSecondary" style={styles.heroLabel}>
                  {t('stats.spentThisMonth')}
                </ThemedText>
                <ThemedText style={styles.heroValue}>{formatAmount(totals.total)}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {deltaLabel}
                </ThemedText>
              </ThemedView>

              <View style={styles.splitRow}>
                <SplitCard label={t('scope.ours')} value={totals.ours} tone="ours" />
                <SplitCard label={t('scope.mine')} value={totals.mine} tone="mine" />
              </View>

              <ThemedView type="backgroundElement" style={styles.factsCard}>
                <Fact label={t('stats.expenses')} value={String(totals.count)} />
                <View style={styles.factDivider} />
                <Fact label={t('stats.avg')} value={formatAmount(avg)} />
                <View style={styles.factDivider} />
                <Fact label={t('stats.biggest')} value={formatAmount(Number(biggest?.amount ?? 0))} />
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
                          {formatAmount(slice.amount)}
                        </ThemedText>
                      </View>
                      <ProgressBar ratio={slice.share} color={color} />
                    </View>
                  );
                })}
              </ThemedView>

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
            </ScrollView>
          )}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

function SplitCard({ label, value, tone }: { label: string; value: number; tone: 'ours' | 'mine' }) {
  return (
    <View style={[styles.splitCard, { backgroundColor: Accent[tone] }, Shadow.card]}>
      <ThemedText type="smallBold" style={styles.splitLabel}>
        {label.toUpperCase()}
      </ThemedText>
      <ThemedText style={styles.splitValue}>{formatAmount(value)}</ThemedText>
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
  hero: { borderRadius: Radius.lg, padding: Spacing.four, gap: Spacing.one, alignItems: 'flex-start' },
  heroLabel: { letterSpacing: 0.6 },
  heroValue: { fontSize: 40, fontWeight: '800', letterSpacing: -0.6, fontVariant: ['tabular-nums'] },
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
