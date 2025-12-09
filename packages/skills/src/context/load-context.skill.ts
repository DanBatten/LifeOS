/**
 * Skill: LoadAgentContext
 * 
 * Loads all context needed for agent interpretation.
 * This is a read-only skill that queries the database.
 * 
 * The context is comprehensive so agents DON'T need to make
 * any additional data fetches - they just interpret what's given.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getLogger, getTodayISO } from '@lifeos/core';

const logger = getLogger();

export interface AgentContext {
  // User info
  userId: string;
  userName: string;
  timezone: string;
  date: string;

  // Health data
  todayHealth: HealthSnapshot | null;
  recentHealth: HealthSnapshot[]; // Last 7 days

  // Training data
  todayWorkout: Workout | null; // Planned for today
  upcomingWorkouts: Workout[]; // Next 3 planned
  recentWorkouts: Workout[]; // Last 7 completed

  // Training plan context
  trainingPlan: TrainingPlan | null;
  currentWeek: number | null;
  currentPhase: string | null;

  // Weekly summaries - coaching memory
  recentWeeklySummaries: WeeklySummary[]; // Last 4 weeks

  // Whiteboard - recent agent notes
  whiteboardEntries: WhiteboardEntry[];

  // Active concerns
  activeInjuries: Injury[];
}

interface HealthSnapshot {
  id: string;
  snapshotDate: string;
  sleepHours: number | null;
  restingHr: number | null;
  hrv: number | null;
  hrvStatus: string | null;
  stressLevel: number | null;
  energyLevel: number | null;
  bodyBattery: { low: number; high: number } | null;
  metadata: Record<string, unknown>;
}

interface Workout {
  id: string;
  title: string;
  workoutType: string;
  status: string;
  scheduledDate: string;
  plannedDurationMinutes: number | null;
  actualDurationMinutes: number | null;
  prescribedDescription: string | null;
  prescribedDistanceMiles: number | null;
  prescribedPacePerMile: string | null;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  splits: unknown[];
  coachNotes: string | null;
  weekNumber: number | null;
}

interface TrainingPlan {
  id: string;
  name: string;
  goalEvent: string | null;
  goalTime: string | null;
  startDate: string;
  endDate: string;
  currentWeek: number | null;
  totalWeeks: number | null;
  phases: { name: string; startWeek: number; endWeek: number }[];
}

interface WhiteboardEntry {
  id: string;
  entryType: string;
  title: string;
  content: string;
  agentId: string | null;
  createdAt: string;
}

interface Injury {
  id: string;
  bodyPart: string;
  severity: number;
  status: string;
  notes: string | null;
}

interface WeeklySummary {
  weekNumber: number;
  startDate: string;
  endDate: string;
  status: string;
  summary: string;
  actualVolumeMiles: number | null;
  actualWorkoutsCompleted: number | null;
}

/**
 * Load comprehensive context for agent interpretation
 */
