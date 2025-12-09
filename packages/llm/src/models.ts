/**
 * LLM Model Configuration
 * 
 * Centralized definitions for all available models and agent assignments.
 * Updated: December 2025
 */

// ===========================================
// Model Definitions
// ===========================================

export type ModelProvider = 'anthropic' | 'openai';

export interface ModelDefinition {
  id: string;
  provider: ModelProvider;
  name: string;
  description: string;
  contextWindow: number;
  maxOutputTokens: number;
  costPer1kInput: number;  // USD
  costPer1kOutput: number; // USD
  supportsTools: boolean;
  supportsVision: boolean;
  tier: 'flagship' | 'balanced' | 'fast' | 'reasoning';
}

// ---------------------------------------------
// Anthropic Models (Claude 4.5 Family - Late 2025)
// ---------------------------------------------
export const ANTHROPIC_MODELS: Record<string, ModelDefinition> = {
  // Flagship - Peak intelligence
  'claude-opus-4-5': {
    id: 'claude-opus-4-5-20251101',
    provider: 'anthropic',
    name: 'Claude Opus 4.5',
    description: 'Strongest model for AI agents, multi-step reasoning, adaptive decision-making, enterprise workflows',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    costPer1kInput: 0.015,
    costPer1kOutput: 0.075,
    supportsTools: true,
    supportsVision: true,
    tier: 'flagship',
  },
  'claude-opus-4': {
    id: 'claude-opus-4-20250514',
    provider: 'anthropic',
    name: 'Claude Opus 4',
    description: 'Complex reasoning, research, long-context coding, traceable agents',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    costPer1kInput: 0.015,
    costPer1kOutput: 0.075,
    supportsTools: true,
    supportsVision: true,
    tier: 'flagship',
  },

  // Balanced - Best value for most tasks
  'claude-sonnet-4-5': {
    id: 'claude-sonnet-4-5-20250929',
    provider: 'anthropic',
    name: 'Claude Sonnet 4.5',
    description: 'World-leading coding, agent building, computer use, math/reasoning with extended thinking',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    costPer1kInput: 0.003,
    costPer1kOutput: 0.015,
    supportsTools: true,
    supportsVision: true,
    tier: 'balanced',
  },
  'claude-sonnet-4': {
    id: 'claude-sonnet-4-20250514',
    provider: 'anthropic',
    name: 'Claude Sonnet 4',
    description: 'Excellent coding and reasoning, balanced performance',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    costPer1kInput: 0.003,
    costPer1kOutput: 0.015,
    supportsTools: true,
    supportsVision: true,
    tier: 'balanced',
  },

  // Fast - Speed and efficiency
  'claude-haiku-4-5': {
    id: 'claude-3-5-haiku-20241022',
    provider: 'anthropic',
    name: 'Claude Haiku 4.5',
    description: 'Fastest for efficiency, quick general tasks, free-tier accessible',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    costPer1kInput: 0.0008,
    costPer1kOutput: 0.004,
    supportsTools: true,
    supportsVision: true,
    tier: 'fast',
  },
};

// ---------------------------------------------
// OpenAI Models (Dec 2025)
// GPT-5 family released late 2025
// ---------------------------------------------
export const OPENAI_MODELS: Record<string, ModelDefinition> = {
  // GPT-5 Family (Nov 2025+)
  'gpt-5': {
    id: 'gpt-5',
    provider: 'openai',
    name: 'GPT-5',
    description: 'Advanced reasoning, coding, math, writing, multimodal with adjustable reasoning levels',
    contextWindow: 128000,
    maxOutputTokens: 16384,
    costPer1kInput: 0.01,
    costPer1kOutput: 0.03,
    supportsTools: true,
    supportsVision: true,
    tier: 'flagship',
  },
  'gpt-5-1': {
    id: 'gpt-5.1',
    provider: 'openai',
    name: 'GPT-5.1',
    description: 'Nov 2025 release - adaptive reasoning, customizable personalities, improved conversation',
    contextWindow: 128000,
    maxOutputTokens: 16384,
    costPer1kInput: 0.01,
    costPer1kOutput: 0.03,
    supportsTools: true,
    supportsVision: true,
    tier: 'flagship',
  },

  // o-series Reasoning Models
  'o3': {
    id: 'o3',
    provider: 'openai',
    name: 'o3',
    description: 'Complex reasoning, math/code/science benchmarks, agent workflows',
    contextWindow: 128000,
    maxOutputTokens: 65536,
    costPer1kInput: 0.01,
    costPer1kOutput: 0.04,
    supportsTools: true,
    supportsVision: true,
    tier: 'reasoning',
  },
  'o3-mini': {
    id: 'o3-mini',
    provider: 'openai',
    name: 'o3 Mini',
    description: 'Fast reasoning model for structured tasks',
    contextWindow: 128000,
    maxOutputTokens: 65536,
    costPer1kInput: 0.003,
    costPer1kOutput: 0.012,
    supportsTools: true,
    supportsVision: false,
    tier: 'reasoning',
  },

  // GPT-4o Family
  'gpt-4o': {
    id: 'gpt-4o',
    provider: 'openai',
    name: 'GPT-4o',
    description: 'Versatile multimodal for multistep tasks, data extraction, classification',
    contextWindow: 128000,
    maxOutputTokens: 16384,
    costPer1kInput: 0.0025,
    costPer1kOutput: 0.01,
    supportsTools: true,
    supportsVision: true,
    tier: 'balanced',
  },
  'gpt-4o-mini': {
    id: 'gpt-4o-mini',
    provider: 'openai',
    name: 'GPT-4o Mini',
    description: 'Fast and efficient for lighter tasks',
    contextWindow: 128000,
    maxOutputTokens: 16384,
    costPer1kInput: 0.00015,
    costPer1kOutput: 0.0006,
    supportsTools: true,
    supportsVision: true,
    tier: 'fast',
  },
};

