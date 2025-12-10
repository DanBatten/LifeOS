/**
 * Weekly Planning Workflow
 *
 * Runs Sunday evening to:
 * 1. Complete the weekly summary for the just-finished week
 * 2. Analyze training progress and athlete readiness
 * 3. Adjust upcoming week's workouts based on performance
 * 4. Generate nutrition/fueling plans for each workout
 * 5. Assign shoe recommendations
 * 6. Write whiteboard entry with week preview
 *
 * This workflow orchestrates the Planning Coach Agent with Nutrition Agent
 * collaboration via whiteboard for the upcoming week's plan.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { LLMProvider, LLMResponse } from '@lifeos/llm';
import { generateRunPlan, type RunPlan, type RunningPreferences } from '@lifeos/skills';

// Types
interface Workout {
  id: string;
  title: string;
  workoutType: string;
  status: string;
  scheduledDate: string;
  prescribedDistanceMiles: number | null;
  prescribedPacePerMile: string | null;
  prescribedDescription: string | null;
  plannedDurationMinutes: number | null;
}

export interface WeeklyPlanResult {
  weekNumber: number;
  adjustedWorkouts: number;
  nutritionPlansGenerated: number;
  shoeAssignments: number;
  coachingNotes: string;
  weekPreview: string;
}

interface TrainingPlanContext {
  paceZones: {
    marathon_pace: string;
    threshold_pace: string;
    easy_pace: string;
    long_run_pace: string;
    recovery_pace: string;
    interval_pace: string;
  };
  goalTime: string;
  raceDate: string;
  weeksToRace: number;
  currentPhase: string;
}

interface AthleteReadiness {
  hrvTrend: 'improving' | 'stable' | 'declining' | 'unknown';
  sleepQuality: 'good' | 'moderate' | 'poor' | 'unknown';
  trainingLoad: 'building' | 'maintaining' | 'recovering' | 'unknown';
  recentPerformance: 'exceeding' | 'meeting' | 'below' | 'unknown';
  recommendation: 'push' | 'maintain' | 'recover';
}

/**
 * Main workflow: Plan the upcoming week
 */
export async function runWeeklyPlanning(
  supabase: SupabaseClient,
  llmClient: LLMProvider,
  userId: string
): Promise<WeeklyPlanResult> {
  console.log('🗓️ Starting weekly planning workflow...');

  // 1. Get training plan context
  const planContext = await getTrainingPlanContext(supabase, userId);
  if (!planContext) {
    throw new Error('No active training plan found');
  }

  // 2. Get user's running preferences
  const runningPrefs = await getRunningPreferences(supabase, userId);

  // 3. Assess athlete readiness from recent data
  const readiness = await assessAthleteReadiness(supabase, userId);

  // 4. Get upcoming week's workouts
  const upcomingWorkouts = await getUpcomingWeekWorkouts(supabase, userId);
  const currentWeekNumber = await getCurrentWeekNumber(supabase, userId);

  // 5. Have training coach analyze and potentially adjust workouts
  const adjustedWorkouts = await analyzeAndAdjustWorkouts(
    llmClient,
    upcomingWorkouts,
    readiness,
    planContext
  );

  // 6. Apply adjustments to database
  let adjustedCount = 0;
  for (const adjustment of adjustedWorkouts) {
    if (adjustment.shouldAdjust) {
      await applyWorkoutAdjustment(supabase, adjustment);
      adjustedCount++;
    }
  }

  // 7. Generate run plans (nutrition + shoes) for each workout
  let nutritionPlans = 0;
  let shoeAssignments = 0;
  if (runningPrefs) {
    for (const workout of upcomingWorkouts) {
      const runPlan = generateRunPlan(
        {
          workoutType: workout.workoutType,
          distanceMiles: workout.prescribedDistanceMiles,
          durationMinutes: workout.plannedDurationMinutes,
          prescribedDescription: workout.prescribedDescription,
          isRace: workout.prescribedDescription?.toLowerCase().includes('race') || false,
          isKeyWorkout: ['interval', 'tempo', 'threshold', 'progression'].some(t =>
            workout.title.toLowerCase().includes(t)
          ),
        },
        runningPrefs
      );

      // Store run plan in workout metadata
      await storeWorkoutRunPlan(supabase, workout.id, runPlan);
      nutritionPlans++;
      if (runPlan.recommendedShoe) {
        shoeAssignments++;
      }
    }
  }

  // 8. Generate coaching notes and week preview
  const { coachingNotes, weekPreview } = await generateWeekPreview(
    llmClient,
    upcomingWorkouts,
    readiness,
    planContext,
    currentWeekNumber
  );

  // 9. Write to whiteboard
  await writeWeekPreviewToWhiteboard(supabase, userId, weekPreview, currentWeekNumber);

  console.log('✅ Weekly planning complete');

  return {
    weekNumber: currentWeekNumber,
    adjustedWorkouts: adjustedCount,
    nutritionPlansGenerated: nutritionPlans,
    shoeAssignments,
    coachingNotes,
    weekPreview,
  };
}

