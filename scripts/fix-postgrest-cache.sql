-- ============================================
-- PostgREST Schema Cache Diagnostic & Fix
-- Run each section in Supabase SQL Editor
-- ============================================

-- ============================================
-- STEP 1: Verify current database and schema
-- ============================================
SELECT current_database(), current_schema();

-- ============================================
-- STEP 2: Verify workouts table columns exist
-- (Should show avg_hr, coach_notes, etc.)
-- ============================================
SELECT table_schema, table_name, column_name
FROM information_schema.columns
WHERE table_name = 'workouts'
ORDER BY ordinal_position;

-- ============================================
-- STEP 3: Check training system tables exist
-- ============================================
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_name IN ('training_plans', 'training_phases', 'training_weeks', 'workouts')
ORDER BY table_name;

-- ============================================
-- STEP 4: Grant privileges to API roles
-- (This is often the missing piece!)
-- ============================================

-- Grant schema access
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

-- Grant full access on training tables
GRANT ALL ON training_plans TO anon, authenticated, service_role;
GRANT ALL ON training_phases TO anon, authenticated, service_role;
GRANT ALL ON training_weeks TO anon, authenticated, service_role;
GRANT ALL ON workouts TO anon, authenticated, service_role;
GRANT ALL ON workout_adaptations TO anon, authenticated, service_role;
GRANT ALL ON biometric_baselines TO anon, authenticated, service_role;
GRANT ALL ON coaching_interactions TO anon, authenticated, service_role;

-- Grant access on biomarker tables
GRANT ALL ON lab_panels TO anon, authenticated, service_role;
GRANT ALL ON biomarker_definitions TO anon, authenticated, service_role;
GRANT ALL ON biomarker_results TO anon, authenticated, service_role;
GRANT ALL ON biomarker_baselines TO anon, authenticated, service_role;

-- Grant sequence access (for auto-generated IDs)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- ============================================
-- STEP 5: Check PostgREST event triggers
-- (Should see pgrst-related triggers)
-- ============================================
SELECT event_manipulation, event_object_table, trigger_name
FROM information_schema.triggers
WHERE trigger_name ILIKE '%pgrst%';

-- ============================================
-- STEP 6: Force schema reload
-- ============================================
NOTIFY pgrst, 'reload schema';

-- ============================================
-- STEP 7: Quick test - add debug column
-- (If this appears in API but others don't, 
--  it's a permissions issue on the old columns)
-- ============================================
-- ALTER TABLE workouts ADD COLUMN IF NOT EXISTS _debug_test TEXT;
-- NOTIFY pgrst, 'reload schema';

-- ============================================
-- VERIFICATION: Check what PostgREST should see
-- ============================================
SELECT 
    c.table_name,
    c.column_name,
    c.data_type,
    CASE 
        WHEN has_column_privilege('authenticated', c.table_schema || '.' || c.table_name, c.column_name, 'SELECT') 
        THEN '✅ Yes' 
        ELSE '❌ No' 
    END as authenticated_can_read,
    CASE 
        WHEN has_column_privilege('service_role', c.table_schema || '.' || c.table_name, c.column_name, 'SELECT') 
        THEN '✅ Yes' 
        ELSE '❌ No' 
    END as service_role_can_read
FROM information_schema.columns c
WHERE c.table_name = 'workouts'
AND c.column_name IN ('avg_hr', 'max_hr', 'coach_notes', 'personal_notes', 'training_load', 'splits')
ORDER BY c.column_name;