export async function loadAgentContext(
  supabase: SupabaseClient,
  userId: string,
  timezone: string = 'America/Los_Angeles'
): Promise<AgentContext> {
  const today = getTodayISO(timezone);
  logger.info(`[Skill:LoadAgentContext] Loading context for ${today}`);

  // Parallel fetch all data
  const [
    userResult,
    todayHealthResult,
    recentHealthResult,
    todayWorkoutResult,
    upcomingWorkoutsResult,
    recentWorkoutsResult,
    trainingPlanResult,
    weeklySummariesResult,
    whiteboardResult,
    injuriesResult,
  ] = await Promise.all([
    // User
    supabase.from('users').select('*').eq('id', userId).single(),

    // Today's health
    supabase
      .from('health_snapshots')
      .select('*')
      .eq('user_id', userId)
      .eq('snapshot_date', today)
      .single(),

    // Recent health (7 days)
    supabase
      .from('health_snapshots')
      .select('*')
      .eq('user_id', userId)
      .gte('snapshot_date', subtractDays(today, 7))
      .order('snapshot_date', { ascending: false })
      .limit(7),

    // Today's planned workout
    supabase
      .from('workouts')
      .select('*')
      .eq('user_id', userId)
      .eq('scheduled_date', today)
      .eq('status', 'planned')
      .limit(1),

    // Upcoming workouts (next 3)
    supabase
      .from('workouts')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'planned')
      .gt('scheduled_date', today)
      .order('scheduled_date', { ascending: true })
      .limit(3),

    // Recent completed workouts (14 days - no limit since date filter handles it)
    supabase
      .from('workouts')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .gte('scheduled_date', subtractDays(today, 14))
      .order('scheduled_date', { ascending: false }),

    // Active training plan
    supabase
      .from('training_plans')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single(),

    // Recent weekly summaries (last 4 completed weeks with summaries)
    supabase
      .from('training_weeks')
      .select('week_number, start_date, end_date, status, week_summary, actual_volume_miles, actual_workouts_completed')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .not('week_summary', 'is', null)
      .order('week_number', { ascending: false })
      .limit(4),

    // Recent whiteboard entries (last 24 hours)
    supabase
      .from('whiteboard_entries')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(10),

    // Active injuries
    supabase
      .from('injuries')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('severity', { ascending: false }),
  ]);

  const user = userResult.data;
  const trainingPlan = trainingPlanResult.data;

  // Calculate current week and phase
  let currentWeek: number | null = null;
  let currentPhase: string | null = null;
  
  if (trainingPlan) {
    const startDate = new Date(trainingPlan.start_date);
    const todayDate = new Date(today);
    const daysSinceStart = Math.floor((todayDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    currentWeek = Math.floor(daysSinceStart / 7) + 1;
    
    // Find current phase
    if (trainingPlan.phases) {
      for (const phase of trainingPlan.phases as { name: string; startWeek: number; endWeek: number }[]) {
        if (currentWeek >= phase.startWeek && currentWeek <= phase.endWeek) {
          currentPhase = phase.name;
          break;
        }
      }
    }
  }

  return {
    userId,
    userName: user?.name || 'Athlete',
    timezone,
    date: today,

    todayHealth: transformHealthSnapshot(todayHealthResult.data),
    recentHealth: (recentHealthResult.data || []).map(transformHealthSnapshot).filter((h): h is HealthSnapshot => h !== null),

    todayWorkout: transformWorkout(todayWorkoutResult.data?.[0]),
    upcomingWorkouts: (upcomingWorkoutsResult.data || []).map(transformWorkout).filter((w): w is Workout => w !== null),
    recentWorkouts: deduplicateWorkouts(
      (recentWorkoutsResult.data || []).map(transformWorkout).filter((w): w is Workout => w !== null)
    ),

    trainingPlan: trainingPlan ? {
      id: trainingPlan.id,
      name: trainingPlan.name,
      goalEvent: trainingPlan.goal_event,
      goalTime: trainingPlan.goal_time,
      startDate: trainingPlan.start_date,
      endDate: trainingPlan.end_date,
      currentWeek,
      totalWeeks: trainingPlan.total_weeks,
      phases: trainingPlan.phases || [],
    } : null,
    currentWeek,
    currentPhase,

    // Weekly summaries for coaching memory - reverse to show oldest first
    recentWeeklySummaries: (weeklySummariesResult.data || [])
      .reverse()
      .map((ws: Record<string, unknown>) => ({
        weekNumber: ws.week_number as number,
        startDate: ws.start_date as string,
        endDate: ws.end_date as string,
        status: ws.status as string,
        summary: ws.week_summary as string,
        actualVolumeMiles: ws.actual_volume_miles as number | null,
        actualWorkoutsCompleted: ws.actual_workouts_completed as number | null,
      })),

    whiteboardEntries: (whiteboardResult.data || []).map((e: Record<string, unknown>) => ({
      id: e.id as string,
      entryType: e.entry_type as string,
      title: e.title as string,
      content: e.content as string,
      agentId: e.agent_id as string | null,
      createdAt: e.created_at as string,
    })),

    activeInjuries: (injuriesResult.data || []).map((i: Record<string, unknown>) => ({
      id: i.id as string,
      bodyPart: i.body_part as string,
      severity: i.severity as number,
      status: i.status as string,
      notes: i.notes as string | null,
    })),
  };
}

function transformHealthSnapshot(data: Record<string, unknown> | null): HealthSnapshot | null {
  if (!data) return null;
  
  const meta = data.metadata as Record<string, unknown> || {};
  const garmin = meta.garmin as Record<string, unknown> || {};
  const bb = garmin.bodyBattery as Record<string, number> || {};
  const hrv = garmin.hrv as Record<string, unknown> || {};

  return {
    id: data.id as string,
    snapshotDate: data.snapshot_date as string,
    sleepHours: data.sleep_hours as number | null,
    restingHr: data.resting_hr as number | null,
    hrv: data.hrv as number | null,
    hrvStatus: hrv.status as string | null,
    stressLevel: data.stress_level as number | null,
    energyLevel: data.energy_level as number | null,
    bodyBattery: bb.lowest !== undefined ? { low: bb.lowest, high: bb.highest } : null,
    metadata: meta,
  };
}

function transformWorkout(data: Record<string, unknown> | null | undefined): Workout | null {
  if (!data) return null;
  
  return {
    id: data.id as string,
    title: data.title as string,
    workoutType: data.workout_type as string,
    status: data.status as string,
    scheduledDate: data.scheduled_date as string,
    plannedDurationMinutes: data.planned_duration_minutes as number | null,
    actualDurationMinutes: data.actual_duration_minutes as number | null,
    prescribedDescription: data.prescribed_description as string | null,
    prescribedDistanceMiles: data.prescribed_distance_miles as number | null,
    prescribedPacePerMile: data.prescribed_pace_per_mile as string | null,
    avgHeartRate: data.avg_heart_rate as number | null,
    maxHeartRate: data.max_heart_rate as number | null,
    splits: (data.splits as unknown[]) || [],
    coachNotes: data.coach_notes as string | null,
    weekNumber: data.week_number as number | null,
  };
}

/**
 * Deduplicate workouts: if multiple workouts on same date, prefer training plan workouts
 * over Garmin-synced ones. This handles the case where both a scheduled workout and
 * a Garmin sync exist for the same day.
 */
function deduplicateWorkouts(workouts: Workout[]): Workout[] {
  const byDate = new Map<string, Workout>();
  
  for (const workout of workouts) {
    const dateKey = workout.scheduledDate;
    if (!dateKey) continue;
    
    const existing = byDate.get(dateKey);
    if (!existing) {
      byDate.set(dateKey, workout);
    } else {
      // Prefer workout with weekNumber (training plan workout) over Garmin-only sync
      // Training plan workouts have weekNumber, Garmin syncs typically don't
      const existingIsPlan = existing.weekNumber !== null;
      const currentIsPlan = workout.weekNumber !== null;
      
      if (currentIsPlan && !existingIsPlan) {
        byDate.set(dateKey, workout);
      }
      // If both or neither are plan workouts, keep first (already sorted by date desc)
    }
  }
  
  return Array.from(byDate.values());
}

function subtractDays(dateStr: string, days: number): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
}

