import { ConfigError } from '@lifeos/core';
import type { LLMProvider, LLMProviderType, LLMConfig, LLMRequest, LLMResponse, ToolResult } from './types.js';
import { AnthropicProvider } from './providers/anthropic.provider.js';
import { OpenAIProvider } from './providers/openai.provider.js';
import { getModel, type ModelProvider } from './models.js';

/**
 * Create an LLM client for the specified provider.
 * If no provider is specified, returns a MultiProviderClient that routes
 * requests to the correct provider based on the model.
 */
export function createLLMClient(
  providerOrConfig?: LLMProviderType | LLMConfig
): LLMProvider {
  // If no config provided, return the multi-provider client
  if (!providerOrConfig) {
    return new MultiProviderClient();
  }

  const config: LLMConfig =
    typeof providerOrConfig === 'string'
      ? { provider: providerOrConfig }
      : providerOrConfig;

  switch (config.provider) {
    case 'anthropic':
      return new AnthropicProvider({
        apiKey: config.apiKey,
        defaultModel: config.defaultModel,
        defaultTemperature: config.defaultTemperature,
        defaultMaxTokens: config.defaultMaxTokens,
      });

    case 'openai':
      return new OpenAIProvider({
        apiKey: config.apiKey,
        defaultModel: config.defaultModel,
        defaultTemperature: config.defaultTemperature,
        defaultMaxTokens: config.defaultMaxTokens,
      });

    default:
      throw new ConfigError(`Unknown LLM provider: ${config.provider}`, {
        configKey: 'LLM_PROVIDER',
      });
  }
}

/**
 * Create an LLM client from environment variables
 */
export function createLLMClientFromEnv(): LLMProvider {
  const provider = (process.env.LLM_PROVIDER || 'anthropic') as LLMProviderType;
  return createLLMClient(provider);
}

// Provider instances cache
const providerCache: Map<ModelProvider, LLMProvider> = new Map();

/**
 * Get or create a provider for a specific model provider type
 */
function getProviderForModel(modelProvider: ModelProvider): LLMProvider {
  let provider = providerCache.get(modelProvider);
  if (!provider) {
    provider = createLLMClient(modelProvider);
    providerCache.set(modelProvider, provider);
  }
  return provider;
}

/**
 * Multi-provider LLM client that routes requests to the correct provider
 * based on the model being used
 */
export class MultiProviderClient implements LLMProvider {
  readonly name = 'multi-provider';
  private defaultProvider: LLMProvider;

  constructor() {
    // Default provider for backwards compatibility
    this.defaultProvider = createLLMClientFromEnv();
  }

  /**
   * Determine which provider to use based on the model
   */
  private getProviderForRequest(request: LLMRequest): LLMProvider {
    if (!request.model) {
      return this.defaultProvider;
    }

    // Try to look up the model in our registry
    try {
      const modelDef = getModel(request.model);
      return getProviderForModel(modelDef.provider);
    } catch {
      // Model not in registry - check if it looks like an OpenAI or Anthropic model
      if (request.model.startsWith('gpt-') || request.model.startsWith('o1') || request.model.startsWith('o3')) {
        return getProviderForModel('openai');
      }
      if (request.model.startsWith('claude-')) {
        return getProviderForModel('anthropic');
      }
      // Fall back to default
      return this.defaultProvider;
    }
  }

  async chat(request: LLMRequest): Promise<LLMResponse> {
    const provider = this.getProviderForRequest(request);
    return provider.chat(request);
  }

  async continueWithToolResults(
    originalRequest: LLMRequest,
    previousResponse: LLMResponse,
    toolResults: ToolResult[]
  ): Promise<LLMResponse> {
    const provider = this.getProviderForRequest(originalRequest);
    return provider.continueWithToolResults(originalRequest, previousResponse, toolResults);
  }
}

// Singleton instance
let defaultClient: LLMProvider | null = null;

/**
 * Get or create the default LLM client
 * Now returns a MultiProviderClient that can route to different providers
 */
export function getLLMClient(): LLMProvider {
  if (!defaultClient) {
    defaultClient = new MultiProviderClient();
  }
  return defaultClient;
}

/**
 * Set a custom default LLM client
 */
export function setLLMClient(client: LLMProvider): void {
  defaultClient = client;
}
