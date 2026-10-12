import { useEffect, useMemo, useState } from 'react';

import { supabase } from '../../../lib/supabase';
import { allOffers, bestSale, CHAIN_WIDE_SHARE, cutoffDate, type DealPriceRow, type ItemSale, type Offer } from './deals';
import { matchItem, type ItemMatch } from './match';

const COLUMNS = 'chain, product_name, group_code, retail_price, promo_price, promo_share, price_date';

export type ItemDeal = ItemSale & { itemName: string; match: ItemMatch };

export type Deals = {
  /** The best current sale for a list item, or null (no group, no sale, or switched off). */
  saleFor: (itemName: string) => ItemDeal | null;
};

/**
 * Current supermarket sales for the items on the list. Fetches only chain-wide
 * promos in the groups the list needs. When the deals switch is off the database
 * returns no rows (RLS), so every badge disappears — no app update needed. Errors
 * are swallowed: deals are a bonus, and the list must never break because of them.
 */
export function useDeals(items: { name: string; is_checked: boolean }[]): Deals {
  const namesKey = useMemo(
    () => [...new Set(items.filter((i) => !i.is_checked).map((i) => i.name))].sort().join('\n'),
    [items]
  );

  const matches = useMemo(() => {
    const map = new Map<string, ItemMatch>();
    for (const name of namesKey ? namesKey.split('\n') : []) {
      const match = matchItem(name);
      if (match) map.set(name, match);
    }
    return map;
  }, [namesKey]);

  const groupsKey = useMemo(
    () => [...new Set([...matches.values()].flatMap((m) => m.groups))].sort((a, b) => a - b).join(','),
    [matches]
  );

  const [rows, setRows] = useState<DealPriceRow[]>([]);

  useEffect(() => {
    if (!groupsKey) return;
    let active = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('deal_prices')
          .select(COLUMNS)
          .in('group_code', groupsKey.split(',').map(Number))
          .not('promo_price', 'is', null)
          .gte('promo_share', CHAIN_WIDE_SHARE)
          .gte('price_date', cutoffDate(new Date()));
        if (active && !error && data) setRows(data);
      } catch {
        // Offline or the table is gone — just no badges.
      }
    })();
    return () => {
      active = false;
    };
  }, [groupsKey]);

  return useMemo(() => {
    const cutoff = cutoffDate(new Date());
    const cache = new Map<string, ItemDeal | null>();
    return {
      saleFor(itemName: string) {
        if (cache.has(itemName)) return cache.get(itemName)!;
        const match = matches.get(itemName) ?? matchItem(itemName);
        const sale = match ? bestSale(match, rows, cutoff) : null;
        const deal = sale && match ? { ...sale, itemName, match } : null;
        cache.set(itemName, deal);
        return deal;
      },
    };
  }, [matches, rows]);
}

/** Every current price for one item, for the comparison sheet. */
export function useItemOffers(match: ItemMatch) {
  const [state, setState] = useState<{ offers: Offer[]; loading: boolean; error: boolean }>({
    offers: [],
    loading: true,
    error: false,
  });
  const [attempt, setAttempt] = useState(0);
  const matchKey = JSON.stringify(match);

  useEffect(() => {
    let active = true;
    (async () => {
      const cutoff = cutoffDate(new Date());
      try {
        const { data, error } = await supabase
          .from('deal_prices')
          .select(COLUMNS)
          .in('group_code', match.groups)
          .gte('price_date', cutoff);
        if (!active) return;
        if (error || !data) setState({ offers: [], loading: false, error: true });
        else setState({ offers: allOffers(match, data, cutoff), loading: false, error: false });
      } catch {
        if (active) setState({ offers: [], loading: false, error: true });
      }
    })();
    return () => {
      active = false;
    };
    // `match` is rebuilt on every render; its serialized form is the real dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchKey, attempt]);

  const retry = () => {
    setState((s) => ({ ...s, loading: true, error: false }));
    setAttempt((n) => n + 1);
  };

  return { ...state, retry };
}
