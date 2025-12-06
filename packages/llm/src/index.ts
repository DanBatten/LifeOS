// Types
export * from './types.js';

// Models configuration
export {
  // Types
  type ModelProvider,
  type ModelDefinition,
  type AgentId,
  type AgentModelConfig,
  // Model registries
  ANTHROPIC_MODELS,
  OPENAI_MODELS,
  ALL_MODELS,
  AGENT_MODEL_CONFIG,
  // Helper functions
  getModel,
  getAgentModelConfig,
  getModelId,
  listModels,
  listModelsByTier,
} from './models.js';

// Client factory
export {
  createLLMClient,
  createLLMClientFromEnv,
  getLLMClient,
  setLLMClient,
  MultiProviderClient,
} from './client.js';

// Providers (for direct instantiation if needed)
export {
  BaseLLMProvider,
  AnthropicProvider,
  OpenAIProvider,
} from './providers/index.js';
