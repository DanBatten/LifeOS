# Anthropic Agent SDK Migration Analysis & Plan

## Executive Summary

This document analyzes the feasibility and approach for migrating LifeOS agents to use the Anthropic Agent SDK (`@anthropic-ai/claude-agent-sdk`). After thorough research, **I recommend a hybrid approach**: adopt the Agent SDK as the execution harness while preserving your domain-specific architecture patterns.

**Verdict: YES, adopt the Agent SDK** - but thoughtfully, not as a wholesale replacement.

## Implementation Status

**Phase 1 Complete!** The following has been implemented:

| Component | Status | Location |
|-----------|--------|----------|
| SDK Installation | ✅ Done | `@lifeos/agents` package |
| SdkAgent base class | ✅ Done | `packages/agents/src/sdk/SdkAgent.ts` |
| MCP Tool Adapter | ✅ Done | `packages/agents/src/sdk/McpToolAdapter.ts` |
| SdkTrainingCoachAgent | ✅ Done | `packages/agents/src/sdk/SdkTrainingCoachAgent.ts` |
| Package exports | ✅ Done | `packages/agents/src/index.ts` |
| Test script | ✅ Done | `scripts/test-sdk-agent.ts` |

### Quick Start

```typescript
import { SdkTrainingCoachAgent } from '@lifeos/agents';

const agent = new SdkTrainingCoachAgent();

const output = await agent.execute(context, {
  permissionMode: 'bypassPermissions',
});

console.log(output.content);
console.log(`Cost: $${output.totalCostUsd}`);
```

---

## Current LifeOS Architecture

### What You Have

```
Workflows → Agents → Skills → Tools
```

| Layer | Implementation | Purpose |
|-------|----------------|---------|
| **Workflows** | `packages/workflows/` | Orchestrate multi-step flows (MorningFlow, ChatFlow) |
| **Agents** | `packages/agents/` with `BaseAgent` | LLM-powered interpretation (HealthAgent, TrainingCoachAgent) |
| **Skills** | `packages/skills/` | Deterministic data operations (SyncGarminMetrics, LoadAgentContext) |
| **Tools** | Within agents | Atomic operations (DB queries, modifications) |

### Key Patterns Worth Preserving

1. **"Agents Don't Fetch" Principle** - Skills pre-load context, agents just interpret
2. **Context Embedding** - All data passed via `AgentContext`, not fetched via tools
3. **Multi-task Agents** - Single agent handles multiple task types via `taskType`
4. **Whiteboard Communication** - Inter-agent messaging via shared entries
5. **Fast Path Detection** - ChatFlow detects modification requests to choose tool-enabled vs tool-less paths

---

## Anthropic Agent SDK Overview

### What the SDK Provides

The Agent SDK is the harness that powers Claude Code, offering:

| Feature | Description | LifeOS Benefit |
|---------|-------------|----------------|
| **Context Management** | Automatic compaction when approaching limits | Unlimited conversation length |
| **Rich Tool Ecosystem** | Built-in Read, Write, Bash, Grep, Glob, WebFetch | Don't reinvent file/search tools |
| **Permission System** | Fine-grained `canUseTool` callbacks | Control what agents can modify |
| **Session Management** | Resume, fork sessions | Persistent coaching conversations |
| **Streaming** | Real-time token streaming | Better UX for long responses |
| **MCP Integration** | Model Context Protocol servers | Extensible external integrations |
| **Hooks** | PreToolUse, PostToolUse, etc. | Audit, validate, intercept |

### SDK Architecture

```typescript
import { query, tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";

// Core pattern: query() returns an async generator of messages
for await (const message of query({
  prompt: "Help me plan this week's training",
  options: {
    systemPrompt: "You are an elite running coach...",
    model: "claude-opus-4-5-20250929",
    allowedTools: ["Read", "Write", "Bash", "mcp__garmin__get_daily_summary"],
    mcpServers: {
      garmin: { type: 'stdio', command: 'uvx', args: ['garmin-mcp'] }
    },
    cwd: "/path/to/project",
    permissionMode: "acceptEdits",
    hooks: {
      PreToolUse: [{ hooks: [auditToolUse] }]
    }
  }
})) {
  if (message.type === 'assistant') {
    // Stream to user
  } else if (message.type === 'result') {
    // Final result with usage stats
  }
}
```

### SDK Skills vs LifeOS Skills

**Important distinction**: These are different concepts!

| Aspect | Anthropic SDK Skills | LifeOS Skills |
|--------|---------------------|---------------|
| **Definition** | `SKILL.md` files in `.claude/skills/` | TypeScript functions in `packages/skills/` |
| **Execution** | LLM autonomously invokes based on description | Workflow explicitly calls |
| **Purpose** | Extend Claude's capabilities with domain knowledge | Deterministic data operations |
| **Contains** | Instructions, examples, scripts | Business logic, DB operations |

