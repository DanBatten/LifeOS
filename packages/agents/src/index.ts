// Base agent exports
export { BaseAgent } from './base/index.js';
export * from './base/types.js';

// Health Agent
export { HealthAgent, getHealthTools } from './health/index.js';

// Training Coach Agent
export { TrainingCoachAgent } from './training/index.js';
export * from './training/prompts.js';

// SDK-based Agents (using Anthropic Agent SDK)
export {
  SdkAgent,
  SdkTrainingCoachAgent,
  SdkHealthAgent,
  createMcpServerFromTools,
  getMcpToolNames,
  ToolResultCollector,
} from './sdk/index.js';
export type {
  SdkAgentConfig,
  SdkAgentOutput,
  SdkExecuteOptions,
  StreamCallback,
  McpToolWrapper,
} from './sdk/types.js';

// TODO: Add other agents as they are implemented
// export { WorkloadAgent, getWorkloadTools } from './workload/index.js';
// export { ReflectionAgent, getReflectionTools } from './reflection/index.js';
