import { useCallback, useEffect, useMemo, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { useHousehold } from './useHousehold';
import type { Transaction } from './useTransactions';

export type Settlement = {
  id: string;
  household_id: string;
  from_user: string;
  to_user: string;
  amount: number;
  created_at: string;
};

// All balance math is done in integer cents to avoid float drift.
function toCents(n: number): number {
  return Math.round(Number(n) * 100);
}

function sortByCreated(list: Settlement[]): Settlement[] {
  return [...list].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

function upsert(list: Settlement[], row: Settlement): Settlement[] {
  const i = list.findIndex((s) => s.id === row.id);
  return sortByCreated(i === -1 ? [...list, row] : list.map((s) => (s.id === row.id ? row : s)));
}

/**
 * "Who owes whom": shared ("Ours") expenses are split 50/50, so whoever paid one
 * is owed half of it by their partner. Recorded settlements (a payback from one
 * partner to the other) cancel that debt. Private expenses never enter the
 * balance — and the caller's transaction list can never contain the partner's
 * private rows anyway (RLS + the defensive filter in useTransactions).
 *
 * `balance` is in currency units from the signed-in user's perspective:
 * positive = the partner owes them, negative = they owe the partner.
 * `settleUp()` records a settlement for the full current balance, debtor → creditor.
 */
export function useSettleUp(transactions: Transaction[]) {
  const { household, members } = useHousehold();
  const { user } = useAuth();
  const householdId = household?.id ?? null;
  const userId = user?.id ?? null;
  const partnerId = members.find((m) => m.user_id !== userId)?.user_id ?? null;

  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settling, setSettling] = useState(false);
  const [attempt, setAttempt] = useState(0); // bumped by retry()

  // Initial load
  useEffect(() => {
    if (!householdId) return;
    let active = true;
    setLoading(true);
    setError(null);

    (async () => {
      const { data, error } = await supabase
        .from('settlements')
        .select('*')
        .eq('household_id', householdId)
        .order('created_at', { ascending: true });

      if (!active) return;
      if (error) setError(error.message);
      else setSettlements((data ?? []) as Settlement[]);
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [householdId, attempt]);

  // Realtime: the partner recording a settlement updates our balance live.
  useEffect(() => {
    if (!householdId) return;
    const channel: RealtimeChannel = supabase
      .channel(`settle:${householdId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'settlements',
          filter: `household_id=eq.${householdId}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setSettlements((prev) => prev.filter((s) => s.id !== (payload.old as Settlement).id));
          } else {
            setSettlements((prev) => upsert(prev, payload.new as Settlement));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [householdId]);

  const balanceCents = useMemo(() => {
    if (!userId) return 0;
    // Each shared expense: the payer fronted the whole amount but owes only
    // half, so the partner owes the payer half of it.
    let cents = 0;
    for (const t of transactions) {
      if (t.scope !== 'shared') continue;
      cents += t.owner_id === userId ? toCents(t.amount) : -toCents(t.amount);
    }
    cents = Math.round(cents / 2);
    // A payback from me raises my balance toward zero; one to me lowers it.
    for (const s of settlements) {
      if (s.from_user === userId) cents += toCents(s.amount);
      else if (s.to_user === userId) cents -= toCents(s.amount);
    }
    return cents;
  }, [transactions, settlements, userId]);

  const settleUp = useCallback(async () => {
    if (!householdId || !userId || !partnerId || settling || balanceCents === 0) return;
    const from = balanceCents < 0 ? userId : partnerId; // the debtor pays
    const to = balanceCents < 0 ? partnerId : userId;

    setSettling(true);
    const { data, error } = await supabase
      .from('settlements')
      .insert({
        household_id: householdId,
        from_user: from,
        to_user: to,
        amount: Math.abs(balanceCents) / 100,
      })
      .select()
      .single();

    if (error) setError(error.message);
    else setSettlements((prev) => upsert(prev, data as Settlement)); // realtime echo merges as a no-op
    setSettling(false);
  }, [householdId, userId, partnerId, settling, balanceCents]);

  // Re-runs the initial load, which also clears a stuck error.
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const lastSettledOn = settlements.length
    ? settlements[settlements.length - 1].created_at.slice(0, 10)
    : null;

  return {
    balance: balanceCents / 100,
    settlements,
    lastSettledOn,
    loading,
    error,
    settling,
    settleUp,
    retry,
  };
}
