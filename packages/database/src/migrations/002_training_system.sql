-- ============================================
-- LifeOS Training System Enhancement
-- Version: 2.0.0
--
-- Design Philosophy:
-- 1. Use JSONB for rich, evolving data that varies by context
-- 2. Use typed columns for data that's frequently queried/filtered
-- 3. Support multiple training domains (running, cycling, swimming, etc.)
-- 4. Enable AI coaching with structured feedback loops
-- ============================================

-- ============================================
-- TRAINING_PLANS TABLE
-- Master plans that contain multiple training blocks
-- ============================================
CREATE TABLE IF NOT EXISTS training_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Plan Identity
    name VARCHAR(255) NOT NULL,
    description TEXT,
    sport VARCHAR(50) NOT NULL DEFAULT 'running', -- running, cycling, triathlon, etc.
    goal_event VARCHAR(255), -- "Boston Marathon 2026"
    goal_time_seconds INTEGER, -- Target finish time
    goal_pace_per_mile_seconds INTEGER, -- e.g., 400 = 6:40/mi

    -- Plan Structure
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_weeks INTEGER NOT NULL,

    -- Plan State
    status VARCHAR(20) DEFAULT 'active', -- draft, active, completed, abandoned
    current_week INTEGER DEFAULT 1,

    -- Flexible Configuration (training philosophy, weekly structure, etc.)
    config JSONB DEFAULT '{}',

    -- AI Coaching Settings
    coaching_style VARCHAR(50) DEFAULT 'analytical', -- analytical, motivational, balanced
    adaptation_aggressiveness VARCHAR(20) DEFAULT 'moderate', -- conservative, moderate, aggressive

    -- External Links
    notion_page_id VARCHAR(255),
    external_url TEXT,

    -- Metadata
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_plans_user ON training_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_training_plans_status ON training_plans(status);
CREATE INDEX IF NOT EXISTS idx_training_plans_dates ON training_plans(start_date, end_date);

-- ============================================
-- TRAINING_PHASES TABLE
-- Mesocycles within a plan (Base, Build, Peak, Taper, etc.)
-- ============================================
CREATE TABLE IF NOT EXISTS training_phases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_id UUID NOT NULL REFERENCES training_plans(id) ON DELETE CASCADE,

    -- Phase Identity
    name VARCHAR(100) NOT NULL, -- "October – Base Build"
    description TEXT,
    phase_type VARCHAR(50) NOT NULL, -- base, build, peak, taper, recovery, transition

    -- Phase Timing
    start_week INTEGER NOT NULL,
    end_week INTEGER NOT NULL,
    start_date DATE,
    end_date DATE,

    -- Phase Goals
    focus_areas TEXT[], -- ["aerobic_base", "long_run_endurance"]
    weekly_volume_target_miles DECIMAL(5,1),
    intensity_distribution JSONB, -- {"easy": 80, "tempo": 10, "intervals": 10}

    -- Flexible Configuration
    config JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_phases_plan ON training_phases(plan_id);

-- ============================================
-- TRAINING_WEEKS TABLE
-- Weekly summaries and targets
-- ============================================
CREATE TABLE IF NOT EXISTS training_weeks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_id UUID NOT NULL REFERENCES training_plans(id) ON DELETE CASCADE,
    phase_id UUID REFERENCES training_phases(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Week Identity
    week_number INTEGER NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,

    -- Planned Targets
    planned_volume_miles DECIMAL(5,1),
    planned_workouts INTEGER,
    planned_intensity_distribution JSONB,

    -- Actual Results (aggregated from workouts)
    actual_volume_miles DECIMAL(5,1),
    actual_workouts_completed INTEGER,
    actual_workouts_skipped INTEGER,
    total_duration_minutes INTEGER,
    total_elevation_ft INTEGER,
    avg_training_load DECIMAL(5,1),
    total_training_load DECIMAL(6,1),

    -- Health Context (aggregated from health_snapshots)
    avg_resting_hr DECIMAL(4,1),
    avg_sleep_hours DECIMAL(3,1),
    avg_energy_level DECIMAL(3,1),
    injury_flags TEXT[],

    -- AI Analysis
    week_summary TEXT, -- AI-generated weekly summary
    adaptations_made JSONB, -- Record of plan changes made this week
    recommendations JSONB, -- Forward-looking suggestions

    -- Status
    status VARCHAR(20) DEFAULT 'planned', -- planned, in_progress, completed

    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(plan_id, week_number)
);

