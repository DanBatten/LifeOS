/**
 * Meal Planner Agent Tools
 *
 * Tools for family meal planning, grocery lists, and recipe management.
 */

import type { AgentTool, AgentContext } from '../../base/types.js';

/**
 * Tool definitions for the Meal Planner Agent
 */
export function getMealPlannerTools(): AgentTool[] {
  return [
    {
      name: 'create_weekly_meal_plan',
      description: 'Create a weekly meal plan for the family, accounting for training schedule',
      parameters: {
        type: 'object',
        properties: {
          weekStartDate: {
            type: 'string',
            description: 'Start date of the week (Monday)',
          },
          meals: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                day: { type: 'string', description: 'Day of week' },
                dinner: { type: 'string', description: 'Main dinner for family' },
                athleteNotes: { type: 'string', description: 'Athlete portion adjustments' },
                kidNotes: { type: 'string', description: 'Kid-friendly modifications' },
                prepTime: { type: 'string', description: 'Estimated prep time' },
                makeAhead: { type: 'boolean', description: 'Can be prepped in advance' },
              },
            },
            description: 'Array of daily meal plans',
          },
          athleteBreakfasts: {
            type: 'array',
            items: { type: 'string' },
            description: 'Athlete breakfast suggestions for training days',
          },
          batchCookingSuggestions: {
            type: 'array',
            items: { type: 'string' },
            description: 'Items that can be batch cooked on weekend',
          },
        },
        required: ['weekStartDate', 'meals'],
      },
      execute: async (args: Record<string, unknown>, _context: AgentContext) => {
        return {
          type: 'weekly_meal_plan',
          weekStartDate: args.weekStartDate,
          meals: args.meals,
          athleteBreakfasts: args.athleteBreakfasts || [],
          batchCooking: args.batchCookingSuggestions || [],
          createdAt: new Date().toISOString(),
        };
      },
    },
    {
      name: 'create_grocery_list',
      description: 'Generate a grocery list organized by store section',
      parameters: {
        type: 'object',
        properties: {
          forWeekOf: {
            type: 'string',
            description: 'Week this grocery list is for',
          },
          produce: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                item: { type: 'string' },
                quantity: { type: 'string' },
                notes: { type: 'string' },
              },
            },
            description: 'Fruits and vegetables',
          },
          proteins: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                item: { type: 'string' },
                quantity: { type: 'string' },
                notes: { type: 'string' },
              },
            },
            description: 'Meat, fish, eggs, tofu',
          },
          dairy: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                item: { type: 'string' },
                quantity: { type: 'string' },
                notes: { type: 'string' },
              },
            },
            description: 'Milk, cheese, yogurt',
          },
          grains: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                item: { type: 'string' },
                quantity: { type: 'string' },
                notes: { type: 'string' },
              },
            },
            description: 'Bread, pasta, rice, cereals',
          },
          pantry: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                item: { type: 'string' },
                quantity: { type: 'string' },
                notes: { type: 'string' },
              },
            },
            description: 'Canned goods, sauces, oils, condiments',
          },
          frozen: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                item: { type: 'string' },
                quantity: { type: 'string' },
                notes: { type: 'string' },
              },
            },
            description: 'Frozen items',
          },
          athleteSpecific: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                item: { type: 'string' },
                quantity: { type: 'string' },
                notes: { type: 'string' },
                store: { type: 'string' },
              },
            },
            description: 'Athlete-specific items (gels, supplements, etc.)',
          },
          estimatedTotal: {
            type: 'string',
            description: 'Estimated cost range',
          },
        },
        required: ['forWeekOf', 'produce', 'proteins'],
      },
      execute: async (args: Record<string, unknown>, _context: AgentContext) => {
        return {
          type: 'grocery_list',
          forWeekOf: args.forWeekOf,
          sections: {
            produce: args.produce || [],
            proteins: args.proteins || [],
            dairy: args.dairy || [],
            grains: args.grains || [],
            pantry: args.pantry || [],
            frozen: args.frozen || [],
            athleteSpecific: args.athleteSpecific || [],
          },
          estimatedTotal: args.estimatedTotal,
          createdAt: new Date().toISOString(),
        };
      },
    },
    {
      name: 'suggest_quick_meal',
      description: 'Suggest a quick meal based on available ingredients and time',
      parameters: {
        type: 'object',
        properties: {
          mealName: {
            type: 'string',
            description: 'Name of the suggested meal',
          },
          prepTime: {
            type: 'string',
            description: 'Preparation time',
          },
          ingredients: {
            type: 'array',
            items: { type: 'string' },
            description: 'Required ingredients',
          },
          quickInstructions: {
            type: 'string',
            description: 'Brief cooking instructions',
          },
          athletePortion: {
            type: 'string',
            description: 'How to adjust for athlete needs',
          },
          kidVersion: {
            type: 'string',
            description: 'Kid-friendly modifications',
          },
          alternativeIfMissing: {
            type: 'string',
            description: 'Backup option if ingredients missing',
          },
        },
        required: ['mealName', 'prepTime', 'ingredients', 'quickInstructions'],
      },
      execute: async (args: Record<string, unknown>, _context: AgentContext) => {
        return {
          type: 'quick_meal_suggestion',
          meal: args.mealName,
          prepTime: args.prepTime,
          ingredients: args.ingredients,
          instructions: args.quickInstructions,
          athleteAdjustments: args.athletePortion || 'Standard portions',
          kidFriendly: args.kidVersion || 'Serve as-is',
          backup: args.alternativeIfMissing,
        };
      },
    },
    {
      name: 'create_batch_cooking_plan',
      description: 'Plan a batch cooking session for meal prep',
      parameters: {
        type: 'object',
        properties: {
          sessionDate: {
            type: 'string',
            description: 'Date of batch cooking session',
          },
          totalTime: {
            type: 'string',
            description: 'Total time available',
          },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                item: { type: 'string', description: 'What to prepare' },
                quantity: { type: 'string', description: 'How much' },
                startTime: { type: 'string', description: 'When to start this item' },
                activeTime: { type: 'string', description: 'Hands-on time required' },
                storage: { type: 'string', description: 'How to store' },
                usedFor: { type: 'array', items: { type: 'string' }, description: 'Which meals/days' },
                keepsDays: { type: 'number', description: 'How long it keeps' },
              },
            },
            description: 'Items to batch cook in priority order',
          },
          shoppingNeeded: {
            type: 'array',
            items: { type: 'string' },
            description: 'Ingredients to buy for batch cooking',
          },
        },
        required: ['sessionDate', 'totalTime', 'items'],
      },
      execute: async (args: Record<string, unknown>, _context: AgentContext) => {
        return {
          type: 'batch_cooking_plan',
          date: args.sessionDate,
          duration: args.totalTime,
          items: args.items,
          shopping: args.shoppingNeeded || [],
          createdAt: new Date().toISOString(),
        };
      },
    },
    {
      name: 'save_family_recipe',
      description: 'Save a recipe to the family collection with adaptations',
      parameters: {
        type: 'object',
        properties: {
          recipeName: {
            type: 'string',
            description: 'Name of the recipe',
          },
          category: {
            type: 'string',
            enum: ['quick_weeknight', 'batch_cooking', 'special_occasion', 'kid_favorite', 'athlete_recovery'],
            description: 'Recipe category',
          },
          servings: {
            type: 'number',
            description: 'Number of servings',
          },
          prepTime: {
            type: 'string',
            description: 'Prep time',
          },
          cookTime: {
            type: 'string',
            description: 'Cook time',
          },
          ingredients: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of ingredients with quantities',
          },
          instructions: {
            type: 'array',
            items: { type: 'string' },
            description: 'Step-by-step instructions',
          },
          athleteAdaptation: {
            type: 'string',
            description: 'How to modify for athlete needs',
          },
          kidAdaptation: {
            type: 'string',
            description: 'How to modify for kids',
          },
          nutritionNotes: {
            type: 'string',
            description: 'Nutritional benefits/considerations',
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Tags for searching (high-protein, low-effort, etc.)',
          },
        },
        required: ['recipeName', 'category', 'ingredients', 'instructions'],
      },
      execute: async (args: Record<string, unknown>, _context: AgentContext) => {
        return {
          type: 'family_recipe',
          name: args.recipeName,
          category: args.category,
          servings: args.servings || 4,
          timing: {
            prep: args.prepTime,
            cook: args.cookTime,
          },
          ingredients: args.ingredients,
          instructions: args.instructions,
          adaptations: {
            athlete: args.athleteAdaptation,
            kids: args.kidAdaptation,
          },
          nutritionNotes: args.nutritionNotes,
          tags: args.tags || [],
          savedAt: new Date().toISOString(),
        };
      },
    },
  ];
}
