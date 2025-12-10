'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import {
  PastWorkoutCard,
  NextWorkoutCard,
  WeeklySummaryCard,
  PlannedWorkoutCard,
} from './components';

interface SerializedWorkout {
  id: string;
  title: string;
  workoutType: string;
  status: string;
  scheduledDate: string | null;
  prescribedDistanceMiles?: number | null;
  prescribedPacePerMile?: string | null;
  prescribedDescription?: string | null;
  prescribedHrZone?: string | null;
  plannedDurationMinutes?: number | null;
  actualDurationMinutes?: number | null;
  avgHeartRate?: number | null;
  elevationGainFt?: number | null;
  // Metadata fields for actual performance
  actualDistanceMiles?: number | null;
  actualPace?: string | null;
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

interface ShoeInfo {
  id: string;
  brand: string;
  model: string;
  category: string;
  totalMiles: number;
  maxMiles: number;
  hasCarbonPlate: boolean;
  cushionLevel: string;
  notes?: string;
}

interface FuelingItem {
  atMile: number;
  item: string;
  notes?: string;
}

interface RunPlan {
  recommendedShoe: ShoeInfo | null;
  shoeReasoning: string;
  suggestedWakeTime: string;
  suggestedMealTime: string;
  suggestedStartTime: string;
  preRunMeal: string;
  preRunSnack: string;
  preRunHydration: string;
  fuelingPlan: FuelingItem[];
  postRunNutrition: string;
  quickSummary: string;
}

interface ScheduleViewProps {
  workouts: SerializedWorkout[];
  trainingWeeks?: TrainingWeekSummary[];
  nextWorkoutRunPlan?: RunPlan | null;
  nextWorkoutId?: string | null;
}

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

// Format date for display
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

// Check if date is today
function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

// Check if date is in the past
function isPast(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

// Format a date to YYYY-MM-DD in local time
function toLocalDateString(dateValue: Date | string): string {
  if (typeof dateValue === 'string') {
    return dateValue.split('T')[0];
  }
  return `${dateValue.getFullYear()}-${String(dateValue.getMonth() + 1).padStart(2, '0')}-${String(dateValue.getDate()).padStart(2, '0')}`;
}

// Group workouts by date
function groupWorkoutsByDate(workouts: SerializedWorkout[]): Map<string, SerializedWorkout[]> {
  const grouped = new Map<string, SerializedWorkout[]>();

  for (const workout of workouts) {
    if (!workout.scheduledDate) continue;
    const dateKey = toLocalDateString(workout.scheduledDate);
    const existing = grouped.get(dateKey) || [];
    existing.push(workout);
    grouped.set(dateKey, existing);
  }

  return grouped;
}

// Render appropriate card based on workout status and context
function WorkoutCardRenderer({
  workout,
  isCurrentDay,
  runPlan,
  isNextWorkoutWithPlan,
}: {
  workout: SerializedWorkout;
  isCurrentDay: boolean;
  runPlan?: RunPlan | null;
  isNextWorkoutWithPlan?: boolean;
}) {
  const isCompleted = workout.status === 'completed';
  const isPlanned = workout.status === 'planned';
  // Show as featured "next workout" if it's the one with a run plan
  const isNextWorkout = isPlanned && (isCurrentDay || isNextWorkoutWithPlan);

  // Use actual distance from metadata if available, otherwise prescribed
  const displayDistance = workout.actualDistanceMiles || workout.prescribedDistanceMiles;
  const displayPace = workout.actualPace || workout.prescribedPacePerMile;

  if (isCompleted) {
    return (
      <PastWorkoutCard
        id={workout.id}
        title={workout.title}
        workoutType={workout.workoutType}
        distanceMiles={displayDistance}
        pace={displayPace}
        durationMinutes={workout.actualDurationMinutes}
        avgHeartRate={workout.avgHeartRate}
        elevationGainFt={workout.elevationGainFt}
      />
    );
  }

  if (isNextWorkout) {
    return (
      <NextWorkoutCard
        id={workout.id}
        title={workout.title}
        workoutType={workout.workoutType}
        distanceMiles={workout.prescribedDistanceMiles}
        pacePerMile={workout.prescribedPacePerMile}
        description={workout.prescribedDescription}
        hrZone={workout.prescribedHrZone}
        plannedDurationMinutes={workout.plannedDurationMinutes}
        runPlan={runPlan}
        isToday={isCurrentDay}
      />
    );
  }

  if (isPlanned) {
    return (
      <PlannedWorkoutCard
        title={workout.title}
        workoutType={workout.workoutType}
        distanceMiles={workout.prescribedDistanceMiles}
        pacePerMile={workout.prescribedPacePerMile}
        description={workout.prescribedDescription}
      />
    );
  }

  // Skipped workouts - simple muted card
  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-4 border border-gray-200 dark:border-gray-700 opacity-60">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide">
            {workout.workoutType}
          </p>
          <h4 className="font-medium text-gray-500 dark:text-gray-400">
            {workout.title.replace(/^Week \d+\s*[—-]\s*\w+:\s*/i, '')}
          </h4>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 font-medium">
          Skipped
        </span>
      </div>
    </div>
  );
}

export function ScheduleView({ workouts, trainingWeeks = [], nextWorkoutRunPlan, nextWorkoutId }: ScheduleViewProps) {
  const todayRef = useRef<HTMLDivElement>(null);
  const workoutsByDate = groupWorkoutsByDate(workouts);

  // Create a map of training weeks by their end date for easy lookup
  const weekSummaryByEndDate = new Map<string, TrainingWeekSummary>();
  for (const tw of trainingWeeks) {
    weekSummaryByEndDate.set(tw.endDate, tw);
  }

  // Generate list of weeks to display
  const weekStart = getWeekStart(new Date());
  const weeks: { start: Date; end: Date; label: string }[] = [];
  for (let i = -2; i <= 2; i++) {
    const start = addDays(weekStart, i * 7);
    const end = addDays(start, 6);
    const label = i === 0 ? 'This Week' : i === -1 ? 'Last Week' : i === 1 ? 'Next Week' : formatDate(start);
    weeks.push({ start, end, label });
  }

  // Scroll to today on mount
  useEffect(() => {
    if (todayRef.current) {
      setTimeout(() => {
        todayRef.current?.scrollIntoView({
          behavior: 'instant',
          block: 'center',
        });
      }, 100);
    }
  }, []);

  return (
    <main className="min-h-screen bg-[#fafafa] dark:bg-[#0a0a0a] pb-28">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#fafafa]/80 dark:bg-[#0a0a0a]/80 backdrop-blur-lg border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-2xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Training Schedule</h1>
              <p className="text-sm text-gray-500">Your upcoming workouts</p>
            </div>
          </div>
        </div>
      </header>

      {/* Schedule Content */}
      <div className="max-w-2xl mx-auto px-6 py-6">
        {weeks.map((week, weekIndex) => {
          const isCurrentWeek = week.label === 'This Week';

          return (
            <section key={weekIndex} className="mb-10">
              {/* Week header */}
              <div className="flex items-center gap-3 mb-5">
                <h2 className={`text-lg font-bold ${isCurrentWeek ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>
                  {week.label}
                </h2>
                <span className="text-sm text-gray-400">
                  {formatDate(week.start)} - {formatDate(week.end)}
                </span>
              </div>

              {/* Days in week */}
              <div className="space-y-4">
                {Array.from({ length: 7 }, (_, dayIndex) => {
                  const date = addDays(week.start, dayIndex);
                  const dateKey = toLocalDateString(date);
                  const dayWorkouts = workoutsByDate.get(dateKey) || [];
                  const isTodayDate = isToday(date);
                  const isPastDate = isPast(date) && !isTodayDate;

                  if (dayWorkouts.length === 0 && isPastDate) {
                    return null; // Skip empty past days
                  }

                  return (
                    <div key={dayIndex} ref={isTodayDate ? todayRef : undefined}>
                      {/* Date label */}
                      <div className={`flex items-center gap-2 mb-2 ${isTodayDate ? 'text-green-600 dark:text-green-400' : 'text-gray-500'}`}>
                        <span className={`text-sm font-semibold ${isTodayDate ? 'text-green-600 dark:text-green-400' : ''}`}>
                          {date.toLocaleDateString('en-US', { weekday: 'long' })}
                        </span>
                        <span className="text-sm">
                          {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                        {isTodayDate && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-green-500 text-white font-medium">
                            Today
                          </span>
                        )}
                      </div>

                      {/* Workouts for this day */}
                      {dayWorkouts.length > 0 ? (
                        <div className="space-y-3">
                          {dayWorkouts.map((workout) => (
                            <WorkoutCardRenderer
                              key={workout.id}
                              workout={workout}
                              isCurrentDay={isTodayDate}
                              runPlan={workout.id === nextWorkoutId ? nextWorkoutRunPlan : undefined}
                              isNextWorkoutWithPlan={workout.id === nextWorkoutId}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700">
                          <p className="text-sm text-gray-400">Rest day</p>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Weekly Summary Card - show at end of completed weeks */}
                {(() => {
                  const weekEndStr = toLocalDateString(week.end);
                  const trainingSummary = weekSummaryByEndDate.get(weekEndStr);
                  const weekStartStr = toLocalDateString(week.start);
                  const summaryByStart = trainingWeeks.find(tw => tw.startDate === weekStartStr);
                  const summary = trainingSummary || summaryByStart;

                  if (summary && summary.status === 'completed' && summary.weekSummary) {
                    return (
                      <div className="mt-5">
                        <WeeklySummaryCard
                          weekNumber={summary.weekNumber}
                          actualVolumeMiles={summary.actualVolumeMiles}
                          actualWorkoutsCompleted={summary.actualWorkoutsCompleted}
                          plannedVolumeMiles={summary.plannedVolumeMiles}
                          summary={summary.weekSummary}
                        />
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