CREATE INDEX IF NOT EXISTS idx_training_weeks_plan ON training_weeks(plan_id);
CREATE INDEX IF NOT EXISTS idx_training_weeks_dates ON training_weeks(start_date, end_date);

-- ============================================
-- ENHANCE WORKOUTS TABLE
-- Add columns to support rich training data
-- ============================================

-- Add training plan linkage
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES training_plans(id) ON DELETE SET NULL;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS phase_id UUID REFERENCES training_phases(id) ON DELETE SET NULL;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS week_id UUID REFERENCES training_weeks(id) ON DELETE SET NULL;

-- Add week/day context
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS week_number INTEGER;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS day_of_week INTEGER; -- 1=Mon, 7=Sun

-- Prescription vs Execution
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS prescribed_description TEXT; -- Original workout description
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS prescribed_distance_miles DECIMAL(4,1);
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS prescribed_pace_per_mile VARCHAR(20); -- "8:00/mi" or "6:30-6:35/mi"
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS prescribed_hr_zone VARCHAR(50); -- "165-172 bpm"
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS prescribed_structure JSONB; -- Detailed workout structure

-- Execution Data (from device)
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS device_data JSONB DEFAULT '{}'; -- Raw Garmin/Strava data
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS splits JSONB DEFAULT '[]'; -- Per-mile/km splits
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS intervals JSONB DEFAULT '[]'; -- Interval-specific data

-- Advanced Biometrics
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS training_load DECIMAL(5,1);
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS training_effect_aerobic DECIMAL(3,1);
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS training_effect_anaerobic DECIMAL(3,1);
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS body_battery_start INTEGER;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS body_battery_end INTEGER;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS cadence_avg INTEGER;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS cadence_max INTEGER;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS ground_contact_time_ms INTEGER;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS vertical_oscillation_cm DECIMAL(4,1);
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS avg_power_watts INTEGER;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS lactate_threshold_hr INTEGER;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS lactate_threshold_pace VARCHAR(20);

-- Environmental Context
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS temperature_f DECIMAL(4,1);
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS humidity_pct INTEGER;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS weather_conditions VARCHAR(100);
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS terrain_type VARCHAR(50); -- road, trail, track, treadmill
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS elevation_gain_ft INTEGER;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS elevation_loss_ft INTEGER;

-- Pre-workout Context
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS pre_workout_resting_hr INTEGER;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS pre_workout_sleep_hours DECIMAL(3,1);
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS pre_workout_soreness TEXT[];
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS pre_workout_energy INTEGER; -- 1-10
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS fueling_pre JSONB; -- {"gel": "Huma regular", "caffeine_mg": 0}
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS fueling_during JSONB; -- {"gels": [...], "electrolytes": [...]}

-- User Feedback
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS personal_notes TEXT;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS perceived_exertion INTEGER; -- 1-10 overall feel
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS perceived_difficulty INTEGER; -- 1-10 vs expectation
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS discomfort_notes TEXT; -- Pain/discomfort descriptions
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS discomfort_locations TEXT[]; -- ["left_knee", "right_calf"]

-- AI Coaching
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS coach_notes TEXT; -- AI-generated analysis
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS execution_score INTEGER; -- 0-100 how well targets were hit
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS key_observations JSONB; -- Structured insights
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS recommendations JSONB; -- Forward-looking suggestions
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS adaptation_triggers JSONB; -- What should change based on this

-- New indexes for enhanced workout queries
CREATE INDEX IF NOT EXISTS idx_workouts_plan ON workouts(plan_id);
CREATE INDEX IF NOT EXISTS idx_workouts_phase ON workouts(phase_id);
CREATE INDEX IF NOT EXISTS idx_workouts_week ON workouts(week_id);
CREATE INDEX IF NOT EXISTS idx_workouts_week_number ON workouts(week_number);

-- ============================================
-- WORKOUT_ADAPTATIONS TABLE
-- Track plan modifications over time
-- ============================================
CREATE TABLE IF NOT EXISTS workout_adaptations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES training_plans(id) ON DELETE CASCADE,

    -- What was adapted
    adapted_workout_id UUID REFERENCES workouts(id) ON DELETE SET NULL,
    affected_week INTEGER,
    affected_date DATE,

    -- Adaptation Details
    adaptation_type VARCHAR(50) NOT NULL, -- volume_reduction, intensity_reduction, reschedule, substitute, skip
    reason_category VARCHAR(50) NOT NULL, -- fatigue, injury, illness, schedule_conflict, weather, performance_based
    reason_details TEXT,

    -- Before/After
    original_prescription JSONB,
    adapted_prescription JSONB,

    -- Decision Context
    triggering_signals JSONB, -- What data led to this decision
    agent_id VARCHAR(100), -- Which agent made/suggested this
    user_approved BOOLEAN DEFAULT TRUE,

    -- Outcome (filled in later)
    outcome_assessment TEXT,
    was_correct_decision BOOLEAN,

    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_adaptations_user ON workout_adaptations(user_id);
