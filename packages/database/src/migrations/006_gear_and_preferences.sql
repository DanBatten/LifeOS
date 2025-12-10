-- Migration: Gear and User Preferences
-- Adds tables for running shoes, nutrition preferences, and run planning

-- ============================================================================
-- RUNNING SHOES
-- ============================================================================
CREATE TABLE IF NOT EXISTS running_shoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Shoe details
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    nickname TEXT, -- Optional friendly name like "My race day shoes"

    -- Classification
    category TEXT NOT NULL CHECK (category IN (
        'daily_trainer',    -- Versatile everyday shoes
        'tempo',            -- Lightweight trainers for faster work
        'race',             -- Super/carbon shoes for racing
        'long_run',         -- Cushioned shoes for long efforts
        'trail',            -- Trail running shoes
        'recovery'          -- Max cushion recovery shoes
    )),

    -- Characteristics (for matching to workout types)
    stack_height_mm INTEGER,        -- Midsole height
    drop_mm INTEGER,                -- Heel-to-toe drop
    weight_oz DECIMAL(4,1),         -- Weight in ounces
    has_carbon_plate BOOLEAN DEFAULT FALSE,
    cushion_level TEXT CHECK (cushion_level IN ('minimal', 'moderate', 'max')),

    -- Usage tracking
    total_miles DECIMAL(6,1) DEFAULT 0,
    max_miles INTEGER DEFAULT 400,  -- Recommended retirement mileage
    purchase_date DATE,
    retired_at TIMESTAMP WITH TIME ZONE,

    -- Status
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'retired', 'reserved')),
    is_primary BOOLEAN DEFAULT FALSE, -- Primary shoe for its category

    notes TEXT,
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_running_shoes_user_status ON running_shoes(user_id, status);
CREATE INDEX IF NOT EXISTS idx_running_shoes_category ON running_shoes(user_id, category, status);

-- ============================================================================
-- USER PREFERENCES
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Running preferences
    default_run_time TIME,              -- e.g., '06:30:00' for 6:30 AM
    preferred_run_days TEXT[],          -- e.g., ['monday', 'wednesday', 'friday', 'sunday']

    -- Nutrition preferences
    preferred_gel_brands TEXT[],        -- e.g., ['Maurten', 'Gu']
    preferred_hydration_brands TEXT[],  -- e.g., ['Nuun', 'LMNT']
    dietary_restrictions TEXT[],        -- e.g., ['vegan', 'gluten-free']
    caffeine_preference TEXT CHECK (caffeine_preference IN ('always', 'race_only', 'never')),

    -- Pre-run nutrition timing (minutes before run)
    pre_run_meal_timing_minutes INTEGER DEFAULT 120,  -- 2 hours before
    pre_run_snack_timing_minutes INTEGER DEFAULT 30,  -- 30 min before

    -- Fueling thresholds
    gel_start_distance_miles DECIMAL(3,1) DEFAULT 8,  -- Start taking gels at 8mi
    gel_interval_minutes INTEGER DEFAULT 45,           -- Gel every 45 min

    -- Sleep/wake preferences (for morning briefing timing)
    typical_wake_time TIME,
    typical_sleep_time TIME,

    -- Units preferences
    distance_unit TEXT DEFAULT 'miles' CHECK (distance_unit IN ('miles', 'km')),
    temperature_unit TEXT DEFAULT 'fahrenheit' CHECK (temperature_unit IN ('fahrenheit', 'celsius')),

    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(user_id)
);

-- ============================================================================
-- WORKOUT RUN PLAN (Pre-computed recommendations for each workout)
-- ============================================================================
CREATE TABLE IF NOT EXISTS workout_run_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workout_id UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Shoe recommendation
    recommended_shoe_id UUID REFERENCES running_shoes(id) ON DELETE SET NULL,
    shoe_reasoning TEXT,

    -- Pre-run nutrition
    pre_run_meal TEXT,           -- e.g., "Oatmeal with banana, 2hrs before"
    pre_run_snack TEXT,          -- e.g., "Half banana or rice cake, 30min before"
    pre_run_hydration TEXT,      -- e.g., "16oz water with electrolytes"

    -- During-run fueling (for longer runs)
    fueling_plan JSONB,          -- Array of {mile: 6, item: "Cadence gel", notes: "take with water"}
    hydration_plan JSONB,        -- Array of {mile: 3, item: "4oz water"}

    -- Post-run nutrition
    post_run_nutrition TEXT,     -- e.g., "Protein shake within 30min, full meal within 2hrs"

    -- Timing
    suggested_wake_time TIME,
    suggested_meal_time TIME,
    suggested_start_time TIME,

    -- Weather considerations (populated closer to run date)
    weather_notes TEXT,
    hydration_adjustment TEXT,   -- e.g., "Add extra 8oz due to heat"

    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    generated_by TEXT,           -- 'training_coach', 'nutrition_agent', etc.

    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(workout_id)
);

-- Index for looking up run plans
CREATE INDEX IF NOT EXISTS idx_workout_run_plans_workout ON workout_run_plans(workout_id);
CREATE INDEX IF NOT EXISTS idx_workout_run_plans_user ON workout_run_plans(user_id);

-- ============================================================================
-- SHOE ROTATION LOG (Track which shoe was used for each workout)
-- ============================================================================
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS shoe_id UUID REFERENCES running_shoes(id) ON DELETE SET NULL;

-- ============================================================================
-- NUTRITION LOG (Track pre/during/post nutrition for workouts)
-- ============================================================================
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS nutrition_log JSONB DEFAULT '{}';
-- Structure: {
--   pre_run: { meal: "...", snack: "...", timing_minutes: 120 },
--   during_run: [{ mile: 6, item: "Cadence gel", notes: "..." }],
--   post_run: { item: "...", timing_minutes: 30 }
-- }

-- ============================================================================
-- HELPER FUNCTION: Get recommended shoe for workout type
-- ============================================================================
CREATE OR REPLACE FUNCTION get_recommended_shoe(
    p_user_id UUID,
    p_workout_type TEXT,
    p_distance_miles DECIMAL
) RETURNS UUID AS $$
DECLARE
    v_shoe_id UUID;
    v_category TEXT;
BEGIN
    -- Map workout type to shoe category
    v_category := CASE
        WHEN p_workout_type IN ('interval', 'tempo', 'threshold') THEN 'tempo'
        WHEN p_workout_type = 'race' THEN 'race'
        WHEN p_workout_type = 'long_run' AND p_distance_miles >= 14 THEN 'long_run'
        WHEN p_workout_type = 'recovery' THEN 'recovery'
        WHEN p_workout_type = 'trail' THEN 'trail'
        ELSE 'daily_trainer'
    END;

    -- Find the primary active shoe for that category
    SELECT id INTO v_shoe_id
    FROM running_shoes
    WHERE user_id = p_user_id
      AND category = v_category
      AND status = 'active'
    ORDER BY is_primary DESC, total_miles ASC
    LIMIT 1;

    -- Fallback to daily trainer if no match
    IF v_shoe_id IS NULL THEN
        SELECT id INTO v_shoe_id
        FROM running_shoes
        WHERE user_id = p_user_id
          AND category = 'daily_trainer'
          AND status = 'active'
        ORDER BY is_primary DESC, total_miles ASC
        LIMIT 1;
    END IF;

    RETURN v_shoe_id;
END;
$$ LANGUAGE plpgsql;
