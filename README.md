# LifeOS

**An AI-powered personal operating system for health, training, and life optimization.**

LifeOS is a comprehensive platform that integrates health tracking, marathon training coaching, biomarker analysis, and daily planning through intelligent AI agents that work together to optimize your life.

---

## 🏗️ Architecture Overview

### System Architecture: Workflows → Agents → Skills → Tools

LifeOS follows a strict hierarchical architecture that separates concerns:

```
┌─────────────────────────────────────────────────────────────────┐
│  WORKFLOWS - Orchestrated sequences (entry points)              │
│  Examples: MorningFlow (6:05 AM cron), ChatFlow (user queries)  │
└───────────────────────────────┬─────────────────────────────────┘
                                │ uses
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  AGENTS - LLM-powered interpretation/creativity/strategy        │
│  Examples: HealthAgent, TrainingCoachAgent                      │
│  Key: Agents RECEIVE data, they don't FETCH it                  │
└───────────────────────────────┬─────────────────────────────────┘
                                │ uses
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  SKILLS - Bundled tool sequences for specific tasks (no LLM)    │
│  Examples: SyncGarminMetrics, LoadAgentContext, WriteWhiteboard │
└───────────────────────────────┬─────────────────────────────────┘
                                │ uses
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  TOOLS - Atomic operations                                      │
│  Examples: garminClient.getStats(), db.upsert(), formatPace()   │
└─────────────────────────────────────────────────────────────────┘
```

**Why this architecture?**
- **Fast chat responses** (<10s): Context is pre-loaded, agents just interpret
- **Reliable cron jobs**: Heavy analysis happens in background, not during chat
- **Clear separation**: Each layer has one job, making debugging easy

### Monorepo Structure (Turborepo)

```
LifeOS/
├── apps/
│   └── web/                    # Next.js 14 web application
│       └── app/api/
│           ├── chat/           # Chat endpoint (uses ChatFlow)
│           └── cron/
│               ├── morning/    # Daily flow (uses MorningFlow)
│               └── garmin-sync/# Direct Garmin data sync
├── packages/
│   ├── core/                   # Shared types, schemas, utilities
│   ├── database/               # Supabase client, repositories, migrations
│   ├── workflows/              # Orchestrated flows (MorningFlow, ChatFlow)
│   ├── agents/                 # AI agents (Health, Training Coach)
│   ├── skills/                 # Deterministic data operations
│   │   ├── garmin/             # SyncGarminMetrics
│   │   ├── context/            # LoadAgentContext
│   │   └── whiteboard/         # WriteWhiteboard
│   ├── llm/                    # Multi-provider LLM client
│   ├── orchestrator/           # Legacy agent coordination
│   └── integrations/
│       └── garmin/             # Garmin MCP client
├── scripts/                    # Database seeding and import scripts
└── supabase/                   # Legacy migrations (moved to packages/database)
```

### Technology Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 14, React, TailwindCSS |
| **Backend** | Next.js API Routes, Edge Functions |
| **Database** | Supabase (PostgreSQL) |
| **AI/LLM** | Anthropic Claude, OpenAI GPT-4 |
| **Monorepo** | Turborepo, npm workspaces |
| **Language** | TypeScript (strict mode) |

---

## 📊 Database Schema

The database is organized into three migration files that build upon each other:

### Migration 001: Initial Schema (`packages/database/src/migrations/001_initial_schema.sql`)

Core tables for the personal OS:

| Table | Purpose |
|-------|---------|
| `users` | User accounts with preferences (timezone, digest times, LLM settings) |
| `people` | Contact/relationship management |
| `events` | Calendar events (Google Calendar sync support) |
| `tasks` | Task management with priorities, contexts, energy requirements |
| `health_snapshots` | Daily health check-ins (sleep, energy, stress, HRV, etc.) |
| `workouts` | Basic workout tracking |
| `injuries` | Injury tracking with status and limitations |
| `constraints` | Personal constraints (time blocks, energy budgets, recovery needs) |
| `whiteboard_entries` | Agent-to-agent and agent-to-user communication system |
| `whiteboard_reactions` | Responses to whiteboard entries |
| `agent_runs` | Logging for AI agent executions |
| `chat_messages` | Conversation history |

