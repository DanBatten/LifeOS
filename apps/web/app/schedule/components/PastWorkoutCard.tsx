'use client';

import Link from 'next/link';

interface PastWorkoutCardProps {
  id: string;
  title: string;
  workoutType: string;
  distanceMiles?: number | null;
  pace?: string | null;
  durationMinutes?: number | null;
  avgHeartRate?: number | null;
  elevationGainFt?: number | null;
}

/**
 * Infographic-style card for completed workouts
 * Emphasizes big stats - distance, pace, HR
 */
export function PastWorkoutCard({
  id,
  title,
  workoutType,
  distanceMiles,
  pace,
  durationMinutes,
  avgHeartRate,
  elevationGainFt,
}: PastWorkoutCardProps) {
  // Extract short title (remove "Week X —" prefix if present)
  const shortTitle = title.replace(/^Week \d+\s*[—-]\s*\w+:\s*/i, '').trim();

  // Format pace (remove /mi if present)
  const displayPace = pace?.replace('/mi', '').replace('/mile', '').trim();

  return (
    <Link
      href={`/workout/${id}`}
      className="block bg-green-50 dark:bg-green-900/20 rounded-2xl p-5 border border-green-200 dark:border-green-800 hover:shadow-lg hover:border-green-300 dark:hover:border-green-700 transition-all group"
    >
      {/* Header row */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-green-600 dark:text-green-400 uppercase tracking-wide">
            {workoutType}
          </p>
          <h4 className="font-semibold text-gray-900 dark:text-white truncate mt-0.5">
            {shortTitle}
          </h4>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full bg-green-500 text-white font-medium shrink-0">
          Done
        </span>
      </div>

      {/* Big stat - distance or duration */}
      <div className="mb-4">
        {distanceMiles ? (
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-bold text-gray-900 dark:text-white">
              {distanceMiles.toFixed(1)}
            </span>
            <span className="text-lg text-gray-500 dark:text-gray-400">mi</span>
          </div>
        ) : durationMinutes ? (
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-bold text-gray-900 dark:text-white">
              {durationMinutes}
            </span>
            <span className="text-lg text-gray-500 dark:text-gray-400">min</span>
          </div>
        ) : null}
      </div>

      {/* Secondary stats row */}
      <div className="flex items-center gap-4 text-sm">
        {displayPace && (
          <div className="flex items-center gap-1.5">
            <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="font-medium text-gray-700 dark:text-gray-300">{displayPace}</span>
            <span className="text-gray-400">/mi</span>
          </div>
        )}
        {avgHeartRate && (
          <div className="flex items-center gap-1.5">
            <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
            <span className="font-medium text-gray-700 dark:text-gray-300">{avgHeartRate}</span>
            <span className="text-gray-400">bpm</span>
          </div>
        )}
        {elevationGainFt && elevationGainFt > 50 && (
          <div className="flex items-center gap-1.5">
            <svg className="w-4 h-4 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
            <span className="font-medium text-gray-700 dark:text-gray-300">{Math.round(elevationGainFt)}</span>
            <span className="text-gray-400">ft</span>
          </div>
        )}
      </div>

      {/* View details hint */}
      <div className="mt-4 pt-3 border-t border-green-200 dark:border-green-800 flex items-center justify-between">
        <span className="text-xs text-gray-400 group-hover:text-green-600 transition-colors">
          View details →
        </span>
        {durationMinutes && distanceMiles && (
          <span className="text-xs text-gray-400">
            {durationMinutes} min
          </span>
        )}
      </div>
    </Link>
  );
}
