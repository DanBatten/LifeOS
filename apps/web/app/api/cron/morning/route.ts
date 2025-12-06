import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createLLMClient } from '@lifeos/llm';
import { runMorningFlow } from '@lifeos/workflows';
import { getSupabaseService } from '@/lib/supabase';
import { getEnv } from '@/lib/env';

export const runtime = 'nodejs';
export const maxDuration = 120; // Allow time for Garmin sync + agent analysis

/**
 * Morning Flow Cron Endpoint
 * 
 * Scheduled to run at 6:05 AM daily:
 * 1. Syncs Garmin health data to database
 * 2. Runs health agent analysis
 * 3. Runs training coach analysis
 * 4. Writes findings to whiteboard
 * 
 * After this runs, user can log in and see everything ready.
 */
export async function GET(request: NextRequest) {
  const headersList = headers();
  const authHeader = headersList.get('authorization');
  const env = getEnv();

  // Verify cron secret in production
  if (env.CRON_SECRET && authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    const supabase = getSupabaseService();
    const llmClient = createLLMClient();

    // Parse optional query params
    const searchParams = request.nextUrl.searchParams;
    const skipGarmin = searchParams.get('skipGarmin') === 'true';
    const skipHealth = searchParams.get('skipHealth') === 'true';
    const skipTraining = searchParams.get('skipTraining') === 'true';

    // Run the morning workflow
    const result = await runMorningFlow(
      supabase,
      llmClient,
      env.USER_ID,
      env.TIMEZONE,
      {
        skipGarminSync: skipGarmin,
        skipHealthAnalysis: skipHealth,
        skipTrainingAnalysis: skipTraining,
      }
    );

    // Log the run
    await supabase.from('agent_runs').insert({
      user_id: env.USER_ID,
      agent_id: 'workflow:morning-flow',
      run_type: 'scheduled',
      trigger_reason: 'morning_cron',
      output_result: {
        garminSync: result.garminSync,
        healthAnalysis: {
          success: result.healthAnalysis.success,
          recoveryScore: result.healthAnalysis.recoveryScore,
          concernCount: result.healthAnalysis.concerns.length,
        },
        trainingAnalysis: {
          success: result.trainingAnalysis.success,
        },
        whiteboardEntries: result.whiteboardEntries,
      },
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date().toISOString(),
      duration_ms: result.duration,
      status: result.success ? 'completed' : 'partial',
      error_message: result.errors.length > 0 ? result.errors[0] : null,
    });

    return NextResponse.json({
      success: result.success,
      message: 'Morning flow completed',
      garminSync: result.garminSync,
      healthAnalysis: {
        success: result.healthAnalysis.success,
        summary: result.healthAnalysis.summary,
        recoveryScore: result.healthAnalysis.recoveryScore,
      },
      trainingAnalysis: {
        success: result.trainingAnalysis.success,
        summary: result.trainingAnalysis.summary,
      },
      whiteboardEntries: result.whiteboardEntries,
      duration: result.duration,
      errors: result.errors,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('Morning flow error:', error);

    // Log the failure
    const supabase = getSupabaseService();
    await supabase.from('agent_runs').insert({
      user_id: env.USER_ID,
      agent_id: 'workflow:morning-flow',
      run_type: 'scheduled',
      trigger_reason: 'morning_cron',
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date().toISOString(),
      duration_ms: duration,
      status: 'failed',
      error_message: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        error: 'Morning flow failed',
        details: error instanceof Error ? error.message : String(error),
        duration,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
