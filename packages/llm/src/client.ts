import { ConfigError } from '@lifeos/core';
import type { LLMProvider, LLMProviderType, LLMConfig } from './types.js';
import { AnthropicProvider } from './providers/anthropic.provider.js';
import { OpenAIProvider } from './providers/openai.provider.js';

/**
 * Create an LLM client for the specified provider
 */
export function createLLMClient(
  providerOrConfig: LLMProviderType | LLMConfig
): LLMProvider {
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

// Singleton instance
let defaultClient: LLMProvider | null = null;

/**
 * Get or create the default LLM client
 */
export function getLLMClient(): LLMProvider {
  if (!defaultClient) {
    defaultClient = createLLMClientFromEnv();
  }
  return defaultClient;
}

/**
 * Set a custom default LLM client
 */
export function setLLMClient(client: LLMProvider): void {
  defaultClient = client;
}
