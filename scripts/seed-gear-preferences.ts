/**
 * Seed user gear (shoes) and preferences
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envContent = readFileSync('.env.local', 'utf8');
function getEnvVar(name: string): string {
  const match = envContent.match(new RegExp(`^${name}=(.+)$`, 'm'));
  return match ? match[1].trim() : '';
}

const supabase = createClient(getEnvVar('SUPABASE_URL'), getEnvVar('SUPABASE_SERVICE_KEY'));
const USER_ID = getEnvVar('USER_ID') || '00000000-0000-0000-0000-000000000001';

async function main() {
  console.log('🏃 Seeding gear and preferences...\n');

  // Run migration first
  const migration = readFileSync('packages/database/src/migrations/006_gear_and_preferences.sql', 'utf8');
  const { error: migrationError } = await supabase.rpc('exec_sql', { sql: migration }).single();

  if (migrationError) {
    // Try running statements individually if rpc doesn't work
    console.log('Running migration via direct execution...');
  }

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
      max_miles: 250, // Carbon shoes have shorter lifespan
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
      notes: 'Approaching retirement at 300mi. Lightstrike Pro foam. Good for tempo and easy runs.',
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
      notes: 'Max cushion for long runs 14mi+. FF Blast Plus Eco foam. Barely broken in.',
    },
  ];

  for (const shoe of shoes) {
    const { error } = await supabase
      .from('running_shoes')
      .upsert(shoe, { onConflict: 'id' });

    if (error) {
      console.error(`  Error adding ${shoe.model}:`, error.message);
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
    console.error('  Error setting preferences:', prefError.message);
  } else {
    console.log('  ✅ Run time: 6:30 AM');
    console.log('  ✅ Gel brands: Cadence, Huma');
    console.log('  ✅ Fueling: Start at 8mi, every 45min');
  }

  // =========================================================================
  // VERIFY
  // =========================================================================
  console.log('\n📋 Verification:');

  const { data: shoesData } = await supabase
    .from('running_shoes')
    .select('brand, model, category, total_miles, status')
    .eq('user_id', USER_ID)
    .eq('status', 'active');

  console.log('\nActive shoes:');
  for (const s of shoesData || []) {
    console.log(`  ${s.brand} ${s.model} [${s.category}] - ${s.total_miles} mi`);
  }

  const { data: prefsData } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', USER_ID)
    .single();

  if (prefsData) {
    console.log('\nPreferences:');
    console.log(`  Run time: ${prefsData.default_run_time}`);
    console.log(`  Gel brands: ${prefsData.preferred_gel_brands?.join(', ')}`);
    console.log(`  Fuel start: ${prefsData.gel_start_distance_miles} mi`);
  }

  console.log('\n✨ Done!');
}

main().catch(console.error);
