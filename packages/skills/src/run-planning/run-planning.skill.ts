/**
 * Run Planning Skill
 *
 * Generates pre-run nutrition, fueling, and shoe recommendations
 * based on workout type, distance, and user preferences.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface RunningPreferences {
  defaultRunTime: string;
  typicalWakeTime: string;
  preferredGelBrands: string[];
  preferredHydrationBrands: string[];
  caffeinePreference: 'always' | 'race_only' | 'never';
  preRunMealTimingMinutes: number;
  preRunSnackTimingMinutes: number;
  gelStartDistanceMiles: number;
  gelIntervalMinutes: number;
  shoes: ShoeInfo[];
}

export interface ShoeInfo {
  id: string;
  brand: string;
  model: string;
  category: 'daily_trainer' | 'tempo' | 'race' | 'long_run' | 'trail' | 'recovery';
  totalMiles: number;
  maxMiles: number;
  hasCarbonPlate: boolean;
  cushionLevel: 'minimal' | 'moderate' | 'max';
  notes?: string;
}

export interface RunPlan {
  // Shoe recommendation
  recommendedShoe: ShoeInfo | null;
  shoeReasoning: string;

  // Pre-run timing
  suggestedWakeTime: string;
  suggestedMealTime: string;
  suggestedStartTime: string;

  // Pre-run nutrition
  preRunMeal: string;
  preRunSnack: string;
  preRunHydration: string;

  // During-run fueling (for longer runs)
  fuelingPlan: FuelingItem[];

  // Post-run
  postRunNutrition: string;

  // Summary for display
  quickSummary: string;
}

export interface FuelingItem {
  atMile: number;
  item: string;
  notes?: string;
}

interface WorkoutInfo {
  workoutType: string;
  distanceMiles: number | null;
  durationMinutes: number | null;
  prescribedDescription: string | null;
  isRace?: boolean;
  isKeyWorkout?: boolean;
}

/**
 * Get running preferences for a user
 */
export async function getRunningPreferences(
  supabase: SupabaseClient,
  userId: string
): Promise<RunningPreferences | null> {
  const { data: user } = await supabase
    .from('users')
    .select('preferences')
    .eq('id', userId)
    .single();

  if (!user?.preferences?.running) {
    return null;
  }

  return user.preferences.running as RunningPreferences;
}

/**
 * Generate a run plan with nutrition and shoe recommendations
 */
export function generateRunPlan(
  workout: WorkoutInfo,
  prefs: RunningPreferences
): RunPlan {
  const distance = workout.distanceMiles || estimateDistanceFromDuration(workout.durationMinutes);
  const isLongRun = distance >= 12;
  const isQualityWorkout = ['interval', 'tempo', 'threshold', 'race'].includes(workout.workoutType);

  // =========================================================================
  // SHOE RECOMMENDATION
  // =========================================================================
  const shoe = recommendShoe(prefs.shoes, workout, distance);
  const shoeReasoning = getShoeReasoning(shoe, workout, distance);

  // =========================================================================
  // TIMING
  // =========================================================================
  const runTime = prefs.defaultRunTime || '06:30';
  const [runHour, runMin] = runTime.split(':').map(Number);

  // Wake time: based on pre-run nutrition timing
  const mealTimingMins = isLongRun ? prefs.preRunMealTimingMinutes : 90;
  const wakeMinutes = runHour * 60 + runMin - mealTimingMins - 30; // 30 min buffer
  const suggestedWakeTime = formatTime(Math.floor(wakeMinutes / 60), wakeMinutes % 60);

  const mealMinutes = runHour * 60 + runMin - mealTimingMins;
  const suggestedMealTime = formatTime(Math.floor(mealMinutes / 60), mealMinutes % 60);

  // =========================================================================
  // PRE-RUN NUTRITION
  // =========================================================================
  const preRunMeal = getPreRunMeal(workout, distance, isLongRun, isQualityWorkout);
  const preRunSnack = getPreRunSnack(workout, distance, prefs.preRunSnackTimingMinutes);
  const preRunHydration = getPreRunHydration(distance, isLongRun);

  // =========================================================================
  // DURING-RUN FUELING
  // =========================================================================
  const fuelingPlan = generateFuelingPlan(
    distance,
    prefs.gelStartDistanceMiles,
    prefs.gelIntervalMinutes,
    prefs.preferredGelBrands,
    workout.isRace || false,
    prefs.caffeinePreference
  );

  // =========================================================================
  // POST-RUN NUTRITION
  // =========================================================================
  const postRunNutrition = getPostRunNutrition(distance, isQualityWorkout);

  // =========================================================================
  // QUICK SUMMARY
  // =========================================================================
  const quickSummary = generateQuickSummary(shoe, preRunMeal, fuelingPlan, distance);

  return {
    recommendedShoe: shoe,
    shoeReasoning,
    suggestedWakeTime,
    suggestedMealTime,
    suggestedStartTime: runTime,
    preRunMeal,
    preRunSnack,
    preRunHydration,
    fuelingPlan,
    postRunNutrition,
    quickSummary,
  };
}