/**
 * Get training plan context including pace zones
 */
async function getTrainingPlanContext(
  supabase: SupabaseClient,
  userId: string
): Promise<TrainingPlanContext | null> {
  const { data } = await supabase
    .from('training_plans')
    .select('metadata')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();

  if (!data?.metadata) return null;

  const meta = data.metadata as Record<string, unknown>;
  return {
    paceZones: (meta.pace_zones as TrainingPlanContext['paceZones']) || {
      marathon_pace: '6:41/mi',
      threshold_pace: '6:12/mi',
      easy_pace: '8:15/mi',
      long_run_pace: '8:00/mi',
      recovery_pace: '8:45/mi',
      interval_pace: '5:55/mi',
    },
    goalTime: (meta.goal_time as string) || '3:00:00',
    raceDate: (meta.race_date as string) || '',
    weeksToRace: (meta.weeks_to_race as number) || 12,
    currentPhase: (meta.current_phase as string) || 'base_building',
  };
}

/**
 * Get user's running preferences
 */
async function getRunningPreferences(
  supabase: SupabaseClient,
  userId: string
): Promise<RunningPreferences | null> {
  const { data } = await supabase
    .from('users')
    .select('preferences')
    .eq('id', userId)
    .single();

  const prefs = data?.preferences as { running?: RunningPreferences } | null;
  return prefs?.running || null;
}

/**
 * Assess athlete readiness based on recent metrics
 */
async function assessAthleteReadiness(
  supabase: SupabaseClient,
  userId: string
): Promise<AthleteReadiness> {
  // Get last 7 days of health metrics
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const { data: metrics } = await supabase
    .from('health_metrics')
    .select('metric_type, value, recorded_at')
    .eq('user_id', userId)
    .gte('recorded_at', weekAgo.toISOString())
    .in('metric_type', ['hrv', 'sleep_hours', 'resting_heart_rate', 'body_battery']);

  if (!metrics || metrics.length === 0) {
    return {
      hrvTrend: 'unknown',
      sleepQuality: 'unknown',
      trainingLoad: 'unknown',
      recentPerformance: 'unknown',
      recommendation: 'maintain',
    };
  }

  // Analyze HRV trend
  const hrvValues = metrics
    .filter(m => m.metric_type === 'hrv')
    .map(m => m.value as number);
  const hrvTrend = analyzeHrvTrend(hrvValues);

  // Analyze sleep
  const sleepValues = metrics
    .filter(m => m.metric_type === 'sleep_hours')
    .map(m => m.value as number);
  const avgSleep = sleepValues.length > 0
    ? sleepValues.reduce((a, b) => a + b, 0) / sleepValues.length
    : 0;
  const sleepQuality: AthleteReadiness['sleepQuality'] =
    avgSleep >= 7.5 ? 'good' : avgSleep >= 6.5 ? 'moderate' : avgSleep > 0 ? 'poor' : 'unknown';

  // Determine recommendation
  let recommendation: AthleteReadiness['recommendation'] = 'maintain';
  if (hrvTrend === 'improving' && sleepQuality === 'good') {
    recommendation = 'push';
  } else if (hrvTrend === 'declining' || sleepQuality === 'poor') {
    recommendation = 'recover';
  }

  return {
    hrvTrend,
    sleepQuality,
    trainingLoad: 'building', // Could be enhanced with actual load calculation
    recentPerformance: 'meeting',
    recommendation,
  };
}

function analyzeHrvTrend(values: number[]): AthleteReadiness['hrvTrend'] {
  if (values.length < 3) return 'unknown';

  const firstHalf = values.slice(0, Math.floor(values.length / 2));
  const secondHalf = values.slice(Math.floor(values.length / 2));

  const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

  const change = (avgSecond - avgFirst) / avgFirst;

  if (change > 0.05) return 'improving';
  if (change < -0.05) return 'declining';
  return 'stable';
}

/**
 * Get upcoming week's workouts (Monday-Sunday)
 */