### Migration 002: Training System (`packages/database/src/migrations/002_training_system.sql`)

Comprehensive training plan management:

| Table | Purpose |
|-------|---------|
| `training_plans` | Master plans (e.g., "LA Marathon 2026") with goals, duration, coaching style |
| `training_phases` | Mesocycles: Base, Build, Peak, Taper, Recovery |
| `training_weeks` | Weekly summaries, targets, and coach analysis |
| `workouts` (enhanced) | 40+ new columns for detailed run tracking |
| `workout_adaptations` | Plan modifications with triggers and reasoning |
| `biometric_baselines` | Personal baseline metrics (resting HR, HRV, etc.) |
| `coaching_interactions` | Coach-athlete dialogue history |

**Enhanced Workout Fields Include:**
- Prescription: distance, pace, HR zone, structured intervals
- Execution: actual duration, splits, intervals
- Biometrics: HR (avg/max/resting), body battery, cadence, power, ground contact time
- Environment: temperature, humidity, weather, terrain, elevation
- Fueling: pre-workout and during-workout nutrition
- Feedback: perceived exertion, discomfort notes, personal reflections
- Coach Analysis: notes, execution score, observations, recommendations

### Migration 003: Biomarker System (`packages/database/src/migrations/003_biomarkers.sql`)

Blood panel and biomarker tracking:

| Table | Purpose |
|-------|---------|
| `lab_panels` | Lab test sessions (date, lab name, fasting status) |
| `biomarker_definitions` | 119 standardized biomarker definitions with reference ranges |
| `biomarker_results` | Individual test results with flags and analysis |
| `biomarker_baselines` | Personal optimal ranges based on history |

**Biomarker Categories:**
- Lipid Panel (cholesterol, triglycerides, ratios)
- Metabolic (glucose, HbA1c, insulin, kidney/liver function)
- CBC (complete blood count)
- Thyroid (TSH, T3, T4)
- Hormones (testosterone, cortisol, DHEA)
- Vitamins & Minerals (D, B12, iron, magnesium, zinc)
- Inflammatory Markers (hs-CRP, homocysteine)
- Cardiac Markers (BNP, troponin)

---

## 🤖 Agent System

### How Agents Work (New Architecture)

Agents are **pure interpreters** - they receive all data via context and respond without fetching additional data:

```typescript
// Chat Flow - Fast because data is pre-loaded
const context = await loadAgentContext(supabase, userId);  // Skill
const response = await agent.respond(context, message);     // Agent (no tools!)
```

### Health Agent (`packages/agents/src/health/`)

Monitors daily health status and provides recommendations.

**Receives (via context):**
- Today's health snapshot (sleep, HRV, resting HR, body battery)
- Recent health trend (7 days)
- Active injuries
- Whiteboard notes from other agents

**Outputs:**
- Recovery assessment
- Concerns and alerts
- Recommendations for the day

### Training Coach Agent (`packages/agents/src/training/`)

AI running coach with detailed workout analysis and plan adaptation.

**Receives (via context):**
- Today's scheduled workout
- Recent completed workouts
- Training plan phase and week
- Health/recovery data

**Coaching Philosophy:**
- 80/20 polarized training (easy/hard distribution)
- Recovery-first approach
- Data-driven decisions with athlete intuition
- Progressive overload with strategic recovery weeks

**Outputs:**
- Workout guidance and modifications
- Training load assessments
- Weekly summaries

### Whiteboard System

Agents communicate through a shared whiteboard. Skills handle writing; agents generate the content:

| Entry Type | Purpose |
|------------|---------|
| `insight` | Data-driven observations |
| `alert` | Urgent attention needed |
| `recommendation` | Suggested actions |
| `summary` | Periodic summaries |
| `note` | General notes |

### Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| **MorningFlow** | 6:05 AM cron | Sync Garmin → Analyze health → Analyze training → Write whiteboard |
| **ChatFlow** | User message | Load context → Route to agent → Respond |

