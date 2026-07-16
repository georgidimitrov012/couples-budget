import 'react-native-url-polyfill/auto';
import { AppState, Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';

import { ChunkedSecureStore } from './chunked-secure-store';
import type { Database } from './database.types';

// Regenerate `database.types.ts` after any schema change with `pnpm gen:types`
// (wraps `supabase gen types typescript --project-id <ref>`).

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
// Accept either the modern "publishable" key or the legacy "anon" key name.
// Both are referenced literally so Expo inlines them into the client bundle.
const supabaseKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or _ANON_KEY). ' +
      'Copy .env.example to .env and fill in your Supabase project values.'
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    // On web, leave storage undefined so supabase-js falls back to localStorage.
    storage: Platform.OS === 'web' ? undefined : (ChunkedSecureStore as any),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Only auto-refresh the session while the app is in the foreground.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
