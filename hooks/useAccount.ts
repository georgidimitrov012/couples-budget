import { useCallback } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Account-level actions that outlive a single household. `deleteAccount()` runs
 * the `delete_account()` RPC (which cleans up the user's data and removes their
 * auth user server-side), then clears the local session so the app routes back
 * to the auth screen. Sign-out uses `local` scope because the auth user is gone
 * by then — a global revoke would just fail against a deleted user.
 */
export function useAccount() {
  const deleteAccount = useCallback(async (): Promise<{ error: string | null }> => {
    const { error } = await supabase.rpc('delete_account');
    if (error) return { error: error.message };
    await supabase.auth.signOut({ scope: 'local' });
    return { error: null };
  }, []);

  return { deleteAccount };
}
