/**
 * Run migration 006 via Supabase client
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envContent = readFileSync('.env.local', 'utf8');
function getEnvVar(name: string): string {
  const match = envContent.match(new RegExp(`^${name}=(.+)$`, 'm'));
  return match ? match[1].trim() : '';
}

const supabase = createClient(getEnvVar('SUPABASE_URL'), getEnvVar('SUPABASE_SERVICE_KEY'));

async function runSQL(sql: string, description: string) {
  const { error } = await supabase.rpc('exec_sql', { sql });
  if (error) {
    // Try alternative approach - some Supabase setups don't have exec_sql
    console.log(`Note: ${description} - may need manual execution`);
    return false;
  }
  console.log(`✅ ${description}`);
  return true;
}

async function main() {
  console.log('🔄 Running migration 006: Gear and Preferences\n');

  // Create tables one by one using REST API where possible
  // For complex DDL, we'll check if tables exist first

  // Check if tables already exist
  const { data: existingTables } = await supabase
    .from('running_shoes')
    .select('id')
    .limit(1);

  if (existingTables !== null) {
    console.log('Tables already exist, skipping creation...');
  } else {
    console.log('Tables need to be created. Please run the SQL migration manually in Supabase Dashboard:');
    console.log('packages/database/src/migrations/006_gear_and_preferences.sql');
    console.log('\nOr run via Supabase SQL Editor.\n');
  }

  // Try to seed data anyway (tables may already exist)
  console.log('Attempting to seed data...\n');
  await seedData();
}

async function seedData() {
  const USER_ID = getEnvVar('USER_ID') || '00000000-0000-0000-0000-000000000001';

  // =========================================================================
  // SEED RUNNING SHOES
  // =========================================================================
  console.log('👟 Adding running shoes...');

  const shoes = [
    {
      user_id: USER_ID,
      brand: 'Adidas',
      model: 'Adios Pro 4',
      nickname: 'Race Day',
      category: 'race',
      stack_height_mm: 39,
      drop_mm: 6,
      weight_oz: 7.8,
      has_carbon_plate: true,
      cushion_level: 'moderate',
      total_miles: 75,
      max_miles: 250,
      status: 'active',
      is_primary: true,
      notes: 'Reserve for races and key workouts. Carbon EnergyRods for propulsion.',
    },
    {
      user_id: USER_ID,
      brand: 'Adidas',
      model: 'Adizero SL',
      nickname: 'Daily Workhorse',
      category: 'daily_trainer',
      stack_height_mm: 35,
      drop_mm: 8.5,
      weight_oz: 8.6,
      has_carbon_plate: false,
      cushion_level: 'moderate',
      total_miles: 283,
      max_miles: 350,
      status: 'active',
      is_primary: true,
      notes: 'Approaching retirement at 300mi. Lightstrike Pro foam.',
    },
    {
      user_id: USER_ID,
      brand: 'ASICS',
      model: 'Gel Nimbus 26',
      nickname: 'Long Run Cushion',
      category: 'long_run',
      stack_height_mm: 41,
      drop_mm: 8,
      weight_oz: 10.9,
      has_carbon_plate: false,
      cushion_level: 'max',
      total_miles: 9,
      max_miles: 500,
      status: 'active',
      is_primary: true,
      notes: 'Max cushion for long runs 14mi+. FF Blast Plus Eco foam.',
    },
  ];

  for (const shoe of shoes) {
    const { error } = await supabase
      .from('running_shoes')
      .insert(shoe);

    if (error) {
      if (error.code === '42P01') {
        console.error('  ❌ Table does not exist. Please run migration SQL first.');
        return;
      } else if (error.code === '23505') {
        console.log(`  ⏭️ ${shoe.brand} ${shoe.model} already exists`);
      } else {
        console.error(`  ❌ ${shoe.model}:`, error.message);
      }
    } else {
      console.log(`  ✅ ${shoe.brand} ${shoe.model} (${shoe.total_miles} mi)`);
    }
  }

  // =========================================================================
  // SEED USER PREFERENCES
  // =========================================================================
  console.log('\n⚙️ Setting user preferences...');

  const preferences = {
    user_id: USER_ID,
    default_run_time: '06:30:00',
    preferred_run_days: ['tuesday', 'wednesday', 'friday', 'sunday'],
    preferred_gel_brands: ['Cadence', 'Huma'],
    preferred_hydration_brands: ['LMNT', 'Nuun'],
    dietary_restrictions: [],
    caffeine_preference: 'race_only',
    pre_run_meal_timing_minutes: 120,
    pre_run_snack_timing_minutes: 30,
    gel_start_distance_miles: 8,
    gel_interval_minutes: 45,
    typical_wake_time: '05:30:00',
    typical_sleep_time: '22:00:00',
    distance_unit: 'miles',
    temperature_unit: 'fahrenheit',
  };

  const { error: prefError } = await supabase
    .from('user_preferences')
    .upsert(preferences, { onConflict: 'user_id' });

  if (prefError) {
    if (prefError.code === '42P01') {
      console.error('  ❌ Table does not exist. Please run migration SQL first.');
      return;
    }
    console.error('  ❌ Preferences:', prefError.message);
  } else {
    console.log('  ✅ Run time: 6:30 AM');
    console.log('  ✅ Gel brands: Cadence, Huma');
    console.log('  ✅ Fueling: Start at 8mi, every 45min');
  }

  // =========================================================================
  // VERIFY
  // =========================================================================
  console.log('\n📋 Verification:');

  const { data: shoesData, error: shoesErr } = await supabase
    .from('running_shoes')
    .select('brand, model, category, total_miles, status')
    .eq('user_id', USER_ID)
    .eq('status', 'active');

  if (shoesErr) {
    console.log('Could not verify shoes:', shoesErr.message);
  } else {
    console.log('\nActive shoes:');
    for (const s of shoesData || []) {
      console.log(`  ${s.brand} ${s.model} [${s.category}] - ${s.total_miles} mi`);
    }
  }

  const { data: prefsData, error: prefsErr } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', USER_ID)
    .single();

  if (prefsErr) {
    console.log('Could not verify preferences:', prefsErr.message);
  } else if (prefsData) {
    console.log('\nPreferences:');
    console.log(`  Run time: ${prefsData.default_run_time}`);
    console.log(`  Gel brands: ${prefsData.preferred_gel_brands?.join(', ')}`);
  }

  console.log('\n✨ Done!');
}

main().catch(console.error);
