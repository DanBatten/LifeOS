/**
 * Check current database schema state
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkSchema() {
  console.log('🔍 Checking Supabase schema...\n');

  // List all tables
  const { data: tables, error: tablesError } = await supabase
    .rpc('get_tables' as never)
    .select('*');

  // If RPC doesn't exist, try direct query
  if (tablesError) {
    // Try listing by querying each expected table
    const expectedTables = [
      // Migration 001
      'users',
      'people', 
      'events',
      'tasks',
      'health_snapshots',
      'workouts',
      'injuries',
      'constraints',
      'whiteboard_entries',
      'whiteboard_reactions',
      'agent_runs',
      'chat_messages',
      // Migration 002
      'training_plans',
      'training_phases',
      'training_weeks',
      'workout_adaptations',
      'biometric_baselines',
      'coaching_interactions',
      // Migration 003
      'lab_panels',
      'biomarker_definitions',
      'biomarker_results',
      'biomarker_baselines',
    ];

    console.log('📋 Checking expected tables:\n');
    
    for (const table of expectedTables) {
      try {
        const { count, error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });
        
        if (error) {
          console.log(`  ❌ ${table} - NOT FOUND or error: ${error.message}`);
        } else {
          console.log(`  ✅ ${table} - exists (${count ?? 0} rows)`);
        }
      } catch (e) {
        console.log(`  ❌ ${table} - error checking`);
      }
    }
  }

  // Check workout columns (to see if migration 002 ran)
  console.log('\n📊 Checking workout table columns...\n');
  
  const { data: workout } = await supabase
    .from('workouts')
    .select('*')
    .limit(1);
  
  if (workout && workout.length > 0) {
    const cols = Object.keys(workout[0]);
    console.log(`  Workout has ${cols.length} columns`);
    
    // Check for migration 002 specific columns
    const migration002Cols = [
      'plan_id', 'phase_id', 'week_id', 'week_number',
      'prescribed_description', 'training_load', 'coach_notes'
    ];
    
    console.log('\n  Migration 002 columns:');
    for (const col of migration002Cols) {
      if (cols.includes(col)) {
        console.log(`    ✅ ${col}`);
      } else {
        console.log(`    ❌ ${col} - missing`);
      }
    }
  } else {
    console.log('  No workout data to inspect columns');
    
    // Try to get column info another way
    const { data: emptyWorkout, error } = await supabase
      .from('workouts')
      .select('plan_id, phase_id, week_id, training_load, coach_notes')
      .limit(0);
    
    if (!error) {
      console.log('  ✅ Migration 002 workout columns exist');
    } else {
      console.log(`  ❌ Migration 002 columns may be missing: ${error.message}`);
    }
  }

  // Check biomarker_definitions count
  console.log('\n📊 Checking biomarker definitions...\n');
  const { count: biomarkerCount } = await supabase
    .from('biomarker_definitions')
    .select('*', { count: 'exact', head: true });
  
  if (biomarkerCount !== null) {
    console.log(`  Found ${biomarkerCount} biomarker definitions`);
    if (biomarkerCount > 50) {
      console.log('  ✅ Looks like seed data was inserted');
    } else if (biomarkerCount === 0) {
      console.log('  ⚠️  Table exists but no seed data');
    }
  }

  // Check for user
  console.log('\n👤 Checking for default user...\n');
  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('id', '00000000-0000-0000-0000-000000000001')
    .single();
  
  if (user) {
    console.log(`  ✅ Default user exists: ${user.name} (${user.email})`);
  } else {
    console.log('  ❌ Default user not found');
  }

  console.log('\n✨ Schema check complete!\n');
}

checkSchema().catch(console.error);


