import type { LLMProvider } from '@lifeos/llm';
import { getAgentModelConfig } from '@lifeos/llm';
import { BaseAgent } from '../../base/BaseAgent.js';
import type { AgentContext, AgentTool } from '../../base/types.js';
import { getMealPlannerTools } from './tools.js';
import { MEAL_PLANNER_SYSTEM_PROMPT, MEAL_PLANNER_USER_PROMPT_TEMPLATE } from './prompts.js';

/**
 * Meal Planner Agent
 *
 * Sub-agent of NutritionAgent focused on family meal planning.
 * Translates the athlete's nutritional needs into practical family meals,
 * grocery lists, and batch cooking plans.
 *
 * Family Context:
 * - Athlete (marathon runner)
 * - Spouse
 * - 2 Kids
 *
 * Philosophy:
 * - One meal, multiple portions (family eats together)
 * - Athlete gets adjustments (extra carbs, larger protein portions)
 * - Kid-friendly modifications when needed
 * - Practical for busy households
 * - Strategic batch cooking and leftovers
 */
export class MealPlannerAgent extends BaseAgent {
  constructor(llmClient: LLMProvider) {
    const modelConfig = getAgentModelConfig('nutrition-agent'); // Uses same config as parent

    super(
      {
        id: 'meal-planner-agent',
        name: 'Meal Planner',
        description: 'Family meal planning with athlete nutrition integration',
        model: modelConfig.model.id,
        temperature: modelConfig.temperature,
        maxTokens: modelConfig.maxTokens,
      },
      llmClient
    );
  }

  protected registerTools(): AgentTool[] {
    return getMealPlannerTools();
  }

  protected buildSystemPrompt(context: AgentContext): string {
    const planningPeriod = context.data.planningPeriod as string || 'this week';

    return MEAL_PLANNER_SYSTEM_PROMPT
      .replace('{{user_name}}', context.userName)
      .replace('{{current_date}}', context.date)
      .replace('{{planning_period}}', planningPeriod)
      .replace('{{timezone}}', context.timezone);
  }

  protected buildUserPrompt(context: AgentContext): string {
    const {
      athleteNeeds,
      trainingSchedule,
      familyPreferences,
      dietaryRestrictions,
      availableStaples,
      userRequest,
    } = context.data;

    return MEAL_PLANNER_USER_PROMPT_TEMPLATE
      .replace('{{athlete_needs}}', this.formatAthleteNeeds(athleteNeeds))
      .replace('{{training_schedule}}', this.formatTrainingSchedule(trainingSchedule))
      .replace('{{family_preferences}}', this.formatFamilyPreferences(familyPreferences))
      .replace('{{dietary_restrictions}}', this.formatDietaryRestrictions(dietaryRestrictions))
      .replace('{{available_staples}}', this.formatStaples(availableStaples))
      .replace('{{user_request}}', (userRequest as string) || 'Create a meal plan for this week');
  }

  private formatAthleteNeeds(needs: unknown): string {
    if (!needs) return 'Standard marathon training nutrition';

    const n = needs as Record<string, unknown>;
    const lines = [];

    if (n.caloricGuidance) lines.push(`Daily caloric guidance: ${n.caloricGuidance}`);
    if (n.emphasis) lines.push(`Nutritional emphasis: ${n.emphasis}`);
    if (n.mealSizeGuidance) lines.push(`Portion guidance: ${n.mealSizeGuidance}`);
    if (n.trainingPhase) lines.push(`Training phase: ${n.trainingPhase}`);
    if (n.weeklyMileage) lines.push(`Weekly mileage: ${n.weeklyMileage} miles`);

    // Biomarker priorities
    if (n.biomarkerPriorities && Array.isArray(n.biomarkerPriorities)) {
      lines.push(`Nutritional priorities from labs: ${(n.biomarkerPriorities as string[]).join(', ')}`);
    }

    return lines.length > 0 ? lines.join('\n') : 'Standard marathon training nutrition';
  }

  private formatTrainingSchedule(schedule: unknown): string {
    if (!schedule) return 'No training schedule provided';

    if (Array.isArray(schedule)) {
      if (schedule.length === 0) return 'Rest week or no workouts scheduled';

      return schedule.map((w: Record<string, unknown>) => {
        const day = w.dayOfWeek || w.day || 'Unknown day';
        const type = w.workoutType || w.type || 'Workout';
        const distance = w.distanceMiles ? `${w.distanceMiles} miles` : '';
        return `- ${day}: ${type} ${distance}`.trim();
      }).join('\n');
    }

    return this.formatData(schedule, 'No training schedule provided');
  }

