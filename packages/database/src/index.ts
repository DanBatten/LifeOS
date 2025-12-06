// Client exports
export {
  initializeDatabase,
  getSupabaseClient,
  getSupabaseServiceClient,
  createSupabaseClient,
} from './client.js';
export type { DatabaseConfig, SupabaseClient } from './client.js';

// Repository exports
export * from './repositories/index.js';
