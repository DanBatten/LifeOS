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

  // Initialize repositories
  const healthRepo = new HealthRepository(supabase);
  const workoutRepo = new WorkoutRepository(supabase);
  const whiteboardRepo = new WhiteboardRepository(supabase);
  const taskRepo = new TaskRepository(supabase);

  // Fetch all data in parallel
  const [healthData, recoveryScore, healthAverages, recentWorkouts, weeklySummary, upcomingWorkouts, whiteboardEntries, alerts, priorityTasks] = await Promise.all([
    healthRepo.getToday(userId).catch(() => null),
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

  // Get current date formatted
  const today = new Date();
  const dateString = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <main className="min-h-screen bg-[#fafafa] dark:bg-[#0a0a0a] pb-28">
      {/* Header */}
      <header className="px-6 pt-12 pb-8">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm text-gray-500">{dateString}</p>
            <div className="w-8 h-8 rounded-full bg-[#D4E157] flex items-center justify-center">
              <span className="text-xs font-bold text-gray-900">
                {/* User initial or icon */}
                D
              </span>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
            LifeOS
          </h1>
        </div>
      </header>

      {/* Dashboard Content */}
      <div className="px-6">
        <div className="max-w-lg mx-auto space-y-6">
          {/* Health Module */}
          <section>
            <HealthModule
              healthData={healthData}
              recoveryScore={recoveryScore}
              averages={healthAverages}
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
              activeCalories={healthData?.activeCalories || 0}
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
