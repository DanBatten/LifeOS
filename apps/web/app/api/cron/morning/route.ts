import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createLLMClient } from '@lifeos/llm';
import { Orchestrator } from '@lifeos/orchestrator';
import { getSupabaseService } from '@/lib/supabase';
import { getEnv } from '@/lib/env';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const headersList = headers();
  const authHeader = headersList.get('authorization');
  const env = getEnv();

  // Verify cron secret in production
  if (env.CRON_SECRET && authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getSupabaseService();
    const llmClient = createLLMClient(env.LLM_PROVIDER);

    // Create orchestrator
    const orchestrator = new Orchestrator(
      {
        userId: env.USER_ID,
        timezone: env.TIMEZONE,
      },
      llmClient,
      supabase
    );

    // Run morning flow
    const result = await orchestrator.runMorningFlow();

    // Log the run
    await supabase.from('agent_runs').insert({
      user_id: env.USER_ID,
      agent_id: 'orchestrator',
      run_type: 'scheduled',
      trigger_reason: 'morning_cron',
      output_result: {
        planSummary: result.dailyPlan.summary,
        agentCount: Object.keys(result.agentOutputs).length,
        whiteboardEntries: result.whiteboardEntries.length,
      },
      started_at: new Date(Date.now() - result.duration).toISOString(),
      completed_at: new Date().toISOString(),
      duration_ms: result.duration,
      status: 'completed',
    });

    return NextResponse.json({
      success: true,
      message: 'Morning flow completed',
      summary: result.dailyPlan.summary,
      duration: result.duration,
    });
  } catch (error) {
    console.error('Morning cron error:', error);

    return NextResponse.json(
      {
        error: 'Morning flow failed',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
