import Anthropic from '@anthropic-ai/sdk';
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
 * Anthropic Claude provider
 */
export class AnthropicProvider extends BaseLLMProvider {
  readonly name = 'anthropic';
  private client: Anthropic;

  constructor(options?: {
    apiKey?: string;
    defaultModel?: string;
    defaultTemperature?: number;
    defaultMaxTokens?: number;
  }) {
    super(options);
    this.client = new Anthropic({
      apiKey: options?.apiKey || process.env.ANTHROPIC_API_KEY,
    });
  }

  protected getDefaultModel(): string {
    return 'claude-sonnet-4-20250514';
  }

  async chat(request: LLMRequest): Promise<LLMResponse> {
    try {
      const tools = request.tools?.map((tool) => this.convertTool(tool));

      const response = await this.client.messages.create({
        model: this.resolveModel(request.model),
        max_tokens: this.resolveMaxTokens(request.maxTokens),
        temperature: this.resolveTemperature(request.temperature),
        system: request.systemPrompt,
        messages: request.messages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
        tools: tools?.length ? tools : undefined,
      });

      return this.parseResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async continueWithToolResults(
    request: LLMRequest,
    previousResponse: LLMResponse,
    toolResults: ToolResult[]
  ): Promise<LLMResponse> {
    try {
      const tools = request.tools?.map((tool) => this.convertTool(tool));

      // Build the message history including tool use and results
      const messages: Anthropic.MessageParam[] = [
        ...request.messages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
        // Add the assistant's tool use response
        {
          role: 'assistant' as const,
          content: previousResponse.toolCalls?.map((tc) => ({
            type: 'tool_use' as const,
            id: tc.id,
            name: tc.name,
            input: tc.arguments,
          })) || [],
        },
        // Add the tool results
        {
          role: 'user' as const,
          content: toolResults.map((tr) => ({
            type: 'tool_result' as const,
            tool_use_id: tr.id,
            content: tr.error || JSON.stringify(tr.result),
            is_error: !!tr.error,
          })),
        },
      ];

      const response = await this.client.messages.create({
        model: this.resolveModel(request.model),
        max_tokens: this.resolveMaxTokens(request.maxTokens),
        temperature: this.resolveTemperature(request.temperature),
        system: request.systemPrompt,
        messages,
        tools: tools?.length ? tools : undefined,
      });

      return this.parseResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  private convertTool(tool: ToolDefinition): Anthropic.Tool {
    return {
      name: tool.name,
      description: tool.description,
      input_schema: {
        type: 'object',
        properties: tool.parameters.properties,
        required: tool.parameters.required,
      },
    };
  }

  private parseResponse(response: Anthropic.Message): LLMResponse {
    const textContent = response.content.find((c) => c.type === 'text');
    const toolUses = response.content.filter((c) => c.type === 'tool_use');

    const toolCalls: ToolCall[] = toolUses.map((tu) => {
      if (tu.type !== 'tool_use') {
        throw new Error('Unexpected content type');
      }
      return {
        id: tu.id,
        name: tu.name,
        arguments: tu.input as Record<string, unknown>,
      };
    });

    const usage: TokenUsage = {
      promptTokens: response.usage.input_tokens,
      completionTokens: response.usage.output_tokens,
      totalTokens: response.usage.input_tokens + response.usage.output_tokens,
    };

    return {
      content: textContent?.type === 'text' ? textContent.text : '',
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage,
      model: response.model,
      stopReason: response.stop_reason || 'unknown',
    };
  }

  private handleError(error: unknown): LLMError {
    if (error instanceof Anthropic.APIError) {
      const retryable =
        error.status === 429 ||
        error.status === 500 ||
        error.status === 502 ||
        error.status === 503;

      return new LLMError(error.message, 'anthropic', {
        retryable,
        statusCode: error.status,
        context: { name: error.name },
      });
    }

    if (error instanceof Error) {
      return new LLMError(error.message, 'anthropic', { retryable: false });
    }

    return new LLMError(String(error), 'anthropic', { retryable: false });
  }
}
