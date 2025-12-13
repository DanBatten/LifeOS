-- ============================================
-- LifeOS Garmin Integration
-- Version: 4.0.0
--
-- Adds columns and indexes for Garmin MCP integration
-- ============================================

-- ============================================
-- WORKOUTS TABLE UPDATES
-- Add Garmin activity tracking
-- ============================================

-- Unique Garmin activity ID for deduplication
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS garmin_activity_id VARCHAR(50) UNIQUE;

-- Additional execution metrics from Garmin
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS actual_distance_miles DECIMAL(5,2);
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS avg_pace VARCHAR(20);
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

-- Additional Garmin-specific metrics
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS vo2max_estimate DECIMAL(4,1);
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS lactate_threshold_speed DECIMAL(5,2);
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS avg_stride_length_cm DECIMAL(5,1);
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS avg_vertical_ratio DECIMAL(4,2);

-- Index for efficient lookup by Garmin ID
CREATE INDEX IF NOT EXISTS idx_workouts_garmin_id ON workouts(garmin_activity_id) WHERE garmin_activity_id IS NOT NULL;

-- ============================================
-- HEALTH_SNAPSHOTS TABLE UPDATES
-- Add Garmin sync tracking
-- ============================================

-- Garmin sync identifier for tracking what data came from Garmin
ALTER TABLE health_snapshots ADD COLUMN IF NOT EXISTS garmin_sync_id VARCHAR(100);

-- Additional Garmin health metrics
ALTER TABLE health_snapshots ADD COLUMN IF NOT EXISTS steps INTEGER;
ALTER TABLE health_snapshots ADD COLUMN IF NOT EXISTS steps_goal INTEGER;
ALTER TABLE health_snapshots ADD COLUMN IF NOT EXISTS active_calories INTEGER;
ALTER TABLE health_snapshots ADD COLUMN IF NOT EXISTS total_calories INTEGER;
ALTER TABLE health_snapshots ADD COLUMN IF NOT EXISTS moderate_intensity_minutes INTEGER;
ALTER TABLE health_snapshots ADD COLUMN IF NOT EXISTS vigorous_intensity_minutes INTEGER;
ALTER TABLE health_snapshots ADD COLUMN IF NOT EXISTS floors_ascended INTEGER;
ALTER TABLE health_snapshots ADD COLUMN IF NOT EXISTS avg_spo2 DECIMAL(4,1);
ALTER TABLE health_snapshots ADD COLUMN IF NOT EXISTS min_spo2 DECIMAL(4,1);

-- Index for Garmin sync tracking
CREATE INDEX IF NOT EXISTS idx_health_garmin_sync ON health_snapshots(garmin_sync_id) WHERE garmin_sync_id IS NOT NULL;

-- ============================================
-- GARMIN_SYNC_LOG TABLE
-- Track sync history and status
-- ============================================
CREATE TABLE IF NOT EXISTS garmin_sync_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Sync metadata
    sync_type VARCHAR(50) NOT NULL, -- 'scheduled', 'manual', 'backfill'
    sync_start TIMESTAMPTZ NOT NULL,
    sync_end TIMESTAMPTZ,
    
    -- What was synced
    date_range_start DATE,
    date_range_end DATE,
    activities_synced INTEGER DEFAULT 0,
    health_snapshots_synced INTEGER DEFAULT 0,
    
    -- Status
    status VARCHAR(20) DEFAULT 'running', -- 'running', 'completed', 'failed', 'partial'
    error_message TEXT,
    error_details JSONB,
    
    -- Performance
    duration_ms INTEGER,
    
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_garmin_sync_user ON garmin_sync_log(user_id);
CREATE INDEX IF NOT EXISTS idx_garmin_sync_date ON garmin_sync_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_garmin_sync_status ON garmin_sync_log(status);

-- ============================================
-- BIOMETRIC_BASELINES TABLE UPDATES
-- Add Garmin-derived baselines
-- ============================================

-- Garmin-specific baseline fields
ALTER TABLE biometric_baselines ADD COLUMN IF NOT EXISTS body_battery_baseline INTEGER;
ALTER TABLE biometric_baselines ADD COLUMN IF NOT EXISTS stress_baseline DECIMAL(4,1);
ALTER TABLE biometric_baselines ADD COLUMN IF NOT EXISTS spo2_baseline DECIMAL(4,1);
ALTER TABLE biometric_baselines ADD COLUMN IF NOT EXISTS garmin_vo2max DECIMAL(4,1);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE garmin_sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for now" ON garmin_sync_log FOR ALL USING (true);

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON COLUMN workouts.garmin_activity_id IS 'Unique Garmin Connect activity ID for deduplication';
COMMENT ON COLUMN health_snapshots.garmin_sync_id IS 'Identifier for tracking Garmin data sync (format: garmin-YYYY-MM-DD)';
COMMENT ON TABLE garmin_sync_log IS 'Log of Garmin data sync operations for monitoring and debugging';


