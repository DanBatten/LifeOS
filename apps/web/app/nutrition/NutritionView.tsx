'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { HealthSnapshot, Workout, MealPlan, PlannedMeal } from '@lifeos/core';

interface RunPreferences {
  defaultRunTime: string | null;
  preferredRunDays: string[] | null;
  preRunMealTimingMinutes: number;
  preRunSnackTimingMinutes: number;
  preferredHydrationBrands: string[] | null;
  preferredGelBrands: string[] | null;
}

interface NutritionViewProps {
  todayHealth: HealthSnapshot | null;
  avgDailyCalories: number | null;
  avgActiveCalories: number | null;
  weeklyTrainingLoad: {
    totalMinutes: number;
    totalMiles: number;
    workoutCount: number;
  };
  upcomingWorkouts: Workout[];
  nutritionBiomarkers: Array<{
    name: string;
    value: number;
    unit: string;
    flag: string;
    category: string;
  }>;
  nutritionPrefs: Record<string, unknown>;
  userMetadata: Record<string, unknown>;
  estimatedDailyNeeds: number;
  latestLabDate: string | null;
  currentMealPlan?: MealPlan | null;
  todaysMeals?: PlannedMeal[];
  todaysRun: Workout | null;
  todaysRunTime: string | null;
  runPreferences: RunPreferences;
}

// Helper to parse time string to hour (24h format)
function parseTimeToHour(timeStr: string | null): number | null {
  if (!timeStr) return null;
  const parts = timeStr.split(':');
  return parseInt(parts[0], 10);
}

// Helper to format time for display
function formatTime(timeStr: string | null): string {
  if (!timeStr) return '';
  const hour = parseTimeToHour(timeStr);
  if (hour === null) return '';
  const ampm = hour >= 12 ? 'pm' : 'am';
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  const minutes = timeStr.split(':')[1] || '00';
  return `${displayHour}:${minutes}${ampm}`;
}

// Determine if run is morning (before noon)
function isMorningRun(timeStr: string | null): boolean {
  const hour = parseTimeToHour(timeStr);
  return hour !== null && hour < 12;
}

// Convert oz to litres
function ozToLitres(oz: number): number {
  return Math.round((oz * 0.0296) * 10) / 10; // 1 oz = 0.0296 L
}

// Meal type with calories
interface MealData {
  type: string;
  name: string;
  description?: string;
  timing?: string;
  calories: number;
  isHighlighted?: boolean;
}

