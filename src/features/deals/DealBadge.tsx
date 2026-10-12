import { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Accent, Radius, Spacing } from '@/constants/theme';
import { formatMoney } from '../../../lib/currency';
import { useTranslation } from '../../../hooks/useTranslation';
import { chainName } from './chains';
import { summarizeOffers, unitPrice, type Offer } from './deals';
import { displayDate, fill, STRINGS } from './strings';
import { useItemOffers, type ItemDeal } from './useDeals';

// Prices come from the shops in euro, whatever display currency the user picked.
const eur = (n: number) => formatMoney(n, 'EUR');
// One chain's full list can run to hundreds of products ("bread" at Lidl).
const CHAIN_LIMIT = 30;
const SALE = Accent.mine;
const SALE_WASH = 'rgba(242, 106, 75, 0.12)';

/** "🏷 Kaufland: 1,29 € (−45%) · Домати кг" under a list item; tap to compare chains. */
export function DealBadge({ deal }: { deal: ItemDeal }) {
  const { lang } = useTranslation();
  const s = STRINGS[lang];
  const [open, setOpen] = useState(false);
  const { best, otherChains } = deal;
  const chain = chainName(best.chain);
  const price = eur(best.price);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={fill(s.badgeA11y, { chain, product: best.productName, price, pct: best.discountPct ?? 0 })}
        hitSlop={6}
        style={({ pressed }) => [styles.badge, pressed && styles.pressed]}>
        <ThemedText type="small" numberOfLines={1} style={styles.badgeText}>
          🏷 {chain}: {price} (−{best.discountPct}%) · {best.productName}
        </ThemedText>
        {otherChains > 0 && (
          <ThemedText
            type="smallBold"
            style={styles.badgeMore}
            accessibilityLabel={fill(s.moreChainsA11y, { n: otherChains })}>
            +{otherChains}
          </ThemedText>
        )}
      </Pressable>
      {open && <DealSheet deal={deal} onClose={() => setOpen(false)} />}
    </>
  );
}

function DealSheet({ deal, onClose }: { deal: ItemDeal; onClose: () => void }) {
  const { lang } = useTranslation();
  const s = STRINGS[lang];
  const insets = useSafeAreaInsets();
  const { offers, loading, error, retry } = useItemOffers(deal.match);
  const summary = useMemo(() => summarizeOffers(offers), [offers]);
  // null = the overview (best per chain + top deals); a chain id = that chain's list.
  const [openChain, setOpenChain] = useState<string | null>(null);
  const chainOffers = summary.chains.find((c) => c.chain === openChain)?.offers ?? [];
  const chainShown = chainOffers.slice(0, CHAIN_LIMIT);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={s.close}
        />
        <ThemedView style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.four }]}>
          <ThemedText type="subtitle" numberOfLines={2}>
            {fill(s.sheetTitle, { item: deal.itemName })}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {fill(s.pricesFrom, { date: displayDate(deal.best.priceDate) })}
          </ThemedText>

          {loading ? (
            <ActivityIndicator testID="deal-sheet-loading" style={styles.state} />
          ) : error ? (
            <Pressable onPress={retry} accessibilityRole="button" style={styles.state}>
              <ThemedText type="small" style={styles.error}>
                {s.loadError}
              </ThemedText>
            </Pressable>
          ) : offers.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.state}>
              {s.empty}
            </ThemedText>
          ) : openChain ? (
            <ScrollView style={styles.offers} contentContainerStyle={styles.offersContent}>
              <Pressable
                onPress={() => setOpenChain(null)}
                accessibilityRole="button"
                hitSlop={8}
                style={({ pressed }) => pressed && styles.pressed}>
                <ThemedText type="smallBold" style={styles.link}>
                  {s.allStores}
                </ThemedText>
              </Pressable>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
                {fill(s.chainProducts, { chain: chainName(openChain), n: chainOffers.length })}
              </ThemedText>
              {chainShown.map((offer, i) => (
                <OfferRow key={`${offer.productName}-${i}`} offer={offer} />
              ))}
              {chainOffers.length > chainShown.length && (
                <ThemedText type="small" themeColor="textSecondary">
                  {fill(s.more, { n: chainOffers.length - chainShown.length })}
                </ThemedText>
              )}
            </ScrollView>
          ) : (
            <ScrollView style={styles.offers} contentContainerStyle={styles.offersContent}>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
                {s.bestPerChain}
              </ThemedText>
              {summary.chains.map(({ chain, best, offers: list }) => (
                <View key={chain} style={styles.chainBlock}>
                  <OfferRow offer={best} />
                  {list.length > 1 && (
                    <Pressable
                      onPress={() => setOpenChain(chain)}
                      accessibilityRole="button"
                      accessibilityLabel={fill(s.showAllA11y, { chain: chainName(chain), n: list.length })}
                      hitSlop={6}
                      style={({ pressed }) => pressed && styles.pressed}>
                      <ThemedText type="small" style={styles.link}>
                        {fill(s.showAll, { n: list.length })}
                      </ThemedText>
                    </Pressable>
                  )}
                </View>
              ))}
              {summary.topDeals.length > 0 && (
                <>
                  <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
                    {s.topDeals}
                  </ThemedText>
                  {summary.topDeals.map((offer, i) => (
                    <OfferRow key={`top-${offer.chain}-${offer.productName}-${i}`} offer={offer} />
                  ))}
                </>
              )}
            </ScrollView>
          )}

          <View style={styles.footer}>
            <ThemedText type="small" themeColor="textSecondary">
              {s.disclaimer}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {s.source}
            </ThemedText>
          </View>

          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
            <ThemedText type="smallBold" style={styles.closeText}>
              {s.close}
            </ThemedText>
          </Pressable>
        </ThemedView>
      </View>
    </Modal>
  );
}

