export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { getEnv } from '@/lib/env';

export async function GET() {
  const supabase = getSupabase();
  const env = getEnv();
  const userId = env.USER_ID;

  // Query directly to find ALL workouts for Dec 20-31, including duplicates
  const { data: workouts, error } = await supabase
    .from('workouts')
    .select('id, title, scheduled_date, status, plan_id, external_id, created_at')
    .eq('user_id', userId)
    .gte('scheduled_date', '2025-12-20')
    .lte('scheduled_date', '2025-12-31')
    .order('scheduled_date', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Check for duplicates (multiple workouts on same date)
  type WorkoutRow = { id: string; title: string; scheduled_date: string; status: string; plan_id: string | null; external_id: string | null; created_at: string };
  const byDate: Record<string, WorkoutRow[]> = {};
  for (const w of (workouts || []) as WorkoutRow[]) {
    const date = w.scheduled_date;
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push(w);
  }

  const duplicates = Object.entries(byDate)
    .filter(([, arr]) => arr.length > 1)
    .map(([date, arr]) => ({ date, count: arr.length, workouts: arr }));

  const typedWorkouts = (workouts || []) as WorkoutRow[];
  
  return NextResponse.json({
    userId,
    totalWorkouts: typedWorkouts.length,
    duplicateDates: duplicates,
    allWorkouts: typedWorkouts.map(w => ({
      id: w.id,
      scheduledDate: w.scheduled_date,
      status: w.status,
      title: w.title?.substring(0, 40),
      hasPlan: !!w.plan_id,
      hasExternalId: !!w.external_id,
    })),
  });
}

