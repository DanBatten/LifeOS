export const dynamic = 'force-dynamic';

import { getSupabase } from '@/lib/supabase';
import { getEnv } from '@/lib/env';
import { HealthRepository, WorkoutRepository, MealPlanRepository } from '@lifeos/database';
import { NutritionView } from './NutritionView';

// Helper to get current week bounds (Monday to Sunday)
function getCurrentWeekBounds(): { start: Date; end: Date } {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.

  // Calculate days to subtract to get to Monday
  // If Sunday (0), go back 6 days. If Monday (1), go back 0 days. etc.
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  const monday = new Date(now);
  monday.setDate(now.getDate() - daysToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return { start: monday, end: sunday };
}

// User preferences interface
interface UserRunPreferences {
  defaultRunTime: string | null; // e.g., "06:30:00"
  preferredRunDays: string[] | null;
  preRunMealTimingMinutes: number;
  preRunSnackTimingMinutes: number;
  preferredHydrationBrands: string[] | null;
  preferredGelBrands: string[] | null;
}

export default async function NutritionPage() {
  const supabase = getSupabase();
  const env = getEnv();
  const userId = env.USER_ID;
  const timezone = env.TIMEZONE;

  const healthRepo = new HealthRepository(supabase, timezone);
  const workoutRepo = new WorkoutRepository(supabase);
  const mealPlanRepo = new MealPlanRepository(supabase);

  // Get current week bounds for training data
  const { start: weekStart, end: weekEnd } = getCurrentWeekBounds();

  // Fetch health, activity, meal plan, and user preferences in parallel
  const [todayHealth, recentHealth, thisWeeksWorkouts, upcomingWorkouts, todaysWorkouts, currentMealPlan] = await Promise.all([
    healthRepo.getToday(userId).catch(() => null),
    healthRepo.getRecentSnapshots(userId, 7).catch(() => []),
    workoutRepo.findByDateRange(userId, weekStart, weekEnd).catch(() => []),
    workoutRepo.findUpcoming(userId, 7).catch(() => []),
    workoutRepo.findToday(userId).catch(() => []),
    mealPlanRepo.getCurrentWeekPlan(userId).catch(() => null),
  ]);

  // Fetch user preferences separately for proper typing
  const { data: userPrefsData } = await supabase
    .from('user_preferences')
    .select('default_run_time, preferred_run_days, pre_run_meal_timing_minutes, pre_run_snack_timing_minutes, preferred_hydration_brands, preferred_gel_brands')
    .eq('user_id', userId)
    .single();

  const typedPrefs = userPrefsData as {
    default_run_time?: string;
    preferred_run_days?: string[];
    pre_run_meal_timing_minutes?: number;
    pre_run_snack_timing_minutes?: number;
    preferred_hydration_brands?: string[];
    preferred_gel_brands?: string[];
  } | null;

  // Transform user preferences
  const userRunPreferences: UserRunPreferences = {
    defaultRunTime: typedPrefs?.default_run_time || '06:30:00', // Default to 6:30 AM
    preferredRunDays: typedPrefs?.preferred_run_days || null,
    preRunMealTimingMinutes: typedPrefs?.pre_run_meal_timing_minutes || 120,
    preRunSnackTimingMinutes: typedPrefs?.pre_run_snack_timing_minutes || 30,
    preferredHydrationBrands: typedPrefs?.preferred_hydration_brands || ['LMNT', 'Nuun'],
    preferredGelBrands: typedPrefs?.preferred_gel_brands || null,
  };

  // Get today's run with scheduled time
  const todaysRun = todaysWorkouts.find(w =>
    w.title?.toLowerCase().includes('run') || w.prescribedDistanceMiles
  );

  // Determine actual run time for today (from workout or default preference)
  const todaysRunTime = todaysRun?.scheduledTime || userRunPreferences.defaultRunTime;

  // Get today's meals if we have a meal plan
  let todaysMeals: Awaited<ReturnType<typeof mealPlanRepo.getMealsForPlan>> = [];
  if (currentMealPlan) {
    const allMeals = await mealPlanRepo.getMealsForPlan(currentMealPlan.id).catch(() => []);
    // Filter to today's day of week
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const todayDayOfWeek = days[new Date().getDay()];
    todaysMeals = allMeals.filter(m => m.dayOfWeek === todayDayOfWeek);
  }

  // Fetch user preferences for nutrition settings
  const { data: userDataRaw } = await supabase
    .from('users')
    .select('preferences, metadata')
    .eq('id', userId)
    .single();

  const userData = userDataRaw as { preferences?: Record<string, unknown>; metadata?: Record<string, unknown> } | null;
  const nutritionPrefs = (userData?.preferences as Record<string, unknown>)?.nutrition || {};
  const userMetadata = userData?.metadata || {};

  // Fetch key biomarkers related to nutrition/metabolism
  const { data: latestPanelRaw } = await supabase
    .from('lab_panels')
    .select('id, panel_date')
    .eq('user_id', userId)
    .order('panel_date', { ascending: false })
    .limit(1)
    .single();

  const latestPanel = latestPanelRaw as { id: string; panel_date: string } | null;

  let nutritionBiomarkers: Array<{
    name: string;
    value: number;
    unit: string;
    flag: string;
    category: string;
  }> = [];

  if (latestPanel) {
    // Get nutrition-relevant biomarkers
    const nutritionCategories = ['metabolic', 'vitamins', 'minerals', 'lipid_panel'];
    const { data: results } = await supabase
      .from('biomarker_results')
      .select(`
        value,
        unit,
        flag,
        biomarker_definitions (
          name,
          category
        )
      `)
      .eq('panel_id', latestPanel.id);

    if (results) {
      nutritionBiomarkers = results
        .filter((r: Record<string, unknown>) => {
          const def = r.biomarker_definitions as { category: string } | null;
          return def && nutritionCategories.includes(def.category);
        })
        .map((r: Record<string, unknown>) => {
          const def = r.biomarker_definitions as { name: string; category: string };
          return {
            name: def.name,
            value: r.value as number,
            unit: r.unit as string,
            flag: r.flag as string,
            category: def.category,
          };
        });
    }
  }

  // Calculate weekly training load from this week's scheduled workouts
  // This includes both completed and planned workouts for the current Monday-Sunday week
  const weeklyTrainingLoad = thisWeeksWorkouts.reduce((acc, w) => {
    // Use actual values for completed workouts, planned values for upcoming
    const duration = w.actualDurationMinutes || w.plannedDurationMinutes || 0;
    const distance = w.status === 'completed'
      ? ((w.metadata as Record<string, unknown>)?.actualDistanceMiles as number || w.prescribedDistanceMiles || 0)
      : (w.prescribedDistanceMiles || 0);
    return {
      totalMinutes: acc.totalMinutes + duration,
      totalMiles: acc.totalMiles + distance,
      workoutCount: acc.workoutCount + 1,
    };
  }, { totalMinutes: 0, totalMiles: 0, workoutCount: 0 });

  // Calculate average daily calories burned from health snapshots
  const avgDailyCalories = recentHealth.length > 0
    ? Math.round(
        recentHealth.reduce((sum, h) => sum + (h.totalCalories || 0), 0) / recentHealth.length
      )
    : null;

  const avgActiveCalories = recentHealth.length > 0
    ? Math.round(
        recentHealth.reduce((sum, h) => sum + (h.activeCalories || 0), 0) / recentHealth.length
      )
    : null;

  // Estimate daily calorie needs based on activity level
  // Base: ~2000-2200 for moderately active adult
  // Add ~100 cal per mile run
  const estimatedDailyNeeds = 2100 + (weeklyTrainingLoad.totalMiles / 7) * 100;

  return (
    <NutritionView
      todayHealth={todayHealth}
      avgDailyCalories={avgDailyCalories}
      avgActiveCalories={avgActiveCalories}
      weeklyTrainingLoad={weeklyTrainingLoad}
      upcomingWorkouts={upcomingWorkouts}
      nutritionBiomarkers={nutritionBiomarkers}
      nutritionPrefs={nutritionPrefs as Record<string, unknown>}
      userMetadata={userMetadata as Record<string, unknown>}
      estimatedDailyNeeds={Math.round(estimatedDailyNeeds)}
      latestLabDate={latestPanel?.panel_date || null}
      currentMealPlan={currentMealPlan}
      todaysMeals={todaysMeals}
      todaysRun={todaysRun || null}
      todaysRunTime={todaysRunTime}
      runPreferences={userRunPreferences}
    />
  );
}