CREATE INDEX IF NOT EXISTS idx_adaptations_plan ON workout_adaptations(plan_id);
CREATE INDEX IF NOT EXISTS idx_adaptations_date ON workout_adaptations(affected_date);

-- ============================================
-- ENHANCE HEALTH_SNAPSHOTS TABLE
-- Add fields commonly used in training context
-- ============================================
ALTER TABLE health_snapshots ADD COLUMN IF NOT EXISTS hrv_rmssd DECIMAL(5,1); -- More precise HRV metric
ALTER TABLE health_snapshots ADD COLUMN IF NOT EXISTS sleep_deep_minutes INTEGER;
ALTER TABLE health_snapshots ADD COLUMN IF NOT EXISTS sleep_rem_minutes INTEGER;
ALTER TABLE health_snapshots ADD COLUMN IF NOT EXISTS sleep_light_minutes INTEGER;
ALTER TABLE health_snapshots ADD COLUMN IF NOT EXISTS sleep_awake_minutes INTEGER;
ALTER TABLE health_snapshots ADD COLUMN IF NOT EXISTS body_battery_morning INTEGER;
ALTER TABLE health_snapshots ADD COLUMN IF NOT EXISTS readiness_score INTEGER; -- Computed or from device
ALTER TABLE health_snapshots ADD COLUMN IF NOT EXISTS recovery_status VARCHAR(20); -- poor, fair, good, excellent
ALTER TABLE health_snapshots ADD COLUMN IF NOT EXISTS muscle_soreness_map JSONB; -- {"quads": 3, "calves": 5, "hamstrings": 2}
ALTER TABLE health_snapshots ADD COLUMN IF NOT EXISTS injury_status JSONB; -- Current injury states
ALTER TABLE health_snapshots ADD COLUMN IF NOT EXISTS menstrual_cycle_day INTEGER; -- For female athletes
ALTER TABLE health_snapshots ADD COLUMN IF NOT EXISTS training_readiness_factors JSONB; -- AI assessment

-- ============================================
-- ENHANCE INJURIES TABLE
-- Better tracking for recurring/related issues
-- ============================================
ALTER TABLE injuries ADD COLUMN IF NOT EXISTS injury_type VARCHAR(50); -- overuse, acute, chronic
ALTER TABLE injuries ADD COLUMN IF NOT EXISTS related_workouts UUID[]; -- Workouts where it was noticed
ALTER TABLE injuries ADD COLUMN IF NOT EXISTS aggravating_activities TEXT[];
ALTER TABLE injuries ADD COLUMN IF NOT EXISTS treatment_log JSONB DEFAULT '[]'; -- [{date, treatment, notes}]
ALTER TABLE injuries ADD COLUMN IF NOT EXISTS progression_history JSONB DEFAULT '[]'; -- [{date, severity, notes}]
ALTER TABLE injuries ADD COLUMN IF NOT EXISTS cleared_for_activity JSONB; -- {"running": true, "speedwork": false}
ALTER TABLE injuries ADD COLUMN IF NOT EXISTS pt_recommendations TEXT;

-- ============================================
-- BIOMETRIC_BASELINES TABLE
-- Track rolling baselines for comparison
-- ============================================
CREATE TABLE IF NOT EXISTS biometric_baselines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Baseline Period
    baseline_date DATE NOT NULL, -- Date this baseline was computed
    period_days INTEGER DEFAULT 28, -- How many days of data used

    -- Heart Rate Baselines
    resting_hr_baseline DECIMAL(4,1),
    resting_hr_stddev DECIMAL(4,2),
    max_hr_observed INTEGER,
    lactate_threshold_hr INTEGER,

    -- HRV Baselines
    hrv_baseline DECIMAL(5,1),
    hrv_stddev DECIMAL(5,2),

    -- Sleep Baselines
    sleep_hours_baseline DECIMAL(3,1),
    sleep_quality_baseline DECIMAL(3,1),

    -- Training Load Baselines
    acute_training_load DECIMAL(6,1), -- 7-day
    chronic_training_load DECIMAL(6,1), -- 28-day
    training_load_ratio DECIMAL(4,2), -- Acute:Chronic

    -- Performance Baselines
    easy_pace_baseline VARCHAR(20), -- Typical easy pace
    threshold_pace_baseline VARCHAR(20),
    vo2max_estimate DECIMAL(4,1),

    -- Body Metrics
    weight_baseline_lbs DECIMAL(5,1),

    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_baselines_user ON biometric_baselines(user_id);