---

## 📁 Key Files Reference

### Configuration
- `package.json` - Root package with workspaces and scripts
- `turbo.json` - Turborepo pipeline configuration
- `tsconfig.base.json` - Shared TypeScript configuration
- `env.local` - Environment variables (Supabase, LLM keys)

### Types & Schemas
- `packages/core/src/types/index.ts` - **All TypeScript interfaces** (600+ lines)
- `packages/core/src/schemas/index.ts` - Zod validation schemas

### Database
- `packages/database/src/client.ts` - Supabase client factory
- `packages/database/src/repositories/` - Data access layer
  - `base.repository.ts` - Generic CRUD operations
  - `workout.repository.ts` - Workout-specific queries
  - `health.repository.ts` - Health data queries

### Scripts
- `scripts/seed-data.sql` - Initial user + 119 biomarker definitions
- `scripts/import-training-plan.sql` - Weeks 1-2 training data
- `scripts/import-training-plan-weeks3-10.sql` - Weeks 3-6
- `scripts/import-training-plan-weeks7-10.sql` - Weeks 7-10
- `scripts/import-training-plan-future.sql` - Weeks 10-16 (planned)
- `scripts/fix-postgrest-cache.sql` - PostgREST schema refresh

---

## 🏃 Current Data State

### User
- **ID**: `00000000-0000-0000-0000-000000000001`
- **Name**: Dan
- **Timezone**: America/Los_Angeles

### Training Plan: LA Marathon 2026
- **Duration**: 16 weeks (Sept 29, 2025 → Jan 19, 2026)
- **Goal**: Sub-2:55 marathon (6:40/mi pace)
- **Current Phase**: Pre-Marathon Specificity (Week 10)

### Workout Statistics
| Status | Count |
|--------|-------|
| Completed | 33 |
| Planned | 25 |
| Skipped | 4 |
| **Total** | **62** |

### Training Phases
1. **October – Base Build** (Weeks 1-4)
2. **November – Endurance Build** (Weeks 5-8)
3. **December – Pre-Marathon Specificity** (Weeks 9-12)
4. **January – Transition to Marathon Block** (Weeks 13-16)

### Key Metrics (from completed workouts)
- **Lactate Threshold**: 6:14/mi @ 177 bpm
- **Easy Pace**: 7:30-8:00/mi @ 135-150 bpm
- **Marathon Pace**: 6:30-6:35/mi @ 165-172 bpm
- **Resting HR Baseline**: 48-51 bpm

---

## 🔧 Development

### Setup
```bash
# Install dependencies
npm install

# Set up environment
cp .env.example env.local
# Edit env.local with your Supabase and LLM API keys

# Run migrations in Supabase SQL Editor (in order):
# 1. packages/database/src/migrations/001_initial_schema.sql
# 2. packages/database/src/migrations/002_training_system.sql
# 3. packages/database/src/migrations/003_biomarkers.sql

# Seed data
# Run scripts/seed-data.sql in Supabase SQL Editor

# Start development
npm run dev
```

### Scripts
```bash
npm run dev          # Start all apps in dev mode
npm run build        # Build all packages
npm run lint         # Lint all packages
npm run typecheck    # TypeScript checking
npm run format       # Prettier formatting
npm run clean        # Clean all build artifacts
```

### Environment Variables
```env
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...

# LLM Providers (both needed for multi-provider support)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# Garmin Integration
GARMIN_EMAIL=your@email.com
GARMIN_PASSWORD=your_password

# App Config
USER_ID=00000000-0000-0000-0000-000000000001
TIMEZONE=America/Los_Angeles
CRON_SECRET=your_secret_for_cron_auth
```

---

## 🗺️ Roadmap / Future Work

### Completed ✅
- [x] Garmin Connect integration via MCP server
- [x] Multi-provider LLM support (Anthropic + OpenAI)
- [x] Workflows/Skills/Tools architecture
- [x] Morning flow with automated analysis
- [x] Fast chat responses (<10s)
- [x] Interactive chat with Training Coach

