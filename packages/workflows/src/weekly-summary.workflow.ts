/**
 * Weekly Summary Workflow
 *
 * Generates a comprehensive weekly training summary by:
 * 1. Aggregating all workout data from the week
 * 2. Pulling health metrics (HRV, sleep, resting HR)
 * 3. Using the training coach agent to analyze and create the summary
 * 4. Saving the summary to the training_weeks table
 *
 * Run on Sunday at 6pm to summarize the completed week.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { LLMProvider, LLMResponse } from '@lifeos/llm';

export interface WeeklySummaryResult {
  success: boolean;
  weekNumber: number;
  summary: string | null;
  weekStats: {
    totalMiles: number;
    totalDuration: number;
    workoutsCompleted: number;
    workoutsSkipped: number;
    avgHeartRate: number | null;
    avgPace: string | null;
  };
  error?: string;
}

interface WorkoutData {
  id: string;
  title: string;
  workoutType: string;
  status: string;
  scheduledDate: string;
  prescribedDescription: string | null;
  prescribedDistanceMiles: number | null;
  prescribedPacePerMile: string | null;
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
  bodyBattery: number | null;
}

interface TrainingWeek {
  id: string;
  weekNumber: number;
  startDate: string;
  endDate: string;
  plannedVolumeMiles: number | null;
  plannedWorkouts: number | null;
  status: string;
}

interface TrainingPlanContext {
  name: string;
  description: string;
  goalEvent: string;
  totalWeeks: number;
  raceDate: string | null;
  weeksToRace: number | null;
  currentPhase: string | null;
}

/**
 * Get training plan context for prompts
 */
