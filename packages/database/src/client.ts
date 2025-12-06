import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ConfigError } from '@lifeos/core';

// Use a generic type alias to avoid strict generic parameter mismatches
type AnySupabaseClient = SupabaseClient<any, any, any>;

let supabaseClient: AnySupabaseClient | null = null;
let supabaseServiceClient: AnySupabaseClient | null = null;

export interface DatabaseConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceKey?: string;
}

/**
 * Initialize the Supabase client
 */
export function initializeDatabase(config: DatabaseConfig): void {
  if (!config.supabaseUrl) {
    throw new ConfigError('SUPABASE_URL is required', { configKey: 'SUPABASE_URL' });
  }
  if (!config.supabaseAnonKey) {
    throw new ConfigError('SUPABASE_ANON_KEY is required', { configKey: 'SUPABASE_ANON_KEY' });
  }

  supabaseClient = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      persistSession: false,
    },
  });

  if (config.supabaseServiceKey) {
    supabaseServiceClient = createClient(config.supabaseUrl, config.supabaseServiceKey, {
      auth: {
        persistSession: false,
      },
    });
  }
}

/**
 * Get the Supabase client (anon key - respects RLS)
 */
export function getSupabaseClient(): AnySupabaseClient {
  if (!supabaseClient) {
    // Try to initialize from environment
    const url = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!url || !anonKey) {
      throw new ConfigError('Database not initialized. Call initializeDatabase() first.');
    }

    initializeDatabase({
      supabaseUrl: url,
      supabaseAnonKey: anonKey,
      supabaseServiceKey: serviceKey,
    });
  }

  return supabaseClient!;
}

/**
 * Get the Supabase service client (bypasses RLS)
 * Use with caution - only for server-side operations
 */
export function getSupabaseServiceClient(): AnySupabaseClient {
  if (!supabaseServiceClient) {
    const url = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!url || !serviceKey) {
      throw new ConfigError(
        'Service client not available. Ensure SUPABASE_SERVICE_KEY is set.',
        { configKey: 'SUPABASE_SERVICE_KEY' }
      );
    }

    if (!supabaseClient) {
      initializeDatabase({
        supabaseUrl: url,
        supabaseAnonKey: process.env.SUPABASE_ANON_KEY!,
        supabaseServiceKey: serviceKey,
      });
    }
  }

  if (!supabaseServiceClient) {
    throw new ConfigError('Service client not initialized');
  }

  return supabaseServiceClient;
}

/**
 * Create a new Supabase client instance (for custom configurations)
 */
export function createSupabaseClient(
  url: string,
  key: string,
  options?: Parameters<typeof createClient>[2]
): AnySupabaseClient {
  return createClient(url, key, {
    auth: {
      persistSession: false,
    },
    ...options,
  });
}

export type { SupabaseClient, AnySupabaseClient };
