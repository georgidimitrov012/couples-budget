import 'react-native-url-polyfill/auto';
import { AppState, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';

// After you run `pnpm dlx supabase gen types typescript --project-id <ref> > lib/database.types.ts`,
// import the generated type and switch to `createClient<Database>(...)` below for full type safety:
//   import type { Database } from './database.types';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Copy .env.example to .env and fill in your Supabase project values.'
  );
}

// expo-secure-store caps each stored value at ~2KB, but Supabase sessions can be
// larger. This adapter transparently splits values into chunks so the auth token
// stays in the device keychain (never AsyncStorage). Keys use only [A-Za-z0-9._-].
const CHUNK_SIZE = 2000;

const ChunkedSecureStore = {
  async getItem(key: string): Promise<string | null> {
    const countRaw = await SecureStore.getItemAsync(`${key}__n`);
    if (countRaw == null) return SecureStore.getItemAsync(key); // legacy/plain value
    const count = parseInt(countRaw, 10);
    let value = '';
    for (let i = 0; i < count; i++) {
      const part = await SecureStore.getItemAsync(`${key}__${i}`);
      if (part == null) return null;
      value += part;
    }
    return value;
  },
  async setItem(key: string, value: string): Promise<void> {
    await ChunkedSecureStore.removeItem(key);
    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE));
    }
    await SecureStore.setItemAsync(`${key}__n`, String(chunks.length));
    await Promise.all(chunks.map((c, i) => SecureStore.setItemAsync(`${key}__${i}`, c)));
  },
  async removeItem(key: string): Promise<void> {
    const countRaw = await SecureStore.getItemAsync(`${key}__n`);
    await SecureStore.deleteItemAsync(key).catch(() => {});
    if (countRaw == null) return;
    const count = parseInt(countRaw, 10);
    await SecureStore.deleteItemAsync(`${key}__n`);
    await Promise.all(
      Array.from({ length: count }, (_, i) => SecureStore.deleteItemAsync(`${key}__${i}`))
    );
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
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