async function getTrainingPlanContext(
  supabase: SupabaseClient,
  userId: string
): Promise<TrainingPlanContext | null> {
  const { data } = await supabase
    .from('training_plans')
    .select('name, description, goal_event, total_weeks, metadata')
    .eq('user_id', userId)
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

/**
 * Get the current training week based on date
 */
async function getCurrentTrainingWeek(
  supabase: SupabaseClient,
  userId: string,
  targetDate: Date
): Promise<TrainingWeek | null> {
  const dateStr = targetDate.toISOString().split('T')[0];

  const { data } = await supabase
    .from('training_weeks')
    .select('id, week_number, start_date, end_date, planned_volume_miles, planned_workouts, status')
    .eq('user_id', userId)
    .lte('start_date', dateStr)
    .gte('end_date', dateStr)
    .single();

  if (!data) return null;

  return {
    id: data.id,
    weekNumber: data.week_number,
    startDate: data.start_date,
    endDate: data.end_date,
    plannedVolumeMiles: data.planned_volume_miles,
    plannedWorkouts: data.planned_workouts,
    status: data.status,
  };
}

/**
 * Fetch all workouts for a given week
 */
async function getWeekWorkouts(
  supabase: SupabaseClient,
  userId: string,
  startDate: string,
  endDate: string
): Promise<WorkoutData[]> {
  const { data } = await supabase
    .from('workouts')
    .select(`
      id, title, workout_type, status, scheduled_date,
      prescribed_description, prescribed_distance_miles, prescribed_pace_per_mile,
      actual_duration_minutes, avg_heart_rate, max_heart_rate,
      personal_notes, coach_notes, metadata
    `)
    .eq('user_id', userId)
    .gte('scheduled_date', startDate)
    .lte('scheduled_date', endDate)
    .order('scheduled_date', { ascending: true });

  return (data || []).map(w => {
    const metadata = (w.metadata || {}) as Record<string, unknown>;
    return {
      id: w.id,
      title: w.title,
      workoutType: w.workout_type,
      status: w.status,
      scheduledDate: w.scheduled_date,
      prescribedDescription: w.prescribed_description,
      prescribedDistanceMiles: w.prescribed_distance_miles,
      prescribedPacePerMile: w.prescribed_pace_per_mile,
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

/**
 * Fetch health metrics for the week
 */
async function getWeekHealthMetrics(
  supabase: SupabaseClient,
  userId: string,
  startDate: string,
  endDate: string
): Promise<HealthMetrics[]> {
  const { data } = await supabase
    .from('health_metrics')
    .select('date, resting_heart_rate, hrv_score, sleep_hours, body_battery_high')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true });

  return (data || []).map(m => ({
    date: m.date,
    restingHeartRate: m.resting_heart_rate,
    hrvScore: m.hrv_score,
    sleepHours: m.sleep_hours,
    bodyBattery: m.body_battery_high,
  }));
}

/**
 * Get previous weekly summaries for context
 */
async function getPreviousWeekSummaries(
  supabase: SupabaseClient,
  userId: string,
  currentWeekNumber: number,
  count: number = 3
): Promise<string[]> {
  const { data } = await supabase
    .from('training_weeks')
    .select('week_number, week_summary')
    .eq('user_id', userId)
    .lt('week_number', currentWeekNumber)
    .not('week_summary', 'is', null)
    .order('week_number', { ascending: false })
    .limit(count);

  return (data || [])
    .reverse()
    .map(w => `**Week ${w.week_number}:** ${w.week_summary?.substring(0, 500)}...`);
}

/**
 * Calculate week statistics
 */
function calculateWeekStats(workouts: WorkoutData[]): WeeklySummaryResult['weekStats'] {
  const completedWorkouts = workouts.filter(w => w.status === 'completed');
  const skippedWorkouts = workouts.filter(w => w.status === 'skipped');

  let totalMiles = 0;
  let totalDuration = 0;
  let totalHeartRate = 0;
  let hrCount = 0;
  const paces: number[] = [];

  for (const w of completedWorkouts) {
    if (w.actualDistanceMiles) totalMiles += w.actualDistanceMiles;
    if (w.actualDurationMinutes) totalDuration += w.actualDurationMinutes;
    if (w.avgHeartRate) {
      totalHeartRate += w.avgHeartRate;
      hrCount++;
    }
    if (w.actualPacePerMile) {
      const [min, sec] = w.actualPacePerMile.replace('/mi', '').split(':').map(Number);
      if (!isNaN(min) && !isNaN(sec)) {
        paces.push(min * 60 + sec);
      }
    }
  }

  let avgPace: string | null = null;
  if (paces.length > 0) {
    const avgPaceSeconds = paces.reduce((a, b) => a + b, 0) / paces.length;
    const mins = Math.floor(avgPaceSeconds / 60);
    const secs = Math.round(avgPaceSeconds % 60);
    avgPace = `${mins}:${String(secs).padStart(2, '0')}/mi`;
  }

  return {
    totalMiles: Math.round(totalMiles * 100) / 100,
    totalDuration: Math.round(totalDuration),
    workoutsCompleted: completedWorkouts.length,
    workoutsSkipped: skippedWorkouts.length,
    avgHeartRate: hrCount > 0 ? Math.round(totalHeartRate / hrCount) : null,
    avgPace,
  };
}

/**
 * Build the prompt for the weekly summary
 */
function buildWeeklySummaryPrompt(
  weekNumber: number,
  workouts: WorkoutData[],
  healthMetrics: HealthMetrics[],
  weekStats: WeeklySummaryResult['weekStats'],
  plannedVolume: number | null,
  previousSummaries: string[],
  planContext: TrainingPlanContext | null
): string {
  // Format workout details
  const workoutDetails = workouts.map(w => {
    const status = w.status === 'completed' ? '✓' : w.status === 'skipped' ? '✗' : '○';
    const distance = w.actualDistanceMiles ? `${w.actualDistanceMiles.toFixed(2)} mi` : (w.prescribedDistanceMiles ? `(planned ${w.prescribedDistanceMiles} mi)` : '');
    const pace = w.actualPacePerMile || '';
    const hr = w.avgHeartRate ? `HR ${w.avgHeartRate}` : '';
    const personalNote = w.personalNotes ? `\n   Athlete notes: "${w.personalNotes.substring(0, 200)}"` : '';
    const coachNote = w.coachNotes ? `\n   Workout analysis: ${w.coachNotes.substring(0, 300)}...` : '';

    return `${status} ${w.scheduledDate}: ${w.title}
   ${distance} ${pace} ${hr}${personalNote}${coachNote}`;
  }).join('\n\n');

  // Format health metrics
  const healthSummary = healthMetrics.length > 0
    ? healthMetrics.map(h => {
        const metrics = [];
        if (h.restingHeartRate) metrics.push(`RHR ${h.restingHeartRate}`);
        if (h.hrvScore) metrics.push(`HRV ${h.hrvScore}`);
        if (h.sleepHours) metrics.push(`Sleep ${h.sleepHours}h`);
        return `${h.date}: ${metrics.join(', ')}`;
      }).join('\n')
    : 'No health metrics available';

  // Previous context
  const previousContext = previousSummaries.length > 0
    ? `## Previous Weeks Context\n${previousSummaries.join('\n\n')}`
    : '';

  // Build training plan context section
  const planName = planContext?.name || 'Marathon Training';
  const totalWeeks = planContext?.totalWeeks || 16;
  const goalEvent = planContext?.goalEvent || 'LA Marathon';
  const raceDate = planContext?.raceDate ? new Date(planContext.raceDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'TBD';
  const weeksToRace = planContext?.weeksToRace || '?';
  const currentPhase = planContext?.currentPhase ? planContext.currentPhase.replace(/_/g, ' ') : 'training';

  return `You are a marathon training coach analyzing Week ${weekNumber} of a ${totalWeeks}-week training plan.

## Training Context
- **Plan:** ${planName}
- **Goal:** ${goalEvent} - Target 2:55
- **Race Date:** ${raceDate} (${weeksToRace} weeks away)
- **Current Phase:** ${currentPhase}

## Week ${weekNumber} Summary Data

**Volume:** ${weekStats.totalMiles} miles completed (planned: ${plannedVolume || '?'} miles)
**Workouts:** ${weekStats.workoutsCompleted} completed, ${weekStats.workoutsSkipped} skipped
**Avg Pace:** ${weekStats.avgPace || 'N/A'}
**Avg HR:** ${weekStats.avgHeartRate || 'N/A'} bpm
**Total Duration:** ${weekStats.totalDuration} minutes

## Workout Details

${workoutDetails}

## Health Metrics

${healthSummary}

${previousContext}

---

Write a comprehensive weekly training summary. Include:

1. **Opening statement** - One sentence summary of how the week went overall
2. **Key accomplishments** - What went well, PRs, strong executions
3. **Areas of concern** - Any warning signs, missed workouts, fatigue indicators
4. **Training load assessment** - Was the volume appropriate? How did the body respond?
5. **Looking ahead** - Brief note on what to focus on next week, considering where we are in the training cycle

Keep the tone supportive but analytical. Reference specific data points. Do NOT mention "6 weeks to marathon" or similar - use the actual weeks to race from the context above.

Write in second person ("You completed...") and keep the summary to 300-500 words.`;
}

/**
 * Run the weekly summary workflow
 */
export async function runWeeklySummaryWorkflow(
  supabase: SupabaseClient,
  llmClient: LLMProvider,
  userId: string,
  targetDate?: Date
): Promise<WeeklySummaryResult> {
  const date = targetDate || new Date();

  try {
    // 1. Get the training week
    const trainingWeek = await getCurrentTrainingWeek(supabase, userId, date);
    if (!trainingWeek) {
      return {
        success: false,
        weekNumber: 0,
        summary: null,
        weekStats: { totalMiles: 0, totalDuration: 0, workoutsCompleted: 0, workoutsSkipped: 0, avgHeartRate: null, avgPace: null },
        error: 'No training week found for the given date',
      };
    }

    // 2. Get all workouts for the week
    const workouts = await getWeekWorkouts(supabase, userId, trainingWeek.startDate, trainingWeek.endDate);

    // 3. Get health metrics for the week
    const healthMetrics = await getWeekHealthMetrics(supabase, userId, trainingWeek.startDate, trainingWeek.endDate);

    // 4. Calculate stats
    const weekStats = calculateWeekStats(workouts);

    // 5. Get previous summaries for context
    const previousSummaries = await getPreviousWeekSummaries(supabase, userId, trainingWeek.weekNumber);

    // 6. Get training plan context
    const planContext = await getTrainingPlanContext(supabase, userId);

    // 7. Build prompt and generate summary
    const prompt = buildWeeklySummaryPrompt(
      trainingWeek.weekNumber,
      workouts,
      healthMetrics,
      weekStats,
      trainingWeek.plannedVolumeMiles,
      previousSummaries,
      planContext
    );

    const response: LLMResponse = await llmClient.chat({
      systemPrompt: 'You are an expert marathon training coach providing weekly training summaries.',
      model: 'claude-sonnet',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 1500,
    });

    const summary = response.content;

    // 8. Save to database
    const { error: updateError } = await supabase
      .from('training_weeks')
      .update({
        week_summary: summary,
        actual_volume_miles: weekStats.totalMiles,
        actual_workouts_completed: weekStats.workoutsCompleted,
        actual_workouts_skipped: weekStats.workoutsSkipped,
        total_duration_minutes: weekStats.totalDuration,
        status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', trainingWeek.id);

    if (updateError) {
      console.error('[WeeklySummary] Failed to save summary:', updateError);
      return {
        success: false,
        weekNumber: trainingWeek.weekNumber,
        summary,
        weekStats,
        error: `Failed to save: ${updateError.message}`,
      };
    }

    return {
      success: true,
      weekNumber: trainingWeek.weekNumber,
      summary,
      weekStats,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[WeeklySummary] Error:', message);
    return {
      success: false,
      weekNumber: 0,
      summary: null,
      weekStats: { totalMiles: 0, totalDuration: 0, workoutsCompleted: 0, workoutsSkipped: 0, avgHeartRate: null, avgPace: null },
      error: message,
    };
  }
}