/**
 * Recommend a shoe based on workout type and distance
 */
function recommendShoe(
  shoes: ShoeInfo[],
  workout: WorkoutInfo,
  distance: number
): ShoeInfo | null {
  if (!shoes || shoes.length === 0) return null;

  // Determine ideal category
  let targetCategory: ShoeInfo['category'];

  if (workout.isRace) {
    targetCategory = 'race';
  } else if (distance >= 14) {
    targetCategory = 'long_run';
  } else if (['interval', 'tempo', 'threshold'].includes(workout.workoutType)) {
    targetCategory = 'tempo';
  } else if (workout.workoutType === 'recovery') {
    targetCategory = 'recovery';
  } else if (workout.workoutType === 'trail') {
    targetCategory = 'trail';
  } else {
    targetCategory = 'daily_trainer';
  }

  // Find shoe in target category
  let shoe = shoes.find(s => s.category === targetCategory && s.totalMiles < s.maxMiles);

  // Fallback to daily trainer
  if (!shoe) {
    shoe = shoes.find(s => s.category === 'daily_trainer' && s.totalMiles < s.maxMiles);
  }

  // Fallback to any active shoe
  if (!shoe) {
    shoe = shoes.find(s => s.totalMiles < s.maxMiles);
  }

  return shoe || null;
}

function getShoeReasoning(shoe: ShoeInfo | null, _workout: WorkoutInfo, _distance: number): string {
  if (!shoe) return 'No shoe recommendation available';

  const milesRemaining = shoe.maxMiles - shoe.totalMiles;
  const isLowMiles = milesRemaining < 50;

  let reasoning = `${shoe.brand} ${shoe.model}`;

  if (shoe.category === 'race') {
    reasoning += ' - Carbon plate for max efficiency';
  } else if (shoe.category === 'long_run') {
    reasoning += ' - Max cushion protects legs on long efforts';
  } else if (shoe.category === 'tempo') {
    reasoning += ' - Lightweight and responsive for faster work';
  } else {
    reasoning += ' - Versatile daily trainer';
  }

  if (isLowMiles) {
    reasoning += ` (${Math.round(milesRemaining)} mi until retirement)`;
  }

  return reasoning;
}

/**
 * Pre-run meal recommendations
 */
function getPreRunMeal(
  _workout: WorkoutInfo,
  distance: number,
  isLongRun: boolean,
  isQualityWorkout: boolean
): string {
  if (isLongRun) {
    return 'Oatmeal with banana and honey, or toast with peanut butter. ~300-400 calories, high carb, low fiber/fat.';
  }

  if (isQualityWorkout) {
    return 'Light carbs: Toast with jam, or small bowl of oatmeal. ~200-250 calories. Easy to digest.';
  }

  if (distance <= 5) {
    return 'Optional: Coffee and a banana, or run fasted if preferred. Keep it light.';
  }

  return 'Light breakfast: Toast with nut butter, or banana with handful of granola. ~150-200 calories.';
}

/**
 * Pre-run snack recommendations
 */
function getPreRunSnack(_workout: WorkoutInfo, distance: number, timingMinutes: number): string {
  if (distance <= 5) {
    return 'Optional - banana or few dates if needed';
  }

  return `${timingMinutes} min before: Half banana or small rice cake. Quick carbs, minimal fiber.`;
}

/**
 * Pre-run hydration recommendations
 */
function getPreRunHydration(distance: number, isLongRun: boolean): string {
  if (isLongRun) {
    return '16-20oz water with electrolytes (LMNT or Nuun) starting 2hrs before';
  }

  if (distance >= 8) {
    return '12-16oz water with electrolytes 1-2hrs before';
  }

  return '8-12oz water upon waking';
}