**Recommendation**: Rename LifeOS "skills" to "operations" or "data-services" to avoid confusion.

---

## Migration Strategy

### Phase 1: SDK as Execution Harness (Recommended First Step)

Replace `BaseAgent` execution loop with SDK's `query()` function while keeping your agent structure.

**Current Pattern:**
```typescript
// packages/agents/src/base/BaseAgent.ts
class BaseAgent {
  async execute(context: AgentContext): Promise<AgentOutput> {
    const systemPrompt = this.buildSystemPrompt(context);
    const userPrompt = this.buildUserPrompt(context);

    let response = await this.llmClient.chat({
      systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      tools: this.toolDefinitions,
      // ...
    });

    // Manual tool loop
    while (response.hasToolCalls && iterations < MAX_LOOPS) {
      // Execute tools, continue conversation...
    }

    return output;
  }
}
```

**New Pattern with SDK:**
```typescript
// packages/agents/src/base/SdkAgent.ts
import { query, SDKMessage, SDKResultMessage } from "@anthropic-ai/claude-agent-sdk";

abstract class SdkAgent {
  abstract buildSystemPrompt(context: AgentContext): string;
  abstract buildUserPrompt(context: AgentContext): string;
  abstract getMcpServers(): Record<string, McpServerConfig>;
  abstract getAllowedTools(): string[];

  async execute(context: AgentContext): Promise<AgentOutput> {
    const messages: SDKMessage[] = [];

    for await (const message of query({
      prompt: this.buildUserPrompt(context),
      options: {
        systemPrompt: this.buildSystemPrompt(context),
        model: this.config.model,
        allowedTools: this.getAllowedTools(),
        mcpServers: this.getMcpServers(),
        maxTurns: 10,
        cwd: process.cwd(),
        // Custom tool permission handler
        canUseTool: async (toolName, input) => {
          return this.validateToolUse(toolName, input, context);
        },
        hooks: {
          PostToolUse: [{
            hooks: [async (input) => this.collectWhiteboardEntry(input)]
          }]
        }
      }
    })) {
      messages.push(message);

      if (message.type === 'result' && message.subtype === 'success') {
        return this.buildOutput(message, messages);
      }
    }
  }
}
```

**Benefits:**
- Automatic context compaction (no more MAX_TOOL_LOOPS worries)
- Built-in streaming support
- Session persistence for multi-turn coaching
- Better error handling and retries
- Token usage tracking built-in

### Phase 2: Garmin MCP Server

Replace your Python subprocess Garmin integration with a proper MCP server.

**Current:**
```typescript
// Slow Python subprocess calls
const garminClient = new GarminMCPClient();
const stats = await garminClient.getDailySummary(date); // 5-10s per call
```

**New:**
```typescript
// packages/integrations/garmin-mcp/
// Create an MCP server that wraps Garmin API

// In agent configuration:
mcpServers: {
  garmin: {
    type: 'stdio',
    command: 'node',
    args: ['./packages/integrations/garmin-mcp/dist/server.js'],
    env: {
      GARMIN_EMAIL: process.env.GARMIN_EMAIL,
      GARMIN_PASSWORD: process.env.GARMIN_PASSWORD
    }
  }
}
```

**Or use SDK MCP server (in-process):**
```typescript
import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

const garminServer = createSdkMcpServer({
  name: "garmin",
  version: "1.0.0",
  tools: [
    tool(
      "get_daily_summary",
      "Get health metrics for a specific date",
      { date: z.string().describe("ISO date string") },
      async ({ date }) => {
        const data = await garminApi.getDailySummary(date);
        return { content: [{ type: "text", text: JSON.stringify(data) }] };
      }
    ),
    tool(
      "get_activities",
      "Get recent activities",
      { limit: z.number().optional() },
      async ({ limit = 10 }) => {
        const activities = await garminApi.getActivities(limit);
        return { content: [{ type: "text", text: JSON.stringify(activities) }] };
      }
    )
  ]
});

// Use in query
mcpServers: {
  garmin: garminServer
}
```

### Phase 3: Adopt SDK Skills for Domain Knowledge

Create `.claude/skills/` for training-specific knowledge that Claude can autonomously invoke.

