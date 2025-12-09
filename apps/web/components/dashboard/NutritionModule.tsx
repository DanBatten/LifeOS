import Link from 'next/link';
import { ModuleCard } from '../ui/ModuleCard';

interface NutritionModuleProps {
  todayCalories?: number;
  targetCalories: number;
  activeCalories?: number;
  nextWorkoutDistance?: number;
}

export function NutritionModule({
  todayCalories = 0,
  targetCalories,
  activeCalories = 0,
  nextWorkoutDistance,
}: NutritionModuleProps) {
  const remaining = targetCalories - todayCalories + activeCalories;
  const percentage = Math.min((todayCalories / targetCalories) * 100, 100);

  // Simple fueling tip based on next workout
  const getFuelingTip = () => {
    if (!nextWorkoutDistance) return 'Stay hydrated throughout the day';
    if (nextWorkoutDistance > 15) return 'Long run tomorrow - prioritize carbs today';
    if (nextWorkoutDistance > 10) return 'Moderate long run - eat well tonight';
    if (nextWorkoutDistance > 6) return 'Regular run - maintain balanced nutrition';
    return 'Short run - standard nutrition';
  };

  return (
    <Link href="/nutrition" className="block">
      <ModuleCard color="amber" title="Nutrition" className="hover:shadow-lg transition-shadow">
        {/* Calorie summary */}
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-4xl font-bold text-gray-900">{remaining}</span>
          <span className="text-sm text-gray-600">cal remaining</span>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-amber-200 rounded-full overflow-hidden mb-4">
          <div
            className="h-full bg-amber-500 rounded-full transition-all"
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Stats row */}
        <div className="flex items-center justify-between text-sm">
          <div>
            <span className="text-gray-600">Consumed: </span>
            <span className="font-medium">{todayCalories}</span>
          </div>
          <div>
            <span className="text-gray-600">Burned: </span>
            <span className="font-medium text-green-600">+{activeCalories}</span>
          </div>
        </div>

        {/* Fueling tip */}
        <div className="mt-4 pt-3 border-t border-amber-200">
          <p className="text-xs text-amber-800">{getFuelingTip()}</p>
        </div>

        {/* View nutrition hint */}
        <div className="mt-3 pt-3 border-t border-amber-200 flex items-center justify-between">
          <span className="text-xs text-gray-600">View nutrition details</span>
          <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </ModuleCard>
    </Link>
  );
}
