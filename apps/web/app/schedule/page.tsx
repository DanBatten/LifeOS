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

  // Serialize dates for client component
  const serializedWorkouts = workouts.map(w => ({
    ...w,
    scheduledDate: w.scheduledDate ? (typeof w.scheduledDate === 'string' ? w.scheduledDate : w.scheduledDate.toISOString()) : null,
    startedAt: w.startedAt ? (typeof w.startedAt === 'string' ? w.startedAt : w.startedAt.toISOString()) : null,
    completedAt: w.completedAt ? (typeof w.completedAt === 'string' ? w.completedAt : w.completedAt.toISOString()) : null,
    createdAt: typeof w.createdAt === 'string' ? w.createdAt : w.createdAt.toISOString(),
    updatedAt: typeof w.updatedAt === 'string' ? w.updatedAt : w.updatedAt.toISOString(),
  }));

  return <ScheduleView workouts={serializedWorkouts} />;
}
