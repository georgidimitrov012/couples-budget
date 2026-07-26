import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { clampDay } from '../lib/recurring';
import { useAuth } from './useAuth';
import { useHousehold } from './useHousehold';

export type RecurringScope = 'private' | 'shared';

export type RecurringRule = {
  id: string;
  household_id: string;
  owner_id: string;
  category_id: string | null;
  amount: number;
  description: string | null;
  scope: RecurringScope;
  day_of_month: number;
  /** 'YYYY-MM' of the last month the scheduled job charged this rule; server-managed. */
  last_charged_month: string | null;
  created_at: string;
};

const COLUMNS =
  'id, household_id, owner_id, category_id, amount, description, scope, day_of_month, last_charged_month, created_at';

function byCreated(a: RecurringRule, b: RecurringRule) {
  return a.created_at.localeCompare(b.created_at);
}

/**
 * The signed-in user's own recurring rules (rent, subscriptions). Editing is
 * owner-only per RLS, so the management screen only deals with rules you own —
 * the scheduled DB job (apply_due_recurring) is what actually turns them into
 * transactions each month, which then arrive live via the transactions channel.
 */
export function useRecurringRules() {
  const { household } = useHousehold();
  const { user } = useAuth();
  const householdId = household?.id ?? null;
  const uid = user?.id ?? null;

  const [rules, setRules] = useState<RecurringRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!householdId || !uid) return;
    let active = true;
    setLoading(true);
    setError(null);

    (async () => {
      const { data, error } = await supabase
        .from('recurring_rules')
        .select(COLUMNS)
        .eq('household_id', householdId)
        .eq('owner_id', uid)
        .order('created_at', { ascending: true });

      if (!active) return;
      if (error) setError(error.message);
      else setRules(((data ?? []) as RecurringRule[]).sort(byCreated));
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [householdId, uid, attempt]);

  const addRule = useCallback(
    async (input: {
      amount: number;
      description?: string;
      scope: RecurringScope;
      categoryId?: string | null;
      dayOfMonth: number;
    }) => {
      if (!householdId || !uid) return { error: 'Not ready' };
      if (!Number.isFinite(input.amount) || input.amount <= 0) {
        return { error: 'Enter an amount.' };
      }

      const { data, error } = await supabase
        .from('recurring_rules')
        .insert({
          household_id: householdId,
          owner_id: uid,
          amount: input.amount,
          description: input.description?.trim() || null,
          scope: input.scope,
          category_id: input.categoryId ?? null,
          day_of_month: clampDay(input.dayOfMonth),
        })
        .select(COLUMNS)
        .single();

      if (error) return { error: error.message };
      setRules((prev) => [...prev, data as RecurringRule].sort(byCreated));
      return { error: null };
    },
    [householdId, uid]
  );

  const removeRule = useCallback(
    async (rule: RecurringRule) => {
      const snapshot = rules;
      setRules((prev) => prev.filter((r) => r.id !== rule.id));
      const { error } = await supabase.from('recurring_rules').delete().eq('id', rule.id);
      if (error) {
        setRules(snapshot); // restore
        setError(error.message);
        return { error: error.message };
      }
      return { error: null };
    },
    [rules]
  );

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { rules, loading, error, addRule, removeRule, retry };
}
