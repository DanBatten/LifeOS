/**
 * Backfill Missing Weekly Summaries
 *
 * Generates weekly summaries for weeks that are missing them.
 * Uses the same workflow as the Sunday cron job.
 *
 * Run: npx tsx scripts/backfill-weekly-summaries.ts
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Load env manually
const envContent = readFileSync('.env.local', 'utf8');
function getEnvVar(name: string): string {
  const match = envContent.match(new RegExp(`^${name}=(.+)$`, 'm'));
  return match ? match[1].trim() : '';
}

const SUPABASE_URL = getEnvVar('SUPABASE_URL');
const SUPABASE_SERVICE_KEY = getEnvVar('SUPABASE_SERVICE_KEY');
const ANTHROPIC_API_KEY = getEnvVar('ANTHROPIC_API_KEY');
const USER_ID = getEnvVar('USER_ID') || '00000000-0000-0000-0000-000000000001';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface TrainingPlanContext {
  name: string;
  description: string;
  goalEvent: string;
  totalWeeks: number;
  raceDate: string | null;
  weeksToRace: number | null;
  currentPhase: string | null;
}

async function getTrainingPlanContext(): Promise<TrainingPlanContext | null> {
  const { data } = await supabase
    .from('training_plans')
    .select('name, description, goal_event, total_weeks, metadata')
    .eq('user_id', USER_ID)
    .eq('status', 'active')
    .single();

  if (!data) return null;

  const metadata = (data.metadata || {}) as Record<string, unknown>;

  return {
    name: data.name,
    description: data.description,
    goalEvent: data.goal_event,
    totalWeeks: data.total_weeks,
    raceDate: metadata.race_date as string | null,
    weeksToRace: metadata.weeks_to_race as number | null,
    currentPhase: metadata.current_phase as string | null,
  };
}

interface WorkoutData {
  id: string;
  title: string;
  status: string;
  scheduledDate: string;
  prescribedDescription: string | null;
  prescribedDistanceMiles: number | null;
  actualDurationMinutes: number | null;
  actualDistanceMiles: number | null;
  actualPacePerMile: string | null;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  personalNotes: string | null;
  coachNotes: string | null;
  metadata: Record<string, unknown>;
}

interface HealthMetrics {
  date: string;
  restingHeartRate: number | null;
  hrvScore: number | null;
  sleepHours: number | null;
}

interface TrainingWeek {
  id: string;
  weekNumber: number;
  startDate: string;
  endDate: string;
  plannedVolumeMiles: number | null;
}

async function getWeeksNeedingSummaries(): Promise<TrainingWeek[]> {
  const { data } = await supabase
    .from('training_weeks')
    .select('id, week_number, start_date, end_date, planned_volume_miles, week_summary, status')
    .eq('user_id', USER_ID)
    .eq('status', 'completed')
    .order('week_number', { ascending: true });

  return (data || [])
    .filter(w => !w.week_summary || w.week_summary.trim().length === 0)
    .map(w => ({
      id: w.id,
      weekNumber: w.week_number,
      startDate: w.start_date,
      endDate: w.end_date,
      plannedVolumeMiles: w.planned_volume_miles,
    }));
}

async function getWeekWorkouts(startDate: string, endDate: string): Promise<WorkoutData[]> {
  const { data } = await supabase
    .from('workouts')
    .select('*')
    .eq('user_id', USER_ID)
    .gte('scheduled_date', startDate)
    .lte('scheduled_date', endDate)
    .order('scheduled_date', { ascending: true });

  return (data || []).map(w => {
    const metadata = (w.metadata || {}) as Record<string, unknown>;
    return {
      id: w.id,
      title: w.title,
      status: w.status,
      scheduledDate: w.scheduled_date,
      prescribedDescription: w.prescribed_description,
      prescribedDistanceMiles: w.prescribed_distance_miles,
      actualDurationMinutes: w.actual_duration_minutes,
      actualDistanceMiles: metadata.actual_distance_miles as number | null,
      actualPacePerMile: metadata.actual_pace as string | null,
      avgHeartRate: w.avg_heart_rate,
      maxHeartRate: w.max_heart_rate,
      personalNotes: w.personal_notes,
      coachNotes: w.coach_notes,
      metadata,
    };
  });
}

async function getWeekHealthMetrics(startDate: string, endDate: string): Promise<HealthMetrics[]> {
  const { data } = await supabase
    .from('health_metrics')
    .select('date, resting_heart_rate, hrv_score, sleep_hours')
    .eq('user_id', USER_ID)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true });

  return (data || []).map(m => ({
    date: m.date,
    restingHeartRate: m.resting_heart_rate,
    hrvScore: m.hrv_score,
    sleepHours: m.sleep_hours,
  }));
}

async function getPreviousSummaries(weekNumber: number): Promise<string[]> {
  const { data } = await supabase
    .from('training_weeks')
    .select('week_number, week_summary')
    .eq('user_id', USER_ID)
    .lt('week_number', weekNumber)
    .not('week_summary', 'is', null)
    .order('week_number', { ascending: false })
    .limit(2);

  return (data || [])
    .reverse()
    .map(w => `Week ${w.week_number}: ${w.week_summary?.substring(0, 400)}...`);
}

function calculateStats(workouts: WorkoutData[]) {
  const completed = workouts.filter(w => w.status === 'completed');
  const skipped = workouts.filter(w => w.status === 'skipped');

  let totalMiles = 0;
  let totalDuration = 0;
  let totalHR = 0;
  let hrCount = 0;

  for (const w of completed) {
    if (w.actualDistanceMiles) totalMiles += w.actualDistanceMiles;
    if (w.actualDurationMinutes) totalDuration += w.actualDurationMinutes;
    if (w.avgHeartRate) {
      totalHR += w.avgHeartRate;
      hrCount++;
    }
  }

  return {
    totalMiles: Math.round(totalMiles * 100) / 100,
    totalDuration,
    completed: completed.length,
    skipped: skipped.length,
    avgHR: hrCount > 0 ? Math.round(totalHR / hrCount) : null,
  };
}

function buildPrompt(
  weekNumber: number,
  workouts: WorkoutData[],
  health: HealthMetrics[],
  stats: ReturnType<typeof calculateStats>,
  plannedMiles: number | null,
  previousSummaries: string[],
  planContext: TrainingPlanContext | null
): string {
  const workoutDetails = workouts.map(w => {
    const status = w.status === 'completed' ? '✓' : w.status === 'skipped' ? '✗' : '○';
    const distance = w.actualDistanceMiles ? `${w.actualDistanceMiles.toFixed(2)} mi` : '';
    const pace = w.actualPacePerMile || '';
    const hr = w.avgHeartRate ? `HR ${w.avgHeartRate}` : '';
    const notes = w.personalNotes ? `\n   Notes: "${w.personalNotes.substring(0, 150)}"` : '';
    const analysis = w.coachNotes ? `\n   Analysis: ${w.coachNotes.substring(0, 250)}...` : '';

    return `${status} ${w.scheduledDate}: ${w.title}
   ${[distance, pace, hr].filter(Boolean).join(' | ')}${notes}${analysis}`;
  }).join('\n\n');

  const healthSummary = health.length > 0
    ? health.map(h => {
        const parts = [];
        if (h.restingHeartRate) parts.push(`RHR ${h.restingHeartRate}`);
        if (h.hrvScore) parts.push(`HRV ${h.hrvScore}`);
        if (h.sleepHours) parts.push(`Sleep ${h.sleepHours}h`);
        return parts.length > 0 ? `${h.date}: ${parts.join(', ')}` : null;
      }).filter(Boolean).join('\n')
    : 'Health metrics not available';

  const prevContext = previousSummaries.length > 0
    ? `\n## Previous Weeks\n${previousSummaries.join('\n\n')}`
    : '';

  // Build training plan context
  const planName = planContext?.name || 'Marathon Training';
  const totalWeeks = planContext?.totalWeeks || 16;
  const goalEvent = planContext?.goalEvent || 'LA Marathon';
  const raceDate = planContext?.raceDate ? new Date(planContext.raceDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'TBD';
  const weeksToRace = planContext?.weeksToRace || '?';
  const currentPhase = planContext?.currentPhase ? planContext.currentPhase.replace(/_/g, ' ') : 'training';

  return `You are an expert marathon running coach writing a weekly training summary for Week ${weekNumber} of a ${totalWeeks}-week training plan.

## Training Context
- **Plan:** ${planName}
- **Goal:** ${goalEvent} - Target 2:55
- **Race Date:** ${raceDate} (${weeksToRace} weeks away)
- **Current Phase:** ${currentPhase}

## Week ${weekNumber} Data

**Volume:** ${stats.totalMiles} miles completed (planned: ${plannedMiles || '?'} miles)
**Workouts:** ${stats.completed} completed, ${stats.skipped} skipped
**Avg HR:** ${stats.avgHR || 'N/A'} bpm
**Duration:** ${stats.totalDuration} minutes

## Workouts

${workoutDetails}

## Health Metrics

${healthSummary}
${prevContext}

---

Write a comprehensive weekly summary in 200-400 words. Use this style:
- Start with a one-sentence overall assessment
- Reference specific workout data (paces, HR, distances)
- Note patterns in health metrics (RHR trends, sleep)
- Mention any athlete notes and your analysis
- Comment on training load and adaptation
- End with a brief note about what this means going forward

Write in second person ("You completed..."). Be direct and analytical like an experienced coach who knows the athlete well. Don't use headers - write in flowing paragraphs.`;
}

async function generateSummary(prompt: string): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

async function saveSummary(weekId: string, summary: string, stats: ReturnType<typeof calculateStats>) {
  const { error } = await supabase
    .from('training_weeks')
    .update({
      week_summary: summary,
      actual_volume_miles: stats.totalMiles,
      actual_workouts_completed: stats.completed,
      actual_workouts_skipped: stats.skipped,
      total_duration_minutes: stats.totalDuration,
      updated_at: new Date().toISOString(),
    })
    .eq('id', weekId);

  if (error) throw error;
}

async function main() {
  console.log('\n🏃 Backfilling Missing Weekly Summaries\n');
  console.log('='.repeat(50) + '\n');

  const weeksNeeding = await getWeeksNeedingSummaries();
  const planContext = await getTrainingPlanContext();

  console.log(`Found ${weeksNeeding.length} weeks needing summaries: ${weeksNeeding.map(w => w.weekNumber).join(', ')}\n`);
  if (planContext) {
    console.log(`Plan: ${planContext.name}`);
    console.log(`Race: ${planContext.raceDate} (${planContext.weeksToRace} weeks away)\n`);
  }

  if (weeksNeeding.length === 0) {
    console.log('✅ All completed weeks have summaries!\n');
    return;
  }

  for (const week of weeksNeeding) {
    console.log(`\n📝 Generating summary for Week ${week.weekNumber}...`);

    try {
      // Gather data
      const workouts = await getWeekWorkouts(week.startDate, week.endDate);
      const health = await getWeekHealthMetrics(week.startDate, week.endDate);
      const stats = calculateStats(workouts);
      const previousSummaries = await getPreviousSummaries(week.weekNumber);

      console.log(`   Found ${workouts.length} workouts, ${health.length} health days`);
      console.log(`   Stats: ${stats.totalMiles} mi, ${stats.completed} completed, ${stats.skipped} skipped`);

      // Generate summary
      const prompt = buildPrompt(week.weekNumber, workouts, health, stats, week.plannedVolumeMiles, previousSummaries, planContext);
      const summary = await generateSummary(prompt);

      console.log(`   Generated ${summary.length} character summary`);

      // Save
      await saveSummary(week.id, summary, stats);
      console.log(`   ✅ Saved Week ${week.weekNumber} summary`);

      // Preview
      console.log(`\n   Preview: "${summary.substring(0, 150)}..."\n`);

      // Rate limiting pause
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      console.error(`   ❌ Error for Week ${week.weekNumber}:`, error);
    }
  }

  console.log('\n✨ Backfill complete!\n');
}

main();