/**
 * Generate fueling plan for the run
 */
function generateFuelingPlan(
  distance: number,
  gelStartMile: number,
  intervalMinutes: number,
  gelBrands: string[],
  isRace: boolean,
  caffeinePreference: string
): FuelingItem[] {
  const plan: FuelingItem[] = [];

  if (distance < gelStartMile) {
    return plan; // No fueling needed for short runs
  }

  const primaryGel = gelBrands[0] || 'Gel';

  // First gel
  plan.push({
    atMile: gelStartMile,
    item: `${primaryGel} gel`,
    notes: 'Take with water if available',
  });

  // Estimate pace ~8 min/mile for gel timing
  const paceMinutes = 8;
  const milesBetweenGels = Math.round(intervalMinutes / paceMinutes);

  // Subsequent gels
  let currentMile = gelStartMile + milesBetweenGels;
  let gelCount = 1;

  while (currentMile < distance - 2) {
    // Stop 2 miles from end
    const useCaffeine =
      isRace && caffeinePreference !== 'never' && currentMile > distance * 0.6;

    plan.push({
      atMile: currentMile,
      item: useCaffeine ? `${primaryGel} gel (caffeinated)` : `${primaryGel} gel`,
      notes: useCaffeine ? 'Caffeine boost for final push' : undefined,
    });

    currentMile += milesBetweenGels;
    gelCount++;
  }

  return plan;
}

/**
 * Post-run nutrition recommendations
 */
function getPostRunNutrition(distance: number, isQualityWorkout: boolean): string {
  if (distance >= 14 || isQualityWorkout) {
    return 'Recovery shake within 30min (20-30g protein + carbs). Full meal within 2hrs. Prioritize glycogen replenishment.';
  }

  if (distance >= 8) {
    return 'Protein-rich snack within 45min. Full balanced meal within 2hrs.';
  }

  return 'Normal meal timing. Include protein and carbs for recovery.';
}

/**
 * Generate a quick summary for the UI
 */
function generateQuickSummary(
  shoe: ShoeInfo | null,
  meal: string,
  fueling: FuelingItem[],
  distance: number
): string {
  const parts: string[] = [];

  if (shoe) {
    parts.push(`${shoe.brand} ${shoe.model}`);
  }

  if (distance >= 8 && fueling.length > 0) {
    parts.push(`${fueling.length} gel${fueling.length > 1 ? 's' : ''}`);
  }

  // Extract key meal point
  if (meal.toLowerCase().includes('oatmeal')) {
    parts.push('Oatmeal breakfast');
  } else if (meal.toLowerCase().includes('toast')) {
    parts.push('Light toast');
  } else if (meal.toLowerCase().includes('optional')) {
    parts.push('Optional fuel');
  }

  return parts.join(' · ');
}

/**
 * Estimate distance from duration if not specified
 */
function estimateDistanceFromDuration(durationMinutes: number | null): number {
  if (!durationMinutes) return 5; // Default assumption
  // Assume ~9 min/mile average
  return Math.round(durationMinutes / 9);
}

/**
 * Format time as HH:MM
 */
function formatTime(hours: number, minutes: number): string {
  const h = Math.max(0, Math.min(23, hours));
  const m = Math.max(0, Math.min(59, minutes));
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Main entry point: Generate run plan for a workout
 */
export async function generateWorkoutRunPlan(
  supabase: SupabaseClient,
  userId: string,
  workout: {
    id: string;
    workoutType: string;
    prescribedDistanceMiles?: number | null;
    plannedDurationMinutes?: number | null;
    prescribedDescription?: string | null;
  }
): Promise<RunPlan | null> {
  const prefs = await getRunningPreferences(supabase, userId);

  if (!prefs) {
    return null;
  }

  const workoutInfo: WorkoutInfo = {
    workoutType: workout.workoutType,
    distanceMiles: workout.prescribedDistanceMiles || null,
    durationMinutes: workout.plannedDurationMinutes || null,
    prescribedDescription: workout.prescribedDescription || null,
    isRace: workout.prescribedDescription?.toLowerCase().includes('race') || false,
    isKeyWorkout:
      workout.prescribedDescription?.toLowerCase().includes('key') ||
      ['interval', 'tempo', 'threshold'].includes(workout.workoutType),
  };

  return generateRunPlan(workoutInfo, prefs);
}
