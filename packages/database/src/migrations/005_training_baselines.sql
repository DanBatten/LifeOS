-- ============================================
-- LifeOS Training Baselines
-- Version: 5.0.0
--
-- Stores computed baselines from Garmin/wearable data
-- for running, fitness, and recovery tracking
-- ============================================

-- ============================================
-- TRAINING_BASELINES TABLE
-- Stores rolling training and fitness baselines
-- ============================================
CREATE TABLE IF NOT EXISTS training_baselines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- When this baseline was calculated
    baseline_date DATE NOT NULL,
    period_days INTEGER NOT NULL DEFAULT 365, -- How many days of data used
    
    -- ========================================
    -- HEALTH BASELINES
    -- ========================================
    
    -- Heart Rate
    resting_hr_baseline DECIMAL(4,1),
    resting_hr_stddev DECIMAL(4,2),
    resting_hr_min INTEGER,
    resting_hr_max INTEGER,
    
    -- HRV
    hrv_baseline DECIMAL(5,1),
    hrv_stddev DECIMAL(5,2),
    hrv_low_threshold DECIMAL(5,1), -- Below this = recovery concern
    hrv_high_threshold DECIMAL(5,1), -- Above this = well recovered
    
    -- Sleep
    sleep_hours_baseline DECIMAL(3,1),
    sleep_hours_stddev DECIMAL(3,2),
    sleep_quality_baseline DECIMAL(3,1),
    deep_sleep_baseline_minutes INTEGER,
    rem_sleep_baseline_minutes INTEGER,
    
    -- Body Battery / Recovery
    body_battery_baseline INTEGER,
    body_battery_stddev DECIMAL(4,1),
    
    -- ========================================
    -- TRAINING LOAD BASELINES
    -- ========================================
    
    -- Weekly Volume
    weekly_mileage_avg DECIMAL(5,1),
    weekly_mileage_peak DECIMAL(5,1),
    runs_per_week_avg DECIMAL(3,1),
    avg_run_distance_miles DECIMAL(4,1),
    
    -- Training Load (TSS/Garmin Load)
    chronic_training_load DECIMAL(6,1), -- 28-day rolling avg
    acute_training_load DECIMAL(6,1), -- 7-day rolling
    training_load_ratio DECIMAL(3,2), -- acute/chronic
    
    -- ========================================
    -- PACE BASELINES
    -- ========================================
    
    -- Easy/Aerobic Running
    easy_pace_baseline VARCHAR(20), -- "8:30/mi"
    easy_hr_baseline INTEGER,
    easy_pace_hr_ratio DECIMAL(4,2), -- efficiency factor
    
    -- Threshold/Tempo
    threshold_pace_baseline VARCHAR(20),
    threshold_hr_baseline INTEGER,
    
    -- ========================================
    -- RUNNING DYNAMICS
    -- ========================================
    
    cadence_avg INTEGER,
    cadence_range_low INTEGER,
    cadence_range_high INTEGER,
    ground_contact_time_ms INTEGER,
    vertical_oscillation_cm DECIMAL(4,1),
    stride_length_cm INTEGER,
    vertical_ratio DECIMAL(4,2),
    power_avg_watts INTEGER, -- Running power
    
    -- ========================================
    -- FITNESS INDICATORS
    -- ========================================
    
    vo2max_estimate DECIMAL(4,1),
    vo2max_trend VARCHAR(20), -- 'improving', 'stable', 'declining'
    lactate_threshold_hr INTEGER,
    lactate_threshold_pace VARCHAR(20),
    
    -- ========================================
    -- RACE PREDICTIONS (based on fitness)
    -- ========================================
    
    predicted_5k_time VARCHAR(20),
    predicted_10k_time VARCHAR(20),
    predicted_half_time VARCHAR(20),
    predicted_marathon_time VARCHAR(20),
    
    -- ========================================
    -- METADATA
    -- ========================================
    
    health_data_points INTEGER, -- How many days of health data
    workout_data_points INTEGER, -- How many workouts used
    
    source VARCHAR(50) DEFAULT 'garmin', -- 'garmin', 'manual', 'mixed'
    calculation_notes TEXT,
    
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, baseline_date, period_days)
);

CREATE INDEX IF NOT EXISTS idx_training_baselines_user ON training_baselines(user_id);
CREATE INDEX IF NOT EXISTS idx_training_baselines_date ON training_baselines(baseline_date DESC);

-- ============================================
-- RACE_RESULTS TABLE
-- Store historical race performances
-- ============================================
CREATE TABLE IF NOT EXISTS race_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Race Identity
    race_name VARCHAR(255) NOT NULL,
    race_date DATE NOT NULL,
    race_location VARCHAR(255),
    
    -- Distance
    distance_miles DECIMAL(5,2) NOT NULL,
    distance_type VARCHAR(50), -- '5K', '10K', 'half_marathon', 'marathon', 'ultra', 'other'
    
    -- Performance
    finish_time_seconds INTEGER NOT NULL,
    pace_per_mile VARCHAR(20), -- "7:30/mi"
    
    -- Splits (if available)
    splits JSONB, -- Array of split times
    
    -- Conditions
    weather_temp_f INTEGER,
    weather_conditions VARCHAR(100), -- 'sunny', 'rain', 'humid', etc.
    course_type VARCHAR(50), -- 'road', 'trail', 'track', 'mixed'
    elevation_gain_ft INTEGER,
    
    -- Goals
    goal_time_seconds INTEGER,
    goal_achieved BOOLEAN,
    
    -- Context
    training_cycle VARCHAR(100), -- What plan/cycle was this part of
    taper_days INTEGER, -- Days of taper before race
    
    -- Garmin Link
    garmin_activity_id VARCHAR(50),
    workout_id UUID REFERENCES workouts(id),
    
    -- Analysis
    notes TEXT,
    lessons_learned TEXT,
    
    -- Metadata
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_race_results_user ON race_results(user_id);
CREATE INDEX IF NOT EXISTS idx_race_results_date ON race_results(race_date DESC);
CREATE INDEX IF NOT EXISTS idx_race_results_type ON race_results(distance_type);

-- ============================================
-- TRIGGERS
-- ============================================
CREATE TRIGGER update_training_baselines_updated_at BEFORE UPDATE ON training_baselines
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_race_results_updated_at BEFORE UPDATE ON race_results
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE training_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE race_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for now" ON training_baselines FOR ALL USING (true);
CREATE POLICY "Allow all for now" ON race_results FOR ALL USING (true);

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE training_baselines IS 'Rolling training and fitness baselines computed from Garmin data';
COMMENT ON TABLE race_results IS 'Historical race performances with context and analysis';

COMMENT ON COLUMN training_baselines.hrv_low_threshold IS 'Personal HRV threshold below which indicates recovery concern';
COMMENT ON COLUMN training_baselines.easy_pace_hr_ratio IS 'Efficiency factor: pace-to-HR ratio for aerobic fitness tracking';
COMMENT ON COLUMN training_baselines.training_load_ratio IS 'Acute:Chronic ratio - ideally 0.8-1.3 for safe progression';

COMMENT ON COLUMN race_results.distance_type IS 'Standardized race distance category';
COMMENT ON COLUMN race_results.lessons_learned IS 'Post-race reflection for future training/racing';







