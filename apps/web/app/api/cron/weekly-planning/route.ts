import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase';
import { createLLMClient } from '@lifeos/llm';
import { runWeeklyPlanning } from '@lifeos/workflows';
import { getEnv } from '@/lib/env';

/**
 * Weekly Planning Cron Endpoint
 *
 * Generates the upcoming week's training plan with adjustments and run plans.
 * Should be run on Sunday evening to prepare for the upcoming week.
 *
 * Cron schedule: 0 20 * * 0 (Sunday at 8pm)
 *
 * This endpoint:
 * 1. Assesses athlete readiness (HRV, sleep, training load trends)
 * 2. Reviews and adjusts upcoming week's workouts based on progression
 * 3. Generates run plans (shoes, nutrition, timing) for each workout
 * 4. Creates a motivating week preview message
 * 5. Writes the preview to the whiteboard
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const env = getEnv();

    if (env.CRON_SECRET && authHeader !== `Bearer ${env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`[WeeklyPlanning] Starting weekly planning for upcoming week`);

    const supabase = getSupabaseService();
    const llmClient = createLLMClient();

    const result = await runWeeklyPlanning(
      supabase,
      llmClient,
      env.USER_ID
    );

    const duration = Date.now() - startTime;

    console.log(`[WeeklyPlanning] Week ${result.weekNumber} planning complete in ${duration}ms`);
    console.log(`[WeeklyPlanning] Adjusted: ${result.adjustedWorkouts} workouts, ${result.nutritionPlansGenerated} nutrition plans`);

    return NextResponse.json({
      success: true,
      weekNumber: result.weekNumber,
      adjustedWorkouts: result.adjustedWorkouts,
      nutritionPlansGenerated: result.nutritionPlansGenerated,
      shoeAssignments: result.shoeAssignments,
      weekPreview: result.weekPreview,
      duration,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[WeeklyPlanning] Error: ${message}`);

    return NextResponse.json({
      success: false,
      error: message,
      duration,
    }, { status: 500 });
  }
}

// Also support GET for manual triggering/testing
export async function GET(request: NextRequest) {
  return POST(request);
}