async function getUpcomingWeekWorkouts(
  supabase: SupabaseClient,
  userId: string
): Promise<Workout[]> {
  // Get next Monday
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + daysUntilMonday);
  nextMonday.setHours(0, 0, 0, 0);

  const nextSunday = new Date(nextMonday);
  nextSunday.setDate(nextMonday.getDate() + 6);
  nextSunday.setHours(23, 59, 59, 999);

  const { data } = await supabase
    .from('workouts')
    .select(
      'id, title, workout_type, status, scheduled_date, prescribed_distance_miles, prescribed_pace_per_mile, prescribed_description, planned_duration_minutes'
    )
    .eq('user_id', userId)
    .gte('scheduled_date', nextMonday.toISOString().split('T')[0])
    .lte('scheduled_date', nextSunday.toISOString().split('T')[0])
    .order('scheduled_date');

  return (data || []).map(w => ({
    id: w.id,
    title: w.title,
    workoutType: w.workout_type,
    status: w.status,
    scheduledDate: w.scheduled_date,
    prescribedDistanceMiles: w.prescribed_distance_miles,
    prescribedPacePerMile: w.prescribed_pace_per_mile,
    prescribedDescription: w.prescribed_description,
    plannedDurationMinutes: w.planned_duration_minutes,
  }));
}

/**
 * Get current training week number
 */
async function getCurrentWeekNumber(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const today = new Date().toISOString().split('T')[0];

  const { data } = await supabase
    .from('training_weeks')
    .select('week_number')
    .eq('user_id', userId)
    .lte('start_date', today)
    .gte('end_date', today)
    .single();

  return data?.week_number || 1;
}

interface WorkoutAdjustment {
  workoutId: string;
  shouldAdjust: boolean;
  newPace?: string;
  newDistance?: number;
  newDescription?: string;
  reason?: string;
}

/**
 * Have training coach analyze and suggest adjustments
 */
async function analyzeAndAdjustWorkouts(
  llmClient: LLMProvider,
  workouts: Workout[],
  readiness: AthleteReadiness,
  planContext: TrainingPlanContext
): Promise<WorkoutAdjustment[]> {
  if (workouts.length === 0) return [];

  const prompt = `You are an expert marathon coach reviewing the upcoming week's training plan.

ATHLETE READINESS:
- HRV Trend: ${readiness.hrvTrend}
- Sleep Quality: ${readiness.sleepQuality}
- Training Load: ${readiness.trainingLoad}
- Recent Performance: ${readiness.recentPerformance}
- Your Recommendation: ${readiness.recommendation}

TRAINING CONTEXT:
- Goal Marathon Time: ${planContext.goalTime}
- Weeks to Race: ${planContext.weeksToRace}
- Current Phase: ${planContext.currentPhase}
- Pace Zones:
  - Easy: ${planContext.paceZones.easy_pace}
  - Long Run: ${planContext.paceZones.long_run_pace}
  - Marathon: ${planContext.paceZones.marathon_pace}
  - Threshold: ${planContext.paceZones.threshold_pace}

UPCOMING WORKOUTS:
${workouts.map(w => `- ${w.title}: ${w.prescribedDistanceMiles || '?'} mi @ ${w.prescribedPacePerMile || 'TBD'}`).join('\n')}

Based on the athlete's readiness, should any workouts be adjusted? Consider:
1. If recommendation is "recover" - should we reduce intensity or volume?
2. If recommendation is "push" - can we add progression or slightly faster paces?
3. Are the scheduled workouts appropriate for the current training phase?

Respond with a JSON array of adjustments. For each workout that should be adjusted:
{
  "workoutId": "id",
  "shouldAdjust": true,
  "newPace": "new pace string if changing",
  "newDistance": new distance if changing,
  "newDescription": "enhanced coaching notes",
  "reason": "why this adjustment"
}

For workouts that are fine as-is: { "workoutId": "id", "shouldAdjust": false }

Only suggest meaningful adjustments. Keep most workouts as-is unless readiness clearly indicates a need for change.`;

  try {
    const response: LLMResponse = await llmClient.chat({
      systemPrompt: 'You are an expert marathon training coach. Analyze workouts and suggest adjustments based on athlete readiness.',
      model: 'claude-haiku',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 2000,
    });

    // Parse JSON from response
    const jsonMatch = response.content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as WorkoutAdjustment[];
    }
  } catch (error) {
    console.error('Error analyzing workouts:', error);
  }

  // Return no adjustments if LLM fails
  return workouts.map(w => ({ workoutId: w.id, shouldAdjust: false }));
}

/**
 * Apply a workout adjustment to the database
 */
