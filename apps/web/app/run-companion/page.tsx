export const dynamic = 'force-dynamic';

import { getSupabase } from '@/lib/supabase';
import { getEnv } from '@/lib/env';
import { WorkoutRepository, WhiteboardRepository } from '@lifeos/database';
import { createTimeContext } from '@/lib/time-context';
import { RunCompanionView } from './run-companion.view';

// ---- helpers ----
function startOfMonth(d: Date, timezone: string): Date {
  const local = new Date(d.toLocaleString('en-US', { timeZone: timezone }));
  return new Date(local.getFullYear(), local.getMonth(), 1);
}

function startOfYear(d: Date, timezone: string): Date {
  const local = new Date(d.toLocaleString('en-US', { timeZone: timezone }));
  return new Date(local.getFullYear(), 0, 1);
}

function extractDistanceMiles(metadata: Record<string, unknown> | undefined): number | null {
  if (!metadata) return null;
  if (typeof metadata.actual_distance_miles === 'number') return metadata.actual_distance_miles;
  if (typeof metadata.actualDistanceMiles === 'number') return metadata.actualDistanceMiles;
  if (typeof metadata.distanceMiles === 'number') return metadata.distanceMiles;
  if (typeof metadata.distanceMeters === 'number') return metadata.distanceMeters / 1609.34;
  const garmin = metadata.garmin as Record<string, unknown> | undefined;
  if (garmin && typeof garmin.distance === 'number') return (garmin.distance as number) / 1609.34;
  return null;
}

function sumMilesFromWorkouts(workouts: Array<{ prescribedDistanceMiles?: number | null; metadata?: Record<string, unknown> }>) {
  return workouts.reduce((sum, w) => {
    const actual = extractDistanceMiles(w.metadata);
    const planned = typeof w.prescribedDistanceMiles === 'number' ? w.prescribedDistanceMiles : 0;
    return sum + (actual ?? planned ?? 0);
  }, 0);
}

export default async function RunCompanionPage() {
  const supabase = getSupabase();
  const env = getEnv();

  const userId = env.USER_ID;
  const timezone = env.TIMEZONE;

  const workoutRepo = new WorkoutRepository(supabase);
  const whiteboardRepo = new WhiteboardRepository(supabase);

  const now = new Date();
  const timeContext = createTimeContext({ timezone, userName: 'Dan' });

  // ---- Schedule data (reuse schedule logic shape) ----
  // Range: 2 weeks past -> 4 weeks future (same as /schedule)
  const weekStart = (() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  })();
  const startDate = new Date(weekStart);
  startDate.setDate(startDate.getDate() - 14);
  const endDate = new Date(weekStart);
  endDate.setDate(endDate.getDate() + 28);

  const workouts = await workoutRepo.findByDateRange(userId, startDate, endDate);

  // Serialize and enrich workouts similarly to /schedule
  const serializedWorkouts = workouts.map((w) => {
    const metadata = (w as unknown as { metadata?: Record<string, unknown> }).metadata;
    return {
      ...w,
      scheduledDate: w.scheduledDate
        ? typeof w.scheduledDate === 'string'
          ? w.scheduledDate
          : w.scheduledDate.toISOString()
        : null,
      startedAt: w.startedAt
        ? typeof w.startedAt === 'string'
          ? w.startedAt
          : w.startedAt.toISOString()
        : null,
      completedAt: w.completedAt
        ? typeof w.completedAt === 'string'
          ? w.completedAt
          : w.completedAt.toISOString()
        : null,
      createdAt: typeof w.createdAt === 'string' ? w.createdAt : w.createdAt.toISOString(),
      updatedAt: typeof w.updatedAt === 'string' ? w.updatedAt : w.updatedAt.toISOString(),
      actualDistanceMiles: extractDistanceMiles(metadata),
    };
  });

  // ---- Rolling mileage (month/year) ----
  const monthWorkoutsAll = await workoutRepo.findByDateRange(userId, startOfMonth(now, timezone), now);
  const yearWorkoutsAll = await workoutRepo.findByDateRange(userId, startOfYear(now, timezone), now);

  // Only count completed runs toward "miles run" stats
  const monthRuns = monthWorkoutsAll.filter((w) => w.workoutType === 'run' && w.status === 'completed');
  const yearRuns = yearWorkoutsAll.filter((w) => w.workoutType === 'run' && w.status === 'completed');

  const monthMiles = sumMilesFromWorkouts(monthRuns);
  const yearMiles = sumMilesFromWorkouts(yearRuns);

  // ---- Latest training coach notes (for right column “insights” if needed) ----
  const whiteboardEntries = await whiteboardRepo.getRecentForContext(userId, { days: 7, limit: 20 }).catch(() => []);

  return (
    <RunCompanionView
      timezone={timezone}
      timeContext={timeContext}
      workouts={serializedWorkouts}
      monthMiles={monthMiles}
      yearMiles={yearMiles}
      whiteboardEntries={whiteboardEntries}
    />
  );
}



