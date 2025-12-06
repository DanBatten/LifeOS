import type {
  LLMProvider,
  LLMRequest,
  LLMResponse,
  ToolResult,
} from '../types.js';

/**
 * Abstract base class for LLM providers
 */
export abstract class BaseLLMProvider implements LLMProvider {
  abstract readonly name: string;

  protected defaultModel: string;
  protected defaultTemperature: number;
  protected defaultMaxTokens: number;

  constructor(options?: {
    defaultModel?: string;
    defaultTemperature?: number;
    defaultMaxTokens?: number;
  }) {
    this.defaultModel = options?.defaultModel || this.getDefaultModel();
    this.defaultTemperature = options?.defaultTemperature ?? 0.7;
    this.defaultMaxTokens = options?.defaultMaxTokens ?? 4096;
  }

  /**
   * Get the default model for this provider
   */
  protected abstract getDefaultModel(): string;

  /**
   * Send a chat completion request
   */
  abstract chat(request: LLMRequest): Promise<LLMResponse>;

  /**
   * Continue a conversation after tool execution
   */
  abstract continueWithToolResults(
    request: LLMRequest,
    previousResponse: LLMResponse,
    toolResults: ToolResult[]
  ): Promise<LLMResponse>;

  /**
   * Resolve the model to use
   */
  protected resolveModel(model?: string): string {
    return model || this.defaultModel;
  }

  /**
   * Resolve the temperature to use
   */
  protected resolveTemperature(temperature?: number): number {
    return temperature ?? this.defaultTemperature;
  }

  /**
   * Resolve the max tokens to use
   */
  protected resolveMaxTokens(maxTokens?: number): number {
    return maxTokens ?? this.defaultMaxTokens;
  }
}
