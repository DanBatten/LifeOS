/**
 * Regenerate a specific week's summary with corrected data extraction
 *
 * Run: npx tsx scripts/regenerate-week-summary.ts 10
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

const weekNumber = parseInt(process.argv[2] || '10', 10);

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
  title: string;
  status: string;
  scheduledDate: string;
  prescribedDescription: string | null;
  prescribedDistanceMiles: number | null;
  prescribedPace: string | null;
  actualDistanceMiles: number | null;
  actualPace: string | null;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  personalNotes: string | null;
  coachNotes: string | null;
}

function extractDistance(metadata: Record<string, unknown>): number | null {
  // Check multiple possible fields
  if (metadata.actual_distance_miles) return metadata.actual_distance_miles as number;
  if (metadata.distanceMiles) return metadata.distanceMiles as number;
  if (metadata.distanceMeters) return (metadata.distanceMeters as number) / 1609.34;
  const garmin = metadata.garmin as Record<string, unknown> | undefined;
  if (garmin?.distance) return (garmin.distance as number) / 1609.34;
  return null;
}

function extractPace(metadata: Record<string, unknown>): string | null {
  if (metadata.actual_pace) return metadata.actual_pace as string;
  if (metadata.avgPace) return metadata.avgPace as string;
  return null;
}

async function getWeekData() {
  const { data: week } = await supabase
    .from('training_weeks')
    .select('*')
    .eq('week_number', weekNumber)
    .single();

  if (!week) {
    console.error(`Week ${weekNumber} not found`);
    process.exit(1);
  }

  const { data: workoutsRaw } = await supabase
    .from('workouts')
    .select('*')
    .eq('user_id', USER_ID)
    .gte('scheduled_date', week.start_date)
    .lte('scheduled_date', week.end_date)
    .order('scheduled_date', { ascending: true });

  const workouts: WorkoutData[] = (workoutsRaw || []).map(w => {
    const meta = (w.metadata || {}) as Record<string, unknown>;
    return {
      title: w.title,
      status: w.status,
      scheduledDate: w.scheduled_date,
      prescribedDescription: w.prescribed_description,
      prescribedDistanceMiles: w.prescribed_distance_miles,
      prescribedPace: w.prescribed_pace_per_mile,
      actualDistanceMiles: extractDistance(meta),
      actualPace: extractPace(meta),
      avgHeartRate: w.avg_heart_rate,
      maxHeartRate: w.max_heart_rate,
      personalNotes: w.personal_notes,
      coachNotes: w.coach_notes,
    };
  });

  return { week, workouts };
}

async function getPreviousSummaries(): Promise<string[]> {
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
  let totalHR = 0;
  let hrCount = 0;
  const paces: number[] = [];

  for (const w of completed) {
    if (w.actualDistanceMiles) totalMiles += w.actualDistanceMiles;
    if (w.avgHeartRate) {
      totalHR += w.avgHeartRate;
      hrCount++;
    }
    if (w.actualPace) {
      const match = w.actualPace.match(/(\d+):(\d+)/);
      if (match) {
        paces.push(parseInt(match[1]) * 60 + parseInt(match[2]));
      }
    }
  }

  let avgPace: string | null = null;
  if (paces.length > 0) {
    const avg = paces.reduce((a, b) => a + b, 0) / paces.length;
    avgPace = `${Math.floor(avg / 60)}:${String(Math.round(avg % 60)).padStart(2, '0')}/mi`;
  }

  return {
    totalMiles: Math.round(totalMiles * 100) / 100,
    completed: completed.length,
    skipped: skipped.length,
    avgHR: hrCount > 0 ? Math.round(totalHR / hrCount) : null,
    avgPace,
  };
}

function buildPrompt(
  workouts: WorkoutData[],
  stats: ReturnType<typeof calculateStats>,
  plannedMiles: number | null,
  previousSummaries: string[],
  planContext: TrainingPlanContext | null
): string {
  const workoutDetails = workouts
    .filter(w => w.status === 'completed')
    .map(w => {
      const distance = w.actualDistanceMiles ? `${w.actualDistanceMiles.toFixed(2)} mi` : '';
      const pace = w.actualPace || '';
      const hr = w.avgHeartRate ? `HR ${w.avgHeartRate}` : '';
      const prescribed = w.prescribedDescription || '';
      const notes = w.personalNotes ? `\n   Athlete notes: "${w.personalNotes.substring(0, 200)}"` : '';
      const analysis = w.coachNotes ? `\n   Workout analysis: ${w.coachNotes.substring(0, 300)}...` : '';

      return `✓ ${w.scheduledDate}: ${w.title}
   Prescribed: ${prescribed || w.prescribedDistanceMiles + ' mi'}
   Actual: ${[distance, pace, hr].filter(Boolean).join(' | ')}${notes}${analysis}`;
    }).join('\n\n');

  const prevContext = previousSummaries.length > 0
    ? `\n## Previous Weeks Context\n${previousSummaries.join('\n\n')}`
    : '';

  // Build training plan context section
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
**Avg Pace:** ${stats.avgPace || 'N/A'}
**Avg HR:** ${stats.avgHR || 'N/A'} bpm

## Completed Workouts

${workoutDetails}
${prevContext}

---

Write a comprehensive weekly summary in 250-400 words. Follow this style:
- Start with a one-sentence overall assessment of the week
- Reference specific workout data (paces, HR, distances)
- Note standout performances and what they indicate about fitness
- Comment on execution quality vs prescription
- End with what this means for the training trajectory considering how far we are from race day

IMPORTANT: Do NOT mention "6 weeks to marathon" or similar incorrect timelines. Use the actual race date and weeks to race from the context above.

Write in second person ("You completed..."). Be direct and analytical like an experienced coach. Write in flowing paragraphs without headers or bullet points.`;
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

async function main() {
  console.log(`\n📝 Regenerating Week ${weekNumber} Summary\n`);
  console.log('='.repeat(50) + '\n');

  const { week, workouts } = await getWeekData();
  const stats = calculateStats(workouts);
  const previousSummaries = await getPreviousSummaries();
  const planContext = await getTrainingPlanContext();

  console.log('Week dates:', week.start_date, 'to', week.end_date);
  console.log('Workouts found:', workouts.length);
  console.log('Stats:', stats);
  if (planContext) {
    console.log('Plan:', planContext.name);
    console.log('Race:', planContext.raceDate, `(${planContext.weeksToRace} weeks away)`);
  }
  console.log('');

  // Show workout details
  console.log('Workout breakdown:');
  workouts.forEach(w => {
    console.log(`  ${w.scheduledDate}: ${w.title}`);
    console.log(`    Status: ${w.status}, Distance: ${w.actualDistanceMiles?.toFixed(2) || 'N/A'} mi, HR: ${w.avgHeartRate || 'N/A'}`);
  });
  console.log('');

  const prompt = buildPrompt(workouts, stats, week.planned_volume_miles, previousSummaries, planContext);

  console.log('Generating summary...\n');
  const summary = await generateSummary(prompt);

  console.log('Generated summary:\n');
  console.log(summary);
  console.log('');

  // Save
  const { error } = await supabase
    .from('training_weeks')
    .update({
      week_summary: summary,
      actual_volume_miles: stats.totalMiles,
      actual_workouts_completed: stats.completed,
      actual_workouts_skipped: stats.skipped,
      updated_at: new Date().toISOString(),
    })
    .eq('id', week.id);

  if (error) {
    console.error('Failed to save:', error);
  } else {
    console.log('✅ Saved successfully!');
  }
}

main();
