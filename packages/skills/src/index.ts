/**
 * @lifeos/skills
 * 
 * Skills are bundles of tool calls for specific tasks.
 * They are deterministic (no LLM) and handle data operations.
 * 
 * Architecture:
 * - Tools: Atomic operations (API calls, DB queries)
 * - Skills: Composed tool sequences (sync data, load context)
 * - Agents: LLM-powered interpretation (receives data from skills)
 * - Workflows: Orchestrated flows using skills and agents
 */

// Garmin skills
export {
  syncGarminMetrics,
  type SyncMetricsResult,
  type SyncMetricsOptions,
} from './garmin/index.js';

// Context skills
export {
  loadAgentContext,
  type AgentContext,
} from './context/index.js';

// Whiteboard skills
export {
  writeToWhiteboard,
  writeMultipleToWhiteboard,
  clearExpiredWhiteboardEntries,
  type WhiteboardEntry,
  type WriteWhiteboardResult,
} from './whiteboard/index.js';

