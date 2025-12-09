import Link from 'next/link';
import { ModuleCard, CardStack } from '../ui/ModuleCard';
import { StatDisplay } from '../ui/StatDisplay';
import type { Workout } from '@lifeos/core';

interface WeeklySummary {
  planned: number;
  completed: number;
  skipped: number;
  totalDuration: number;
  byType: Record<string, number>;
}

interface DailyMileage {
  day: string;
  miles: number;
}

interface TrainingModuleProps {
  weeklySummary: WeeklySummary | null;
  weeklyMileage: DailyMileage[];
  upcomingWorkout: Workout | null;
  totalWeeklyMiles?: number;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Format the workout date nicely
function formatWorkoutDate(workout: Workout): string {
  if (!workout.scheduledDate) return '';

  const date = new Date(workout.scheduledDate);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Check if it's today
  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  }

  // Check if it's tomorrow
  if (date.toDateString() === tomorrow.toDateString()) {
    return 'Tomorrow';
  }

  // Otherwise show the day name
  return date.toLocaleDateString('en-US', { weekday: 'long' });
}

export function TrainingModule({
  weeklySummary,
  weeklyMileage,
  upcomingWorkout,
  totalWeeklyMiles,
}: TrainingModuleProps) {
  const chartData = DAY_LABELS.map((day) => {
    const found = weeklyMileage.find((d) => d.day === day);
    return found?.miles ?? 0;
  });

  const today = new Date().getDay();
  const todayIndex = today === 0 ? 6 : today - 1;
  const weeklyMiles = totalWeeklyMiles ?? chartData.reduce((a, b) => a + b, 0);
  const completedCount = weeklySummary?.completed ?? 0;
  const totalWorkouts = completedCount + (weeklySummary?.planned ?? 0);
  const max = Math.max(...chartData, 1);

  const workoutDay = upcomingWorkout ? formatWorkoutDate(upcomingWorkout) : '';

  return (
    <CardStack>
      {/* Weekly mileage card */}
      <ModuleCard color="lime" title="Weekly Mileage" actionButton className="pb-10">
        <StatDisplay
          value={weeklyMiles.toFixed(1)}
          label="miles this week"
          comparison={`${completedCount} of ${totalWorkouts} workouts completed`}
          size="xl"
        />

        {/* Inline bar chart */}
        <div className="mt-6 flex items-end justify-between gap-1.5 h-16">
          {chartData.map((value, index) => {
            const height = (value / max) * 100;
            const isToday = index === todayIndex;
            return (
              <div key={index} className="flex flex-col items-center flex-1">
                <div className="w-full flex-1 flex items-end">
                  <div
                    className={`
                      w-full rounded-t transition-all duration-300
                      ${isToday ? 'bg-gray-900' : 'bg-[#a8c43a]'}
                    `}
                    style={{ height: `${Math.max(height, 8)}%` }}
                  />
                </div>
                <span className={`text-[10px] mt-1 ${isToday ? 'font-bold text-gray-900' : 'text-gray-600'}`}>
                  {DAY_LABELS[index]}
                </span>
              </div>
            );
          })}
        </div>
      </ModuleCard>

      {/* Upcoming workout card - Now clickable */}
      <Link href="/schedule" className="block relative z-10">
        <ModuleCard color="dark" title="Next Workout" className="hover:bg-[#252525] transition-colors">
          {upcomingWorkout ? (
            <>
              {/* Day indicator */}
              {workoutDay && (
                <span className="text-xs text-[#D4E157] font-medium mb-1 block">
                  {workoutDay}
                </span>
              )}
              <h4 className="text-xl font-bold text-white mb-2">
                {upcomingWorkout.title}
              </h4>
              {upcomingWorkout.prescribedDistanceMiles && (
                <StatDisplay
                  value={upcomingWorkout.prescribedDistanceMiles}
                  label={upcomingWorkout.prescribedPacePerMile ? `@ ${upcomingWorkout.prescribedPacePerMile} pace` : 'miles'}
                  size="md"
                  dark
                />
              )}
              {upcomingWorkout.prescribedDescription && (
                <p className="text-sm text-gray-400 mt-3 line-clamp-2">
                  {upcomingWorkout.prescribedDescription}
                </p>
              )}

              {/* View schedule hint */}
              <div className="mt-4 pt-3 border-t border-gray-700 flex items-center justify-between">
                <span className="text-xs text-gray-500">View full schedule</span>
                <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </>
          ) : (
            <div className="py-4">
              <p className="text-gray-400">No upcoming workouts</p>
              <p className="text-sm text-gray-500 mt-1">Rest day or add a workout</p>

              {/* View schedule hint */}
              <div className="mt-4 pt-3 border-t border-gray-700 flex items-center justify-between">
                <span className="text-xs text-gray-500">View full schedule</span>
                <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          )}
        </ModuleCard>
      </Link>
    </CardStack>
  );
}
