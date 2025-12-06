-- ============================================
-- LifeOS Database Schema
-- Version: 1.0.0
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    timezone VARCHAR(50) DEFAULT 'America/Los_Angeles',
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PEOPLE TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS people (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    relationship VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(50),
    notes TEXT,
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    last_contact_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_people_user_id ON people(user_id);
CREATE INDEX IF NOT EXISTS idx_people_relationship ON people(relationship);

-- ============================================
-- EVENTS TABLE
-- ============================================
CREATE TYPE event_type AS ENUM (
    'meeting', 'focus_block', 'workout', 'meal', 'sleep',
    'travel', 'personal', 'break', 'other'
);

CREATE TYPE event_source AS ENUM ('google_calendar', 'manual', 'agent_suggested');

CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    google_event_id VARCHAR(255),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    event_type event_type DEFAULT 'other',
    source event_source DEFAULT 'manual',
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    all_day BOOLEAN DEFAULT FALSE,
    timezone VARCHAR(50),
    location TEXT,
    video_link TEXT,
    participant_ids UUID[] DEFAULT '{}',
    energy_cost SMALLINT DEFAULT 50 CHECK (energy_cost >= 0 AND energy_cost <= 100),
    is_flexible BOOLEAN DEFAULT FALSE,
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_start_time ON events(start_time);
CREATE INDEX IF NOT EXISTS idx_events_google_id ON events(google_event_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);

-- ============================================
-- TASKS TABLE
-- ============================================
CREATE TYPE task_status AS ENUM (
    'inbox', 'todo', 'in_progress', 'blocked', 'done', 'archived'
);

CREATE TYPE task_priority AS ENUM ('p1_critical', 'p2_high', 'p3_medium', 'p4_low');

CREATE TYPE task_source AS ENUM (
    'manual', 'agent_created', 'calendar_derived', 'notion_sync', 'slack'
);

CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    status task_status DEFAULT 'inbox',
    priority task_priority DEFAULT 'p3_medium',
    source task_source DEFAULT 'manual',
    due_date DATE,
    due_time TIME,
    estimated_minutes INTEGER,
    actual_minutes INTEGER,
    energy_required SMALLINT DEFAULT 50 CHECK (energy_required >= 0 AND energy_required <= 100),
    context_tags TEXT[] DEFAULT '{}',
    project VARCHAR(255),
    parent_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    related_event_id UUID REFERENCES events(id) ON DELETE SET NULL,
    assigned_to_people_ids UUID[] DEFAULT '{}',
    completed_at TIMESTAMPTZ,
    blocked_reason TEXT,
    notion_page_id VARCHAR(255),
    external_url TEXT,
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project);

-- ============================================
-- HEALTH_SNAPSHOTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS health_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    snapshot_date DATE NOT NULL,
    snapshot_time TIME,
    sleep_hours DECIMAL(3,1),
    sleep_quality SMALLINT CHECK (sleep_quality >= 1 AND sleep_quality <= 10),
    energy_level SMALLINT CHECK (energy_level >= 1 AND energy_level <= 10),
    stress_level SMALLINT CHECK (stress_level >= 1 AND stress_level <= 10),
    mood_score SMALLINT CHECK (mood_score >= 1 AND mood_score <= 10),
    soreness_level SMALLINT CHECK (soreness_level >= 0 AND soreness_level <= 10),
    soreness_areas TEXT[] DEFAULT '{}',
    illness_symptoms TEXT[] DEFAULT '{}',
    hrv INTEGER,
    resting_hr INTEGER,
    hydration_glasses INTEGER,
    meals_logged INTEGER,
    alcohol_units DECIMAL(3,1),
    caffeine_mg INTEGER,
    notes TEXT,
    source VARCHAR(50) DEFAULT 'manual',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, snapshot_date, snapshot_time)
);

CREATE INDEX IF NOT EXISTS idx_health_user_date ON health_snapshots(user_id, snapshot_date);

-- ============================================
-- WORKOUTS TABLE
-- ============================================
CREATE TYPE workout_status AS ENUM ('planned', 'completed', 'skipped', 'partial');

