'use client';

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

interface NextWorkoutCardProps {
  id: string;
  title: string;
  workoutType: string;
  distanceMiles?: number | null;
  pacePerMile?: string | null;
  description?: string | null;
  hrZone?: string | null;
  plannedDurationMinutes?: number | null;
  runPlan?: RunPlan | null;
  isToday?: boolean;
}

/**
 * Featured infographic card for the next scheduled workout
 * Shows full workout details in a visually prominent way
 */
export function NextWorkoutCard({
  title,
  workoutType,
  distanceMiles,
  pacePerMile,
  description,
  hrZone,
  plannedDurationMinutes,
  runPlan,
  isToday = false,
}: NextWorkoutCardProps) {
  // Extract short title (remove "Week X —" prefix if present)
  const shortTitle = title.replace(/^Week \d+\s*[—-]\s*\w+:\s*/i, '').trim();

  // Parse description for structured workout info
  const hasIntervals = description?.includes('×') || description?.includes('x');
  const hasWarmup = description?.toLowerCase().includes('wu') || description?.toLowerCase().includes('warm');
  const hasCooldown = description?.toLowerCase().includes('cd') || description?.toLowerCase().includes('cool');

  // Format pace
  const displayPace = pacePerMile?.replace('/mi', '').replace('/mile', '').trim();

  return (
    <div className="bg-[#C8E6C9] dark:bg-[#2E7D32] rounded-2xl p-6 border-2 border-[#A5D6A7] dark:border-[#388E3C] relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-32 h-32 opacity-10">
        <svg viewBox="0 0 100 100" fill="currentColor" className="text-green-900">
          <path d="M50 10 L90 90 L10 90 Z" />
        </svg>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-5 relative">
        <div>
          <p className="text-xs font-bold text-green-700 dark:text-green-200 uppercase tracking-wider mb-1">
            Up Next
          </p>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            {shortTitle}
          </h3>
          <p className="text-sm text-green-700 dark:text-green-200 mt-0.5">
            {workoutType}
          </p>
        </div>
        {isToday && (
          <div className="bg-gray-900 text-white px-3 py-1.5 rounded-full text-xs font-bold">
            TODAY
          </div>
        )}
      </div>

      {/* Main stats grid */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        {/* Distance */}
        {distanceMiles && (
          <div className="bg-white/60 dark:bg-black/20 rounded-xl p-4">
            <p className="text-xs text-green-700 dark:text-green-200 font-medium uppercase tracking-wide mb-1">
              Distance
            </p>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-gray-900 dark:text-white">
                {distanceMiles}
              </span>
              <span className="text-sm text-gray-600 dark:text-gray-300">mi</span>
            </div>
          </div>
        )}

        {/* Target Pace */}
        {displayPace && (
          <div className="bg-white/60 dark:bg-black/20 rounded-xl p-4">
            <p className="text-xs text-green-700 dark:text-green-200 font-medium uppercase tracking-wide mb-1">
              Target Pace
            </p>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-gray-900 dark:text-white">
                {displayPace}
              </span>
              <span className="text-sm text-gray-600 dark:text-gray-300">/mi</span>
            </div>
          </div>
        )}

        {/* Duration (if no distance) */}
        {!distanceMiles && plannedDurationMinutes && (
          <div className="bg-white/60 dark:bg-black/20 rounded-xl p-4">
            <p className="text-xs text-green-700 dark:text-green-200 font-medium uppercase tracking-wide mb-1">
              Duration
            </p>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-gray-900 dark:text-white">
                {plannedDurationMinutes}
              </span>
              <span className="text-sm text-gray-600 dark:text-gray-300">min</span>
            </div>
          </div>
        )}

        {/* HR Zone if specified */}
        {hrZone && (
          <div className="bg-white/60 dark:bg-black/20 rounded-xl p-4">
            <p className="text-xs text-green-700 dark:text-green-200 font-medium uppercase tracking-wide mb-1">
              HR Zone
            </p>
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {hrZone}
            </span>
          </div>
        )}
      </div>

      {/* Workout structure indicators */}
      {(hasIntervals || hasWarmup || hasCooldown) && (
        <div className="flex items-center gap-2 mb-4">
          {hasWarmup && (
            <span className="text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 px-2 py-1 rounded-full font-medium">
              Warmup
            </span>
          )}
          {hasIntervals && (
            <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-2 py-1 rounded-full font-medium">
              Intervals
            </span>
          )}
          {hasCooldown && (
            <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full font-medium">
              Cooldown
            </span>
          )}
        </div>
      )}

      {/* Full description */}
      {description && (
        <div className="bg-white/40 dark:bg-black/10 rounded-xl p-4">
          <p className="text-xs text-green-700 dark:text-green-200 font-medium uppercase tracking-wide mb-2">
            Workout Details
          </p>
          <p className="text-sm text-gray-800 dark:text-gray-100 leading-relaxed">
            {description}
          </p>
        </div>
      )}

      {/* Run Plan Recommendations */}
      {runPlan && (
        <div className="mt-5 pt-5 border-t border-green-600/20 dark:border-green-400/20">
          <p className="text-xs text-green-700 dark:text-green-200 font-bold uppercase tracking-wider mb-4">
            Run Plan
          </p>

          {/* Quick Summary */}
          {runPlan.quickSummary && (
            <p className="text-sm font-medium text-gray-800 dark:text-gray-100 mb-4 bg-white/30 dark:bg-black/20 rounded-lg px-3 py-2">
              {runPlan.quickSummary}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            {/* Shoe Recommendation */}
            {runPlan.recommendedShoe && (
              <div className="col-span-2 bg-white/50 dark:bg-black/20 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-900 dark:bg-white flex items-center justify-center flex-shrink-0">
                    <span className="text-sm">👟</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-green-700 dark:text-green-300 font-medium uppercase tracking-wide">
                      Shoe
                    </p>
                    <p className="font-bold text-gray-900 dark:text-white truncate">
                      {runPlan.recommendedShoe.brand} {runPlan.recommendedShoe.model}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                      {runPlan.shoeReasoning}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Timing */}
            <div className="bg-white/50 dark:bg-black/20 rounded-xl p-3">
              <p className="text-xs text-green-700 dark:text-green-300 font-medium uppercase tracking-wide mb-1">
                Wake Up
              </p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {runPlan.suggestedWakeTime}
              </p>
            </div>

            <div className="bg-white/50 dark:bg-black/20 rounded-xl p-3">
              <p className="text-xs text-green-700 dark:text-green-300 font-medium uppercase tracking-wide mb-1">
                Start Run
              </p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {runPlan.suggestedStartTime}
              </p>
            </div>

            {/* Pre-Run Nutrition */}
            <div className="col-span-2 bg-white/50 dark:bg-black/20 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm">🍌</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-green-700 dark:text-green-300 font-medium uppercase tracking-wide">
                    Pre-Run @ {runPlan.suggestedMealTime}
                  </p>
                  <p className="text-sm text-gray-800 dark:text-gray-100 mt-1">
                    {runPlan.preRunMeal}
                  </p>
                </div>
              </div>
            </div>

            {/* Hydration */}
            <div className="col-span-2 bg-white/50 dark:bg-black/20 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm">💧</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-green-700 dark:text-green-300 font-medium uppercase tracking-wide">
                    Hydration
                  </p>
                  <p className="text-sm text-gray-800 dark:text-gray-100 mt-1">
                    {runPlan.preRunHydration}
                  </p>
                </div>
              </div>
            </div>

            {/* Fueling Plan (for longer runs) */}
            {runPlan.fuelingPlan.length > 0 && (
              <div className="col-span-2 bg-orange-50 dark:bg-orange-900/20 rounded-xl p-4 border border-orange-200 dark:border-orange-800">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm">⚡</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-orange-700 dark:text-orange-300 font-medium uppercase tracking-wide mb-2">
                      Fueling Plan
                    </p>
                    <div className="space-y-2">
                      {runPlan.fuelingPlan.map((fuel, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <span className="text-xs font-bold text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/40 px-2 py-0.5 rounded">
                            Mile {fuel.atMile}
                          </span>
                          <span className="text-sm text-gray-800 dark:text-gray-100">
                            {fuel.item}
                          </span>
                          {fuel.notes && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              ({fuel.notes})
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