// Combined model registry
export const ALL_MODELS: Record<string, ModelDefinition> = {
  ...ANTHROPIC_MODELS,
  ...OPENAI_MODELS,
};

// ===========================================
// Agent Model Assignments
// ===========================================

export type AgentId =
  | 'health-agent'
  | 'training-coach'
  | 'planning-coach'
  | 'nutrition-agent'
  | 'meal-planner-agent'
  | 'workload-agent'
  | 'reflection-agent'
  | 'orchestrator';

export interface AgentModelConfig {
  modelKey: string;       // Key from ALL_MODELS
  temperature: number;    // 0-1, lower = more deterministic
  maxTokens: number;      // Max response tokens
  description: string;    // Why this model for this agent
}

/**
 * Agent Model Assignments
 * 
 * Configure which model each agent uses.
 * Change these to swap models without touching agent code.
 */
export const AGENT_MODEL_CONFIG: Record<AgentId, AgentModelConfig> = {
  // Health Agent - needs to be reliable and supportive
  'health-agent': {
    modelKey: 'claude-sonnet-4-5',
    temperature: 0.3,
    maxTokens: 2000,
    description: 'Balanced model for reliable health assessments with good reasoning',
  },

  // Training Coach - needs strong reasoning for workout analysis
  'training-coach': {
    modelKey: 'claude-sonnet-4-5',
    temperature: 0.4,
    maxTokens: 3000,
    description: 'Using Claude Sonnet 4.5 - better at following tool usage instructions',
  },

  // Planning Coach - strategic weekly planning and periodization
  'planning-coach': {
    modelKey: 'claude-sonnet-4-5',
    temperature: 0.3,
    maxTokens: 2500,
    description: 'Balanced model for strategic planning and workout adjustments',
  },

  // Nutrition Agent - fueling and hydration recommendations
  'nutrition-agent': {
    modelKey: 'claude-haiku-4-5',
    temperature: 0.2,
    maxTokens: 1500,
    description: 'Fast model for nutrition recommendations - deterministic and practical',
  },

  // Meal Planner Agent - family meal planning and grocery lists
  'meal-planner-agent': {
    modelKey: 'claude-haiku-4-5',
    temperature: 0.3,
    maxTokens: 2000,
    description: 'Fast model for practical meal planning - creative but consistent',
  },

  // Workload Agent - quick task analysis
  'workload-agent': {
    modelKey: 'claude-haiku-4-5',
    temperature: 0.2,
    maxTokens: 1500,
    description: 'Fast model for quick task prioritization',
  },

  // Reflection Agent - deeper thinking
  'reflection-agent': {
    modelKey: 'claude-opus-4-5',
    temperature: 0.5,
    maxTokens: 4000,
    description: 'Flagship model for thoughtful reflections and insights',
  },

  // Orchestrator - routing decisions
  'orchestrator': {
    modelKey: 'claude-haiku-4-5',
    temperature: 0.1,
    maxTokens: 500,
    description: 'Fast model for quick routing decisions',
  },
};

// ===========================================
// Helper Functions
// ===========================================

/**
 * Get model definition by key
 */
export function getModel(modelKey: string): ModelDefinition {
  const model = ALL_MODELS[modelKey];
  if (!model) {
    throw new Error(`Unknown model: ${modelKey}. Available: ${Object.keys(ALL_MODELS).join(', ')}`);
  }
  return model;
}

/**
 * Get agent's model configuration
 */
export function getAgentModelConfig(agentId: AgentId): AgentModelConfig & { model: ModelDefinition } {
  const config = AGENT_MODEL_CONFIG[agentId];
  if (!config) {
    throw new Error(`No model config for agent: ${agentId}`);
  }
  return {
    ...config,
    model: getModel(config.modelKey),
  };
}

/**
 * Get the actual model ID string to send to the API
 */
export function getModelId(modelKey: string): string {
  return getModel(modelKey).id;
}

/**
 * List all available models for a provider
 */
export function listModels(provider?: ModelProvider): ModelDefinition[] {
  const models = Object.values(ALL_MODELS);
  if (provider) {
    return models.filter(m => m.provider === provider);
  }
  return models;
}

/**
 * List models by tier
 */
export function listModelsByTier(tier: ModelDefinition['tier']): ModelDefinition[] {
  return Object.values(ALL_MODELS).filter(m => m.tier === tier);
}

