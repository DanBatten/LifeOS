import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createLLMClient } from '@lifeos/llm';
import { runPostRunFlow } from '@lifeos/workflows';
import { getSupabase } from '@/lib/supabase';
import { getEnv } from '@/lib/env';

export const runtime = 'nodejs';
export const maxDuration = 60; // Garmin sync can take a moment

const SyncRequestSchema = z.object({
  date: z.string().optional(), // YYYY-MM-DD format, defaults to today
  forceResync: z.boolean().optional(),
  athleteFeedback: z.string().optional(),
  perceivedExertion: z.number().min(1).max(10).optional(),
});

/**
 * POST /api/workout/sync
 * 
 * Post-run workflow endpoint:
 * 1. Syncs latest activity from Garmin
 * 2. Generates coach analysis
 * 3. Saves notes to database
 * 4. Returns analysis for conversation
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { date, forceResync, athleteFeedback, perceivedExertion } = SyncRequestSchema.parse(body);

    const env = getEnv();
    const supabase = getSupabase();
    const llmClient = createLLMClient();

    // Run the post-run workflow
    const result = await runPostRunFlow(
      supabase,
      llmClient,
      env.USER_ID,
      env.TIMEZONE,
      {
        date,
        forceResync,
        athleteFeedback,
        perceivedExertion,
      }
    );

    return NextResponse.json({
      success: result.success,
      workout: result.workout,
      syncAction: result.syncAction,
      coachAnalysis: result.coachAnalysis,
      coachNotesSaved: result.coachNotesSaved,
      conversationStarter: result.conversationStarter,
      duration: result.duration,
      error: result.error,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('Workout sync error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to sync workout',
        details: error instanceof Error ? error.message : String(error),
        duration,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/workout/sync
 * 
 * Quick sync without analysis - just sync the activity
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const date = searchParams.get('date') || undefined;

  // Redirect to POST with minimal options
  const postRequest = new NextRequest(request.url, {
    method: 'POST',
    body: JSON.stringify({ date }),
    headers: { 'Content-Type': 'application/json' },
  });

  return POST(postRequest);
}