async function applyWorkoutAdjustment(
  supabase: SupabaseClient,
  adjustment: WorkoutAdjustment
): Promise<void> {
  const updates: Record<string, unknown> = {};

  if (adjustment.newPace) {
    updates.prescribed_pace_per_mile = adjustment.newPace;
  }
  if (adjustment.newDistance) {
    updates.prescribed_distance_miles = adjustment.newDistance;
  }
  if (adjustment.newDescription) {
    updates.prescribed_description = adjustment.newDescription;
  }

  if (Object.keys(updates).length > 0) {
    await supabase.from('workouts').update(updates).eq('id', adjustment.workoutId);
  }
}

/**
 * Store run plan in workout metadata
 */
async function storeWorkoutRunPlan(
  supabase: SupabaseClient,
  workoutId: string,
  runPlan: RunPlan
): Promise<void> {
  // Get existing metadata
  const { data } = await supabase
    .from('workouts')
    .select('metadata')
    .eq('id', workoutId)
    .single();

  const existingMetadata = (data?.metadata || {}) as Record<string, unknown>;

  await supabase
    .from('workouts')
    .update({
      metadata: {
        ...existingMetadata,
        run_plan: {
          recommended_shoe: runPlan.recommendedShoe
            ? {
                brand: runPlan.recommendedShoe.brand,
                model: runPlan.recommendedShoe.model,
                category: runPlan.recommendedShoe.category,
              }
            : null,
          shoe_reasoning: runPlan.shoeReasoning,
          pre_run_meal: runPlan.preRunMeal,
          pre_run_hydration: runPlan.preRunHydration,
          fueling_plan: runPlan.fuelingPlan,
          suggested_wake_time: runPlan.suggestedWakeTime,
          suggested_start_time: runPlan.suggestedStartTime,
        },
      },
    })
    .eq('id', workoutId);
}

/**
 * Generate coaching notes and week preview
 */
async function generateWeekPreview(
  llmClient: LLMProvider,
  workouts: Workout[],
  readiness: AthleteReadiness,
  planContext: TrainingPlanContext,
  weekNumber: number
): Promise<{ coachingNotes: string; weekPreview: string }> {
  const totalMiles = workouts.reduce(
    (sum, w) => sum + (w.prescribedDistanceMiles || 0),
    0
  );
  const keyWorkouts = workouts.filter(
    w =>
      w.title.toLowerCase().includes('interval') ||
      w.title.toLowerCase().includes('tempo') ||
      w.title.toLowerCase().includes('long') ||
      w.title.toLowerCase().includes('progression')
  );

  const prompt = `Generate a brief, motivating week preview for a marathon runner.

WEEK ${weekNumber} OVERVIEW:
- Total planned miles: ${totalMiles}
- ${workouts.length} workouts scheduled
- Key workouts: ${keyWorkouts.map(w => w.title.split(':')[1]?.trim() || w.title).join(', ')}
- Athlete readiness: ${readiness.recommendation === 'push' ? 'Ready to push' : readiness.recommendation === 'recover' ? 'Need recovery focus' : 'Steady training'}
- Weeks to race: ${planContext.weeksToRace}
- Training phase: ${planContext.currentPhase}

Write 2-3 sentences that:
1. Highlight the week's focus
2. Call out any key workouts to prepare for
3. Include one specific tactical tip

Keep it conversational and encouraging. No fluff.`;

  try {
    const response: LLMResponse = await llmClient.chat({
      systemPrompt: 'You are an encouraging marathon training coach writing a brief week preview for your athlete.',
      model: 'claude-haiku',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 300,
    });

    return {
      coachingNotes: `Week ${weekNumber} - ${readiness.recommendation} mode`,
      weekPreview: response.content.trim(),
    };
  } catch (error) {
    console.error('Error generating preview:', error);
    return {
      coachingNotes: `Week ${weekNumber}`,
      weekPreview: `Week ${weekNumber} focuses on ${totalMiles} miles with ${keyWorkouts.length} key workouts. Stay consistent with your easy pace and prepare for ${keyWorkouts[0]?.title.split(':')[1]?.trim() || 'your quality sessions'}.`,
    };
  }
}

/**
 * Write week preview to whiteboard
 */
async function writeWeekPreviewToWhiteboard(
  supabase: SupabaseClient,
  userId: string,
  preview: string,
  weekNumber: number
): Promise<void> {
  await supabase.from('whiteboard_entries').insert({
    user_id: userId,
    agent_type: 'training_coach',
    entry_type: 'week_preview',
    title: `Week ${weekNumber} Training Preview`,
    content: preview,
    priority: 2, // High priority
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Expires in 7 days
  });
}
