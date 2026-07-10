import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { useHousehold } from './useHousehold';

export type TransactionScope = 'private' | 'shared';

export type Transaction = {
  id: string;
  household_id: string;
  category_id: string | null;
  /** Set when the transaction was produced by checking off a priced list item. */
  list_item_id: string | null;
  owner_id: string;
  amount: number;
  description: string | null;
  occurred_on: string; // 'YYYY-MM-DD'
  scope: TransactionScope;
  created_at: string;
};

// occurred_on is a calendar date in the user's local timezone. toISOString()
// would give the UTC date, which shifts late-evening entries to the previous
// day (and into the previous month right at a month boundary).
export function localDateString(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

// Newest first: by the day it happened, then by insert time as a tiebreak.
function sortTx(list: Transaction[]): Transaction[] {
  return [...list].sort(
    (a, b) => b.occurred_on.localeCompare(a.occurred_on) || b.created_at.localeCompare(a.created_at)
  );
}

// The DB only ever returns shared rows + the caller's own private rows (RLS), but
// we mirror that rule on the client so a stray realtime event can never leak a
// partner's private spend into the UI. See the "Scope rule" in AGENTS.md.
function visibleToMe(tx: Transaction, myId: string | null): boolean {
  return tx.scope === 'shared' || tx.owner_id === myId;
}

function upsert(list: Transaction[], row: Transaction, myId: string | null): Transaction[] {
  if (!visibleToMe(row, myId)) return list;
  const i = list.findIndex((x) => x.id === row.id);
  const next = i === -1 ? [...list, row] : list.map((x) => (x.id === row.id ? row : x));
  return sortTx(next);
}
function removeById(list: Transaction[], id: string): Transaction[] {
  return list.filter((x) => x.id !== id);
}

/**
 * Loads the household's transactions — shared ("Ours") plus the signed-in user's
 * own private ("Mine") — and keeps them live. A partner's private spend ("Yours")
 * is never returned by RLS and is defensively filtered here too. Adds are
 * optimistic and reconciled against the Realtime stream.
 */
export function useTransactions() {
  const { household } = useHousehold();
  const { user } = useAuth();
  const householdId = household?.id ?? null;
  const userIdRef = useRef<string | null>(user?.id ?? null);
  userIdRef.current = user?.id ?? null;

  const [items, setItems] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0); // bumped by retry()

  // Initial load
  useEffect(() => {
    if (!householdId) return;
    let active = true;
    setLoading(true);
    setError(null);

    (async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('household_id', householdId)
        .order('occurred_on', { ascending: false })
        .order('created_at', { ascending: false });

      if (!active) return;
      if (error) setError(error.message);
      else setItems(sortTx((data ?? []) as Transaction[]));
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [householdId, attempt]);

  // Realtime
  useEffect(() => {
    if (!householdId) return;
    const channel: RealtimeChannel = supabase
      .channel(`budget:${householdId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `household_id=eq.${householdId}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setItems((prev) => removeById(prev, (payload.old as Transaction).id));
          } else {
            setItems((prev) => upsert(prev, payload.new as Transaction, userIdRef.current));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [householdId]);

  const addTransaction = useCallback(
    async (input: {
      amount: number;
      description?: string;
      scope: TransactionScope;
      occurredOn?: string;
      categoryId?: string;
    }) => {
      const uid = userIdRef.current;
      if (!householdId || !uid || !Number.isFinite(input.amount) || input.amount <= 0) return;

      const tempId = `temp-${Date.now()}`;
      const now = new Date().toISOString();
      const occurred = input.occurredOn ?? localDateString();

      const optimistic: Transaction = {
        id: tempId,
        household_id: householdId,
        category_id: input.categoryId ?? null,
        list_item_id: null,
        owner_id: uid,
        amount: input.amount,
        description: input.description?.trim() || null,
        occurred_on: occurred,
        scope: input.scope,
        created_at: now,
      };
      setItems((prev) => upsert(prev, optimistic, uid));

      const { data, error } = await supabase
        .from('transactions')
        .insert({
          household_id: householdId,
          owner_id: uid,
          amount: input.amount,
          description: input.description?.trim() || null,
          occurred_on: occurred,
          scope: input.scope,
          category_id: input.categoryId ?? null,
        })
        .select()
        .single();

      if (error) {
        setItems((prev) => removeById(prev, tempId)); // roll back
        setError(error.message);
        return;
      }
      // Swap the temp row for the real one (its Realtime INSERT is a no-op merge).
      setItems((prev) => upsert(removeById(prev, tempId), data as Transaction, uid));
    },
    [householdId]
  );

  const removeTransaction = useCallback(async (tx: Transaction) => {
    setItems((prev) => removeById(prev, tx.id));
    const { error } = await supabase.from('transactions').delete().eq('id', tx.id);
    if (error) {
      setItems((prev) => upsert(prev, tx, userIdRef.current)); // restore
      setError(error.message);
    }
  }, []);

  // Re-runs the initial load, which also clears a stuck error (load or mutation).
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { items, loading, error, addTransaction, removeTransaction, retry };
}
