import { NextResponse } from 'next/server';
import { createLLMClient } from '@lifeos/llm';
import { runChatFlow } from '@lifeos/workflows';
import { getSupabaseService } from '@/lib/supabase';
import { getEnv } from '@/lib/env';
import { createTimeContext } from '@/lib/time-context';

type BriefingMeta = {
  kind: 'run_companion_briefing';
  timeOfDay: string;
  period: string;
  lastWorkoutMarker: string | null;
};

function todayDateString(timezone: string): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: timezone });
}

async function getLatestRunMarker(supabase: ReturnType<typeof getSupabaseService>, userId: string) {
  const { data } = await supabase
    .from('workouts')
    .select('updated_at, completed_at')
    .eq('user_id', userId)
    .eq('workout_type', 'run')
    .eq('status', 'completed')
    // supabase-js types support `nullsFirst`; `nullsLast` is equivalent to `nullsFirst: false`
    .order('completed_at', { ascending: false, nullsFirst: false })
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return (data.updated_at as string | null) || (data.completed_at as string | null) || null;
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
    .contains('tags', ['run-companion', 'auto-briefing'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  const metadata = (data.metadata || {}) as Partial<BriefingMeta>;
  if (metadata.kind !== 'run_companion_briefing') return null;

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
  const llmClient = createLLMClient();

  const timeContext = createTimeContext({ timezone: env.TIMEZONE, userName: 'Dan' });
  const dateStr = todayDateString(env.TIMEZONE);

  const timeOfDay = timeContext.timeOfDay; // morning / afternoon / evening
  const period = timeContext.period;

  const lastWorkoutMarker = await getLatestRunMarker(supabase, env.USER_ID);
  const cached = await getCachedBriefing(supabase, env.USER_ID, dateStr);

  const isFresh =
    cached &&
    cached.metadata.timeOfDay === timeOfDay &&
    cached.metadata.lastWorkoutMarker === lastWorkoutMarker;

  if (isFresh) {
    return NextResponse.json({ briefing: cached.content, cached: true });
  }

  // Generate a new briefing using the training coach context (not post-run)
  const prompt = `Generate my RUN-COMPANION briefing for ${timeContext.dateString} (${timeOfDay}).

## Goal
- Be a focused running coach (trainer personality), but acknowledge recovery + life context when relevant.
- Use the data already available in context: recent workouts, upcoming workouts, training plan, recovery metrics, and whiteboard.

## Output format
- 2–4 paragraphs of coaching narrative.
- Then a short bullet list titled "Today" with 3-5 action items (training, fueling, recovery, focus).
- Keep it tight and readable in a chat panel (no giant walls of text).
`;

  const result = await runChatFlow(
    supabase,
    llmClient,
    env.USER_ID,
    prompt,
    env.TIMEZONE,
    { context: 'training' }
  );

  const metadata: BriefingMeta = {
    kind: 'run_companion_briefing',
    timeOfDay,
    period,
    lastWorkoutMarker,
  };

  // Store as a whiteboard insight (we reuse existing enum types + tag it)
  await supabase.from('whiteboard_entries').insert({
    user_id: env.USER_ID,
    agent_id: 'training-coach',
    entry_type: 'insight',
    visibility: 'all',
    title: `Run Companion Briefing (${timeOfDay})`,
    content: result.response,
    priority: 40,
    context_date: dateStr,
    tags: ['run-companion', 'auto-briefing', timeOfDay],
    metadata,
    expires_at: new Date(Date.now() + 1000 * 60 * 60 * 12).toISOString(), // 12h
  });

  return NextResponse.json({ briefing: result.response, cached: false });
}





