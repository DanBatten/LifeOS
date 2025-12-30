import { NextResponse } from 'next/server';
import { createLLMClient } from '@lifeos/llm';
import { runChatFlow } from '@lifeos/workflows';
import { getSupabaseService } from '@/lib/supabase';
import { getEnv } from '@/lib/env';
import { createTimeContext } from '@/lib/time-context';

type BriefingMeta = {
  kind: 'home_companion_briefing';
  timeOfDay: string;
  period: string;
  lastWorkoutMarker: string | null;
  lastHealthMarker: string | null;
};

function todayDateString(timezone: string): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: timezone });
}

async function getLatestMarker(
  supabase: ReturnType<typeof getSupabaseService>,
  userId: string
): Promise<{ workout: string | null; health: string | null }> {
  const [{ data: w }, { data: h }] = await Promise.all([
    supabase
      .from('workouts')
      .select('updated_at, completed_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('health_snapshots')
      .select('updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const workout = w ? ((w.updated_at as string | null) || (w.completed_at as string | null) || null) : null;
  const health = h ? ((h.updated_at as string | null) || null) : null;
  return { workout, health };
}

async function getCachedBriefing(
  supabase: ReturnType<typeof getSupabaseService>,
  userId: string,
  dateStr: string
) {
  const { data } = await supabase
    .from('whiteboard_entries')
    .select('id, content, metadata, created_at')
    .eq('user_id', userId)
    .eq('context_date', dateStr)
    .contains('tags', ['home-companion', 'auto-briefing'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  const metadata = (data.metadata || {}) as Partial<BriefingMeta>;
  if (metadata.kind !== 'home_companion_briefing') return null;

  return {
    id: data.id as string,
    content: data.content as string,
    metadata,
    createdAt: data.created_at as string,
  };
}

export async function GET() {
  const env = getEnv();
  const supabase = getSupabaseService();

  try {
    const llmClient = createLLMClient();
    const timeContext = createTimeContext({ timezone: env.TIMEZONE, userName: 'Dan' });
    const dateStr = todayDateString(env.TIMEZONE);

    console.log(`[Briefing] Generating for ${dateStr} (${timeContext.timeOfDay})`);

    const { workout: lastWorkoutMarker, health: lastHealthMarker } = await getLatestMarker(supabase, env.USER_ID);
    const cached = await getCachedBriefing(supabase, env.USER_ID, dateStr);

    const isFresh =
      cached &&
      cached.metadata.timeOfDay === timeContext.timeOfDay &&
      cached.metadata.lastWorkoutMarker === lastWorkoutMarker &&
      cached.metadata.lastHealthMarker === lastHealthMarker;

    if (isFresh) {
      console.log(`[Briefing] Returning cached briefing for ${dateStr}`);
      return NextResponse.json({ briefing: cached.content, cached: true });
    }

    console.log(`[Briefing] No fresh cache, generating new briefing...`);

    const prompt = `Generate my HOME COMPANION briefing for ${timeContext.dateString} (${timeContext.timeOfDay}).

## Goal
- Provide a comprehensive overview across: training, recovery/health, and planning/focus.
- Use the data already available in context: health snapshots, workouts, training plan, whiteboard, tasks.

## Output format
- 3–5 short paragraphs (each 1–3 sentences).
- Include: training note, recovery note, and one planning/focus suggestion.
- End with a short bullet list titled "Today" (3–5 items).
- Keep it readable (no walls of text).
`;

    const result = await runChatFlow(
      supabase,
      llmClient,
      env.USER_ID,
      prompt,
      env.TIMEZONE,
      { context: 'default' }
    );

    console.log(`[Briefing] Generated successfully, saving to whiteboard...`);

    const metadata: BriefingMeta = {
      kind: 'home_companion_briefing',
      timeOfDay: timeContext.timeOfDay,
      period: timeContext.period,
      lastWorkoutMarker,
      lastHealthMarker,
    };

    await supabase.from('whiteboard_entries').insert({
      user_id: env.USER_ID,
      agent_id: 'workflow:morning-flow',
      entry_type: 'insight',
      visibility: 'all',
      title: `Home Briefing (${timeContext.timeOfDay})`,
      content: result.response,
      priority: 40,
      context_date: dateStr,
      tags: ['home-companion', 'auto-briefing', timeContext.timeOfDay],
      metadata,
      expires_at: new Date(Date.now() + 1000 * 60 * 60 * 12).toISOString(), // 12h
    });

    return NextResponse.json({ briefing: result.response, cached: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[Briefing] Error generating briefing:`, message);
    
    return NextResponse.json(
      { 
        error: 'Failed to generate briefing', 
        details: message,
        briefing: null 
      },
      { status: 500 }
    );
  }
}







