/**
 * Nutrition Agent Tools
 *
 * Tools for generating and managing nutrition plans for runners.
 */

import type { AgentTool, AgentContext } from '../base/types.js';

/**
 * Tool definitions for the Nutrition Agent
 */
export function getNutritionTools(): AgentTool[] {
  return [
    {
      name: 'create_pre_run_plan',
      description: 'Create a pre-run nutrition plan with meal and hydration timing',
      parameters: {
        type: 'object',
        properties: {
          workoutType: {
            type: 'string',
            description: 'Type of workout (easy, tempo, long_run, intervals, race)',
          },
          distanceMiles: {
            type: 'number',
            description: 'Distance in miles',
          },
          startTime: {
            type: 'string',
            description: 'Planned start time (e.g., "6:00 AM", "afternoon")',
          },
          mealRecommendation: {
            type: 'string',
            description: 'Specific meal recommendation',
          },
          mealTiming: {
            type: 'string',
            description: 'When to eat relative to run start',
          },
          hydrationPlan: {
            type: 'string',
            description: 'Pre-run hydration guidance',
          },
          notes: {
            type: 'string',
            description: 'Additional notes or considerations',
          },
        },
        required: ['workoutType', 'mealRecommendation', 'mealTiming', 'hydrationPlan'],
      },
      execute: async (args: Record<string, unknown>, _context: AgentContext) => {
        return {
          type: 'pre_run_plan',
          workoutType: args.workoutType,
          distanceMiles: args.distanceMiles,
          startTime: args.startTime,
          meal: {
            recommendation: args.mealRecommendation,
            timing: args.mealTiming,
          },
          hydration: args.hydrationPlan,
          notes: args.notes,
        };
      },
    },
    {
      name: 'create_fueling_plan',
      description: 'Create an in-run fueling plan for long runs or races',
      parameters: {
        type: 'object',
        properties: {
          durationMinutes: {
            type: 'number',
            description: 'Expected duration in minutes',
          },
          distanceMiles: {
            type: 'number',
            description: 'Distance in miles',
          },
          fuelType: {
            type: 'string',
            description: 'Preferred fuel type (gels, chews, real food, etc.)',
          },
          fuelSchedule: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                timing: { type: 'string' },
                fuel: { type: 'string' },
                notes: { type: 'string' },
              },
            },
            description: 'Array of fuel timing points',
          },
          hydrationSchedule: {
            type: 'string',
            description: 'Hydration timing and amounts',
          },
          electrolyteStrategy: {
            type: 'string',
            description: 'Electrolyte/salt supplementation plan',
          },
        },
        required: ['durationMinutes', 'fuelSchedule', 'hydrationSchedule'],
      },
      execute: async (args: Record<string, unknown>, _context: AgentContext) => {
        return {
          type: 'fueling_plan',
          durationMinutes: args.durationMinutes,
          distanceMiles: args.distanceMiles,
          fuelType: args.fuelType,
          fuelSchedule: args.fuelSchedule,
          hydration: args.hydrationSchedule,
          electrolytes: args.electrolyteStrategy,
        };
      },
    },
    {
      name: 'create_recovery_plan',
      description: 'Create a post-run recovery nutrition plan',
      parameters: {
        type: 'object',
        properties: {
          workoutIntensity: {
            type: 'string',
            description: 'Intensity level (easy, moderate, hard)',
          },
          immediateRecovery: {
            type: 'string',
            description: 'What to consume within 30 minutes',
          },
          recoveryMeal: {
            type: 'string',
            description: 'Full recovery meal recommendation',
          },
          recoveryMealTiming: {
            type: 'string',
            description: 'When to eat recovery meal',
          },
          hydrationRecovery: {
            type: 'string',
            description: 'Post-run rehydration plan',
          },
        },
        required: ['immediateRecovery', 'hydrationRecovery'],
      },
      execute: async (args: Record<string, unknown>, _context: AgentContext) => {
        return {
          type: 'recovery_plan',
          intensity: args.workoutIntensity,
          immediate: args.immediateRecovery,
          meal: {
            recommendation: args.recoveryMeal,
            timing: args.recoveryMealTiming,
          },
          hydration: args.hydrationRecovery,
        };
      },
    },
    {
      name: 'write_nutrition_to_whiteboard',
      description: 'Write nutrition recommendations to the whiteboard for the planning coach to reference',
      parameters: {
        type: 'object',
        properties: {
          workoutId: {
            type: 'string',
            description: 'The workout ID these recommendations are for',
          },
          preRunNutrition: {
            type: 'string',
            description: 'Pre-run meal and hydration summary',
          },
          duringRunFueling: {
            type: 'string',
            description: 'In-run fueling plan (if applicable)',
          },
          postRunRecovery: {
            type: 'string',
            description: 'Post-run recovery nutrition summary',
          },
          specialConsiderations: {
            type: 'string',
            description: 'Any special notes (weather, stomach sensitivity, etc.)',
          },
        },
        required: ['workoutId', 'preRunNutrition'],
      },
      execute: async (args: Record<string, unknown>, _context: AgentContext) => {
        // This tool captures the nutrition plan for the planning workflow to use
        return {
          type: 'whiteboard_nutrition_entry',
          workoutId: args.workoutId,
          preRun: args.preRunNutrition,
          duringRun: args.duringRunFueling || 'Not needed for this workout duration',
          postRun: args.postRunRecovery || 'Standard recovery protocol',
          notes: args.specialConsiderations,
        };
      },
    },
  ];
}