function OfferRow({ offer }: { offer: Offer }) {
  const { lang } = useTranslation();
  const s = STRINGS[lang];
  const perUnit = unitPrice(offer);
  const showUnit = perUnit != null && offer.size != null && offer.size.amount !== 1;

  return (
    <View style={styles.offer}>
      <View style={styles.offerMain}>
        <ThemedText type="smallBold">{chainName(offer.chain)}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
          {offer.productName}
        </ThemedText>
        {offer.onSale ? (
          <ThemedText type="small" style={styles.saleText}>
            {fill(s.promo, { pct: offer.discountPct ?? 0, price: eur(offer.retailPrice) })}
          </ThemedText>
        ) : offer.someStoresOnly ? (
          <ThemedText type="small" themeColor="textSecondary">
            {s.someStores}
          </ThemedText>
        ) : null}
      </View>
      <View style={styles.offerPrice}>
        <ThemedText type="smallBold" style={offer.onSale ? styles.saleText : undefined}>
          {eur(offer.price)}
        </ThemedText>
        {showUnit && (
          <ThemedText type="small" themeColor="textSecondary">
            {eur(perUnit)}/{s[offer.size!.unit]}
          </ThemedText>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.6 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    maxWidth: '100%',
    gap: Spacing.one,
    backgroundColor: SALE_WASH,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  badgeText: { color: SALE, flexShrink: 1 },
  badgeMore: { color: SALE },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.35)' },
  sheet: {
    maxHeight: '85%',
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    gap: Spacing.two,
  },
  state: { paddingVertical: Spacing.four },
  error: { color: Accent.danger },
  offers: { flexShrink: 1 },
  offersContent: { gap: Spacing.three, paddingVertical: Spacing.two },
  offer: { flexDirection: 'row', gap: Spacing.three },
  chainBlock: { gap: Spacing.one },
  sectionLabel: { letterSpacing: 0.5, textTransform: 'uppercase', marginTop: Spacing.two },
  link: { color: Accent.primary },
  offerMain: { flex: 1, gap: 2 },
  offerPrice: { alignItems: 'flex-end' },
  saleText: { color: SALE },
  footer: { gap: Spacing.one, paddingTop: Spacing.two },
  close: { alignSelf: 'stretch', alignItems: 'center', paddingVertical: Spacing.three },
  closeText: { color: Accent.primary },
});
