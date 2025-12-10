'use client';

interface PlannedWorkoutCardProps {
  title: string;
  workoutType: string;
  distanceMiles?: number | null;
  pacePerMile?: string | null;
  description?: string | null;
}

/**
 * Minimal card for future planned workouts
 * Shows key info but less prominent than NextWorkoutCard
 */
export function PlannedWorkoutCard({
  title,
  workoutType,
  distanceMiles,
  pacePerMile,
  description,
}: PlannedWorkoutCardProps) {
  // Extract short title (remove "Week X —" prefix if present)
  const shortTitle = title.replace(/^Week \d+\s*[—-]\s*\w+:\s*/i, '').trim();

  // Format pace
  const displayPace = pacePerMile?.replace('/mi', '').replace('/mile', '').trim();

  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-5 border border-blue-200 dark:border-blue-800">
      {/* Header row */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide">
            {workoutType}
          </p>
          <h4 className="font-semibold text-gray-900 dark:text-white truncate mt-0.5">
            {shortTitle}
          </h4>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300 font-medium shrink-0">
          Planned
        </span>
      </div>

      {/* Stats row */}
      <div className="flex items-baseline gap-4">
        {distanceMiles && (
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {distanceMiles}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">mi</span>
          </div>
        )}
        {displayPace && (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            @ {displayPace}/mi
          </div>
        )}
      </div>

      {/* Description preview */}
      {description && (
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
          {description}
        </p>
      )}
    </div>
  );
}
