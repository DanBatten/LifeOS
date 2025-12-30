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

  // DEBUG: Query Supabase directly to compare with WorkoutRepository
  const startStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
  const endStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
  
  const { data: rawWorkouts } = await supabase
    .from('workouts')
    .select('*')
    .eq('user_id', userId)
    .gte('scheduled_date', startStr)
    .lte('scheduled_date', endStr)
    .order('scheduled_date', { ascending: true });
  
  type RawWorkout = { id: string; scheduled_date: string; status: string; [key: string]: unknown };
  console.log('[run-companion] Direct Supabase query for Dec 23-30:');
  for (const w of ((rawWorkouts || []) as RawWorkout[])) {
    if (w.scheduled_date >= '2025-12-23' && w.scheduled_date <= '2025-12-30') {
      console.log(`  ${w.scheduled_date} | status=${w.status} | id=${w.id}`);
    }
  }
  
  // Use direct Supabase results - serialize directly from snake_case
  const serializedWorkouts = ((rawWorkouts || []) as RawWorkout[]).map((w) => {
    return {
      id: w.id as string,
      title: w.title as string,
      workoutType: w.workout_type as string,
      status: w.status as string,
      scheduledDate: w.scheduled_date as string | null,
      prescribedDistanceMiles: w.prescribed_distance_miles as number | null,
      prescribedPacePerMile: w.prescribed_pace_per_mile as string | null,
      prescribedDescription: w.prescribed_description as string | null,
      prescribedHrZone: w.prescribed_hr_zone as string | null,
      plannedDurationMinutes: w.planned_duration_minutes as number | null,
      actualDurationMinutes: w.actual_duration_minutes as number | null,
      avgHeartRate: w.avg_heart_rate as number | null,
      elevationGainFt: w.elevation_gain_ft as number | null,
      startedAt: w.started_at as string | null,
      completedAt: w.completed_at as string | null,
      createdAt: w.created_at as string,
      updatedAt: w.updated_at as string,
      actualDistanceMiles: extractDistanceMiles(w.metadata as Record<string, unknown> | undefined),
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





