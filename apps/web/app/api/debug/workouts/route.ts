export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { getEnv } from '@/lib/env';
import { WorkoutRepository } from '@lifeos/database';

export async function GET() {
  const supabase = getSupabase();
  const env = getEnv();
  const userId = env.USER_ID;

  const workoutRepo = new WorkoutRepository(supabase);

  // Get workouts from Dec 23-31
  const startDate = new Date('2025-12-23');
  const endDate = new Date('2025-12-31');

  const workouts = await workoutRepo.findByDateRange(userId, startDate, endDate);

  return NextResponse.json({
    userId,
    workoutCount: workouts.length,
    workouts: workouts.map(w => ({
      scheduledDate: w.scheduledDate,
      status: w.status,
      title: w.title?.substring(0, 40),
    })),
  });
}

