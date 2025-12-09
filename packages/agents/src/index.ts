// Base agent exports
export { BaseAgent } from './base/index.js';
export * from './base/types.js';

// Health Agent
export { HealthAgent, getHealthTools } from './health/index.js';

// Training Coach Agent
export { TrainingCoachAgent } from './training/index.js';
export * from './training/prompts.js';

// Planning Coach Agent (weekly planning, pace adjustments, periodization)
export { PlanningCoachAgent } from './planning/index.js';

// Nutrition Agent (fueling, hydration, race nutrition)
export { NutritionAgent, getNutritionTools } from './nutrition/index.js';
export * from './nutrition/prompts.js';

// Meal Planner Sub-Agent (family meals, grocery lists)
export { MealPlannerAgent, getMealPlannerTools } from './nutrition/index.js';

// TODO: Add other agents as they are implemented
// export { WorkloadAgent, getWorkloadTools } from './workload/index.js';
// export { ReflectionAgent, getReflectionTools } from './reflection/index.js';