**Example: Marathon Training Skill**
```markdown
<!-- .claude/skills/marathon-training/SKILL.md -->
---
name: marathon-training
description: Expert marathon training knowledge including periodization, workout types,
  pacing strategies, recovery protocols, and race preparation. Use when discussing
  marathon training, running workouts, race pacing, or training plan modifications.
---

# Marathon Training Knowledge Base

## Training Phases

### Base Building (Weeks 1-4)
- Focus: Aerobic development, injury prevention
- Volume: 70-80% of peak mileage
- Intensity: 80% easy, 20% moderate
- Key workouts: Long runs at conversational pace

### Build Phase (Weeks 5-12)
- Focus: Lactate threshold, VO2max
- Volume: Building to peak
- Key workouts:
  - Tempo runs: 20-40 min at marathon pace + 20-30 sec/mile
  - Intervals: 6-8 x 800m at 5K pace
  - Long runs: Progressive, with MP segments

### Peak Phase (Weeks 13-16)
- Focus: Race-specific fitness
- Volume: Peak then taper
- Key workouts:
  - Race-pace long runs (14-16 mi with 8-10 at MP)
  - Tune-up races (10K-half marathon)

### Taper (Final 2-3 weeks)
- Volume reduction: 40-60%
- Maintain intensity, reduce duration
- Focus on rest and nutrition

## Pace Calculations

See [PACING.md](PACING.md) for detailed pace zone calculations.

## Recovery Indicators

See [RECOVERY.md](RECOVERY.md) for HRV, RHR, and sleep analysis guidelines.
```

**Benefits:**
- Claude automatically loads marathon knowledge when relevant
- Progressive disclosure (only loads PACING.md when discussing pacing)
- Versioned and shareable training methodology

### Phase 4: Implement Hooks for System Integration

Use SDK hooks to integrate with your whiteboard and logging systems.

```typescript
const hooks = {
  PreToolUse: [{
    matcher: "mcp__garmin__*",
    hooks: [async (input) => {
      // Log Garmin API calls
      await logApiCall('garmin', input.tool_name, input.tool_input);
      return { continue: true };
    }]
  }],

  PostToolUse: [{
    hooks: [async (input) => {
      // Collect whiteboard entries from tool results
      if (isWhiteboardEntry(input.tool_response)) {
        await saveWhiteboardEntry(input.tool_response);
      }
      return { continue: true };
    }]
  }],

  Notification: [{
    hooks: [async (input) => {
      // Send notifications to user
      await sendPushNotification(input.message);
      return { continue: true };
    }]
  }]
};
```

---

## Implementation Roadmap

### Step 1: Install SDK and Create Adapter (1-2 days)

```bash
npm install @anthropic-ai/claude-agent-sdk
```

Create `packages/agents/src/base/SdkAdapter.ts` that wraps SDK's `query()` with your existing interface.

### Step 2: Migrate TrainingCoachAgent (2-3 days)

Start with the most complex agent to validate the approach:
- Convert tool definitions to MCP format
- Implement custom `canUseTool` for modification validation
- Add hooks for whiteboard collection
- Test all task types (workout_analysis, readiness_check, etc.)

### Step 3: Migrate HealthAgent (1 day)

Simpler agent, mostly read-only operations.

### Step 4: Update Workflows (1-2 days)

- Modify ChatFlow to use SDK streaming
- Add session persistence for multi-turn conversations
- Implement fast-path optimization (tool-less queries)

### Step 5: Create SDK Skills (2-3 days)

- Marathon training knowledge base
- Recovery protocols
- Nutrition guidelines

### Step 6: MCP Server for Garmin (2-3 days)

- Create proper MCP server (either stdio or in-process)
- Remove Python subprocess dependency
- Add caching layer

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| SDK breaking changes | High | Pin version, wrap in adapter layer |
| Performance regression | Medium | Benchmark before/after, keep fast-path logic |
| Lost "agents don't fetch" pattern | High | Enforce via `canUseTool` + pre-loaded context |
| Complexity increase | Medium | Gradual migration, maintain existing tests |

---

## What NOT to Change

1. **AgentContext pre-loading** - Keep this pattern, it's excellent
2. **Workflow orchestration** - SDK doesn't replace this
3. **Database repositories** - SDK doesn't handle persistence
4. **Whiteboard system** - Adapt via hooks, but keep the concept
5. **Multi-task agent design** - SDK supports this via prompt variations

---

## Conclusion

The Anthropic Agent SDK is a strong fit for LifeOS because:

1. **Production-ready infrastructure** - Context management, streaming, error handling
2. **MCP ecosystem** - Better Garmin integration path
3. **Skills for domain knowledge** - Natural fit for training methodology
4. **Hooks for customization** - Maintains your whiteboard pattern
5. **Session management** - Enables persistent coaching conversations

**Start with Phase 1** (SDK as execution harness) to validate the approach with minimal risk, then proceed through the phases as confidence grows.

The migration preserves your excellent architectural decisions (context pre-loading, fast-path detection, multi-task agents) while gaining significant infrastructure benefits.
