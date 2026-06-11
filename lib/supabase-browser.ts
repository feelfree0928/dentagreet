/**
 * lib/supabase-browser.ts
 *
 * Browser-side Supabase client using the ANON key.
 * Safe to use in client components — anon key is public by design.
 * RLS policies control what the anon key can access (none for sessions table).
 * All session mutations go through Route Handlers (server-side service role).
 */
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

let client: ReturnType<typeof createClient<Database>> | null = null;

export function getBrowserSupabaseClient() {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      'Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY'
    );
  }

  client = createClient<Database>(url, key);
  return client;
}
