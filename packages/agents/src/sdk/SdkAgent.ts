/**
 * SDK Agent Base Class
 *
 * Abstract base class for agents using the Anthropic Agent SDK.
 * Provides the execution harness while allowing subclasses to define
 * their own tools, prompts, and behavior.
 *
 * Benefits over BaseAgent:
 * - Automatic context compaction (no MAX_TOOL_LOOPS limit)
 * - Built-in streaming support
 * - Session persistence for multi-turn conversations
 * - Better error handling and retries
 * - Token usage tracking with cost breakdown
 */

import { EventEmitter } from 'events';
import { query } from '@anthropic-ai/claude-agent-sdk';
import type {
  SDKMessage,
  SDKResultMessage,
  SDKAssistantMessage,
  Options as SdkOptions,
} from '@anthropic-ai/claude-agent-sdk';
import { AgentError, getLogger } from '@lifeos/core';
import type { AgentTool, AgentContext } from '../base/types.js';
import type { SdkAgentConfig, SdkAgentOutput, SdkExecuteOptions, StreamCallback } from './types.js';
import { createMcpServerFromTools, getMcpToolNames, ToolResultCollector } from './McpToolAdapter.js';

const logger = getLogger();

/**
 * Abstract base class for SDK-powered agents
 */
export abstract class SdkAgent extends EventEmitter {
  public readonly id: string;
  public readonly name: string;
  public readonly description: string;

  protected config: SdkAgentConfig;
  protected tools: AgentTool[];

  constructor(config: SdkAgentConfig) {
    super();
    this.id = config.id;
    this.name = config.name;
    this.description = config.description;
    this.config = config;
    this.tools = this.registerTools();
  }

  /**
   * Each agent must define its tools
   */
  protected abstract registerTools(): AgentTool[];

  /**
   * Each agent must define its system prompt
   */
  protected abstract buildSystemPrompt(context: AgentContext): string;

  /**
   * Each agent must define its user prompt
   */
  protected abstract buildUserPrompt(context: AgentContext): string;

  /**
   * Get the MCP server name for this agent's tools
   */
  protected getMcpServerName(): string {
    return this.id.replace(/-/g, '_');
  }

  /**
   * Hook for validating tool usage (can be overridden)
   */
  protected async validateToolUse(
    _toolName: string,
    _input: Record<string, unknown>,
    _context: AgentContext
  ): Promise<{ allow: boolean; reason?: string }> {
    return { allow: true };
  }

  /**
   * Main execution method using Agent SDK
   */
  async execute(
    context: AgentContext,
    options: SdkExecuteOptions = {}
  ): Promise<SdkAgentOutput> {
    const startTime = Date.now();
    const collector = new ToolResultCollector();

    this.emit('agent:start', { agentId: this.id, context });
    logger.info(`SDK Agent ${this.id} starting execution`, {
      agentId: this.id,
      userId: context.userId,
      date: context.date,
    });

    try {
      // Build prompts
      const promptStart = Date.now();
      const systemPrompt = this.buildSystemPrompt(context);
      logger.info(`SDK Agent ${this.id} built system prompt`, {
        duration: Date.now() - promptStart,
        length: systemPrompt.length,
      });

      const userPromptStart = Date.now();
      const userPrompt = this.buildUserPrompt(context);
      logger.info(`SDK Agent ${this.id} built user prompt`, {
        duration: Date.now() - userPromptStart,
        length: userPrompt.length,
      });

      // Create MCP server for our tools
      const mcpServerName = this.getMcpServerName();
      const mcpServer = createMcpServerFromTools(
        mcpServerName,
        this.tools,
        context,
        collector
      );

      // Build SDK options
      const sdkOptions: SdkOptions = {
        systemPrompt,
        model: this.config.model,
        maxTurns: this.config.maxTurns || 10,
        mcpServers: {
          [mcpServerName]: mcpServer,
        },
        allowedTools: getMcpToolNames(mcpServerName, this.tools),
        permissionMode: options.permissionMode || 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        maxBudgetUsd: options.maxBudgetUsd,
      };

      // Add session resumption if provided
      if (options.resumeSession) {
        sdkOptions.resume = options.resumeSession;
      }

      // Execute query
      const llmStart = Date.now();
      logger.info(`SDK Agent ${this.id} starting query...`);

      const messages: SDKMessage[] = [];
      let resultMessage: SDKResultMessage | null = null;
      let finalContent = '';
      let sessionId: string | undefined;

      for await (const message of query({
        prompt: userPrompt,
        options: sdkOptions,
      })) {
        messages.push(message);

        // Capture session ID from first message
        if (!sessionId && 'session_id' in message) {
          sessionId = message.session_id;
        }

        // Handle different message types
        if (message.type === 'assistant') {
          const assistantMsg = message as SDKAssistantMessage;
          // Extract text content from the message
          if (assistantMsg.message.content) {
            for (const block of assistantMsg.message.content) {
              if (block.type === 'text') {
                finalContent += block.text;
              }
            }
          }
          this.emit('agent:message', { agentId: this.id, message: assistantMsg });
        } else if (message.type === 'result') {
          resultMessage = message as SDKResultMessage;
        }
      }

      logger.info(`SDK Agent ${this.id} query completed`, {
        duration: Date.now() - llmStart,
        messageCount: messages.length,
      });

      if (!resultMessage) {
        throw new AgentError('No result message received from SDK', this.id);
      }

      // Build output
      const output: SdkAgentOutput = {
        agentId: this.id as SdkAgentOutput['agentId'],
        timestamp: new Date().toISOString(),
        content: resultMessage.subtype === 'success' ? resultMessage.result : finalContent,
        whiteboardEntries: collector.getWhiteboardEntries(),
        toolCallsMade: collector.getToolCalls(),
        duration: Date.now() - startTime,
        tokenUsage: {
          promptTokens: resultMessage.usage?.input_tokens || 0,
          completionTokens: resultMessage.usage?.output_tokens || 0,
          totalTokens: (resultMessage.usage?.input_tokens || 0) + (resultMessage.usage?.output_tokens || 0),
        },
        sessionId,
        totalCostUsd: resultMessage.total_cost_usd,
        numTurns: resultMessage.num_turns,
        modelUsage: resultMessage.modelUsage,
      };

      // Handle errors in result
      if (resultMessage.subtype !== 'success') {
        const errorResult = resultMessage as SDKResultMessage & { errors?: string[] };
        logger.warn(`SDK Agent ${this.id} completed with errors`, {
          subtype: resultMessage.subtype,
          errors: errorResult.errors,
        });
        output.content = `Agent completed with status: ${resultMessage.subtype}. ${errorResult.errors?.join(', ') || ''}`;
      }

      this.emit('agent:complete', { agentId: this.id, output });
      logger.info(`SDK Agent ${this.id} completed execution`, {
        agentId: this.id,
        duration: output.duration,
        toolCalls: output.toolCallsMade.length,
        whiteboardEntries: output.whiteboardEntries.length,
        cost: output.totalCostUsd,
        turns: output.numTurns,
      });

      return output;
    } catch (error) {
      const agentError =
        error instanceof AgentError
          ? error
          : new AgentError(
              error instanceof Error ? error.message : String(error),
              this.id,
              { phase: 'sdk_execution' }
            );

      this.emit('agent:error', { agentId: this.id, error: agentError });
      logger.error(`SDK Agent ${this.id} failed`, agentError, { agentId: this.id });

      throw agentError;
    }
  }

