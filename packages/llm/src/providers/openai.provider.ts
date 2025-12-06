import OpenAI from 'openai';
import { LLMError } from '@lifeos/core';
import { BaseLLMProvider } from './base.provider.js';
import type {
  LLMRequest,
  LLMResponse,
  ToolDefinition,
  ToolCall,
  ToolResult,
  TokenUsage,
} from '../types.js';

/**
 * OpenAI GPT provider
 */
export class OpenAIProvider extends BaseLLMProvider {
  readonly name = 'openai';
  private client: OpenAI;

  constructor(options?: {
    apiKey?: string;
    defaultModel?: string;
    defaultTemperature?: number;
    defaultMaxTokens?: number;
  }) {
    super(options);
    this.client = new OpenAI({
      apiKey: options?.apiKey || process.env.OPENAI_API_KEY,
    });
  }

  protected getDefaultModel(): string {
    return 'gpt-4-turbo-preview';
  }

  async chat(request: LLMRequest): Promise<LLMResponse> {
    try {
      const tools = request.tools?.map((tool) => this.convertTool(tool));
      const model = this.resolveModel(request.model);

      const messages: OpenAI.ChatCompletionMessageParam[] = [
        { role: 'system', content: request.systemPrompt },
        ...request.messages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      ];

      // GPT-5.x and o-series models use max_completion_tokens instead of max_tokens
      const maxTokensParam = this.isNewModelFormat(model)
        ? { max_completion_tokens: this.resolveMaxTokens(request.maxTokens) }
        : { max_tokens: this.resolveMaxTokens(request.maxTokens) };

      const response = await this.client.chat.completions.create({
        model,
        ...maxTokensParam,
        temperature: this.resolveTemperature(request.temperature),
        messages,
        tools: tools?.length ? tools : undefined,
      });

      return this.parseResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Check if model uses the newer API format (max_completion_tokens)
   */
  private isNewModelFormat(model: string): boolean {
    return model.startsWith('gpt-5') || 
           model.startsWith('o1') || 
           model.startsWith('o3');
  }

  async continueWithToolResults(
    request: LLMRequest,
    previousResponse: LLMResponse,
    toolResults: ToolResult[]
  ): Promise<LLMResponse> {
    try {
      const tools = request.tools?.map((tool) => this.convertTool(tool));
      const model = this.resolveModel(request.model);

      // Build messages with tool calls and results
      const messages: OpenAI.ChatCompletionMessageParam[] = [
        { role: 'system', content: request.systemPrompt },
        ...request.messages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
        // Add the assistant's tool call response
        {
          role: 'assistant',
          content: previousResponse.content || null,
          tool_calls: previousResponse.toolCalls?.map((tc) => ({
            id: tc.id,
            type: 'function' as const,
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments),
            },
          })),
        },
        // Add tool results
        ...toolResults.map((tr) => ({
          role: 'tool' as const,
          tool_call_id: tr.id,
          content: tr.error || JSON.stringify(tr.result),
        })),
      ];

      // GPT-5.x and o-series models use max_completion_tokens instead of max_tokens
      const maxTokensParam = this.isNewModelFormat(model)
        ? { max_completion_tokens: this.resolveMaxTokens(request.maxTokens) }
        : { max_tokens: this.resolveMaxTokens(request.maxTokens) };

      const response = await this.client.chat.completions.create({
        model,
        ...maxTokensParam,
        temperature: this.resolveTemperature(request.temperature),
        messages,
        tools: tools?.length ? tools : undefined,
      });

      return this.parseResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  private convertTool(tool: ToolDefinition): OpenAI.ChatCompletionTool {
    return {
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    };
  }

  private parseResponse(response: OpenAI.ChatCompletion): LLMResponse {
    const choice = response.choices[0];
    const message = choice?.message;

    if (!message) {
      throw new LLMError('No response message', 'openai', { retryable: false });
    }

    const toolCalls: ToolCall[] | undefined = message.tool_calls?.map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments),
    }));

    const usage: TokenUsage = {
      promptTokens: response.usage?.prompt_tokens || 0,
      completionTokens: response.usage?.completion_tokens || 0,
      totalTokens: response.usage?.total_tokens || 0,
    };

    return {
      content: message.content || '',
      toolCalls: toolCalls?.length ? toolCalls : undefined,
      usage,
      model: response.model,
      stopReason: choice.finish_reason || 'unknown',
    };
  }

  private handleError(error: unknown): LLMError {
    if (error instanceof OpenAI.APIError) {
      const retryable =
        error.status === 429 ||
        error.status === 500 ||
        error.status === 502 ||
        error.status === 503;

      return new LLMError(error.message, 'openai', {
        retryable,
        statusCode: error.status,
        context: { type: error.type },
      });
    }

    if (error instanceof Error) {
      return new LLMError(error.message, 'openai', { retryable: false });
    }

    return new LLMError(String(error), 'openai', { retryable: false });
  }
}
