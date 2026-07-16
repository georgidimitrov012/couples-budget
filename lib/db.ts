import type { Database } from './database.types';

/**
 * Convenience aliases over the generated Supabase types, so hooks can name a
 * table's Row/Insert/Update shape without spelling out the full nested path.
 * Regenerate `database.types.ts` with `pnpm gen:types` after a schema change.
 */
export type Row<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type Insert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type Update<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
