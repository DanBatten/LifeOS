export const dynamic = 'force-dynamic';

import { getSupabase } from '@/lib/supabase';
import { getEnv } from '@/lib/env';
import { HealthRepository, WorkoutRepository, WhiteboardRepository, ShoeRepository } from '@lifeos/database';
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

  const healthRepo = new HealthRepository(supabase, timezone);
  const workoutRepo = new WorkoutRepository(supabase);
  const whiteboardRepo = new WhiteboardRepository(supabase);
  const shoeRepo = new ShoeRepository(supabase);

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

  // ---- Health (for Training Readiness card) ----
  const [todayWithStatus, averages, recoveryScore] = await Promise.all([
    healthRepo.getTodayWithStatus(userId).catch(() => ({ data: null, isStale: false, dataDate: null })),
    healthRepo.getAverages(userId, 7).catch(() => ({ sleepHours: null, hrv: null, restingHr: null })),
    healthRepo.calculateRecoveryScore(userId).catch(() => 0.5),
  ]);

  const healthToday = todayWithStatus.data;
  const recoveryPct = Math.round(recoveryScore * 100);
  const hrvDelta =
    healthToday?.hrv != null && averages.hrv != null ? Math.round(healthToday.hrv - averages.hrv) : null;
  const hrvDeltaPct =
    healthToday?.hrv != null && averages.hrv != null && averages.hrv !== 0
      ? Math.round(((healthToday.hrv - averages.hrv) / averages.hrv) * 100)
      : null;

  const readiness = {
    score: recoveryPct,
    stress:
      healthToday?.stressLevel != null
        ? healthToday.stressLevel <= 3
          ? 'Low'
          : healthToday.stressLevel <= 6
            ? 'Moderate'
            : 'High'
        : '—',
    hrv:
      hrvDeltaPct != null
        ? Math.abs(hrvDeltaPct) <= 5
          ? 'Balanced'
          : hrvDeltaPct > 5
            ? 'Improving'
            : 'Strained'
        : '—',
    sleep:
      healthToday?.sleepHours != null
        ? healthToday.sleepHours >= 7
          ? 'Good'
          : healthToday.sleepHours >= 6
            ? 'Fair'
            : 'Poor'
        : '—',
    recovery:
      recoveryPct >= 75 ? 'Recovered' : recoveryPct >= 55 ? 'Moderate' : 'Fatigued',
    subtitle:
      hrvDelta != null
        ? `HRV ${hrvDelta >= 0 ? '+' : ''}${hrvDelta}ms vs 7-day avg`
        : todayWithStatus.isStale
          ? `Showing latest available (${todayWithStatus.dataDate || 'stale'})`
          : null,
  };

  // ---- Latest training coach notes (for right column "insights" if needed) ----
  const whiteboardEntries = await whiteboardRepo.getRecentForContext(userId, { days: 7, limit: 20 }).catch(() => []);

  // ---- Shoes ----
  const activeShoes = await shoeRepo.getActiveShoes(userId).catch(() => []);
  
  // Serialize shoes for the view
  const serializedShoes = activeShoes.map((shoe) => ({
    id: shoe.id,
    brand: shoe.brand,
    model: shoe.model,
    nickname: shoe.nickname,
    category: shoe.category,
    totalMiles: shoe.totalMiles,
    maxMiles: shoe.maxMiles,
    imageUrl: shoe.imageUrl,
    status: shoe.status,
  }));

  return (
    <RunCompanionView
      timezone={timezone}
      timeContext={timeContext}
      workouts={serializedWorkouts}
      monthMiles={monthMiles}
      yearMiles={yearMiles}
      readiness={readiness}
      whiteboardEntries={whiteboardEntries}
      shoes={serializedShoes}
    />
  );
}





