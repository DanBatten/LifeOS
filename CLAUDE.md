# CLAUDE.md - AI Assistant Guide

This file provides context for AI assistants working on the LifeOS codebase.

## Project Overview

LifeOS is an AI-powered personal operating system for health, training, and life optimization. It integrates Garmin health tracking, marathon training coaching, biomarker analysis, and daily planning through intelligent AI agents.

## Architecture: Workflows → Agents → Skills → Tools

The system follows a strict hierarchical architecture:

```
┌─────────────────────────────────────────────────────────────────┐
│  WORKFLOWS - Orchestrated sequences (entry points)              │
│  Location: packages/workflows/                                  │
│  Examples: MorningFlow, ChatFlow                                │
│  Purpose: Combine agents and skills into complete flows         │
└─────────────────────────────────────────────────────────────────┘
                              │ uses
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  AGENTS - LLM-powered interpretation/creativity/strategy        │
│  Location: packages/agents/                                     │
│  Examples: HealthAgent, TrainingCoachAgent                      │
│  Purpose: Receive data → Think → Respond/Decide                 │
│  IMPORTANT: Agents do NOT fetch data - they interpret it        │
└─────────────────────────────────────────────────────────────────┘
                              │ uses
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  SKILLS - Bundled tool sequences for specific tasks             │
│  Location: packages/skills/                                     │
│  Examples: SyncGarminMetrics, LoadAgentContext, WriteWhiteboard │
│  Purpose: Execute focused multi-step processes (no LLM)         │
└─────────────────────────────────────────────────────────────────┘
                              │ uses
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  TOOLS - Atomic operations                                      │
│  Location: packages/integrations/, packages/database/           │
│  Examples: garminClient.getStats(), db.upsert(), formatPace()   │
│  Purpose: Single responsibility, no orchestration               │
└─────────────────────────────────────────────────────────────────┘
```

### When to Use What

| Layer | Use When | Examples |
|-------|----------|----------|
| **Workflow** | Need to orchestrate multiple steps | Morning cron job, Chat response |
| **Agent** | Need interpretation, creativity, strategy | "Is this workout safe given my HRV?" |
| **Skill** | Need deterministic data operations | Sync Garmin data, Load user context |
| **Tool** | Need single atomic operation | API call, DB query, format a value |

### Key Principle: Agents Don't Fetch Data

In the old architecture, agents had tools to fetch data themselves. Now:
- **Skills** handle ALL data operations (sync, load, transform, save)
- **Agents** receive data via context and just interpret/respond
- **Workflows** orchestrate when skills and agents run

This makes chat fast (<10s) because context is pre-loaded.

## Monorepo Structure

```
LifeOS/
├── apps/
│   └── web/                    # Next.js 14 application
│       └── app/api/
│           ├── chat/           # Chat endpoint (uses ChatFlow)
│           └── cron/
│               ├── morning/    # Morning flow (uses MorningFlow)
│               └── garmin-sync/# Direct Garmin sync
├── packages/
│   ├── core/                   # Shared types, schemas, utilities
│   ├── database/               # Supabase client, repositories
│   ├── skills/                 # Deterministic skill modules ✨ NEW
│   │   ├── garmin/             # SyncGarminMetrics
│   │   ├── context/            # LoadAgentContext
│   │   └── whiteboard/         # WriteWhiteboard
│   ├── workflows/              # Orchestrated flows ✨ NEW
│   │   ├── morning-flow        # Daily 6:05 AM cron
│   │   └── chat-flow           # User chat handling
│   ├── agents/                 # LLM-powered agents
│   │   ├── health/             # HealthAgent
│   │   └── training/           # TrainingCoachAgent
│   ├── llm/                    # Multi-provider LLM client
│   ├── orchestrator/           # Legacy (being replaced by workflows)
│   └── integrations/
│       └── garmin/             # Garmin MCP client
└── scripts/                    # Database seeding, testing
```

## Data Flow Examples

### Morning Cron (6:05 AM)
```
1. MorningFlow.run()
   ├── Skill: syncGarminMetrics()     → Garmin API → DB
   ├── Skill: loadAgentContext()      → DB → context object
   ├── Agent: HealthAgent.analyze()   → context → health summary
   ├── Agent: TrainingCoach.analyze() → context → training advice
   └── Skill: writeToWhiteboard()     → summaries → DB
```

### User Chat
```
1. ChatFlow.run(message)
   ├── Skill: loadAgentContext()      → DB → context object
   ├── Route: classifyMessage()       → "training" or "health"
   └── Agent: respond(context, msg)   → NO TOOLS, just interpret
```

## Key Files

### Configuration
- `package.json` - Root with workspaces
- `turbo.json` - Build pipeline
- `.env.local` - Environment variables (Supabase, LLM keys, Garmin creds)

### Types & Schemas
- `packages/core/src/types/index.ts` - All TypeScript interfaces
- `packages/core/src/schemas/index.ts` - Zod validation

### LLM Configuration
- `packages/llm/src/models.ts` - All available models (Anthropic + OpenAI)
- `packages/llm/src/client.ts` - MultiProviderClient for routing

## Common Patterns

### Adding a New Skill
```typescript
// packages/skills/src/my-skill/my-skill.skill.ts
export async function mySkill(
  supabase: SupabaseClient,
  userId: string,
  options?: MySkillOptions
): Promise<MySkillResult> {
  // 1. Call tools (API, DB)
  // 2. Transform data
  // 3. Return result
}
```

### Adding a New Workflow
```typescript
// packages/workflows/src/my-flow.workflow.ts
export async function runMyFlow(
  supabase: SupabaseClient,
  llmClient: LLMProvider,
  userId: string
): Promise<MyFlowResult> {
  // 1. Run skills to get/set data
  // 2. Run agents for interpretation
  // 3. Return combined result
}
```

## Environment Variables

```env
# Database
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...

# LLM (both needed for multi-provider)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# Garmin
GARMIN_EMAIL=your@email.com
GARMIN_PASSWORD=your_password

# App Config
USER_ID=00000000-0000-0000-0000-000000000001
TIMEZONE=America/Los_Angeles
CRON_SECRET=xxx  # For protecting cron endpoints
```

## Important Notes

1. **Current User ID**: `00000000-0000-0000-0000-000000000001` (single-user mode)
2. **PostgREST Cache**: After DB migrations, run `NOTIFY pgrst, 'reload schema';`
3. **Garmin MCP**: Uses Python subprocess via uvx - can be slow (~5-10s per call)
4. **Agent Context**: All data should be pre-loaded via skills, not fetched during chat
5. **Build**: Run `npm run build` from root - Turborepo handles dependency order

## Debugging

### Agent Too Slow?
- Check if agents are making tool calls (they shouldn't in chat mode)
- Verify context is being loaded from DB, not Garmin
- Check `MAX_TOOL_LOOPS` limit in BaseAgent

### Garmin Sync Failing?
- Verify credentials in `.env.local`
- Check Garmin MCP server can start: `uvx garmin-mcp --help`
- Review sync logs in `garmin_sync_log` table

### Build Errors?
- Run `npm install` first
- Check `exports` in package.json for each package
- Verify TypeScript types match between packages


