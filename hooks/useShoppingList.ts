import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useHousehold } from './useHousehold';

/**
 * Resolves the household's single shared shopping list, creating it on first use.
 * The MVP has one list per household, so we get-or-create rather than require a
 * migration to seed one — existing households keep working. The resolved id is
 * fed to useListItems, which owns the live item state.
 *
 * If a rare race creates two lists (both partners open the tab at the exact same
 * moment on a brand-new household), we deterministically pick the earliest one so
 * both devices converge on the same list.
 */
export function useShoppingList() {
  const { household } = useHousehold();
  const householdId = household?.id ?? null;
  const [listId, setListId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0); // bumped by retry()

  useEffect(() => {
    if (!householdId) {
      setListId(null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);

    (async () => {
      // Prefer an existing list (earliest wins for determinism).
      const { data: existing, error: selErr } = await supabase
        .from('shopping_lists')
        .select('id')
        .eq('household_id', householdId)
        .order('created_at', { ascending: true })
        .limit(1);
      if (!active) return;
      if (selErr) {
        setError(selErr.message);
        setLoading(false);
        return;
      }
      if (existing && existing.length > 0) {
        setListId(existing[0].id);
        setLoading(false);
        return;
      }

      // None yet — create the household's default list.
      const { data: created, error: insErr } = await supabase
        .from('shopping_lists')
        .insert({ household_id: householdId })
        .select('id')
        .single();
      if (!active) return;
      if (insErr) {
        setError(insErr.message);
        setLoading(false);
        return;
      }
      setListId(created.id);
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [householdId, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { listId, loading, error, retry };
}
