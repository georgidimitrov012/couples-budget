import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export type Household = {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
  created_at: string;
};

export type HouseholdMember = {
  user_id: string;
  role: string;
  joined_at: string;
  display_name: string | null;
};

type HouseholdContextValue = {
  household: Household | null;
  members: HouseholdMember[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createHousehold: (name?: string) => Promise<{ error: string | null }>;
  joinHousehold: (code: string) => Promise<{ error: string | null }>;
  leaveHousehold: () => Promise<{ error: string | null }>;
};

const HouseholdContext = createContext<HouseholdContextValue | undefined>(undefined);

/**
 * Loads the signed-in user's household (a couple, max 2 members) and keeps the
 * member list in sync in real time — so the creator sees their partner appear
 * the moment they join. Mounted inside (app), so it only runs when authenticated.
 *
 * Fetchers are pure (they return data); state is only set inside async callbacks
 * and event handlers, never synchronously from within an effect.
 */
export function HouseholdProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // profiles has no direct FK to household_members (both point at auth.users), so
  // fetch display names in a second query and merge them in.
  const fetchMembers = useCallback(async (householdId: string): Promise<HouseholdMember[]> => {
    const { data: mem, error: memErr } = await supabase
      .from('household_members')
      .select('user_id, role, joined_at')
      .eq('household_id', householdId)
      .order('joined_at', { ascending: true });
    if (memErr) throw new Error(memErr.message);
    const rows = mem ?? [];
    const ids = rows.map((m) => m.user_id);
    const names: Record<string, string | null> = {};
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles').select('id, display_name').in('id', ids);
      for (const p of profs ?? []) names[p.id] = p.display_name;
    }
    return rows.map((m) => ({ ...m, display_name: names[m.user_id] ?? null }));
  }, []);

  // RLS scopes households to the ones the user belongs to, so this returns their
  // single household (or none).
  const fetchHousehold = useCallback(async (): Promise<{
    household: Household | null;
    members: HouseholdMember[];
  }> => {
    const { data: hh, error: hhErr } = await supabase
      .from('households')
      .select('*')
      .limit(1)
      .maybeSingle();
    if (hhErr) throw new Error(hhErr.message);
    const found = (hh as Household) ?? null;
    const memberList = found ? await fetchMembers(found.id) : [];
    return { household: found, members: memberList };
  }, [fetchMembers]);

  // Initial load for the signed-in user. This provider is mounted inside (app),
  // so it only renders while authenticated; sign-out unmounts it entirely.
  useEffect(() => {
    if (!user) return;
    let active = true;
    fetchHousehold()
      .then((res) => {
        if (!active) return;
        setHousehold(res.household);
        setMembers(res.members);
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
  }, [user, fetchHousehold]);

  // Realtime: watch membership changes for our household (partner joining/leaving).
  const householdId = household?.id ?? null;
  useEffect(() => {
    if (!householdId) return;
    const channel: RealtimeChannel = supabase
      .channel(`household:${householdId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'household_members',
          filter: `household_id=eq.${householdId}`,
        },
        () => {
          fetchMembers(householdId)
            .then(setMembers)
            .catch(() => {});
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [householdId, fetchMembers]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchHousehold();
      setHousehold(res.household);
      setMembers(res.members);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [fetchHousehold]);

  const createHousehold = useCallback(
    async (name?: string) => {
      const { data, error: rpcErr } = await supabase.rpc('create_household', {
        p_name: name?.trim() ?? '',
      });
      if (rpcErr) return { error: rpcErr.message };
      const hh = data as Household;
      setHousehold(hh);
      setMembers(await fetchMembers(hh.id));
      return { error: null };
    },
    [fetchMembers]
  );

  const joinHousehold = useCallback(
    async (code: string) => {
      const { data, error: rpcErr } = await supabase.rpc('join_household', { p_code: code.trim() });
      if (rpcErr) return { error: rpcErr.message };
      const hh = data as Household;
      setHousehold(hh);
      setMembers(await fetchMembers(hh.id));
      return { error: null };
    },
    [fetchMembers]
  );

  // Exit the current household. The RPC cleans up server-side (deletes the
  // household if we were the last member, otherwise hands it to the partner);
  // clearing local state flips the (app) guard back to create/join onboarding.
  const leaveHousehold = useCallback(async () => {
    const { error: rpcErr } = await supabase.rpc('leave_household');
    if (rpcErr) return { error: rpcErr.message };
    setHousehold(null);
    setMembers([]);
    return { error: null };
  }, []);

  return (
    <HouseholdContext.Provider
      value={{ household, members, loading, error, refresh, createHousehold, joinHousehold, leaveHousehold }}>
      {children}
    </HouseholdContext.Provider>
  );
}

export function useHousehold() {
  const ctx = useContext(HouseholdContext);
  if (!ctx) throw new Error('useHousehold must be used within a <HouseholdProvider>');
  return ctx;
}
