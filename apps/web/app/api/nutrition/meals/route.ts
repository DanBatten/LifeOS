import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createLLMClient } from '@lifeos/llm';
import { getSupabase } from '@/lib/supabase';
import { getEnv } from '@/lib/env';

// ============================================================================
// TYPES
// ============================================================================

interface MealSlot {
  type: 'pre_run' | 'breakfast' | 'lunch' | 'snack' | 'dinner' | 'post_run';
  timing: string;
  purpose: string;
  calorieTarget: number;
  macroFocus: 'carbs' | 'protein' | 'balanced';
}

interface GeneratedMeal {
  type: string;
  timing: string;
  name: string;
  description: string;
  calories: number;
  isHighlighted: boolean;
}

// ============================================================================
// REQUEST SCHEMA
// ============================================================================

const MealsRequestSchema = z.object({
  // Run context
  hasRunToday: z.boolean(),
  runMiles: z.number().nullable(),
  runTime: z.string().nullable(), // "6:30am"
  isMorningRun: z.boolean(),
  runType: z.string().nullable(), // "easy run", "tempo", "long run"

  // Training context
  weeklyMiles: z.number().nullable(),
  isHighVolumeWeek: z.boolean().default(false),

  // Health context
  sleepHours: z.number().nullable(),
  hrvLow: z.boolean().default(false),

  // Calorie target
  dailyCalorieTarget: z.number(),
});

// ============================================================================
// DETERMINISTIC: Meal Structure Based on Run Timing
// ============================================================================

function getMealStructure(
  hasRun: boolean,
  isMorningRun: boolean,
  runTime: string | null,
  runMiles: number,
  dailyCalories: number
): MealSlot[] {
  if (!hasRun) {
    // Rest day - balanced structure
    return [
      { type: 'breakfast', timing: '~7:30am', purpose: 'Start day with protein', calorieTarget: Math.round(dailyCalories * 0.25), macroFocus: 'protein' },
      { type: 'lunch', timing: '~12:30pm', purpose: 'Balanced midday meal', calorieTarget: Math.round(dailyCalories * 0.30), macroFocus: 'balanced' },
      { type: 'snack', timing: '~3:30pm', purpose: 'Afternoon energy', calorieTarget: Math.round(dailyCalories * 0.10), macroFocus: 'balanced' },
      { type: 'dinner', timing: '~6:30pm', purpose: 'Recovery and satisfaction', calorieTarget: Math.round(dailyCalories * 0.35), macroFocus: 'balanced' },
    ];
  }

  if (isMorningRun) {
    // Morning run - pre-run snack, post-run breakfast focus
    const runHour = runTime ? parseInt(runTime.split(':')[0]) : 6;
    const preRunTime = `~${runHour - 1 > 0 ? runHour - 1 : 5}:45am`;
    const postRunTime = `~${runHour + 1}:30am`;

    const slots: MealSlot[] = [
      { type: 'pre_run', timing: preRunTime, purpose: 'Quick fuel before run', calorieTarget: 120, macroFocus: 'carbs' },
      { type: 'breakfast', timing: `${postRunTime} (post-run)`, purpose: 'Recovery - carbs + protein', calorieTarget: Math.round(dailyCalories * 0.25), macroFocus: 'balanced' },
      { type: 'lunch', timing: '~12:30pm', purpose: 'Continued recovery', calorieTarget: Math.round(dailyCalories * 0.25), macroFocus: 'balanced' },
      { type: 'snack', timing: '~3:30pm', purpose: 'Sustained energy', calorieTarget: Math.round(dailyCalories * 0.10), macroFocus: 'balanced' },
      { type: 'dinner', timing: '~6:30pm', purpose: 'Glycogen replenishment', calorieTarget: Math.round(dailyCalories * 0.30), macroFocus: runMiles > 10 ? 'carbs' : 'balanced' },
    ];
    return slots;
  } else {
    // Afternoon/evening run - carb-loaded breakfast, light lunch, post-run dinner
    return [
      { type: 'breakfast', timing: '~7:30am', purpose: 'Carb loading for run', calorieTarget: Math.round(dailyCalories * 0.25), macroFocus: 'carbs' },
      { type: 'lunch', timing: '~12:00pm', purpose: 'Moderate - 3+ hrs before run', calorieTarget: Math.round(dailyCalories * 0.20), macroFocus: 'balanced' },
      { type: 'pre_run', timing: '30-45 min before run', purpose: 'Light pre-run fuel', calorieTarget: 100, macroFocus: 'carbs' },
      { type: 'dinner', timing: 'Post-run', purpose: 'Recovery - protein + carbs', calorieTarget: Math.round(dailyCalories * 0.35), macroFocus: 'protein' },
    ];
  }
}

// ============================================================================
// LLM: Creative Meal Suggestions
// ============================================================================

