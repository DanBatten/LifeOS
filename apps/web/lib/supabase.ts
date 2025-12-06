import { createClient } from '@supabase/supabase-js';
import { getEnv } from './env';

// Simple untyped client - we'll use manual type assertions
let supabaseClient: ReturnType<typeof createClient> | null = null;

export function getSupabase() {
  if (supabaseClient) {
    return supabaseClient;
  }

  const env = getEnv();

  supabaseClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
    },
  });

  return supabaseClient;
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
