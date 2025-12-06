/**
 * LLM types for multi-provider abstraction
 */

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  id: string;
  result?: unknown;
  error?: string;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LLMRequest {
  systemPrompt: string;
  messages: LLMMessage[];
  tools?: ToolDefinition[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMResponse {
  content: string;
  toolCalls?: ToolCall[];
  usage: TokenUsage;
  model: string;
  stopReason: string;
}

export interface LLMProvider {
  readonly name: string;

  /**
   * Send a chat completion request
   */
  chat(request: LLMRequest): Promise<LLMResponse>;

  /**
   * Continue a conversation after tool execution
   */
  continueWithToolResults(
    request: LLMRequest,
    previousResponse: LLMResponse,
    toolResults: ToolResult[]
  ): Promise<LLMResponse>;
}

export type LLMProviderType = 'anthropic' | 'openai';

export interface LLMConfig {
  provider: LLMProviderType;
  apiKey?: string;
  defaultModel?: string;
  defaultTemperature?: number;
  defaultMaxTokens?: number;
}
