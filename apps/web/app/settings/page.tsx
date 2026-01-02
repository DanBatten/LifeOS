export const dynamic = 'force-dynamic';

import { getSupabase } from '@/lib/supabase';
import { getEnv } from '@/lib/env';
import { SettingsView } from './settings.view';

// Common timezones for quick selection
const COMMON_TIMEZONES = [
  { value: 'Pacific/Auckland', label: 'Auckland (NZDT)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEDT)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET)' },
  { value: 'America/New_York', label: 'New York (EST/EDT)' },
  { value: 'America/Chicago', label: 'Chicago (CST/CDT)' },
  { value: 'America/Denver', label: 'Denver (MST/MDT)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PST/PDT)' },
];

export default async function SettingsPage() {
  const supabase = getSupabase();
  const env = getEnv();
  const userId = env.USER_ID;

  // Fetch current user settings
  const { data: user } = await supabase
    .from('users')
    .select('id, name, email, timezone, preferences')
    .eq('id', userId)
    .single();

  const currentTimezone = user?.timezone || env.TIMEZONE;
  const preferences = (user?.preferences || {}) as Record<string, unknown>;

  return (
    <SettingsView
      userId={userId}
      currentTimezone={currentTimezone}
      userName={user?.name || 'User'}
      userEmail={user?.email || ''}
      preferences={preferences}
      commonTimezones={COMMON_TIMEZONES}
    />
  );
}