  private formatFamilyPreferences(prefs: unknown): string {
    if (!prefs) return 'No specific preferences noted';

    const p = prefs as Record<string, unknown>;
    const lines = [];

    // Athlete preferences
    if (p.athleteFavorites) {
      const favorites = Array.isArray(p.athleteFavorites)
        ? p.athleteFavorites.join(', ')
        : p.athleteFavorites;
      lines.push(`Athlete favorites: ${favorites}`);
    }

    // Spouse preferences
    if (p.spousePreferences) {
      lines.push(`Spouse preferences: ${p.spousePreferences}`);
    }

    // Kid preferences
    if (p.kidFavorites) {
      const kidFaves = Array.isArray(p.kidFavorites)
        ? p.kidFavorites.join(', ')
        : p.kidFavorites;
      lines.push(`Kid favorites: ${kidFaves}`);
    }

    if (p.kidDislikes) {
      const kidDislikes = Array.isArray(p.kidDislikes)
        ? p.kidDislikes.join(', ')
        : p.kidDislikes;
      lines.push(`Kids won't eat: ${kidDislikes}`);
    }

    // Cooking preferences
    if (p.cookingStyle) lines.push(`Cooking style: ${p.cookingStyle}`);
    if (p.weeknightTime) lines.push(`Weeknight cooking time: ${p.weeknightTime}`);
    if (p.weekendTime) lines.push(`Weekend cooking time: ${p.weekendTime}`);

    // Budget
    if (p.budget) lines.push(`Budget level: ${p.budget}`);

    return lines.length > 0 ? lines.join('\n') : 'Standard family preferences';
  }

  private formatDietaryRestrictions(restrictions: unknown): string {
    if (!restrictions) return 'No dietary restrictions';

    if (Array.isArray(restrictions)) {
      if (restrictions.length === 0) return 'No dietary restrictions';
      return restrictions.join(', ');
    }

    const r = restrictions as Record<string, unknown>;
    const lines = [];

    if (r.allergies) {
      const allergies = Array.isArray(r.allergies)
        ? r.allergies.join(', ')
        : r.allergies;
      lines.push(`Allergies: ${allergies}`);
    }

    if (r.intolerances) {
      const intolerances = Array.isArray(r.intolerances)
        ? r.intolerances.join(', ')
        : r.intolerances;
      lines.push(`Intolerances: ${intolerances}`);
    }

    if (r.avoidances) {
      const avoidances = Array.isArray(r.avoidances)
        ? r.avoidances.join(', ')
        : r.avoidances;
      lines.push(`Prefer to avoid: ${avoidances}`);
    }

    return lines.length > 0 ? lines.join('\n') : 'No dietary restrictions';
  }

