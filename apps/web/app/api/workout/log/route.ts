import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase';
import { getEnv } from '@/lib/env';

export const runtime = 'nodejs';

interface LogRunRequest {
  title: string;
  scheduledDate: string;
  distanceMiles: number;
  durationMinutes: number;
  avgPace?: string;
  avgHeartRate?: number;
  notes?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: LogRunRequest = await request.json();
    const env = getEnv();
    const supabase = getSupabaseService();

    const {
      title,
      scheduledDate,
      distanceMiles,
      durationMinutes,
      avgPace,
      avgHeartRate,
      notes,
    } = body;

    // Validate required fields
    if (!scheduledDate || !distanceMiles || !durationMinutes) {
      return NextResponse.json(
        { error: 'Missing required fields: scheduledDate, distanceMiles, durationMinutes' },
        { status: 400 }
      );
    }

    // Create workout record
    const workoutData = {
      user_id: env.USER_ID,
      title: title || `${distanceMiles} mile run`,
      workout_type: 'run',
      status: 'completed',
      scheduled_date: scheduledDate,
      actual_duration_minutes: Math.round(durationMinutes),
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      avg_heart_rate: avgHeartRate || null,
      notes: notes || null,
      source: 'manual',
      exercises: [],
      tags: ['manual-entry'],
      metadata: {
        distance_miles: distanceMiles,
        avg_pace: avgPace,
        logged_at: new Date().toISOString(),
      },
    };

    const { data, error } = await supabase
      .from('workouts')
      .insert(workoutData)
      .select()
      .single();

    if (error) {
      console.error('Failed to log workout:', error);
      return NextResponse.json(
        { error: `Failed to save workout: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      workout: data,
    });
  } catch (error) {
    console.error('Log workout error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
