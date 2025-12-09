import type { LLMProvider } from '@lifeos/llm';
import { getAgentModelConfig } from '@lifeos/llm';
import { BaseAgent } from '../base/BaseAgent.js';
import type { AgentContext, AgentTool } from '../base/types.js';
import { getNutritionTools } from './tools.js';
import { NUTRITION_AGENT_SYSTEM_PROMPT, NUTRITION_USER_PROMPT_TEMPLATE } from './prompts.js';

/**
 * Nutrition Agent
 *
 * Holistic nutrition guidance based on health data, biomarkers, training load,
 * and metabolism. Focuses on meal planning and practical recommendations rather
 * than calorie counting.
 *
 * Philosophy:
 * - Recommend meals, not numbers
 * - Use biomarkers to identify gaps
 * - Sync nutrition with training load
 * - Keep it practical for a busy person
 * - Consider the whole family
 */
export class NutritionAgent extends BaseAgent {
  constructor(llmClient: LLMProvider) {
    const modelConfig = getAgentModelConfig('nutrition-agent');

    super(
      {
        id: 'nutrition-agent',
        name: 'Nutrition Agent',
        description: 'Holistic nutrition guidance based on health, biomarkers, and training',
        model: modelConfig.model.id,
        temperature: modelConfig.temperature,
        maxTokens: modelConfig.maxTokens,
      },
      llmClient
    );
  }

  protected registerTools(): AgentTool[] {
    return getNutritionTools();
  }

  protected buildSystemPrompt(context: AgentContext): string {
    const now = new Date();

    return NUTRITION_AGENT_SYSTEM_PROMPT
      .replace('{{user_name}}', context.userName)
      .replace('{{current_date}}', context.date)
      .replace('{{current_time}}', now.toLocaleTimeString('en-US', { hour12: true }))
      .replace('{{timezone}}', context.timezone);
  }

  protected buildUserPrompt(context: AgentContext): string {
    const {
      todaysContext,
      healthStatus,
      trainingContext,
      biomarkerSummary,
      foodPreferences,
      userRequest,
    } = context.data;

    return NUTRITION_USER_PROMPT_TEMPLATE
      .replace('{{todays_context}}', this.formatData(todaysContext, 'No specific context'))
      .replace('{{health_status}}', this.formatHealthStatus(healthStatus))
      .replace('{{training_context}}', this.formatTrainingContext(trainingContext))
      .replace('{{biomarker_summary}}', this.formatBiomarkers(biomarkerSummary))
      .replace('{{food_preferences}}', this.formatPreferences(foodPreferences))
      .replace('{{user_request}}', (userRequest as string) || 'Provide general nutrition guidance for today');
  }

  private formatHealthStatus(health: unknown): string {
    if (!health) return 'No health data available';

    const h = health as Record<string, unknown>;
    const lines = [];

    if (h.recoveryScore !== undefined) {
      const score = Math.round((h.recoveryScore as number) * 100);
      lines.push(`Recovery: ${score}% (${score >= 70 ? 'Good' : score >= 50 ? 'Moderate' : 'Low'})`);
    }
    if (h.sleepHours) lines.push(`Sleep: ${h.sleepHours} hours`);
    if (h.hrv) lines.push(`HRV: ${h.hrv}ms`);
    if (h.energyLevel) lines.push(`Energy: ${h.energyLevel}/10`);
    if (h.stressLevel) lines.push(`Stress: ${h.stressLevel}/10`);

    return lines.length > 0 ? lines.join('\n') : 'No health data available';
  }

  private formatTrainingContext(training: unknown): string {
    if (!training) return 'No training data available';

    const t = training as Record<string, unknown>;
    const lines = [];

    if (t.todaysWorkout) {
      const w = t.todaysWorkout as Record<string, unknown>;
      lines.push(`Today's Workout: ${w.title || w.type || 'Scheduled'}`);
      if (w.distanceMiles) lines.push(`  Distance: ${w.distanceMiles} miles`);
      if (w.pacePerMile) lines.push(`  Pace: ${w.pacePerMile}`);
    } else {
      lines.push('Today: Rest day or no workout scheduled');
    }

    if (t.weeklyMileage) lines.push(`Weekly Mileage: ${t.weeklyMileage} miles`);
    if (t.trainingPhase) lines.push(`Training Phase: ${t.trainingPhase}`);
    if (t.weeksToRace) lines.push(`Weeks to Race: ${t.weeksToRace}`);

    return lines.length > 0 ? lines.join('\n') : 'No training data available';
  }

