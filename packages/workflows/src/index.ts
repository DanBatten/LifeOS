/**
 * @lifeos/workflows
 * 
 * Workflows orchestrate skills and agents to accomplish user goals.
 * They are the top-level entry points for cron jobs and API endpoints.
 * 
 * Architecture:
 * - Workflows: Orchestrated flows (MorningFlow, ChatFlow)
 * - Agents: LLM-powered interpretation (receives data, returns analysis)
 * - Skills: Deterministic tool sequences (sync data, load context)
 * - Tools: Atomic operations (API calls, DB queries)
 */

export {
  runMorningFlow,
  type MorningFlowResult,
  type MorningFlowOptions,
} from './morning-flow.workflow.js';

export {
  runChatFlow,
  type ChatFlowResult,
  type ChatFlowOptions,
} from './chat-flow.workflow.js';

export {
  runPostRunFlow,
  type PostRunFlowResult,
  type PostRunFlowOptions,
} from './post-run-flow.workflow.js';

export {
  routeMessage,
  quickRoute,
  type RouteResult,
  type ConversationMessage,
  type AgentId,
} from './router.js';

export {
  runWeeklySummaryWorkflow,
  type WeeklySummaryResult,
} from './weekly-summary.workflow.js';

export {
  runWeeklyPlanning,
  type WeeklyPlanResult,
} from './weekly-planning.workflow.js';
