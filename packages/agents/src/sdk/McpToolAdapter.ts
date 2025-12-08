/**
 * MCP Tool Adapter
 *
 * Converts LifeOS AgentTools to MCP-compatible tools for use with the Agent SDK.
 * This adapter creates an in-process MCP server that wraps existing tool implementations.
 */

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import type { AgentTool, AgentContext, WhiteboardEntryPayload } from '../base/types.js';

/**
 * Convert JSON Schema property to Zod schema
 */
function jsonSchemaToZod(property: Record<string, unknown>, required: boolean = false): z.ZodTypeAny {
  const type = property.type as string;
  const description = property.description as string | undefined;

  let schema: z.ZodTypeAny;

  switch (type) {
    case 'string':
      if (property.enum) {
        schema = z.enum(property.enum as [string, ...string[]]);
      } else {
        schema = z.string();
      }
      break;
    case 'number':
      schema = z.number();
      break;
    case 'integer':
      // Use z.number() for integers - validation happens at runtime
      schema = z.number();
      break;
    case 'boolean':
      schema = z.boolean();
      break;
    case 'array': {
      const items = property.items as Record<string, unknown> | undefined;
      if (items) {
        schema = z.array(jsonSchemaToZod(items, true));
      } else {
        schema = z.array(z.unknown());
      }
      break;
    }
    case 'object': {
      const props = property.properties as Record<string, Record<string, unknown>> | undefined;
      if (props) {
        const shape: Record<string, z.ZodTypeAny> = {};
        const requiredFields = (property.required as string[]) || [];
        for (const [key, value] of Object.entries(props)) {
          shape[key] = jsonSchemaToZod(value, requiredFields.includes(key));
        }
        schema = z.object(shape);
      } else {
        schema = z.record(z.unknown());
      }
      break;
    }
    default:
      schema = z.unknown();
  }

  if (description) {
    schema = schema.describe(description);
  }

  if (!required) {
    schema = schema.optional();
  }

  return schema;
}

/**
 * Convert AgentTool parameters to Zod schema
 */
function convertParametersToZod(parameters: AgentTool['parameters']): z.ZodRawShape {
  const shape: z.ZodRawShape = {};
  const required = parameters.required || [];

  for (const [key, value] of Object.entries(parameters.properties)) {
    const prop = value as Record<string, unknown>;
    shape[key] = jsonSchemaToZod(prop, required.includes(key));
  }

  return shape;
}

/**
 * Result collector for whiteboard entries from tool executions
 */
export class ToolResultCollector {
  private whiteboardEntries: WhiteboardEntryPayload[] = [];
  private toolCalls: Array<{
    name: string;
    arguments: Record<string, unknown>;
    result: unknown;
    duration: number;
  }> = [];

  addWhiteboardEntry(entry: WhiteboardEntryPayload) {
    this.whiteboardEntries.push(entry);
  }

  addToolCall(call: { name: string; arguments: Record<string, unknown>; result: unknown; duration: number }) {
    this.toolCalls.push(call);
  }

  getWhiteboardEntries(): WhiteboardEntryPayload[] {
    return this.whiteboardEntries;
  }

  getToolCalls() {
    return this.toolCalls;
  }

  reset() {
    this.whiteboardEntries = [];
    this.toolCalls = [];
  }
}

/**
 * Check if a result is a whiteboard entry payload
 */
function isWhiteboardEntry(result: unknown): result is WhiteboardEntryPayload {
  if (typeof result !== 'object' || result === null) {
    return false;
  }
  const entry = result as Record<string, unknown>;
  return (
    typeof entry.entryType === 'string' &&
    typeof entry.content === 'string'
  );
}

/**
 * Create an in-process MCP server from AgentTools
 *
 * @param serverName - Name for the MCP server
 * @param tools - Array of AgentTools to wrap
 * @param context - AgentContext to pass to tool executions
 * @param collector - Optional collector for whiteboard entries and tool calls
 */
export function createMcpServerFromTools(
  serverName: string,
  tools: AgentTool[],
  context: AgentContext,
  collector?: ToolResultCollector
) {
  const mcpTools = tools.map((agentTool) => {
    const zodSchema = convertParametersToZod(agentTool.parameters);

    return tool(
      agentTool.name,
      agentTool.description,
      zodSchema,
      async (args) => {
        const startTime = Date.now();

        try {
          const result = await agentTool.execute(args as Record<string, unknown>, context);
          const duration = Date.now() - startTime;

          // Collect tool call
          if (collector) {
            collector.addToolCall({
              name: agentTool.name,
              arguments: args as Record<string, unknown>,
              result,
              duration,
            });

            // Collect whiteboard entry if result is one
            if (isWhiteboardEntry(result)) {
              collector.addWhiteboardEntry(result);
            }
          }

          // Return MCP-compatible result
          return {
            content: [{
              type: 'text' as const,
              text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
            }],
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);

          // Still record failed tool calls
          if (collector) {
            collector.addToolCall({
              name: agentTool.name,
              arguments: args as Record<string, unknown>,
              result: { error: errorMessage },
              duration: Date.now() - startTime,
            });
          }

          return {
            content: [{
              type: 'text' as const,
              text: `Error: ${errorMessage}`,
            }],
            isError: true,
          };
        }
      }
    );
  });

  return createSdkMcpServer({
    name: serverName,
    version: '1.0.0',
    tools: mcpTools,
  });
}

/**
 * Get tool names with MCP server prefix
 */
export function getMcpToolNames(serverName: string, tools: AgentTool[]): string[] {
  return tools.map((t) => `mcp__${serverName}__${t.name}`);
}