CREATE INDEX IF NOT EXISTS idx_baselines_date ON biometric_baselines(baseline_date DESC);

-- Create unique constraint for one baseline per day per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_baselines_user_date ON biometric_baselines(user_id, baseline_date);

-- ============================================
-- COACHING_INTERACTIONS TABLE
-- Track AI coaching conversations and decisions
-- ============================================
CREATE TABLE IF NOT EXISTS coaching_interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES training_plans(id) ON DELETE SET NULL,
    workout_id UUID REFERENCES workouts(id) ON DELETE SET NULL,

    -- Interaction Type
    interaction_type VARCHAR(50) NOT NULL, -- workout_analysis, plan_adaptation, weekly_review, injury_assessment, goal_check

    -- Context
    context_date DATE NOT NULL,
    context_data JSONB, -- Relevant data at time of interaction

    -- AI Analysis
    analysis_prompt TEXT, -- What was asked
    analysis_response TEXT, -- Full AI response (coach notes)
    key_insights JSONB, -- Structured extraction of insights
    action_items JSONB, -- Specific recommendations

    -- Outcomes
    user_acknowledged BOOLEAN DEFAULT FALSE,
    user_feedback TEXT,
    actions_taken JSONB,

    -- Model Info
    llm_provider VARCHAR(50),
    llm_model VARCHAR(100),
    prompt_tokens INTEGER,
    completion_tokens INTEGER,

    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coaching_user ON coaching_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_coaching_date ON coaching_interactions(context_date DESC);
CREATE INDEX IF NOT EXISTS idx_coaching_type ON coaching_interactions(interaction_type);
CREATE INDEX IF NOT EXISTS idx_coaching_workout ON coaching_interactions(workout_id);

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================
CREATE TRIGGER update_training_plans_updated_at BEFORE UPDATE ON training_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_training_phases_updated_at BEFORE UPDATE ON training_phases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_training_weeks_updated_at BEFORE UPDATE ON training_weeks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE training_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_adaptations ENABLE ROW LEVEL SECURITY;
ALTER TABLE biometric_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE coaching_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for now" ON training_plans FOR ALL USING (true);
CREATE POLICY "Allow all for now" ON training_phases FOR ALL USING (true);
CREATE POLICY "Allow all for now" ON training_weeks FOR ALL USING (true);
CREATE POLICY "Allow all for now" ON workout_adaptations FOR ALL USING (true);
CREATE POLICY "Allow all for now" ON biometric_baselines FOR ALL USING (true);
CREATE POLICY "Allow all for now" ON coaching_interactions FOR ALL USING (true);

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================
COMMENT ON TABLE training_plans IS 'Master training plans (e.g., Marathon Base-to-Block 16-week plan)';
COMMENT ON TABLE training_phases IS 'Mesocycles within a plan (Base Build, Peak, Taper, etc.)';
COMMENT ON TABLE training_weeks IS 'Weekly summaries, targets, and AI analysis';
COMMENT ON TABLE workout_adaptations IS 'History of plan modifications with reasoning';
COMMENT ON TABLE biometric_baselines IS 'Rolling baseline calculations for anomaly detection';
COMMENT ON TABLE coaching_interactions IS 'AI coaching analysis history';

COMMENT ON COLUMN workouts.device_data IS 'Raw data from Garmin/Strava/etc - structure varies by source';
COMMENT ON COLUMN workouts.splits IS 'Per-unit splits: [{mile: 1, pace: "8:05", hr: 134, elevation: 88, power: 320}]';
COMMENT ON COLUMN workouts.intervals IS 'Structured interval data: [{rep: 1, distance: 800, time: "2:58", hr_avg: 175}]';
COMMENT ON COLUMN workouts.key_observations IS 'AI-extracted insights: {"hr_efficiency": "improving", "fatigue_signals": ["elevated_rhr"]}';
COMMENT ON COLUMN workouts.adaptation_triggers IS 'What future changes this workout suggests: {"reduce_volume": true, "reason": "elevated_rhr"}';