### Immediate
- [ ] Import blood panel CSV data (script exists: `scripts/import-lab-panels.ts`)
- [ ] Training plan UI for viewing weekly schedule
- [ ] Dashboard with health metrics and whiteboard

### Short-term
- [ ] Google Calendar integration
- [ ] Evening digest workflow
- [ ] Workout completion flow via chat

### Long-term
- [ ] Multi-user support
- [ ] Mobile app (React Native)
- [ ] Wearable integrations (Apple Watch, Whoop, Oura)
- [ ] Nutrition tracking and meal planning
- [ ] Sleep optimization agent

---

## 🏃 Garmin Integration

LifeOS connects to Garmin Connect via the [Garmin MCP Server](https://github.com/Taxuspt/garmin_mcp):

### Data Synced
| Metric | Table | Sync Frequency |
|--------|-------|----------------|
| Daily stats (steps, calories, stress) | `health_snapshots` | Daily (6:05 AM) |
| Sleep (hours, stages, body battery) | `health_snapshots` | Daily (6:05 AM) |
| HRV (last night avg, status) | `health_snapshots` | Daily (6:05 AM) |
| Activities (runs, workouts) | `workouts` | Daily (6:05 AM) |

### How It Works
1. Python MCP server spawned as subprocess
2. Communicates via stdio using JSON-RPC protocol
3. Skills handle sync logic (`packages/skills/src/garmin/`)
4. Data stored in PostgreSQL via Supabase

---

## 📝 Design Principles

### Architecture
1. **Workflows orchestrate** - Entry points for cron jobs and API endpoints
2. **Agents interpret** - LLM-powered analysis, receive data via context
3. **Skills operate** - Deterministic data operations, no LLM
4. **Tools are atomic** - Single responsibility operations

### Database
1. **JSONB for flexibility** - Use for evolving data that varies by context (metadata, device_data, structured_data)
2. **Typed columns for queries** - Use for frequently filtered/sorted data
3. **Timestamps everywhere** - created_at, updated_at on all tables
4. **Soft references** - JSONB arrays for flexible relationships
5. **RLS policies** - Row-level security for multi-user future

### Agents
1. **Pure interpreters** - Agents receive data, they don't fetch it
2. **Whiteboard communication** - Skills write; agents generate content
3. **No tools in chat** - Context is pre-loaded for fast responses
4. **Logging everything** - All agent runs are recorded for debugging

### Code
1. **Type safety** - Strict TypeScript, no `any`
2. **Repository pattern** - Database access through typed repositories
3. **Shared types** - All interfaces in `packages/core/src/types`
4. **Validation** - Zod schemas for runtime validation

---

## 📚 For AI Agents

When working with this codebase:

1. **Types are in `packages/core/src/types/index.ts`** - Always check here first for interfaces
2. **Database schema is in `packages/database/src/migrations/`** - Three SQL files define everything
3. **Current user ID is `00000000-0000-0000-0000-000000000001`** - Hardcoded for single-user mode
4. **Supabase PostgREST needs cache refresh after migrations** - Use `NOTIFY pgrst, 'reload schema';`
5. **Training data has rich coach notes** - The `coach_notes` field contains detailed AI analysis
6. **Workouts have splits as JSONB** - Array of `{mile, pace, avg_hr, elevation}` objects

### Common Queries

```sql
-- Get all workouts for current plan
SELECT * FROM workouts 
WHERE user_id = '00000000-0000-0000-0000-000000000001'
ORDER BY scheduled_date;

-- Get workout with coach notes
SELECT title, scheduled_date, status, coach_notes, splits
FROM workouts WHERE status = 'completed'
ORDER BY scheduled_date DESC LIMIT 5;

-- Get biomarker definitions by category
SELECT code, name, default_unit, default_range_low, default_range_high
FROM biomarker_definitions
WHERE category = 'lipid_panel';

-- Get training phases
SELECT name, phase_type, start_date, end_date
FROM training_phases
ORDER BY start_week;
```

---

*Built with ❤️ for optimizing human performance through AI.*

