import type { SupabaseClient } from '@supabase/supabase-js';
import type { AgentId, TokenUsage } from '@lifeos/core';
import type { ToolDefinition } from '@lifeos/llm';

/**
 * Configuration for an agent
 */
export interface AgentConfig {
  id: AgentId;
  name: string;
  description: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Context provided to agents for execution
 */
export interface AgentContext {
  userId: string;
  date: string; // ISO date string
  userName: string;
  timezone: string;
  supabase: SupabaseClient;
  data: Record<string, unknown>;
}

/**
 * Output from an agent execution
 */
export interface AgentOutput {
  agentId: AgentId;
  timestamp: string;
  content: string;
  whiteboardEntries: WhiteboardEntryPayload[];
  toolCallsMade: ToolCallRecord[];
  duration: number;
  tokenUsage: TokenUsage;
}

/**
 * Payload for creating a whiteboard entry
 */
export interface WhiteboardEntryPayload {
  entryType: 'observation' | 'suggestion' | 'question' | 'alert' | 'insight' | 'plan' | 'reflection';
  title?: string;
  content: string;
  structuredData?: Record<string, unknown>;
  priority?: number;
  requiresResponse?: boolean;
  relatedEntityType?: string;
  relatedEntityId?: string;
  tags?: string[];
}

/**
 * Record of a tool call made during execution
 */
export interface ToolCallRecord {
  name: string;
  arguments: Record<string, unknown>;
  result: unknown;
  duration: number;
}

/**
 * Tool with execution function
 */
export interface AgentTool extends ToolDefinition {
  execute: (args: Record<string, unknown>, context: AgentContext) => Promise<unknown>;
}

/**
 * Events emitted by agents
 */
export interface AgentEvents {
  'agent:start': { agentId: AgentId; context: AgentContext };
  'agent:tool:start': { agentId: AgentId; tool: string; args: Record<string, unknown> };
  'agent:tool:complete': { agentId: AgentId; tool: string; result: unknown; duration: number };
  'agent:tool:error': { agentId: AgentId; tool: string; error: Error };
  'agent:complete': { agentId: AgentId; output: AgentOutput };
  'agent:error': { agentId: AgentId; error: Error };
}
