/**
 * SDK Agent Module
 *
 * Provides agents built on the Anthropic Agent SDK for enhanced capabilities:
 * - Automatic context compaction
 * - Built-in streaming
 * - Session persistence
 * - Cost tracking
 */

// Base class and types
export { SdkAgent } from './SdkAgent.js';
export * from './types.js';

// MCP Tool Adapter
export {
  createMcpServerFromTools,
  getMcpToolNames,
  ToolResultCollector,
} from './McpToolAdapter.js';

// SDK-based Agents
export { SdkTrainingCoachAgent } from './SdkTrainingCoachAgent.js';
export { SdkHealthAgent } from './SdkHealthAgent.js';