  private formatBiomarkers(biomarkers: unknown): string {
    if (!biomarkers) return 'No recent lab results';

    if (Array.isArray(biomarkers)) {
      if (biomarkers.length === 0) return 'No recent lab results';

      const concerns = biomarkers.filter((b: Record<string, unknown>) =>
        b.flag === 'low' || b.flag === 'high' || b.optimalStatus !== 'optimal'
      );

      if (concerns.length === 0) {
        return 'All biomarkers in normal range';
      }

      return concerns.map((b: Record<string, unknown>) =>
        `${b.name}: ${b.value} ${b.unit} (${b.flag})`
      ).join('\n');
    }

    return this.formatData(biomarkers, 'No recent lab results');
  }

  private formatPreferences(prefs: unknown): string {
    if (!prefs) return 'No preferences specified';

    const p = prefs as Record<string, unknown>;
    const lines = [];

    if (p.dietaryRestrictions) {
      const restrictions = Array.isArray(p.dietaryRestrictions)
        ? p.dietaryRestrictions.join(', ')
        : p.dietaryRestrictions;
      lines.push(`Dietary Restrictions: ${restrictions}`);
    }
    if (p.favoriteFoods) {
      const favorites = Array.isArray(p.favoriteFoods)
        ? p.favoriteFoods.join(', ')
        : p.favoriteFoods;
      lines.push(`Favorite Foods: ${favorites}`);
    }
    if (p.dislikedFoods) {
      const dislikes = Array.isArray(p.dislikedFoods)
        ? p.dislikedFoods.join(', ')
        : p.dislikedFoods;
      lines.push(`Dislikes: ${dislikes}`);
    }
    if (p.cookingLevel) lines.push(`Cooking Skill: ${p.cookingLevel}`);
    if (p.mealPrepTime) lines.push(`Time for Cooking: ${p.mealPrepTime}`);

    return lines.length > 0 ? lines.join('\n') : 'Standard nutrition approach';
  }

  private formatData(data: unknown, emptyMessage: string): string {
    if (!data || (Array.isArray(data) && data.length === 0)) {
      return emptyMessage;
    }

    if (typeof data === 'string') {
      return data;
    }

    return JSON.stringify(data, null, 2);
  }

  /**
   * Calculate estimated daily caloric needs based on training
   * This is used internally to inform meal portion guidance, not shown to user
   */
  estimateDailyNeeds(params: {
    basalMetabolicRate?: number; // If known
    weight: number; // lbs
    weeklyMileage: number;
    todaysWorkoutMiles?: number;
    isRecoveryDay?: boolean;
  }): {
    estimatedRange: { low: number; high: number };
    mealSizeGuidance: string;
    emphasis: string;
  } {
    // Base: estimate BMR if not provided (rough estimate)
    const bmr = params.basalMetabolicRate || (params.weight * 10 + 800);

    // Activity multiplier
    const weeklyActivity = params.weeklyMileage * 100; // ~100 cal/mile
    const dailyTrainingCals = weeklyActivity / 7;

    // Today's workout addition
    const todaysCals = (params.todaysWorkoutMiles || 0) * 100;

    // Total estimate
    const baseNeeds = bmr * 1.4; // Moderate activity multiplier
    const totalNeeds = baseNeeds + dailyTrainingCals + todaysCals;

    // Adjust for recovery day
    const low = params.isRecoveryDay ? totalNeeds * 0.9 : totalNeeds * 0.95;
    const high = params.isRecoveryDay ? totalNeeds * 1.0 : totalNeeds * 1.1;

    // Meal size guidance (not calorie counts)
    let mealSizeGuidance: string;
    let emphasis: string;

    if (params.todaysWorkoutMiles && params.todaysWorkoutMiles > 10) {
      mealSizeGuidance = 'Larger portions today, especially carbs. Extra snacks between meals.';
      emphasis = 'carbohydrates for fuel and recovery';
    } else if (params.todaysWorkoutMiles && params.todaysWorkoutMiles > 6) {
      mealSizeGuidance = 'Normal to slightly larger portions. Have a recovery snack after run.';
      emphasis = 'balanced macros with good protein for recovery';
    } else if (params.isRecoveryDay) {
      mealSizeGuidance = 'Standard portions. Focus on nutrient-dense foods.';
      emphasis = 'protein and anti-inflammatory foods for recovery';
    } else {
      mealSizeGuidance = 'Standard portions appropriate for your hunger.';
      emphasis = 'balanced nutrition with whole foods';
    }

    return {
      estimatedRange: { low: Math.round(low), high: Math.round(high) },
      mealSizeGuidance,
      emphasis,
    };
  }

