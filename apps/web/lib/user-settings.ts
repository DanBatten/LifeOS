/**
 * User settings utilities
 * 
 * Fetches user preferences from the database with fallbacks to env vars.
 * Use this instead of directly accessing env.TIMEZONE to respect user preferences.
 */

import { getSupabase } from './supabase';
import { getEnv } from './env';

export interface UserSettings {
  timezone: string;
  userName: string;
  userId: string;
}

/**
 * Get user settings from database, with fallback to env vars
 */
export async function getUserSettings(userId?: string): Promise<UserSettings> {
  const env = getEnv();
  const effectiveUserId = userId || env.USER_ID;
  
  const supabase = getSupabase();
  
  const { data: user } = await supabase
    .from('users')
    .select('timezone, name')
    .eq('id', effectiveUserId)
    .single();
  
  return {
    userId: effectiveUserId,
    timezone: user?.timezone || env.TIMEZONE,
    userName: user?.name || 'User',
  };
}

/**
 * Get just the timezone for the current user
 */
export async function getUserTimezone(userId?: string): Promise<string> {
  const settings = await getUserSettings(userId);
  return settings.timezone;
}

