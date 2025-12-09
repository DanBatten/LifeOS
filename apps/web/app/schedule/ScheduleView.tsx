'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';

interface SerializedWorkout {
  id: string;
  title: string;
  workoutType: string;
  status: string;
  scheduledDate: string | null;
  prescribedDistanceMiles?: number | null;
  prescribedPacePerMile?: string | null;
  prescribedDescription?: string | null;
  actualDurationMinutes?: number | null;
  avgHeartRate?: number | null;
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

interface ScheduleViewProps {
  workouts: SerializedWorkout[];
  trainingWeeks?: TrainingWeekSummary[];
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

const statusColors: Record<string, { bg: string; text: string; border: string }> = {
  planned: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  completed: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  skipped: { bg: 'bg-gray-50', text: 'text-gray-500', border: 'border-gray-200' },
  partial: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
};

interface WorkoutCardProps {
  workout: SerializedWorkout;
  isCurrentDay: boolean;
}

function WorkoutCard({ workout, isCurrentDay }: WorkoutCardProps) {
  const colors = statusColors[workout.status] || statusColors.planned;
  const isNext = workout.status === 'planned' && isCurrentDay;
  const isClickable = workout.status === 'completed';

  const cardClassName = `
    block p-4 rounded-2xl border transition-all
    ${isNext ? 'bg-[#D4E157] border-[#c4d147]' : `${colors.bg} ${colors.border}`}
    ${workout.status === 'completed' ? 'hover:opacity-100 cursor-pointer' : ''}
    ${isClickable ? 'hover:shadow-md' : ''}
  `;

  const cardContent = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h4 className={`font-semibold truncate ${isNext ? 'text-gray-900' : colors.text}`}>
            {workout.title}
          </h4>
          {workout.prescribedDistanceMiles && (
            <p className={`text-2xl font-bold mt-1 ${isNext ? 'text-gray-900' : colors.text}`}>
              {workout.prescribedDistanceMiles} mi
            </p>
          )}
          {workout.prescribedPacePerMile && (
            <p className={`text-sm mt-1 ${isNext ? 'text-gray-700' : 'text-gray-500'}`}>
              @ {workout.prescribedPacePerMile} pace
            </p>
          )}
          {workout.prescribedDescription && (
            <p className={`text-sm mt-2 line-clamp-2 ${isNext ? 'text-gray-700' : 'text-gray-500'}`}>
              {workout.prescribedDescription}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <span
            className={`
              text-xs px-2 py-1 rounded-full font-medium
              ${workout.status === 'completed' ? 'bg-green-100 text-green-700' :
                workout.status === 'skipped' ? 'bg-gray-100 text-gray-500' :
                isNext ? 'bg-gray-900 text-white' : 'bg-white/50 text-gray-600'}
            `}
          >
            {workout.status === 'completed' ? 'Done' :
             workout.status === 'skipped' ? 'Skipped' :
             isNext ? 'Up Next' : 'Planned'}
          </span>
          {workout.workoutType && (
            <span className={`text-xs ${isNext ? 'text-gray-600' : 'text-gray-400'}`}>
              {workout.workoutType}
            </span>
          )}
        </div>
      </div>

      {workout.status === 'completed' && workout.actualDurationMinutes && (
        <div className="mt-3 pt-3 border-t border-green-200 flex gap-4 text-sm">
          <div>
            <span className="text-gray-500">Duration:</span>{' '}
            <span className="font-medium text-gray-700">{workout.actualDurationMinutes} min</span>
          </div>
          {workout.avgHeartRate && (
            <div>
              <span className="text-gray-500">Avg HR:</span>{' '}
              <span className="font-medium text-gray-700">{workout.avgHeartRate} bpm</span>
            </div>
          )}
        </div>
      )}
    </>
  );

  if (isClickable) {
    return (
      <Link href={`/workout/${workout.id}`} className={cardClassName}>
        {cardContent}
      </Link>
    );
  }

  return (
    <div className={cardClassName}>
      {cardContent}
    </div>
  );
}

// Weekly Summary Card Component
function WeeklySummaryCard({ summary }: { summary: TrainingWeekSummary }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!summary.weekSummary) return null;

  // Get first paragraph as preview
  const paragraphs = summary.weekSummary.split('\n\n');
  const preview = paragraphs[0];
  const hasMore = summary.weekSummary.length > preview.length + 10;

  return (
    <div className="mt-4 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-2xl p-5 border border-purple-200 dark:border-purple-800">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-purple-900 dark:text-purple-100">
              Week {summary.weekNumber} Summary
            </h3>
            <p className="text-xs text-purple-600 dark:text-purple-400">
              {summary.actualVolumeMiles?.toFixed(1) || '—'} mi completed
              {summary.actualWorkoutsCompleted && ` · ${summary.actualWorkoutsCompleted} workouts`}
            </p>
          </div>
        </div>
        {hasMore && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-200 font-medium"
          >
            {isExpanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>

      <div className={`prose prose-sm dark:prose-invert max-w-none prose-p:text-purple-900 dark:prose-p:text-purple-100 prose-p:my-2 prose-strong:text-purple-800 dark:prose-strong:text-purple-200 ${!isExpanded ? 'line-clamp-4' : ''}`}>
        <ReactMarkdown>
          {isExpanded ? summary.weekSummary : preview}
        </ReactMarkdown>
      </div>
    </div>
  );
}

export function ScheduleView({ workouts, trainingWeeks = [] }: ScheduleViewProps) {
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
      // Small delay to ensure layout is complete
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
            <section key={weekIndex} className="mb-8">
              {/* Week header */}
              <div className="flex items-center gap-3 mb-4">
                <h2 className={`text-lg font-semibold ${isCurrentWeek ? 'text-[#D4E157]' : 'text-gray-900 dark:text-white'}`}>
                  {week.label}
                </h2>
                <span className="text-sm text-gray-500">
                  {formatDate(week.start)} - {formatDate(week.end)}
                </span>
              </div>

              {/* Days in week */}
              <div className="space-y-3">
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
                      <div className={`flex items-center gap-2 mb-2 ${isTodayDate ? 'text-[#D4E157]' : 'text-gray-500'}`}>
                        <span className={`text-sm font-medium ${isTodayDate ? 'text-[#D4E157]' : ''}`}>
                          {date.toLocaleDateString('en-US', { weekday: 'long' })}
                        </span>
                        <span className="text-sm">
                          {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                        {isTodayDate && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-[#D4E157] text-gray-900 font-medium">
                            Today
                          </span>
                        )}
                      </div>

                      {/* Workouts for this day */}
                      {dayWorkouts.length > 0 ? (
                        <div className="space-y-2">
                          {dayWorkouts.map((workout) => (
                            <WorkoutCard
                              key={workout.id}
                              workout={workout}
                              isCurrentDay={isTodayDate}
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
                  // Also check by matching start date (training weeks might use different date conventions)
                  const weekStartStr = toLocalDateString(week.start);
                  const summaryByStart = trainingWeeks.find(tw => tw.startDate === weekStartStr);
                  const summary = trainingSummary || summaryByStart;

                  if (summary && summary.status === 'completed' && summary.weekSummary) {
                    return <WeeklySummaryCard summary={summary} />;
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
