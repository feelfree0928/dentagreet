/**
 * lib/supabase-server.ts
 *
 * Server-side Supabase client using the SERVICE ROLE key.
 * ONLY import this in Route Handlers (app/api/**) — never in client components.
 * The service role key bypasses RLS and must never reach the browser.
 *
 * We use the untyped client and cast results explicitly in each route handler
 * to avoid the `never` inference issue with custom Database generics.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type UntypedSupabaseClient = SupabaseClient<any, any, any>;

export function createServerSupabaseClient(): UntypedSupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY'
    );
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
