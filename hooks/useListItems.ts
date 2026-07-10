import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export type ListItem = {
  id: string;
  list_id: string;
  name: string;
  quantity: number;
  price: number | null;
  category_id: string | null;
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
 */
export function useListItems(listId: string | null) {
  const [items, setItems] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const userIdRef = useRef<string | null>(null);

  // Initial load
  useEffect(() => {
    if (!listId) return;
    let active = true;
    setLoading(true);
    setError(null);

    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      userIdRef.current = sessionData.session?.user.id ?? null;

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
  }, [listId]);

  // Realtime subscription
  useEffect(() => {
    if (!listId) return;
    const channel: RealtimeChannel = supabase
      .channel(`list:${listId}`)
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
    async (
      name: string,
      opts?: { quantity?: number; price?: number; categoryId?: string }
    ) => {
      if (!listId || !name.trim()) return;
      const uid = userIdRef.current;
      const tempId = `temp-${Date.now()}`;
      const now = new Date().toISOString();

      const optimistic: ListItem = {
        id: tempId,
        list_id: listId,
        name: name.trim(),
        quantity: opts?.quantity ?? 1,
        price: opts?.price ?? null,
        category_id: opts?.categoryId ?? null,
        is_checked: false,
        added_by: uid ?? '',
        checked_by: null,
        created_at: now,
        updated_at: now,
      };
      setItems((prev) => upsert(prev, optimistic));

      const { data, error } = await supabase
        .from('list_items')
        .insert({
          list_id: listId,
          name: name.trim(),
          quantity: opts?.quantity ?? 1,
          price: opts?.price ?? null,
          category_id: opts?.categoryId ?? null,
          added_by: uid,
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

  return { items, loading, error, addItem, toggleItem, removeItem, clearChecked };
}

// Extension idea (Phase 4 "partner is editing" indicator): add a second hook that
// joins the same channel and uses channel.track()/presenceState() to broadcast
// presence. Kept out of the MVP hook to keep responsibilities clean.
