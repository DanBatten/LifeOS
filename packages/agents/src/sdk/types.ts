/**
 * Types for SDK-based agents
 */

import type { AgentContext, AgentOutput, WhiteboardEntryPayload, ToolCallRecord } from '../base/types.js';

/**
 * Configuration for SDK-based agents
 */
export interface SdkAgentConfig {
  id: string;
  name: string;
  description: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  maxTurns?: number;
}

/**
 * SDK agent execution options
 */
export interface SdkExecuteOptions {
  /** Enable streaming (receive partial messages) */
  streaming?: boolean;
  /** Custom permission mode */
  permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions';
  /** Maximum budget in USD */
  maxBudgetUsd?: number;
  /** Session ID to resume */
  resumeSession?: string;
}

/**
 * Callback for streaming messages
 */
export type StreamCallback = (chunk: string) => void;

/**
 * MCP tool definition that wraps our AgentTool
 */
export interface McpToolWrapper {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>, context: AgentContext) => Promise<unknown>;
}

/**
 * Extended agent output with SDK-specific metrics
 */
export interface SdkAgentOutput extends AgentOutput {
  /** Session ID for resumption */
  sessionId?: string;
  /** Model usage breakdown by model */
  modelUsage?: Record<string, {
    inputTokens: number;
    outputTokens: number;
    costUSD: number;
  }>;
  /** Total cost in USD */
  totalCostUsd?: number;
  /** Number of conversation turns */
  numTurns?: number;
}

/**
 * Re-export base types for convenience
 */
export type { AgentContext, AgentOutput, WhiteboardEntryPayload, ToolCallRecord };
