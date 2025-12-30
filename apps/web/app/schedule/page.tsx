export const dynamic = 'force-dynamic';

import { getSupabase } from '@/lib/supabase';
import { getEnv } from '@/lib/env';
import { WorkoutRepository } from '@lifeos/database';
import { generateRunPlan, type RunPlan, type RunningPreferences } from '@lifeos/skills';
import { ScheduleView } from './ScheduleView';

// Get start of current week (Monday)
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Add days to a date
function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

interface TrainingWeekSummary {
  weekNumber: number;
  startDate: string;
  endDate: string;
  status: string;
  weekSummary: string | null;
  plannedVolumeMiles: number | null;
  actualVolumeMiles: number | null;
  plannedWorkouts: number | null;
  actualWorkoutsCompleted: number | null;
}

// Helper to check if a date is today
function isToday(dateStr: string): boolean {
  const today = new Date();
  const date = new Date(dateStr);
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

export default async function SchedulePage() {
  const supabase = getSupabase();
  const env = getEnv();
  const userId = env.USER_ID;

  // Get 4 weeks of workouts (2 past, current, 2 future)
  const weekStart = getWeekStart(new Date());
  const startDate = addDays(weekStart, -14); // 2 weeks ago
  const endDate = addDays(weekStart, 28); // 4 weeks from start of this week

  // Query Supabase directly (bypasses WorkoutRepository caching issue)
  const startStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
  const endStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
  
  type RawWorkout = { id: string; scheduled_date: string; status: string; [key: string]: unknown };
  const { data: rawWorkouts } = await supabase
    .from('workouts')
    .select('*')
    .eq('user_id', userId)
    .gte('scheduled_date', startStr)
    .lte('scheduled_date', endStr)
    .order('scheduled_date', { ascending: true });

  // Transform from snake_case to camelCase
  function snakeToCamel(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const camelKey = key.replace(/_([a-z])/g, (_: string, letter: string) => letter.toUpperCase());
      result[camelKey] = value;
    }
    return result;
  }
  
  const workouts = ((rawWorkouts || []) as RawWorkout[]).map((item) => snakeToCamel(item)) as unknown as Awaited<ReturnType<WorkoutRepository['findByDateRange']>>;

  // Fetch user's running preferences for run plan generation
  const { data: userData } = await supabase
    .from('users')
    .select('preferences')
    .eq('id', userId)
    .single();

  // Type assertion for the user data
  const userPrefs = userData as { preferences?: { running?: RunningPreferences } } | null;
  const runningPrefs = userPrefs?.preferences?.running;

  // Find the next planned workout to generate a run plan for
  // Sort by scheduled date to get the earliest planned workout
  const sortedWorkouts = [...workouts].sort((a, b) => {
    const dateA = a.scheduledDate ? new Date(a.scheduledDate).getTime() : 0;
    const dateB = b.scheduledDate ? new Date(b.scheduledDate).getTime() : 0;
    return dateA - dateB;
  });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const nextPlannedWorkout = sortedWorkouts.find(
    w => w.scheduledDate &&
         new Date(w.scheduledDate) >= todayStart &&
         w.status === 'planned'
  );

  // Generate run plan for the next workout if we have preferences
  let nextWorkoutRunPlan: RunPlan | null = null;
  let nextWorkoutId: string | null = null;
  if (nextPlannedWorkout && runningPrefs) {
    nextWorkoutId = nextPlannedWorkout.id;
    nextWorkoutRunPlan = generateRunPlan(
      {
        workoutType: nextPlannedWorkout.workoutType,
        distanceMiles: nextPlannedWorkout.prescribedDistanceMiles || null,
        durationMinutes: nextPlannedWorkout.plannedDurationMinutes || null,
        prescribedDescription: nextPlannedWorkout.prescribedDescription || null,
        isRace: nextPlannedWorkout.prescribedDescription?.toLowerCase().includes('race') || false,
        isKeyWorkout: ['interval', 'tempo', 'threshold'].includes(nextPlannedWorkout.workoutType),
      },
      runningPrefs
    );
  }

  // Fetch training weeks with summaries
  const { data: trainingWeeksData } = await supabase
    .from('training_weeks')
    .select('week_number, start_date, end_date, status, week_summary, planned_volume_miles, actual_volume_miles, planned_workouts, actual_workouts_completed')
    .gte('end_date', startDate.toISOString().split('T')[0])
    .lte('start_date', endDate.toISOString().split('T')[0])
    .order('week_number', { ascending: true });

  // Cast the data to the expected shape
  const trainingWeeks = (trainingWeeksData || []) as Array<{
    week_number: number;
    start_date: string;
    end_date: string;
    status: string;
    week_summary: string | null;
    planned_volume_miles: number | null;
    actual_volume_miles: number | null;
    planned_workouts: number | null;
    actual_workouts_completed: number | null;
  }>;

  // Helper to extract distance from various metadata locations
  function extractDistance(metadata: Record<string, unknown> | undefined): number | null {
    if (!metadata) return null;
    if (metadata.actual_distance_miles) return metadata.actual_distance_miles as number;
    if (metadata.distanceMiles) return metadata.distanceMiles as number;
    if (metadata.distanceMeters) return (metadata.distanceMeters as number) / 1609.34;
    const garmin = metadata.garmin as Record<string, unknown> | undefined;
    if (garmin?.distance) return (garmin.distance as number) / 1609.34;
    return null;
  }

  // Helper to extract pace from metadata
  function extractPace(metadata: Record<string, unknown> | undefined): string | null {
    if (!metadata) return null;
    if (metadata.actual_pace) return metadata.actual_pace as string;
    if (metadata.avgPace) return metadata.avgPace as string;
    return null;
  }

  // Serialize dates for client component and include computed fields
  const serializedWorkouts = workouts.map(w => {
    const metadata = (w as unknown as { metadata?: Record<string, unknown> }).metadata;
    return {
      ...w,
      scheduledDate: w.scheduledDate ? (typeof w.scheduledDate === 'string' ? w.scheduledDate : w.scheduledDate.toISOString()) : null,
      startedAt: w.startedAt ? (typeof w.startedAt === 'string' ? w.startedAt : w.startedAt.toISOString()) : null,
      completedAt: w.completedAt ? (typeof w.completedAt === 'string' ? w.completedAt : w.completedAt.toISOString()) : null,
      createdAt: typeof w.createdAt === 'string' ? w.createdAt : w.createdAt.toISOString(),
      updatedAt: typeof w.updatedAt === 'string' ? w.updatedAt : w.updatedAt.toISOString(),
      // Add extracted metadata fields for display
      actualDistanceMiles: extractDistance(metadata),
      actualPace: extractPace(metadata),
    };
  });

  // Serialize training weeks
  const serializedWeeks: TrainingWeekSummary[] = (trainingWeeks || []).map(tw => ({
    weekNumber: tw.week_number,
    startDate: tw.start_date,
    endDate: tw.end_date,
    status: tw.status,
    weekSummary: tw.week_summary,
    plannedVolumeMiles: tw.planned_volume_miles,
    actualVolumeMiles: tw.actual_volume_miles,
    plannedWorkouts: tw.planned_workouts,
    actualWorkoutsCompleted: tw.actual_workouts_completed,
  }));

  return (
    <ScheduleView
      workouts={serializedWorkouts}
      trainingWeeks={serializedWeeks}
      nextWorkoutRunPlan={nextWorkoutRunPlan}
      nextWorkoutId={nextWorkoutId}
    />
  );
}