  /**
   * Generate pre-workout nutrition based on workout type and timing
   * Deterministic helper - no LLM call needed
   */
  getPreWorkoutNutrition(workout: {
    type: string;
    distanceMiles: number;
    durationMinutes: number;
    hoursUntilStart: number;
  }): {
    meal: string;
    timing: string;
    hydration: string;
    avoid: string;
  } {
    const { type, distanceMiles, durationMinutes, hoursUntilStart } = workout;

    // Long run or race
    if (distanceMiles > 12 || type === 'race' || type === 'long_run') {
      if (hoursUntilStart >= 3) {
        return {
          meal: 'Oatmeal with banana and honey, or bagel with peanut butter. Include a small amount of protein.',
          timing: '2-3 hours before your run',
          hydration: '16-20 oz water over the next 2 hours, stop 30 min before start',
          avoid: 'High fiber, high fat, anything new or untested',
        };
      } else if (hoursUntilStart >= 1.5) {
        return {
          meal: 'Toast with peanut butter and banana, or a small bowl of oatmeal',
          timing: 'Now, to allow 90+ minutes to digest',
          hydration: '12-16 oz water, finish 30 min before start',
          avoid: 'Fiber, fat, dairy, large portions',
        };
      } else {
        return {
          meal: 'Small banana or a few bites of energy bar if hungry',
          timing: 'Keep it minimal with less than 90 min to go',
          hydration: '4-8 oz water, stop 20 min before',
          avoid: 'Anything substantial - too late for a meal',
        };
      }
    }

    // Tempo or intervals
    if (type === 'tempo' || type === 'intervals' || distanceMiles > 6) {
      if (hoursUntilStart >= 2) {
        return {
          meal: 'Light, easily digestible meal - toast with nut butter, small oatmeal, or banana with yogurt',
          timing: '1.5-2 hours before',
          hydration: '12-16 oz water before your run',
          avoid: 'Heavy meals, high fiber, too much fat',
        };
      } else {
        return {
          meal: 'Banana, small energy bar, or skip if not hungry',
          timing: 'At least 30-45 min before',
          hydration: '8-12 oz water',
          avoid: 'Anything heavy or new',
        };
      }
    }

    // Easy/short run
    if (durationMinutes < 60) {
      return {
        meal: 'Optional - can run fasted or have a small snack if hungry (banana, few crackers)',
        timing: 'Whenever, short runs are flexible',
        hydration: 'Stay normally hydrated, no need to force fluids',
        avoid: 'No restrictions for short easy runs',
      };
    }

    // Default
    return {
      meal: 'Light snack 1-2 hours before if hungry - banana, toast, or small oatmeal',
      timing: '1-2 hours before',
      hydration: '8-16 oz water in the hours before',
      avoid: 'Anything you haven\'t tested before a run',
    };
  }

  /**
   * Generate post-workout recovery nutrition
   * Deterministic helper - no LLM call needed
   */
  getPostWorkoutNutrition(workout: {
    type: string;
    distanceMiles: number;
    durationMinutes: number;
  }): {
    immediate: string;
    meal: string;
    hydration: string;
    priority: string;
  } {
    const { type, distanceMiles, durationMinutes } = workout;

    // Long run or hard workout
    if (distanceMiles > 12 || type === 'long_run') {
      return {
        immediate: 'Within 30 min: Recovery shake, chocolate milk, or Greek yogurt with fruit. Aim for 20-30g protein + 40-60g carbs.',
        meal: 'Full meal within 2 hours: Chicken or salmon with rice/potato and vegetables. Don\'t skimp on carbs today.',
        hydration: 'Drink to thirst plus extra - aim to replace fluids over next few hours. Consider electrolytes.',
        priority: 'Glycogen replenishment is critical. Eat more than you think you need.',
      };
    }

    // Tempo or intervals
    if (type === 'tempo' || type === 'intervals') {
      return {
        immediate: 'Protein shake, chocolate milk, or Greek yogurt within 30-45 min',
        meal: 'Balanced meal within 1-2 hours with good protein source',
        hydration: 'Rehydrate well, 16-24 oz in first hour',
        priority: 'Protein for muscle recovery, moderate carbs to refuel',
      };
    }

    // Moderate run
    if (distanceMiles > 6 || durationMinutes > 60) {
      return {
        immediate: 'Optional recovery snack - banana with nut butter, or wait for your next meal',
        meal: 'Normal balanced meal within 1-2 hours',
        hydration: 'Drink to thirst, 12-20 oz',
        priority: 'Standard recovery - your body knows what it needs',
      };
    }

    // Easy/short run
    return {
      immediate: 'Not critical - just eat your normal next meal',
      meal: 'Regular balanced meal when hungry',
      hydration: 'Drink when thirsty',
      priority: 'No special recovery needs for short easy runs',
    };
  }
}
