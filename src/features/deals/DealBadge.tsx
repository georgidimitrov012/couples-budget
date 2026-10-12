import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Accent, Radius, Spacing } from '@/constants/theme';
import { formatMoney } from '../../../lib/currency';
import { useTranslation } from '../../../hooks/useTranslation';
import { chainName } from './chains';
import { unitPrice, type Offer } from './deals';
import { displayDate, fill, STRINGS } from './strings';
import { useItemOffers, type ItemDeal } from './useDeals';

// Prices come from the shops in euro, whatever display currency the user picked.
const eur = (n: number) => formatMoney(n, 'EUR');
const SHEET_LIMIT = 15;
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
  const shown = offers.slice(0, SHEET_LIMIT);

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
          ) : shown.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.state}>
              {s.empty}
            </ThemedText>
          ) : (
            <ScrollView style={styles.offers} contentContainerStyle={styles.offersContent}>
              {shown.map((offer, i) => (
                <OfferRow key={`${offer.chain}-${offer.productName}-${i}`} offer={offer} />
              ))}
              {offers.length > shown.length && (
                <ThemedText type="small" themeColor="textSecondary">
                  {fill(s.more, { n: offers.length - shown.length })}
                </ThemedText>
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
  offerMain: { flex: 1, gap: 2 },
  offerPrice: { alignItems: 'flex-end' },
  saleText: { color: SALE },
  footer: { gap: Spacing.one, paddingTop: Spacing.two },
  close: { alignSelf: 'stretch', alignItems: 'center', paddingVertical: Spacing.three },
  closeText: { color: Accent.primary },
});
