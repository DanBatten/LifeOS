import { EventEmitter } from 'events';
import { AgentError, getLogger } from '@lifeos/core';
import type { LLMProvider, ToolResult } from '@lifeos/llm';
import type {
  AgentConfig,
  AgentContext,
  AgentOutput,
  AgentTool,
  WhiteboardEntryPayload,
  ToolCallRecord,
} from './types.js';

const logger = getLogger();

/**
 * Abstract base class for all LifeOS agents
 */
export abstract class BaseAgent extends EventEmitter {
  public readonly id: string;
  public readonly name: string;
  public readonly description: string;

  protected config: AgentConfig;
  protected llmClient: LLMProvider;
  protected tools: AgentTool[];

  constructor(config: AgentConfig, llmClient: LLMProvider) {
    super();
    this.id = config.id;
    this.name = config.name;
    this.description = config.description;
    this.config = config;
    this.llmClient = llmClient;
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
   * Main execution method
   */
  async execute(context: AgentContext): Promise<AgentOutput> {
    const startTime = Date.now();
    const toolCallsMade: ToolCallRecord[] = [];
    const whiteboardEntries: WhiteboardEntryPayload[] = [];

    this.emit('agent:start', { agentId: this.id, context });
    logger.info(`Agent ${this.id} starting execution`, {
      agentId: this.id,
      userId: context.userId,
      date: context.date,
    });

    try {
      // DIAGNOSTIC: Time prompt building
      const promptStart = Date.now();
      const systemPrompt = this.buildSystemPrompt(context);
      logger.info(`Agent ${this.id} built system prompt`, { 
        duration: Date.now() - promptStart,
        length: systemPrompt.length 
      });
      
      const userPromptStart = Date.now();
      const userPrompt = this.buildUserPrompt(context);
      logger.info(`Agent ${this.id} built user prompt`, { 
        duration: Date.now() - userPromptStart,
        length: userPrompt.length 
      });

      // Build tool definitions for LLM
      const toolDefinitions = this.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      }));
      logger.info(`Agent ${this.id} has ${toolDefinitions.length} tools registered`);

      // DIAGNOSTIC: Time LLM call
      const llmStart = Date.now();
      logger.info(`Agent ${this.id} sending LLM request...`);
      
      // Initial LLM call
      let response = await this.llmClient.chat({
        systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        tools: toolDefinitions.length > 0 ? toolDefinitions : undefined,
        model: this.config.model,
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens,
      });
      
      logger.info(`Agent ${this.id} LLM response received`, {
        duration: Date.now() - llmStart,
        toolCalls: response.toolCalls?.length || 0,
        contentLength: response.content?.length || 0,
        tokens: response.usage.totalTokens,
      });

      let totalUsage = { ...response.usage };

      // Process tool calls in a loop until no more tool calls
      let loopCount = 0;
      const maxLoops = 10; // Safety limit
      
      while (response.toolCalls && response.toolCalls.length > 0) {
        loopCount++;
        logger.info(`Agent ${this.id} tool loop iteration ${loopCount}`, {
          toolCalls: response.toolCalls.map(tc => tc.name),
        });
        
        if (loopCount > maxLoops) {
          logger.warn(`Agent ${this.id} exceeded max tool loops (${maxLoops}), breaking`);
          break;
        }
        
        const toolResults: ToolResult[] = [];

        for (const toolCall of response.toolCalls) {
          this.emit('agent:tool:start', {
            agentId: this.id,
            tool: toolCall.name,
            args: toolCall.arguments,
          });

          const toolStartTime = Date.now();
          const tool = this.tools.find((t) => t.name === toolCall.name);

          if (!tool) {
            logger.warn(`Unknown tool called: ${toolCall.name}`, {
              agentId: this.id,
            });
            toolResults.push({
              id: toolCall.id,
              error: `Unknown tool: ${toolCall.name}`,
            });
            continue;
          }

          try {
            const result = await tool.execute(toolCall.arguments, context);
            const toolDuration = Date.now() - toolStartTime;

            toolResults.push({ id: toolCall.id, result });
            toolCallsMade.push({
              name: toolCall.name,
              arguments: toolCall.arguments,
              result,
              duration: toolDuration,
            });

            // Collect whiteboard entries from tool results
            if (this.isWhiteboardEntry(result)) {
              whiteboardEntries.push(result);
            }

            this.emit('agent:tool:complete', {
              agentId: this.id,
              tool: toolCall.name,
              result,
              duration: toolDuration,
            });
          } catch (error) {
            const toolDuration = Date.now() - toolStartTime;
            const errorMessage = error instanceof Error ? error.message : String(error);

            toolResults.push({ id: toolCall.id, error: errorMessage });
            toolCallsMade.push({
              name: toolCall.name,
              arguments: toolCall.arguments,
              result: { error: errorMessage },
              duration: toolDuration,
            });

            this.emit('agent:tool:error', {
              agentId: this.id,
              tool: toolCall.name,
              error: error instanceof Error ? error : new Error(errorMessage),
            });
          }
        }

        // Continue conversation with tool results
        response = await this.llmClient.continueWithToolResults(
          {
            systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
            tools: toolDefinitions.length > 0 ? toolDefinitions : undefined,
            model: this.config.model,
            temperature: this.config.temperature,
            maxTokens: this.config.maxTokens,
          },
          response,
          toolResults
        );

        // Accumulate token usage
        totalUsage = {
          promptTokens: totalUsage.promptTokens + response.usage.promptTokens,
          completionTokens: totalUsage.completionTokens + response.usage.completionTokens,
          totalTokens: totalUsage.totalTokens + response.usage.totalTokens,
        };
      }

      const output: AgentOutput = {
        agentId: this.id as AgentOutput['agentId'],
        timestamp: new Date().toISOString(),
        content: response.content,
        whiteboardEntries,
        toolCallsMade,
        duration: Date.now() - startTime,
        tokenUsage: totalUsage,
      };

      this.emit('agent:complete', { agentId: this.id, output });
      logger.info(`Agent ${this.id} completed execution`, {
        agentId: this.id,
        duration: output.duration,
        toolCalls: toolCallsMade.length,
        whiteboardEntries: whiteboardEntries.length,
      });

      return output;
    } catch (error) {
      const agentError =
        error instanceof AgentError
          ? error
          : new AgentError(
              error instanceof Error ? error.message : String(error),
              this.id,
              { phase: 'execution' }
            );

      this.emit('agent:error', { agentId: this.id, error: agentError });
      logger.error(`Agent ${this.id} failed`, agentError, { agentId: this.id });

      throw agentError;
    }
  }

  /**
   * Check if a result is a whiteboard entry payload
   */
  private isWhiteboardEntry(result: unknown): result is WhiteboardEntryPayload {
    if (typeof result !== 'object' || result === null) {
      return false;
    }
    const entry = result as Record<string, unknown>;
    return (
      typeof entry.entryType === 'string' &&
      typeof entry.content === 'string'
    );
  }
}