async function generateMealSuggestions(
  mealSlots: MealSlot[],
  preferences: {
    favoriteFoods: string[];
    dislikedFoods: string[];
    dietaryRestrictions: string[];
    cookingSkill: string;
  },
  context: {
    runType: string | null;
    isRecoveryFocus: boolean;
    hrvLow: boolean;
  }
): Promise<GeneratedMeal[]> {
  const llmClient = createLLMClient();

  const slotsDescription = mealSlots.map(s =>
    `- ${s.type}: ${s.timing}, ~${s.calorieTarget} cal, focus: ${s.macroFocus}, purpose: ${s.purpose}`
  ).join('\n');

  const preferencesDescription = `
Favorite foods: ${preferences.favoriteFoods.length > 0 ? preferences.favoriteFoods.join(', ') : 'not specified'}
Foods to avoid: ${preferences.dislikedFoods.length > 0 ? preferences.dislikedFoods.join(', ') : 'none'}
Dietary restrictions: ${preferences.dietaryRestrictions.length > 0 ? preferences.dietaryRestrictions.join(', ') : 'none'}
Cooking skill: ${preferences.cookingSkill}
${context.hrvLow ? 'Note: HRV is low - suggest anti-inflammatory foods' : ''}
${context.isRecoveryFocus ? 'Note: Focus on recovery nutrition' : ''}
${context.runType ? `Today's run: ${context.runType}` : ''}
`.trim();

  const response = await llmClient.chat({
    model: 'claude-3-5-haiku-latest',
    systemPrompt: `You are a sports nutrition expert. Generate specific meal suggestions for an endurance athlete.

Return ONLY a valid JSON array with one object per meal slot. Each object must have:
- type: the meal type exactly as given
- timing: the timing exactly as given
- name: a specific, appetizing meal name (e.g., "Greek yogurt parfait with granola and berries")
- description: brief 3-6 word description of nutritional benefit
- calories: the calorie target as a number
- isHighlighted: true only for pre_run meals

Be specific with meal names - not generic. Consider the preferences and context provided.
Keep meals practical and realistic for a busy person.`,
    messages: [
      {
        role: 'user',
        content: `Generate meals for these slots:

${slotsDescription}

Preferences and context:
${preferencesDescription}

Return only the JSON array, no other text.`,
      },
    ],
    maxTokens: 800,
    temperature: 0.7,
  });

  try {
    // Parse the JSON response
    const content = response.content.trim();
    // Handle potential markdown code blocks
    const jsonStr = content.startsWith('[') ? content : content.replace(/```json?\n?|\n?```/g, '').trim();
    const meals = JSON.parse(jsonStr) as GeneratedMeal[];
    return meals;
  } catch (error) {
    console.error('[Meals API] Failed to parse LLM response:', error, response.content);
    // Fallback to template meals
    return mealSlots.map(slot => ({
      type: slot.type,
      timing: slot.timing,
      name: getDefaultMealName(slot.type, slot.macroFocus),
      description: slot.purpose,
      calories: slot.calorieTarget,
      isHighlighted: slot.type === 'pre_run',
    }));
  }
}

function getDefaultMealName(type: string, macroFocus: string): string {
  const defaults: Record<string, Record<string, string>> = {
    pre_run: { carbs: 'Banana with honey', protein: 'Greek yogurt', balanced: 'Rice cake with almond butter' },
    breakfast: { carbs: 'Oatmeal with berries and honey', protein: 'Eggs with avocado toast', balanced: 'Overnight oats with nuts and fruit' },
    lunch: { carbs: 'Pasta salad with vegetables', protein: 'Grilled chicken salad', balanced: 'Chicken wrap with hummus' },
    snack: { carbs: 'Apple with honey', protein: 'Greek yogurt with nuts', balanced: 'Trail mix with dried fruit' },
    dinner: { carbs: 'Rice bowl with vegetables', protein: 'Salmon with quinoa', balanced: 'Stir-fry with rice and tofu' },
    post_run: { carbs: 'Smoothie with banana and oats', protein: 'Protein shake with fruit', balanced: 'Chocolate milk and banana' },
  };
  return defaults[type]?.[macroFocus] || 'Balanced meal';
}

// ============================================================================
// API HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = MealsRequestSchema.parse(body);

    const env = getEnv();
    const supabase = getSupabase();
    const userId = env.USER_ID;

    // Fetch user preferences from database
    const { data: prefsData } = await supabase
      .from('user_preferences')
      .select('favorite_foods, disliked_foods, dietary_restrictions, cooking_skill')
      .eq('user_id', userId)
      .single();

    const typedPrefs = prefsData as {
      favorite_foods?: string[];
      disliked_foods?: string[];
      dietary_restrictions?: string[];
      cooking_skill?: string;
    } | null;

    const preferences = {
      favoriteFoods: typedPrefs?.favorite_foods || [],
      dislikedFoods: typedPrefs?.disliked_foods || [],
      dietaryRestrictions: typedPrefs?.dietary_restrictions || [],
      cookingSkill: typedPrefs?.cooking_skill || 'intermediate',
    };

    // Step 1: Get deterministic meal structure
    const mealStructure = getMealStructure(
      data.hasRunToday,
      data.isMorningRun,
      data.runTime,
      data.runMiles || 0,
      data.dailyCalorieTarget
    );

    // Step 2: Generate creative meal suggestions via LLM
    const meals = await generateMealSuggestions(
      mealStructure,
      preferences,
      {
        runType: data.runType,
        isRecoveryFocus: data.hasRunToday && (data.runMiles || 0) > 8,
        hrvLow: data.hrvLow,
      }
    );

    return NextResponse.json({
      meals,
      structure: mealStructure, // Include for debugging/transparency
      preferences: {
        hasPreferences: preferences.favoriteFoods.length > 0 || preferences.dislikedFoods.length > 0,
      },
    });
  } catch (error) {
    console.error('[Meals API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate meals' },
      { status: 500 }
    );
  }
}
