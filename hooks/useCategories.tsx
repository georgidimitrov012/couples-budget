import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { Update } from '../lib/db';
import { useAuth } from './useAuth';
import { useHousehold } from './useHousehold';

export type CategoryScope = 'private' | 'shared';

export type Category = {
  id: string;
  household_id: string;
  owner_id: string;
  name: string;
  color: string | null;
  icon: string | null;
  scope: CategoryScope;
  monthly_limit: number | null;
};

const COLUMNS = 'id, household_id, owner_id, name, color, icon, scope, monthly_limit';

export type CategoryPatch = {
  name?: string;
  color?: string | null;
  icon?: string | null;
  scope?: CategoryScope;
  monthlyLimit?: number | null;
};

type CategoriesContextValue = {
  categories: Category[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addCategory: (input: {
    name: string;
    color?: string;
    icon?: string;
    scope: CategoryScope;
    monthlyLimit?: number | null;
  }) => Promise<{ error: string | null }>;
  updateCategory: (cat: Category, patch: CategoryPatch) => Promise<{ error: string | null }>;
  removeCategory: (cat: Category) => Promise<{ error: string | null }>;
};

const CategoriesContext = createContext<CategoriesContextValue | undefined>(undefined);

function byName(a: Category, b: Category) {
  return a.name.localeCompare(b.name);
}

/**
 * Household budget categories, following the same Yours/Mine/Ours rule as
 * transactions: RLS returns shared categories plus the caller's own private ones.
 * Kept in context (not a per-screen hook) so the budget's category picker and the
 * categories modal share one live list — adding a category shows up immediately in
 * both. (No realtime yet: a partner's newly-added *shared* category appears after a
 * refresh; see docs/SUPABASE_SETUP.md if we add categories to the publication.)
 */
export function CategoriesProvider({ children }: { children: ReactNode }) {
  const { household } = useHousehold();
  const { user } = useAuth();
  const householdId = household?.id ?? null;
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = useCallback(async (): Promise<Category[]> => {
    if (!householdId) return [];
    const { data, error } = await supabase
      .from('categories')
      .select(COLUMNS)
      .eq('household_id', householdId)
      .order('name', { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as Category[];
  }, [householdId]);

  useEffect(() => {
    if (!householdId) return;
    let active = true;
    fetchCategories()
      .then((rows) => {
        if (!active) return;
        setCategories(rows);
        setError(null);
        setLoading(false);
      })
      .catch((e: Error) => {
        if (!active) return;
        setError(e.message);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [householdId, fetchCategories]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setCategories(await fetchCategories());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [fetchCategories]);

  const addCategory = useCallback(
    async (input: {
      name: string;
      color?: string;
      icon?: string;
      scope: CategoryScope;
      monthlyLimit?: number | null;
    }) => {
      const uid = user?.id;
      if (!householdId || !uid) return { error: 'Not ready' };
      const name = input.name.trim();
      if (!name) return { error: 'Enter a category name.' };

      const { data, error } = await supabase
        .from('categories')
        .insert({
          household_id: householdId,
          owner_id: uid,
          name,
          color: input.color ?? null,
          icon: input.icon ?? null,
          scope: input.scope,
          monthly_limit: input.monthlyLimit ?? null,
        })
        .select(COLUMNS)
        .single();
      if (error) return { error: error.message };
      setCategories((prev) => [...prev, data as Category].sort(byName));
      return { error: null };
    },
    [householdId, user]
  );

  // Owner-only per RLS (categories_update: owner_id = auth.uid()). Used for the
  // monthly limit; optimistic with snapshot restore on failure.
  const updateCategory = useCallback(
    async (cat: Category, patch: CategoryPatch) => {
      const dbPatch: Update<'categories'> = {};
      const local: Partial<Category> = {};
      if (patch.name !== undefined) {
        dbPatch.name = patch.name;
        local.name = patch.name;
      }
      if (patch.color !== undefined) {
        dbPatch.color = patch.color;
        local.color = patch.color;
      }
      if (patch.icon !== undefined) {
        dbPatch.icon = patch.icon;
        local.icon = patch.icon;
      }
      if (patch.scope !== undefined) {
        dbPatch.scope = patch.scope;
        local.scope = patch.scope;
      }
      if (patch.monthlyLimit !== undefined) {
        dbPatch.monthly_limit = patch.monthlyLimit;
        local.monthly_limit = patch.monthlyLimit;
      }
      if (Object.keys(dbPatch).length === 0) return { error: null };

      const snapshot = categories;
      setCategories((prev) =>
        prev.map((c) => (c.id === cat.id ? { ...c, ...local } : c)).sort(byName)
      );
      const { error } = await supabase.from('categories').update(dbPatch).eq('id', cat.id);
      if (error) {
        setCategories(snapshot); // restore
        return { error: error.message };
      }
      return { error: null };
    },
    [categories]
  );

  const removeCategory = useCallback(
    async (cat: Category) => {
      const snapshot = categories;
      setCategories((prev) => prev.filter((c) => c.id !== cat.id));
      const { error } = await supabase.from('categories').delete().eq('id', cat.id);
      if (error) {
        setCategories(snapshot); // restore
        return { error: error.message };
      }
      return { error: null };
    },
    [categories]
  );

  return (
    <CategoriesContext.Provider
      value={{ categories, loading, error, refresh, addCategory, updateCategory, removeCategory }}>
      {children}
    </CategoriesContext.Provider>
  );
}

export function useCategories() {
  const ctx = useContext(CategoriesContext);
  if (!ctx) throw new Error('useCategories must be used within a <CategoriesProvider>');
  return ctx;
}