  private formatStaples(staples: unknown): string {
    if (!staples) return 'Standard pantry items assumed';

    if (Array.isArray(staples)) {
      if (staples.length === 0) return 'Standard pantry items assumed';
      return staples.join(', ');
    }

    return this.formatData(staples, 'Standard pantry items assumed');
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
   * Generate a quick meal suggestion based on available ingredients
   * Deterministic helper - no LLM call needed for simple cases
   */
  getQuickMealIdeas(params: {
    timeAvailable: 'minimal' | 'short' | 'normal';
    mainProtein?: string;
    hasCarbs?: boolean;
    familyMeal: boolean;
    athleteNeedsExtra?: boolean;
  }): {
    suggestions: string[];
    athleteAdditions: string;
  } {
    const { timeAvailable, mainProtein, hasCarbs, familyMeal: _familyMeal, athleteNeedsExtra } = params;

    const suggestions: string[] = [];

    // Minimal time (< 15 min)
    if (timeAvailable === 'minimal') {
      if (mainProtein === 'eggs') {
        suggestions.push('Scrambled eggs with toast', 'Fried egg sandwiches');
      } else if (mainProtein === 'chicken') {
        suggestions.push('Chicken quesadillas', 'Chicken and rice bowl (use leftover rice)');
      } else {
        suggestions.push('Pasta with jarred sauce and frozen veggies', 'Grilled cheese with tomato soup');
      }
    }

    // Short time (15-30 min)
    else if (timeAvailable === 'short') {
      if (mainProtein === 'ground_beef' || mainProtein === 'ground_turkey') {
        suggestions.push('Tacos or taco bowls', 'Quick stir-fry with rice');
      } else if (mainProtein === 'salmon' || mainProtein === 'fish') {
        suggestions.push('Pan-seared salmon with roasted veggies', 'Fish tacos');
      } else {
        suggestions.push('Stir-fry with whatever protein/veggies available', 'Sheet pan dinner');
      }
    }

    // Normal time (30+ min)
    else {
      suggestions.push(
        'One-pot pasta with protein and vegetables',
        'Sheet pan chicken with roasted vegetables',
        'Burrito bowls with all the fixings'
      );
    }

    // Athlete additions
    let athleteAdditions = 'Standard portions are fine';
    if (athleteNeedsExtra) {
      if (hasCarbs) {
        athleteAdditions = 'Add extra serving of carbs (extra rice, bread on the side, or tortilla)';
      } else {
        athleteAdditions = 'Add a carb source: toast, rice, or sweet potato on the side';
      }
    }

    return { suggestions, athleteAdditions };
  }

  /**
   * Generate default family dinner ideas for the week
   * Deterministic helper for quick suggestions
   */
  getWeeklyDinnerTemplate(): {
    day: string;
    theme: string;
    examples: string[];
  }[] {
    return [
      {
        day: 'Monday',
        theme: 'Quick & Easy',
        examples: ['Sheet pan chicken', 'One-pot pasta', 'Stir-fry'],
      },
      {
        day: 'Tuesday',
        theme: 'Taco Tuesday',
        examples: ['Tacos', 'Burrito bowls', 'Nachos', 'Taco salad'],
      },
      {
        day: 'Wednesday',
        theme: 'Comfort Food',
        examples: ['Pasta bake', 'Soup and sandwiches', 'Mac and cheese with veggies'],
      },
      {
        day: 'Thursday',
        theme: 'Protein Focus',
        examples: ['Grilled chicken', 'Salmon', 'Pork tenderloin'],
      },
      {
        day: 'Friday',
        theme: 'Pizza Night / Takeout',
        examples: ['Homemade pizza', 'Pizza bagels', 'Order in'],
      },
      {
        day: 'Saturday',
        theme: 'Batch Cook Friendly',
        examples: ['Slow cooker meal', 'Big batch soup', 'Meal prep proteins'],
      },
      {
        day: 'Sunday',
        theme: 'Family Dinner',
        examples: ['Roast chicken', 'BBQ', 'Special recipe'],
      },
    ];
  }

  /**
   * Estimate grocery budget based on meal plan
   * Deterministic helper
   */
  estimateGroceryBudget(params: {
    numberOfDinners: number;
    proteinIntensity: 'low' | 'normal' | 'high';
    organicPreference: boolean;
    athleteSupplements: boolean;
  }): {
    estimatedRange: { low: number; high: number };
    perMealAverage: number;
    tips: string[];
  } {
    const { numberOfDinners, proteinIntensity, organicPreference, athleteSupplements } = params;

    // Base cost per dinner for family of 4
    let baseCost = 15;

    if (proteinIntensity === 'high') baseCost += 5;
    if (organicPreference) baseCost *= 1.3;

    const dinnerTotal = numberOfDinners * baseCost;

    // Add breakfast, lunch, snacks estimate
    const otherMeals = numberOfDinners * 8; // ~$8/day for other meals

    // Athlete supplements
    const supplements = athleteSupplements ? 30 : 0;

    const totalLow = Math.round((dinnerTotal + otherMeals + supplements) * 0.85);
    const totalHigh = Math.round((dinnerTotal + otherMeals + supplements) * 1.15);

    const tips = [];
    if (proteinIntensity === 'high') {
      tips.push('Buy proteins in bulk or on sale, freeze extras');
    }
    if (organicPreference) {
      tips.push('Prioritize organic for dirty dozen produce, conventional for clean fifteen');
    }
    tips.push('Plan meals around weekly store sales');
    tips.push('Batch cook proteins on Sunday to stretch portions');

    return {
      estimatedRange: { low: totalLow, high: totalHigh },
      perMealAverage: Math.round(baseCost),
      tips,
    };
  }
}