  /**
   * Execute with streaming support
   */
  async executeWithStreaming(
    context: AgentContext,
    onChunk: StreamCallback,
    options: SdkExecuteOptions = {}
  ): Promise<SdkAgentOutput> {
    const startTime = Date.now();
    const collector = new ToolResultCollector();

    this.emit('agent:start', { agentId: this.id, context });

    try {
      const systemPrompt = this.buildSystemPrompt(context);
      const userPrompt = this.buildUserPrompt(context);

      const mcpServerName = this.getMcpServerName();
      const mcpServer = createMcpServerFromTools(
        mcpServerName,
        this.tools,
        context,
        collector
      );

      const sdkOptions: SdkOptions = {
        systemPrompt,
        model: this.config.model,
        maxTurns: this.config.maxTurns || 10,
        mcpServers: {
          [mcpServerName]: mcpServer,
        },
        allowedTools: getMcpToolNames(mcpServerName, this.tools),
        permissionMode: options.permissionMode || 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        maxBudgetUsd: options.maxBudgetUsd,
        includePartialMessages: true, // Enable streaming
      };

      if (options.resumeSession) {
        sdkOptions.resume = options.resumeSession;
      }

      let resultMessage: SDKResultMessage | null = null;
      let sessionId: string | undefined;
      let fullContent = '';

      for await (const message of query({
        prompt: userPrompt,
        options: sdkOptions,
      })) {
        if (!sessionId && 'session_id' in message) {
          sessionId = message.session_id;
        }

        // Stream partial messages
        if (message.type === 'stream_event') {
          const event = (message as { event?: { type?: string; delta?: { text?: string } } }).event;
          if (event?.type === 'content_block_delta' && event.delta?.text) {
            onChunk(event.delta.text);
            fullContent += event.delta.text;
          }
        } else if (message.type === 'result') {
          resultMessage = message as SDKResultMessage;
        }
      }

      if (!resultMessage) {
        throw new AgentError('No result message received from SDK', this.id);
      }

      const output: SdkAgentOutput = {
        agentId: this.id as SdkAgentOutput['agentId'],
        timestamp: new Date().toISOString(),
        content: resultMessage.subtype === 'success' ? resultMessage.result : fullContent,
        whiteboardEntries: collector.getWhiteboardEntries(),
        toolCallsMade: collector.getToolCalls(),
        duration: Date.now() - startTime,
        tokenUsage: {
          promptTokens: resultMessage.usage?.input_tokens || 0,
          completionTokens: resultMessage.usage?.output_tokens || 0,
          totalTokens: (resultMessage.usage?.input_tokens || 0) + (resultMessage.usage?.output_tokens || 0),
        },
        sessionId,
        totalCostUsd: resultMessage.total_cost_usd,
        numTurns: resultMessage.num_turns,
        modelUsage: resultMessage.modelUsage,
      };

      this.emit('agent:complete', { agentId: this.id, output });
      return output;
    } catch (error) {
      const agentError =
        error instanceof AgentError
          ? error
          : new AgentError(
              error instanceof Error ? error.message : String(error),
              this.id,
              { phase: 'sdk_streaming_execution' }
            );

      this.emit('agent:error', { agentId: this.id, error: agentError });
      throw agentError;
    }
  }
}
