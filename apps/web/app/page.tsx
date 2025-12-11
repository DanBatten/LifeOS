export const dynamic = 'force-dynamic';

import { getSupabase } from '@/lib/supabase';
import { getEnv } from '@/lib/env';
import {
  HealthRepository,
  WorkoutRepository,
  WhiteboardRepository,
  TaskRepository,
} from '@lifeos/database';
import { HealthModule } from '@/components/dashboard/HealthModule';
import { TrainingModule } from '@/components/dashboard/TrainingModule';
import { NutritionModule } from '@/components/dashboard/NutritionModule';
import { PlanningModule } from '@/components/dashboard/PlanningModule';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';

// Calculate weekly mileage from recent workouts
function calculateWeeklyMileage(workouts: { scheduledDate?: Date; prescribedDistanceMiles?: number; metadata?: Record<string, unknown> }[]) {
  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const today = new Date();
  const dayOfWeek = today.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);

  const weeklyMileage: { day: string; miles: number }[] = dayLabels.map((day) => ({
    day,
    miles: 0,
  }));

  for (const workout of workouts) {
    if (!workout.scheduledDate) continue;

    const workoutDate = new Date(workout.scheduledDate);
    const diffDays = Math.floor((workoutDate.getTime() - monday.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays >= 0 && diffDays < 7) {
      const actualDistance = workout.metadata?.actualDistanceMiles as number | undefined;
      const distance = actualDistance ?? workout.prescribedDistanceMiles ?? 0;
      weeklyMileage[diffDays].miles += distance;
    }
  }

  return weeklyMileage;
}

export default async function Dashboard() {
  const supabase = getSupabase();
  const env = getEnv();
  const userId = env.USER_ID;
  const timezone = env.TIMEZONE;

  // Initialize repositories with timezone for correct date handling
  const healthRepo = new HealthRepository(supabase, timezone);
  const workoutRepo = new WorkoutRepository(supabase);
  const whiteboardRepo = new WhiteboardRepository(supabase);
  const taskRepo = new TaskRepository(supabase);

  // Fetch all data in parallel
  const [healthStatus, recoveryScore, healthAverages, recentWorkouts, weeklySummary, upcomingWorkouts, whiteboardEntries, alerts, priorityTasks] = await Promise.all([
    healthRepo.getTodayWithStatus(userId).catch(() => ({ data: null, isStale: false, dataDate: null })),
    healthRepo.calculateRecoveryScore(userId).catch(() => 0.5),
    healthRepo.getAverages(userId, 7).catch(() => ({ sleepHours: null, hrv: null, restingHr: null })),
    workoutRepo.findRecentCompleted(userId, 7).catch(() => []),
    workoutRepo.getWeeklySummary(userId).catch(() => ({ planned: 0, completed: 0, skipped: 0, totalDuration: 0, byType: {} })),
    workoutRepo.findUpcoming(userId, 1).catch(() => []),
    whiteboardRepo.findToday(userId).catch(() => []),
    whiteboardRepo.findAlerts(userId).catch(() => []),
    taskRepo.findHighPriority(userId).catch(() => []),
  ]);

  // Calculate weekly mileage for chart
  const weeklyMileage = calculateWeeklyMileage(recentWorkouts);
  const totalWeeklyMiles = weeklyMileage.reduce((sum, d) => sum + d.miles, 0);

  // Filter whiteboard entries
  const insights = whiteboardEntries.filter((e) => e.entryType !== 'alert');

  // Get current date formatted in user's timezone
  const today = new Date();
  const dateString = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: timezone,
  });

  return (
    <main className="min-h-screen bg-[#fafafa] dark:bg-[#0a0a0a] pb-28">
      {/* Time-aware Header */}
      <DashboardHeader serverDateString={dateString} />

      {/* Dashboard Content */}
      <div className="px-6">
        <div className="max-w-lg mx-auto space-y-6">
          {/* Health Module */}
          <section>
            <HealthModule
              healthData={healthStatus.data}
              recoveryScore={recoveryScore}
              averages={healthAverages}
              isStaleData={healthStatus.isStale}
              dataDate={healthStatus.dataDate ?? undefined}
            />
          </section>

          {/* Training Module */}
          <section>
            <TrainingModule
              weeklySummary={weeklySummary}
              weeklyMileage={weeklyMileage}
              upcomingWorkout={upcomingWorkouts[0] || null}
              totalWeeklyMiles={totalWeeklyMiles}
            />
          </section>

          {/* Nutrition Module */}
          <section>
            <NutritionModule
              todayCalories={0}
              targetCalories={2100 + totalWeeklyMiles / 7 * 100}
              activeCalories={healthStatus.data?.activeCalories || 0}
              nextWorkoutDistance={upcomingWorkouts[0]?.prescribedDistanceMiles}
            />
          </section>

          {/* Planning Module */}
          <section>
            <PlanningModule
              whiteboardEntries={insights}
              priorityTasks={priorityTasks.slice(0, 5)}
              alerts={alerts}
            />
          </section>
        </div>
      </div>
    </main>
  );
}
