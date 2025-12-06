// Base agent exports
export { BaseAgent } from './base/index.js';
export * from './base/types.js';

// Health Agent
export { HealthAgent, getHealthTools } from './health/index.js';

// Training Coach Agent
export { TrainingCoachAgent } from './training/index.js';
export * from './training/prompts.js';

// TODO: Add other agents as they are implemented
// export { WorkloadAgent, getWorkloadTools } from './workload/index.js';
// export { ReflectionAgent, getReflectionTools } from './reflection/index.js';
