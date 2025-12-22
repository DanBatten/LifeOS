export const dynamic = 'force-dynamic';
export const revalidate = 0; // Force no caching

import { getSupabase } from '@/lib/supabase';
import { getEnv } from '@/lib/env';
import { HealthRepository, WorkoutRepository } from '@lifeos/database';
import { createTimeContext } from '@/lib/time-context';
import { CompanionHomeView } from './companion-home/companion-home.view';

export default async function CompanionHomePage() {
  const supabase = getSupabase();
  const env = getEnv();
  const userId = env.USER_ID;
  const timezone = env.TIMEZONE;

  const healthRepo = new HealthRepository(supabase, timezone);
  const workoutRepo = new WorkoutRepository(supabase);

  const timeContext = createTimeContext({ timezone, userName: 'Dan' });

  // Minimal data for the v2 home UI (we'll expand as we wire more panels)
  const [todayWithStatus, averages, recoveryScore, upcomingWorkouts] = await Promise.all([
    healthRepo.getTodayWithStatus(userId).catch(() => ({ data: null, isStale: false, dataDate: null })),
    healthRepo.getAverages(userId, 7).catch(() => ({ sleepHours: null, hrv: null, restingHr: null })),
    healthRepo.calculateRecoveryScore(userId).catch(() => 0.5),
    workoutRepo.findUpcoming(userId, 1).catch(() => []),
  ]);

  const today = todayWithStatus.data;
  const nextWorkout = upcomingWorkouts[0] || null;

  const hrvDeltaPct =
    today?.hrv && averages.hrv ? Math.round(((today.hrv - averages.hrv) / averages.hrv) * 100) : null;
  const recoveryPct = Math.round(recoveryScore * 100);

  const metrics = [
    {
      title: 'Sleep',
      value: today?.sleepHours != null ? today.sleepHours.toFixed(1) : '--',
      unit: 'HRS',
      badge: { text: today?.sleepHours != null ? (today.sleepHours >= 7 ? '↓ 0.8hrs' : 'LOW') : '—', tone: 'amber' as const },
      subtitle: 'Shorter than ideal, plenty of deep.',
    },
    {
      title: 'RHR',
      value: today?.restingHr != null ? String(today.restingHr) : '--',
      unit: 'BPM',
      badge: { text: 'STABLE', tone: 'lime' as const },
    },
    {
      title: 'HRV',
      value: today?.hrv != null ? String(today.hrv) : '--',
      unit: 'MS',
      badge: { text: hrvDeltaPct != null ? (hrvDeltaPct >= 5 ? '↑ IMPROVING' : 'STABLE') : '—', tone: 'lime' as const },
    },
    {
      title: 'Recovery',
      value: String(recoveryPct),
      unit: '%',
      badge: { text: recoveryPct >= 75 ? 'READY TO PERFORM' : recoveryPct >= 55 ? 'GOOD' : 'EASY', tone: 'green' as const },
      subtitle: averages.hrv && today?.hrv ? `HRV ${today.hrv - averages.hrv >= 0 ? '+' : ''}${today.hrv - averages.hrv}ms above 7 day average` : undefined,
    },
  ];

  const todayRun = {
    title: nextWorkout?.title || 'Today’s Easy Run',
    distanceMiles: nextWorkout?.prescribedDistanceMiles != null ? String(Math.round(nextWorkout.prescribedDistanceMiles)) : '6',
    paceLabel: nextWorkout?.prescribedPacePerMile || '8:15/mile',
    planLabel: 'LA Marathon Plan',
    shoeLabel: 'Daily Trainer',
    description:
      nextWorkout?.prescribedDescription ||
      'Easy run at conversational pace. If breathing becomes labored, reduce pace.',
  };

  return (
    <CompanionHomeView
      timezone={timezone}
      timeContext={timeContext}
      initialBriefing={`Loading your companion briefing…`}
      metrics={metrics}
      todayRun={todayRun}
    />
  );
}
