import { getSupabase } from '@/lib/supabase';
import { getEnv } from '@/lib/env';
import { WorkoutRepository } from '@lifeos/database';
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

export default async function SchedulePage() {
  const supabase = getSupabase();
  const env = getEnv();
  const userId = env.USER_ID;

  const workoutRepo = new WorkoutRepository(supabase);

  // Get 4 weeks of workouts (2 past, current, 2 future)
  const weekStart = getWeekStart(new Date());
  const startDate = addDays(weekStart, -14); // 2 weeks ago
  const endDate = addDays(weekStart, 28); // 4 weeks from start of this week

  const workouts = await workoutRepo.findByDateRange(userId, startDate, endDate);

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

  // Serialize dates for client component
  const serializedWorkouts = workouts.map(w => ({
    ...w,
    scheduledDate: w.scheduledDate ? (typeof w.scheduledDate === 'string' ? w.scheduledDate : w.scheduledDate.toISOString()) : null,
    startedAt: w.startedAt ? (typeof w.startedAt === 'string' ? w.startedAt : w.startedAt.toISOString()) : null,
    completedAt: w.completedAt ? (typeof w.completedAt === 'string' ? w.completedAt : w.completedAt.toISOString()) : null,
    createdAt: typeof w.createdAt === 'string' ? w.createdAt : w.createdAt.toISOString(),
    updatedAt: typeof w.updatedAt === 'string' ? w.updatedAt : w.updatedAt.toISOString(),
  }));

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

  return <ScheduleView workouts={serializedWorkouts} trainingWeeks={serializedWeeks} />;
}
