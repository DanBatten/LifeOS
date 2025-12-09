import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseService } from '@/lib/supabase';
import { createLLMClient } from '@lifeos/llm';
import { runWeeklySummaryWorkflow } from '@lifeos/workflows';
import { getEnv } from '@/lib/env';

/**
 * Weekly Summary Cron Endpoint
 *
 * Generates a comprehensive weekly training summary.
 * Should be run on Sunday at 6pm to summarize the completed week.
 *
 * Cron schedule: 0 18 * * 0 (Sunday at 6pm)
 *
 * This endpoint:
 * 1. Aggregates all workout data from the current week
 * 2. Pulls health metrics (HRV, sleep, resting HR)
 * 3. Uses the training coach agent to analyze and create the summary
 * 4. Saves the summary to the training_weeks table
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

    // Parse optional date parameter (for backfilling)
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');
    const targetDate = dateParam ? new Date(dateParam) : new Date();

    console.log(`[WeeklySummary] Starting weekly summary for ${targetDate.toISOString().split('T')[0]}`);

    const supabase = getSupabaseService();
    const llmClient = createLLMClient();

    const result = await runWeeklySummaryWorkflow(
      supabase,
      llmClient,
      env.USER_ID,
      targetDate
    );

    const duration = Date.now() - startTime;

    if (result.success) {
      console.log(`[WeeklySummary] Week ${result.weekNumber} summary generated in ${duration}ms`);
      console.log(`[WeeklySummary] Stats: ${result.weekStats.totalMiles} mi, ${result.weekStats.workoutsCompleted} workouts`);

      return NextResponse.json({
        success: true,
        weekNumber: result.weekNumber,
        weekStats: result.weekStats,
        summaryLength: result.summary?.length || 0,
        duration,
      });
    } else {
      console.error(`[WeeklySummary] Failed: ${result.error}`);

      return NextResponse.json({
        success: false,
        error: result.error,
        duration,
      }, { status: 500 });
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[WeeklySummary] Error: ${message}`);

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
