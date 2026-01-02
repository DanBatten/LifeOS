export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { getEnv } from '@/lib/env';

// GET current settings
export async function GET() {
  const supabase = getSupabase();
  const env = getEnv();
  const userId = env.USER_ID;

  const { data: user, error } = await supabase
    .from('users')
    .select('id, name, email, timezone, preferences')
    .eq('id', userId)
    .single();

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }

  return NextResponse.json({
    timezone: user?.timezone || env.TIMEZONE,
    preferences: user?.preferences || {},
  });
}

// PATCH update settings
export async function PATCH(request: NextRequest) {
  const supabase = getSupabase();
  const env = getEnv();
  const userId = env.USER_ID;

  try {
    const body = await request.json();
    const { timezone, preferences } = body;

    // Validate timezone if provided
    if (timezone) {
      try {
        // Test if timezone is valid
        new Date().toLocaleString('en-US', { timeZone: timezone });
      } catch {
        return NextResponse.json({ error: 'Invalid timezone' }, { status: 400 });
      }
    }

    // Build update object
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (timezone) {
      updates.timezone = timezone;
    }

    if (preferences) {
      // Merge with existing preferences
      const { data: existing } = await supabase
        .from('users')
        .select('preferences')
        .eq('id', userId)
        .single();

      updates.preferences = {
        ...(existing?.preferences || {}),
        ...preferences,
      };
    }

    // Update user
    const { error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId);

    if (error) {
      console.error('[API:settings] Update error:', error);
      return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
    }

    return NextResponse.json({ success: true, timezone, preferences });
  } catch (err) {
    console.error('[API:settings] Error:', err);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