CREATE TYPE workout_type AS ENUM (
    'strength', 'cardio', 'hiit', 'yoga', 'mobility',
    'sport', 'walk', 'run', 'cycle', 'swim', 'other'
);

CREATE TABLE IF NOT EXISTS workouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    workout_type workout_type NOT NULL,
    status workout_status DEFAULT 'planned',
    scheduled_date DATE,
    scheduled_time TIME,
    planned_duration_minutes INTEGER,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    actual_duration_minutes INTEGER,
    planned_intensity SMALLINT CHECK (planned_intensity >= 1 AND planned_intensity <= 10),
    actual_intensity SMALLINT CHECK (actual_intensity >= 1 AND actual_intensity <= 10),
    rpe SMALLINT CHECK (rpe >= 1 AND rpe <= 10),
    avg_heart_rate INTEGER,
    max_heart_rate INTEGER,
    calories_burned INTEGER,
    exercises JSONB DEFAULT '[]',
    notes TEXT,
    event_id UUID REFERENCES events(id) ON DELETE SET NULL,
    external_id VARCHAR(255),
    source VARCHAR(50) DEFAULT 'manual',
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workouts_user_id ON workouts(user_id);
CREATE INDEX IF NOT EXISTS idx_workouts_date ON workouts(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_workouts_status ON workouts(status);

-- ============================================
-- INJURIES TABLE (Flexible injury tracking)
-- ============================================
CREATE TYPE injury_status AS ENUM ('active', 'recovering', 'healed', 'chronic');

CREATE TABLE IF NOT EXISTS injuries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body_part VARCHAR(100) NOT NULL,
    description TEXT,
    severity SMALLINT NOT NULL CHECK (severity >= 1 AND severity <= 10),
    status injury_status DEFAULT 'active',
    start_date DATE NOT NULL,
    end_date DATE,
    notes TEXT,
    limitations TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_injuries_user_id ON injuries(user_id);
CREATE INDEX IF NOT EXISTS idx_injuries_status ON injuries(status);

-- ============================================
-- CONSTRAINTS TABLE
-- ============================================
CREATE TYPE constraint_type AS ENUM (
    'time_block', 'energy_budget', 'recovery', 'focus', 'personal', 'health', 'custom'
);

CREATE TABLE IF NOT EXISTS constraints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    constraint_type constraint_type NOT NULL,
    applies_to_days INTEGER[] DEFAULT '{1,2,3,4,5,6,7}',
    start_time TIME,
    end_time TIME,
    rule JSONB NOT NULL,
    priority INTEGER DEFAULT 50,
    is_active BOOLEAN DEFAULT TRUE,
    is_flexible BOOLEAN DEFAULT FALSE,
    valid_from DATE,
    valid_until DATE,
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_constraints_user_id ON constraints(user_id);
CREATE INDEX IF NOT EXISTS idx_constraints_active ON constraints(is_active);

-- ============================================
-- WHITEBOARD_ENTRIES TABLE
-- ============================================
CREATE TYPE whiteboard_entry_type AS ENUM (
    'observation', 'suggestion', 'question', 'alert', 'insight', 'plan', 'reflection'
);

CREATE TYPE whiteboard_visibility AS ENUM ('user_only', 'agents_only', 'all');

CREATE TABLE IF NOT EXISTS whiteboard_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    agent_id VARCHAR(100) NOT NULL,
    entry_type whiteboard_entry_type NOT NULL,
    visibility whiteboard_visibility DEFAULT 'all',
    title VARCHAR(255),
    content TEXT NOT NULL,
    structured_data JSONB,
    priority INTEGER DEFAULT 50 CHECK (priority >= 0 AND priority <= 100),
    requires_response BOOLEAN DEFAULT FALSE,
    response_deadline TIMESTAMPTZ,
    is_read BOOLEAN DEFAULT FALSE,
    is_actioned BOOLEAN DEFAULT FALSE,
    actioned_at TIMESTAMPTZ,
    related_entity_type VARCHAR(50),
    related_entity_id UUID,
    parent_entry_id UUID REFERENCES whiteboard_entries(id) ON DELETE SET NULL,
    context_date DATE DEFAULT CURRENT_DATE,
    expires_at TIMESTAMPTZ,
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whiteboard_user_id ON whiteboard_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_whiteboard_agent ON whiteboard_entries(agent_id);
CREATE INDEX IF NOT EXISTS idx_whiteboard_date ON whiteboard_entries(context_date DESC);
CREATE INDEX IF NOT EXISTS idx_whiteboard_unread ON whiteboard_entries(user_id, is_read) WHERE is_read = FALSE;

-- ============================================
-- WHITEBOARD_REACTIONS TABLE
-- ============================================
CREATE TYPE reaction_type AS ENUM (
    'acknowledge', 'agree', 'disagree', 'question', 'implement', 'defer', 'dismiss'
);

CREATE TABLE IF NOT EXISTS whiteboard_reactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entry_id UUID NOT NULL REFERENCES whiteboard_entries(id) ON DELETE CASCADE,
    reactor_type VARCHAR(20) NOT NULL,
    reactor_id VARCHAR(100) NOT NULL,
    reaction_type reaction_type NOT NULL,
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reactions_entry ON whiteboard_reactions(entry_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reactions_unique ON whiteboard_reactions(entry_id, reactor_type, reactor_id);

-- ============================================
-- AGENT_RUNS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS agent_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    agent_id VARCHAR(100) NOT NULL,
    run_type VARCHAR(50) NOT NULL,
    trigger_reason TEXT,
    input_context JSONB,
    output_result JSONB,
    llm_provider VARCHAR(50),
    llm_model VARCHAR(100),
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    total_cost_cents INTEGER,
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,
    status VARCHAR(20) DEFAULT 'running',
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_user ON agent_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_agent ON agent_runs(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_date ON agent_runs(started_at DESC);

-- ============================================
-- CHAT_MESSAGES TABLE
-- ============================================
CREATE TYPE message_role AS ENUM ('user', 'assistant', 'system');

CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID NOT NULL,
    role message_role NOT NULL,
    content TEXT NOT NULL,
    responding_agent_id VARCHAR(100),
    tool_calls JSONB,
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_user ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_session ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_created ON chat_messages(created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE people ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE injuries ENABLE ROW LEVEL SECURITY;
ALTER TABLE constraints ENABLE ROW LEVEL SECURITY;
ALTER TABLE whiteboard_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE whiteboard_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Permissive policies for v1 (single user)
CREATE POLICY "Allow all for now" ON users FOR ALL USING (true);
CREATE POLICY "Allow all for now" ON people FOR ALL USING (true);
CREATE POLICY "Allow all for now" ON events FOR ALL USING (true);
CREATE POLICY "Allow all for now" ON tasks FOR ALL USING (true);
CREATE POLICY "Allow all for now" ON health_snapshots FOR ALL USING (true);
CREATE POLICY "Allow all for now" ON workouts FOR ALL USING (true);
CREATE POLICY "Allow all for now" ON injuries FOR ALL USING (true);
CREATE POLICY "Allow all for now" ON constraints FOR ALL USING (true);
CREATE POLICY "Allow all for now" ON whiteboard_entries FOR ALL USING (true);
CREATE POLICY "Allow all for now" ON whiteboard_reactions FOR ALL USING (true);
CREATE POLICY "Allow all for now" ON agent_runs FOR ALL USING (true);
CREATE POLICY "Allow all for now" ON chat_messages FOR ALL USING (true);

-- ============================================
-- TRIGGERS FOR updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_people_updated_at BEFORE UPDATE ON people
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_health_updated_at BEFORE UPDATE ON health_snapshots
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_workouts_updated_at BEFORE UPDATE ON workouts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_injuries_updated_at BEFORE UPDATE ON injuries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_constraints_updated_at BEFORE UPDATE ON constraints
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_whiteboard_updated_at BEFORE UPDATE ON whiteboard_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SEED DEFAULT USER (Dan)
-- ============================================
INSERT INTO users (id, email, name, timezone, preferences)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'dan@lifeos.local',
    'Dan',
    'America/Los_Angeles',
    '{
        "morningDigestTime": "07:00",
        "eveningDigestTime": "21:00",
        "workingHours": { "start": "09:00", "end": "18:00" },
        "defaultLLMProvider": "anthropic"
    }'::jsonb
) ON CONFLICT (id) DO NOTHING;
