import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Update } from '../lib/db';
import { useAuth } from './useAuth';

export type ListItem = {
  id: string;
  list_id: string;
  name: string;
  quantity: number;
  category: string | null; // grocery aisle key (see lib/groceries.ts)
  is_checked: boolean;
  added_by: string;
  checked_by: string | null;
  created_at: string;
  updated_at: string;
};

// Merges are keyed by id and idempotent, so duplicate Realtime events are harmless.
function upsert(list: ListItem[], row: ListItem): ListItem[] {
  const i = list.findIndex((x) => x.id === row.id);
  const next = i === -1 ? [...list, row] : list.map((x) => (x.id === row.id ? row : x));
  return next.sort((a, b) => a.created_at.localeCompare(b.created_at));
}
function removeById(list: ListItem[], id: string): ListItem[] {
  return list.filter((x) => x.id !== id);
}

/**
 * Loads a shopping list's items and keeps them in sync in real time.
 * Every mutation updates the UI optimistically, then reconciles against the
 * Supabase Realtime stream (which also delivers the partner's changes).
 *
 * The list is a pure shopping list — name + quantity + grocery category, no
 * money. Spending is tracked separately on the Budget tab, which is where an
 * item gets completed (quantity-aware) when it's actually purchased.
 */
export function useListItems(listId: string | null) {
  const { user } = useAuth();
  const userIdRef = useRef<string | null>(user?.id ?? null);
  userIdRef.current = user?.id ?? null;

  // A per-instance channel id. Both the List tab and the Budget tab subscribe to
  // the same list, and Supabase keys channels by topic name — reusing one name
  // would make the second subscriber call `.on()` on an already-subscribed
  // channel, which throws. A unique suffix gives each hook its own channel
  // (postgres_changes still filters by `list_id`, not the topic name).
  const channelIdRef = useRef(Math.random().toString(36).slice(2));

  const [items, setItems] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0); // bumped by retry()

  // Initial load
  useEffect(() => {
    if (!listId) return;
    let active = true;
    setLoading(true);
    setError(null);

    (async () => {
      const { data, error } = await supabase
        .from('list_items')
        .select('*')
        .eq('list_id', listId)
        .order('created_at', { ascending: true });

      if (!active) return;
      if (error) setError(error.message);
      else setItems((data ?? []) as ListItem[]);
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [listId, attempt]);

  // Realtime subscription
  useEffect(() => {
    if (!listId) return;
    const channel: RealtimeChannel = supabase
      .channel(`list:${listId}:${channelIdRef.current}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'list_items', filter: `list_id=eq.${listId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setItems((prev) => removeById(prev, (payload.old as ListItem).id));
          } else {
            setItems((prev) => upsert(prev, payload.new as ListItem));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [listId]);

  const addItem = useCallback(
    async (name: string, opts?: { quantity?: number; category?: string; checked?: boolean }) => {
      if (!listId || !name.trim()) return;
      const uid = userIdRef.current;
      const tempId = `temp-${Date.now()}`;
      const now = new Date().toISOString();
      const quantity = opts?.quantity && opts.quantity > 0 ? opts.quantity : 1;
      // `checked` lets the Budget tab log an off-list purchase straight onto the
      // list as already-bought (see completeItem for the on-list case).
      const checked = opts?.checked ?? false;

      const optimistic: ListItem = {
        id: tempId,
        list_id: listId,
        name: name.trim(),
        quantity,
        category: opts?.category ?? null,
        is_checked: checked,
        added_by: uid ?? '',
        checked_by: checked ? uid : null,
        created_at: now,
        updated_at: now,
      };
      setItems((prev) => upsert(prev, optimistic));

      const { data, error } = await supabase
        .from('list_items')
        .insert({
          list_id: listId,
          name: name.trim(),
          quantity,
          category: opts?.category ?? null,
          added_by: uid ?? '',
          is_checked: checked,
          checked_by: checked ? uid : null,
        })
        .select()
        .single();

      if (error) {
        setItems((prev) => removeById(prev, tempId)); // roll back
        setError(error.message);
        return;
      }
      // Swap the temp row for the real one (Realtime INSERT will be a no-op merge).
      setItems((prev) => upsert(removeById(prev, tempId), data as ListItem));
    },
    [listId]
  );

  const toggleItem = useCallback(async (item: ListItem) => {
    const uid = userIdRef.current;
    const next = !item.is_checked;
    setItems((prev) => upsert(prev, { ...item, is_checked: next, checked_by: next ? uid : null }));

    const { error } = await supabase
      .from('list_items')
      .update({ is_checked: next, checked_by: next ? uid : null })
      .eq('id', item.id);

    if (error) {
      setItems((prev) => upsert(prev, item)); // revert
      setError(error.message);
    }
  }, []);

  // Adjust an item's quantity (the row stepper). Quantity is clamped at 1; use
  // removeItem to take something off the list entirely.
  const setQuantity = useCallback(async (item: ListItem, next: number) => {
    const quantity = Math.max(1, Math.round(next));
    if (quantity === item.quantity) return;
    setItems((prev) => upsert(prev, { ...item, quantity }));

    const { error } = await supabase.from('list_items').update({ quantity }).eq('id', item.id);
    if (error) {
      setItems((prev) => upsert(prev, item)); // revert
      setError(error.message);
    }
  }, []);

  // Quantity-aware completion driven by the Budget tab: when `purchased` covers
  // the whole listed quantity the item is checked off; buying fewer leaves it on
  // the list with the remaining quantity (Milk ×3, buy 1 → Milk ×2 stays).
  const completeItem = useCallback(async (item: ListItem, purchased: number) => {
    const uid = userIdRef.current;
    const qty = Math.max(0, Math.floor(purchased));
    if (qty <= 0) return;
    const remaining = item.quantity - qty;
    const patch: Update<'list_items'> =
      remaining > 0 ? { quantity: remaining } : { is_checked: true, checked_by: uid };

    setItems((prev) => upsert(prev, { ...item, ...patch } as ListItem));
    const { error } = await supabase.from('list_items').update(patch).eq('id', item.id);
    if (error) {
      setItems((prev) => upsert(prev, item)); // revert
      setError(error.message);
    }
  }, []);

  const removeItem = useCallback(async (item: ListItem) => {
    setItems((prev) => removeById(prev, item.id));
    const { error } = await supabase.from('list_items').delete().eq('id', item.id);
    if (error) {
      setItems((prev) => upsert(prev, item)); // restore
      setError(error.message);
    }
  }, []);

  const clearChecked = useCallback(async () => {
    if (!listId) return;
    const snapshot = items;
    setItems((prev) => prev.filter((x) => !x.is_checked));

    const { error } = await supabase
      .from('list_items')
      .delete()
      .eq('list_id', listId)
      .eq('is_checked', true);

    if (error) {
      setItems(snapshot); // restore
      setError(error.message);
    }
  }, [listId, items]);

  // Re-runs the initial load, which also clears a stuck error (load or mutation).
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return {
    items,
    loading,
    error,
    addItem,
    toggleItem,
    setQuantity,
    completeItem,
    removeItem,
    clearChecked,
    retry,
  };
}

// Extension idea (Phase 4 "partner is editing" indicator): add a second hook that
// joins the same channel and uses channel.track()/presenceState() to broadcast
// presence. Kept out of the MVP hook to keep responsibilities clean.
