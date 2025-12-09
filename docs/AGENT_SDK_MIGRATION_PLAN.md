# Agent Architecture & Future SDK Migration Plan

## Executive Summary

This document outlines the LifeOS agent architecture and documents our evaluation of the Anthropic Agent SDK for future integration.

**Current Status:** Using direct LLM calls via `@lifeos/llm` for server-side agents. The Anthropic Agent SDK was evaluated but is designed for CLI tools (spawns subprocesses), not server/API use.

**Key Insight:** The Agent SDK is excellent for CLI tools like Claude Code, but for HTTP APIs we use the standard Anthropic SDK directly.

---

## Current LifeOS Architecture

### Layer Overview

```
Workflows → Agents → Skills → Tools
```

| Layer | Implementation | Purpose |
|-------|----------------|---------|
| **Workflows** | `packages/workflows/` | Orchestrate multi-step flows (MorningFlow, ChatFlow) |
| **Agents** | `packages/agents/` with `BaseAgent` | LLM-powered interpretation (HealthAgent, TrainingCoachAgent) |
| **Skills** | `packages/skills/` | Deterministic data operations (SyncGarminMetrics, LoadAgentContext) |
| **Tools** | Within agents | Atomic operations (DB queries, modifications) |

### Key Patterns

1. **"Agents Don't Fetch" Principle** - Skills pre-load context, agents just interpret
2. **Context Embedding** - All data passed via `AgentContext`, not fetched via tools
3. **Multi-task Agents** - Single agent handles multiple task types via `taskType`
4. **Whiteboard Communication** - Inter-agent messaging via shared entries
5. **Fast Path Detection** - ChatFlow detects modification requests to choose tool-enabled vs tool-less paths

---

## Marathon Training Skills

Domain knowledge for the Training Coach is stored in `.claude/skills/marathon-training/`:

| File | Purpose |
|------|---------|
| `SKILL.md` | Training phases, workout types, key metrics |
| `PACING.md` | Pace zone calculations by goal time |
| `RECOVERY.md` | HRV, RHR, sleep analysis guidelines |
| `RACE_DAY.md` | Race execution strategy and troubleshooting |

These skills provide structured domain knowledge that can be referenced by agents or used for prompt construction.

---

## Agent SDK Evaluation (December 2025)

### What We Learned

The Anthropic Agent SDK (`@anthropic-ai/claude-agent-sdk`) is designed for **CLI applications** like Claude Code:

| Feature | SDK Approach | Our Needs |
|---------|--------------|-----------|
| Execution | Spawns subprocess | HTTP API handler |
| Environment | Local CLI | Serverless/Next.js |
| Permissions | Interactive prompts | Programmatic |
| Tools | MCP servers (stdio) | Direct function calls |

### Why We Didn't Adopt It (For Now)

1. **Subprocess model** - The SDK spawns a Claude Code process, which fails in serverless environments
2. **Designed for CLI** - Permission prompts, interactive mode not suitable for APIs
3. **Our agents already work** - Direct LLM calls via `@lifeos/llm` are fast and reliable

### When to Revisit

Consider the Agent SDK if:
- Building a CLI tool for local use
- Anthropic releases a server-compatible version
- Need advanced features like session persistence across deployments

---

## Current Agent Implementation

### BaseAgent Pattern

```typescript
// packages/agents/src/base/BaseAgent.ts
abstract class BaseAgent {
  abstract registerTools(): AgentTool[];
  abstract buildSystemPrompt(context: AgentContext): string;
  abstract buildUserPrompt(context: AgentContext): string;

  async execute(context: AgentContext): Promise<AgentOutput> {
    // 1. Build prompts
    // 2. Send to LLM with tools
    // 3. Execute tool loop if needed
    // 4. Return response + collected whiteboard entries
  }
}
```

### Available Agents

| Agent | Purpose | Model |
|-------|---------|-------|
| `HealthAgent` | Health metrics, recovery analysis | Claude Sonnet 4.5 |
| `TrainingCoachAgent` | Workout analysis, plan modifications | Claude Sonnet 4.5 |

### Tool Definition

```typescript
interface AgentTool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  execute: (args: Record<string, unknown>, context: AgentContext) => Promise<unknown>;
}
```

---

## Future Considerations

### If We Need CLI Tools

If building local CLI tools, the Agent SDK would provide:
- Automatic context compaction
- Session persistence
- MCP server integration
- Cost tracking

### Alternative: Direct Anthropic SDK

For server use, we use the Anthropic SDK directly:

```typescript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();
const response = await client.messages.create({
  model: 'claude-sonnet-4-5-20250929',
  messages: [...],
  tools: [...],
});
```

This is what `@lifeos/llm` wraps with multi-provider support.

---

## Summary

| Aspect | Current Approach | Future Option |
|--------|------------------|---------------|
| Server APIs | Direct LLM via `@lifeos/llm` | Keep as-is |
| CLI Tools | N/A | Agent SDK |
| Domain Knowledge | `.claude/skills/` markdown files | Keep as-is |
| Agent Pattern | `BaseAgent` + tools | Keep as-is |
