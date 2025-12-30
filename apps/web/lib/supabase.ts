import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getEnv } from './env';

// In serverless environments, create fresh clients to avoid stale connection issues
// The singleton pattern can cause problems with cached data in Vercel edge functions
let supabaseClient: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  // Always create fresh client in production to avoid caching issues
  // In development, we can reuse for performance
  if (process.env.NODE_ENV === 'development' && supabaseClient) {
    return supabaseClient;
  }

  const env = getEnv();

  const client = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
    },
    global: {
      // Disable fetch caching in Next.js
      fetch: (url, options = {}) => {
        return fetch(url, { ...options, cache: 'no-store' });
      },
    },
  });

  if (process.env.NODE_ENV === 'development') {
    supabaseClient = client;
  }

  return client;
}

// Helper to insert into any table with type safety at call site
export async function insertRecord<T extends Record<string, unknown>>(
  tableName: string,
  data: T
) {
  const supabase = getSupabase();
  return supabase.from(tableName).insert(data as never);
}

export function getSupabaseService() {
  const env = getEnv();

  if (!env.SUPABASE_SERVICE_KEY) {
    throw new Error('SUPABASE_SERVICE_KEY is required for service operations');
  }

  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
    auth: {
      persistSession: false,
    },
  });
}
