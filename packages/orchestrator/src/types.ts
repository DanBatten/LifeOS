import type { AgentId, DailyPlan, WhiteboardEntry, Task, CalendarEvent, Workout } from '@lifeos/core';
import type { AgentOutput } from '@lifeos/agents';

/**
 * Configuration for the orchestrator
 */
export interface OrchestratorConfig {
  userId: string;
  timezone?: string;
}

/**
 * Result of a morning flow execution
 */
export interface MorningFlowResult {
  dailyPlan: DailyPlan;
  agentOutputs: Record<AgentId, AgentOutput>;
  whiteboardEntries: WhiteboardEntry[];
  duration: number;
}

/**
 * Result of an evening flow execution
 */
export interface EveningFlowResult {
  reflection: AgentOutput;
  whiteboardEntries: WhiteboardEntry[];
  duration: number;
}

/**
 * Types of event triggers
 */
export type EventTriggerType =
  | 'calendar_change'
  | 'health_checkin'
  | 'task_completed'
  | 'task_added'
  | 'workout_completed'
  | 'weekly_review'
  | 'user_message';

/**
 * Event trigger payload
 */
export interface EventTrigger {
  type: EventTriggerType;
  entityId?: string;
  data?: Record<string, unknown>;
  timestamp: Date;
}

/**
 * Context built for agent execution
 */
export interface OrchestratorContext {
  userId: string;
  date: string;
  userName: string;
  timezone: string;
  events: CalendarEvent[];
  tasks: Task[];
  healthSnapshot: unknown;
  recentWorkouts: Workout[];
  upcomingWorkouts: Workout[];
  activeInjuries: unknown[];
  constraints: unknown[];
  whiteboardEntries: WhiteboardEntry[];
}

/**
 * Message classification result
 */
export interface MessageClassification {
  primaryAgent: AgentId;
  confidence: number;
  topics: string[];
  intent: 'question' | 'command' | 'update' | 'chat';
}

/**
 * Events emitted by the orchestrator
 */
export interface OrchestratorEvents {
  'flow:start': { type: 'morning' | 'evening' | 'chat' | 'trigger' };
  'flow:complete': { type: 'morning' | 'evening' | 'chat' | 'trigger'; duration: number };
  'agent:dispatched': { agentId: AgentId };
  'agent:completed': { agentId: AgentId; output: AgentOutput };
  'agent:failed': { agentId: AgentId; error: Error };
  'trigger:received': { trigger: EventTrigger };
}