// Meal row component
function MealRow({
  meal,
  timing,
  calories,
  isHighlighted = false,
  onRegenerate
}: {
  meal: { type: string; name: string; description?: string };
  timing?: string;
  calories: number;
  isHighlighted?: boolean;
  onRegenerate?: () => void;
}) {
  const mealEmoji: Record<string, string> = {
    breakfast: '🌅',
    lunch: '🌞',
    dinner: '🌙',
    snack: '🍎',
    pre_run: '⚡',
    post_run: '💪',
  };

  return (
    <div className={`flex items-center gap-4 py-4 border-b last:border-0 ${isHighlighted ? 'bg-amber-50 -mx-4 px-4 rounded-xl' : ''}`}>
      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-lg">
        {mealEmoji[meal.type] || '🍽️'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 uppercase tracking-wide font-medium">
            {meal.type.replace('_', '-')}
          </span>
          {timing && <span className="text-xs text-gray-400">• {timing}</span>}
        </div>
        <p className="font-medium text-gray-900">{meal.name}</p>
        {meal.description && (
          <p className="text-sm text-gray-500">{meal.description}</p>
        )}
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-semibold text-gray-700">~{calories}</p>
        <p className="text-xs text-gray-400">cal</p>
      </div>
      {onRegenerate && (
        <button
          onClick={onRegenerate}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          title="Regenerate meal suggestion"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      )}
    </div>
  );
}

// Module wrapper component
function Module({
  title,
  icon,
  action,
  children,
  variant = 'default'
}: {
  title: string;
  icon?: string;
  action?: { label: string; onClick: () => void };
  children: React.ReactNode;
  variant?: 'default' | 'highlight' | 'dark';
}) {
  const variants = {
    default: 'bg-white border',
    highlight: 'bg-[#f0f7e0] border-[#c4d147]/30',
    dark: 'bg-gray-900 text-white',
  };

  return (
    <div className={`rounded-3xl p-6 ${variants[variant]}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {icon && <span className="text-lg">{icon}</span>}
          <h2 className={`text-lg font-semibold ${variant === 'dark' ? 'text-white' : 'text-gray-900'}`}>
            {title}
          </h2>
        </div>
        {action && (
          <button
            onClick={action.onClick}
            className={`text-sm font-medium ${variant === 'dark' ? 'text-[#D4E157]' : 'text-[#7cb342]'}`}
          >
            {action.label}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

export function NutritionView({
  todayHealth,
  avgActiveCalories,
  weeklyTrainingLoad,
  upcomingWorkouts,
  nutritionBiomarkers,
  estimatedDailyNeeds,
  latestLabDate,
  todaysMeals = [],
  todaysRun,
  todaysRunTime,
  runPreferences,
}: NutritionViewProps) {
  const [overviewText, setOverviewText] = useState<string | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [generatedMeals, setGeneratedMeals] = useState<MealData[] | null>(null);
  const [mealsLoading, setMealsLoading] = useState(true);

  const hasRunToday = !!todaysRun;
  const runMiles = todaysRun?.prescribedDistanceMiles || 0;
  const runTimeFormatted = formatTime(todaysRunTime);
  const morningRun = isMorningRun(todaysRunTime);
  const runHour = parseTimeToHour(todaysRunTime);

  // Get next run for context if no run today
  const nextRun = !hasRunToday
    ? upcomingWorkouts.find(w => w.title?.toLowerCase().includes('run') || w.prescribedDistanceMiles)
    : null;

  // Fetch LLM-generated overview and meals in parallel
  useEffect(() => {
    const sleepHours = todayHealth?.sleepHours || null;
    const hrv = todayHealth?.hrv;

    // Fetch overview
    async function fetchOverview() {
      try {
        const response = await fetch('/api/nutrition/overview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sleepHours,
            sleepQuality: sleepHours ? (sleepHours >= 7 ? 'solid' : 'light') : null,
            runMiles: hasRunToday ? runMiles : null,
            runTime: hasRunToday ? runTimeFormatted : null,
            runType: todaysRun?.title?.toLowerCase() || null,
            isMorningRun: morningRun,
            hasRunToday,
            nextRunMiles: nextRun?.prescribedDistanceMiles || null,
            nextRunDay: nextRun?.scheduledDate
              ? new Date(nextRun.scheduledDate).toLocaleDateString('en-US', { weekday: 'long' })
              : null,
            hrvStatus: hrv && hrv < 40 ? 'low' : null,
            userName: 'Dan',
          }),
        });

        if (response.ok) {
          const data = await response.json();
          setOverviewText(data.overview);
        }
      } catch (error) {
        console.error('Failed to fetch overview:', error);
      } finally {
        setOverviewLoading(false);
      }
    }

    // Fetch meals (hybrid LLM + deterministic)
    async function fetchMeals() {
      try {
        const response = await fetch('/api/nutrition/meals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hasRunToday,
            runMiles: hasRunToday ? runMiles : null,
            runTime: hasRunToday ? runTimeFormatted : null,
            isMorningRun: morningRun,
            runType: todaysRun?.title?.toLowerCase() || null,
            weeklyMiles: weeklyTrainingLoad.totalMiles,
            isHighVolumeWeek: weeklyTrainingLoad.totalMiles > 40,
            sleepHours,
            hrvLow: hrv ? hrv < 40 : false,
            dailyCalorieTarget: estimatedDailyNeeds,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          setGeneratedMeals(data.meals);
        }
      } catch (error) {
        console.error('Failed to fetch meals:', error);
      } finally {
        setMealsLoading(false);
      }
    }

    fetchOverview();
    fetchMeals();
  }, [todayHealth, hasRunToday, runMiles, runTimeFormatted, morningRun, todaysRun, nextRun, weeklyTrainingLoad, estimatedDailyNeeds]);

  // Generate meals structured around run timing with calorie estimates
  const getMealsForRunSchedule = (): MealData[] => {
    if (!hasRunToday) {
      // Rest day or no run - standard meal schedule
      return [
        { type: 'breakfast', name: 'Eggs with avocado & whole grain toast', description: 'Protein-focused start', timing: '~7:30am', calories: 450 },
        { type: 'lunch', name: 'Grilled chicken salad with quinoa', description: 'Lean protein + whole grains', timing: '~12:30pm', calories: 550 },
        { type: 'snack', name: 'Greek yogurt with berries', description: 'Afternoon protein boost', timing: '~3:30pm', calories: 200 },
        { type: 'dinner', name: 'Salmon with sweet potato & vegetables', description: 'Omega-3s + complex carbs', timing: '~6:30pm', calories: 650 },
      ];
    }

    if (morningRun && runHour !== null) {
      // Morning run schedule - light snack before, breakfast after
      const snackTime = runHour > 0 ? `${runHour - 1 > 12 ? runHour - 13 : runHour - 1}:${runHour > 0 ? '45' : '00'}am` : '5:45am';
      const breakfastTime = runHour + 1 > 12 ? `${runHour - 11}:30pm` : `${runHour + 1}:30am`;

      return [
        {
          type: 'pre_run',
          name: 'Banana or rice cake with honey',
          description: 'Light, fast-digesting carbs',
          timing: `~${snackTime}`,
          calories: 120,
          isHighlighted: true
        },
        {
          type: 'breakfast',
          name: 'Oatmeal with berries, nuts & Greek yogurt',
          description: 'Post-run recovery meal - carbs + protein',
          timing: `~${breakfastTime} (post-run)`,
          calories: 550
        },
        { type: 'lunch', name: 'Grilled chicken wrap with hummus & veggies', description: 'Continued recovery nutrition', timing: '~12:30pm', calories: 500 },
        { type: 'snack', name: 'Apple with almond butter', description: 'Sustained energy', timing: '~3:30pm', calories: 250 },
        { type: 'dinner', name: 'Salmon with rice & roasted vegetables', description: 'Anti-inflammatory + glycogen replenishment', timing: '~6:30pm', calories: 700 },
      ];
    } else {
      // Afternoon/evening run - full breakfast, light lunch, post-run dinner
      return [
        { type: 'breakfast', name: 'Oatmeal with banana & almond butter', description: 'Carb-loading for later run', timing: '~7:30am', calories: 500 },
        { type: 'lunch', name: 'Turkey sandwich on whole grain', description: 'Moderate meal - 3+ hrs before run', timing: '~12:00pm', calories: 450 },
        {
          type: 'pre_run',
          name: 'Rice cake with honey or banana',
          description: 'Light pre-run fuel',
          timing: `~${runTimeFormatted ? `${parseInt(runTimeFormatted) - 1}:30pm` : '3:30pm'}`,
          calories: 100,
          isHighlighted: true
        },
        {
          type: 'dinner',
          name: 'Chicken stir-fry with rice & vegetables',
          description: 'Post-run recovery - protein + carbs',
          timing: 'Post-run',
          calories: 650
        },
      ];
    }
  };

  // Priority: 1) Database meal plan, 2) LLM-generated meals, 3) Hardcoded fallback
  const meals: MealData[] = todaysMeals.length > 0
    ? todaysMeals.map(m => ({
        type: m.mealType,
        name: m.name,
        description: m.description,
        timing: undefined,
        calories: 400, // Default estimate for planned meals
        isHighlighted: false
      }))
    : generatedMeals || getMealsForRunSchedule();

  // Calculate total calories from meals
  const totalMealCalories = meals.reduce((sum, m) => sum + m.calories, 0);

  // Hydration target in litres (base ~2.5L + ~0.2L per mile for runs)
  const baseHydrationLitres = 2.5;
  const runHydrationBonus = runMiles * 0.18; // ~180ml per mile
  const hydrationTargetLitres = Math.round((baseHydrationLitres + runHydrationBonus) * 10) / 10;
  const hydrationBrand = runPreferences.preferredHydrationBrands?.[0] || 'electrolyte mix';

  // Post-run hydration in ml
  const postRunHydrationMl = 500; // 500ml = ~16-17oz

  // Flagged biomarkers that need attention
  const flaggedBiomarkers = nutritionBiomarkers.filter(b => b.flag !== 'normal' && b.flag !== 'optimal');

  // Weekly macro focus based on training
  const getWeeklyFocus = () => {
    if (weeklyTrainingLoad.totalMiles > 40) {
      return { focus: 'High Carb', reason: 'Peak training week', carbs: 55, protein: 20, fat: 25 };
    }
    const upcomingLongRun = upcomingWorkouts.find(w => (w.prescribedDistanceMiles || 0) > 15);
    if (upcomingLongRun) {
      return { focus: 'Carb Loading', reason: 'Long run preparation', carbs: 60, protein: 18, fat: 22 };
    }
    return { focus: 'Balanced', reason: 'Standard training', carbs: 50, protein: 25, fat: 25 };
  };

  const weeklyFocus = getWeeklyFocus();

  return (
    <main className="min-h-screen bg-[#fafafa] dark:bg-[#0a0a0a] pb-8">
      {/* Header */}
      <header className="px-6 pt-8 pb-6 bg-white border-b">
        <div className="max-w-2xl mx-auto">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-4">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </Link>
          <div className="flex items-start justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Nutrition</h1>
            <div className="flex gap-2">
              <button className="bg-white text-gray-700 text-sm font-medium px-4 py-2 rounded-xl border hover:bg-gray-50 transition-colors">
                + Log
              </button>
              <button className="bg-[#D4E157] text-gray-900 text-sm font-medium px-4 py-2 rounded-xl hover:bg-[#c4d147] transition-colors">
                Plan Week
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="px-6 py-6">
        <div className="max-w-2xl mx-auto space-y-6">

          {/* Conversational Overview - LLM Generated */}
          <div className="bg-gradient-to-r from-[#f0f7e0] to-[#e8f5c8] rounded-3xl p-6">
            {overviewLoading ? (
              <div className="flex items-center gap-2 text-gray-600">
                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                <span>Loading your daily briefing...</span>
              </div>
            ) : (
              <p className="text-gray-800 leading-relaxed">
                {overviewText || `Hi Dan, focus on balanced nutrition with plenty of whole foods today.`}
              </p>
            )}
          </div>

          {/* Today's Meals Module */}
          <Module title="Today's Meals" icon="🍽️">
            {/* Targets bar */}
            <div className="flex items-center gap-6 mb-4 p-4 bg-gray-50 rounded-2xl">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🔥</span>
                <div>
                  <p className="text-lg font-bold text-gray-900">{estimatedDailyNeeds}</p>
                  <p className="text-xs text-gray-500">Calorie target</p>
                </div>
              </div>
              <div className="h-8 w-px bg-gray-200" />
              <div className="flex items-center gap-3">
                <span className="text-2xl">💧</span>
                <div>
                  <p className="text-lg font-bold text-gray-900">{hydrationTargetLitres}L</p>
                  <p className="text-xs text-gray-500">Hydration target</p>
                </div>
              </div>
            </div>

            {/* Hydration guidance for run days */}
            {hasRunToday && (
              <div className="mb-4 p-3 bg-blue-50 rounded-xl border border-blue-100">
                <div className="flex items-start gap-2">
                  <span className="text-lg">💡</span>
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">Post-run hydration</p>
                    <p className="text-blue-700">
                      Within 30 min of finishing: {postRunHydrationMl}ml water with {hydrationBrand} for electrolyte replenishment.
                      {runMiles > 8 && ` For your ${runMiles} miler, aim to replace ~${Math.round(runMiles * 0.12 * 10) / 10}L over the next 2 hours.`}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Meal list */}
            <div>
              {mealsLoading ? (
                <div className="py-8 text-center">
                  <div className="w-6 h-6 border-2 border-gray-300 border-t-[#7cb342] rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Generating personalized meals...</p>
                </div>
              ) : (
                meals.map((meal, i) => (
                  <MealRow
                    key={i}
                    meal={meal}
                    timing={meal.timing}
                    calories={meal.calories}
                    isHighlighted={meal.isHighlighted || false}
                    onRegenerate={() => console.log('Regenerate', meal.type)}
                  />
                ))
              )}
            </div>

            {/* Total calories summary */}
            <div className="mt-3 pt-3 border-t flex items-center justify-between text-sm">
              <span className="text-gray-500">Total from meals</span>
              <span className="font-semibold text-gray-700">~{totalMealCalories} cal</span>
            </div>

            {/* Quick add */}
            <div className="mt-4 flex gap-2">
              <button className="flex-1 py-2 text-sm text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">
                + Add Snack
              </button>
              <button className="flex-1 py-2 text-sm text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">
                + Log Water
              </button>
            </div>
          </Module>

          {/* Weekly Overview Module */}
          <Module
            title="This Week"
            icon="📊"
            action={{ label: 'Plan meals →', onClick: () => console.log('Plan') }}
          >
            {/* Macro focus */}
            <div className="mb-4 p-4 bg-amber-50 rounded-2xl">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-amber-800">{weeklyFocus.focus} Week</span>
                <span className="text-sm text-amber-600">{weeklyFocus.reason}</span>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-600">Carbs</span>
                    <span className="font-medium">{weeklyFocus.carbs}%</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full" style={{ width: `${weeklyFocus.carbs}%` }} />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-600">Protein</span>
                    <span className="font-medium">{weeklyFocus.protein}%</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-red-400 rounded-full" style={{ width: `${weeklyFocus.protein}%` }} />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-600">Fat</span>
                    <span className="font-medium">{weeklyFocus.fat}%</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-400 rounded-full" style={{ width: `${weeklyFocus.fat}%` }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Week at a glance */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => {
                const isToday = i === (new Date().getDay() + 6) % 7; // Adjust for Monday start
                return (
                  <div key={i} className={`py-2 rounded-lg ${isToday ? 'bg-[#D4E157]' : 'bg-gray-100'}`}>
                    <span className={`text-xs font-medium ${isToday ? 'text-gray-900' : 'text-gray-500'}`}>{day}</span>
                  </div>
                );
              })}
            </div>
          </Module>

          {/* Fitness Module */}
          <Module title="Training" icon="🏃" variant="dark">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-3xl font-bold text-white">{Math.round(weeklyTrainingLoad.totalMiles)}</p>
                <p className="text-xs text-gray-400">Miles this week</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-white">{weeklyTrainingLoad.workoutCount}</p>
                <p className="text-xs text-gray-400">Runs</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-[#D4E157]">{avgActiveCalories || '—'}</p>
                <p className="text-xs text-gray-400">Avg active cal</p>
              </div>
            </div>

            {(hasRunToday || nextRun) && (
              <div className="mt-4 pt-4 border-t border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">{hasRunToday ? "Today's run" : 'Next run'}</p>
                    <p className="font-medium text-white">{hasRunToday ? todaysRun?.title : nextRun?.title}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-[#D4E157]">
                      {hasRunToday ? runMiles : nextRun?.prescribedDistanceMiles} mi
                    </p>
                    <p className="text-xs text-gray-400">
                      {hasRunToday
                        ? runTimeFormatted
                        : nextRun?.scheduledDate && new Date(nextRun.scheduledDate).toLocaleDateString('en-US', { weekday: 'short' })
                      }
                    </p>
                  </div>
                </div>
              </div>
            )}
          </Module>

          {/* Health Module */}
          <Module
            title="Health Insights"
            icon="❤️"
            action={{ label: 'View all →', onClick: () => window.location.href = '/health' }}
          >
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center p-3 bg-gray-50 rounded-xl">
                <p className="text-2xl font-bold text-gray-900">{todayHealth?.sleepHours?.toFixed(1) || '—'}</p>
                <p className="text-xs text-gray-500">Sleep (hrs)</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-xl">
                <p className="text-2xl font-bold text-gray-900">{todayHealth?.hrv || '—'}</p>
                <p className="text-xs text-gray-500">HRV</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-xl">
                <p className="text-2xl font-bold text-gray-900">{todayHealth?.restingHr || '—'}</p>
                <p className="text-xs text-gray-500">Resting HR</p>
              </div>
            </div>

            {/* Biomarkers needing attention */}
            {flaggedBiomarkers.length > 0 && (
              <div className="border-t pt-4">
                <p className="text-sm font-medium text-amber-600 mb-2">Nutrition priorities from labs:</p>
                {flaggedBiomarkers.slice(0, 3).map((b, i) => (
                  <div key={i} className="flex items-center justify-between py-2">
                    <span className="text-sm text-gray-700">{b.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      b.flag === 'low' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {b.flag} ({b.value} {b.unit})
                    </span>
                  </div>
                ))}
                {latestLabDate && (
                  <p className="text-xs text-gray-400 mt-2">
                    Last labs: {new Date(latestLabDate).toLocaleDateString()}
                  </p>
                )}
              </div>
            )}
          </Module>

        </div>
      </div>
    </main>
  );
}
