/**
 * Merge duplicate workouts - combine Garmin data with training plan workouts
 *
 * Run: npx tsx scripts/merge-duplicate-workouts.ts
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Load env
const envContent = readFileSync('.env.local', 'utf8');
function getEnvVar(name: string): string {
  const match = envContent.match(new RegExp(`^${name}=(.+)$`, 'm'));
  return match ? match[1].trim() : '';
}

const supabase = createClient(getEnvVar('SUPABASE_URL'), getEnvVar('SUPABASE_SERVICE_KEY'));
const USER_ID = getEnvVar('USER_ID') || '00000000-0000-0000-0000-000000000001';

async function mergeDuplicates() {
  console.log('\n🔄 Merging duplicate workouts\n');
  console.log('='.repeat(50) + '\n');

  // Get all completed workouts
  const { data: workouts, error } = await supabase
    .from('workouts')
    .select('*')
    .eq('user_id', USER_ID)
    .eq('status', 'completed')
    .order('scheduled_date', { ascending: true });

  if (error) {
    console.error('Error fetching workouts:', error);
    return;
  }

  // Group by date
  const byDate = new Map<string, typeof workouts>();
  for (const w of workouts || []) {
    const date = w.scheduled_date;
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push(w);
  }

  let merged = 0;
  let deleted = 0;

  for (const [date, dateWorkouts] of byDate) {
    if (dateWorkouts.length <= 1) continue;

    // Find training plan workout (has "Week" in title)
    const planWorkout = dateWorkouts.find(w => w.title?.includes('Week'));
    // Find Garmin workout (doesn't have "Week" in title, usually has actual data)
    const garminWorkout = dateWorkouts.find(w => !w.title?.includes('Week'));

    if (!planWorkout || !garminWorkout) {
      console.log(`${date}: Skipping - no clear plan/garmin pair`);
      for (const w of dateWorkouts) {
        console.log(`  - ${w.title}`);
      }
      continue;
    }

    console.log(`${date}:`);
    console.log(`  Plan: ${planWorkout.title}`);
    console.log(`  Garmin: ${garminWorkout.title}`);

    // Merge Garmin data into plan workout
    const updateData: Record<string, unknown> = {};

    // Copy actual performance data from Garmin workout
    if (garminWorkout.actual_duration_minutes) updateData.actual_duration_minutes = garminWorkout.actual_duration_minutes;
    if (garminWorkout.avg_heart_rate) updateData.avg_heart_rate = garminWorkout.avg_heart_rate;
    if (garminWorkout.max_heart_rate) updateData.max_heart_rate = garminWorkout.max_heart_rate;
    if (garminWorkout.training_load) updateData.training_load = garminWorkout.training_load;
    if (garminWorkout.training_effect_aerobic) updateData.training_effect_aerobic = garminWorkout.training_effect_aerobic;
    if (garminWorkout.training_effect_anaerobic) updateData.training_effect_anaerobic = garminWorkout.training_effect_anaerobic;
    if (garminWorkout.cadence_avg) updateData.cadence_avg = garminWorkout.cadence_avg;
    if (garminWorkout.cadence_max) updateData.cadence_max = garminWorkout.cadence_max;
    if (garminWorkout.elevation_gain_ft) updateData.elevation_gain_ft = garminWorkout.elevation_gain_ft;
    if (garminWorkout.elevation_loss_ft) updateData.elevation_loss_ft = garminWorkout.elevation_loss_ft;
    if (garminWorkout.calories_burned) updateData.calories_burned = garminWorkout.calories_burned;
    if (garminWorkout.garmin_activity_id) updateData.garmin_activity_id = garminWorkout.garmin_activity_id;
    if (garminWorkout.external_id) updateData.external_id = garminWorkout.external_id;
    if (garminWorkout.started_at) updateData.started_at = garminWorkout.started_at;
    if (garminWorkout.completed_at) updateData.completed_at = garminWorkout.completed_at;
    if (garminWorkout.splits) updateData.splits = garminWorkout.splits;
    if (garminWorkout.device_data) updateData.device_data = garminWorkout.device_data;

    // Merge metadata
    const mergedMetadata = {
      ...(planWorkout.metadata || {}),
      ...(garminWorkout.metadata || {}),
      merged_from_garmin_workout: garminWorkout.id,
      merged_at: new Date().toISOString(),
    };
    updateData.metadata = mergedMetadata;
    updateData.source = 'garmin';

    // Update plan workout with Garmin data
    const { error: updateError } = await supabase
      .from('workouts')
      .update(updateData)
      .eq('id', planWorkout.id);

    if (updateError) {
      console.error(`  ❌ Failed to update: ${updateError.message}`);
      continue;
    }

    console.log(`  ✅ Merged Garmin data into plan workout`);
    merged++;

    // Delete the Garmin-only workout
    const { error: deleteError } = await supabase
      .from('workouts')
      .delete()
      .eq('id', garminWorkout.id);

    if (deleteError) {
      console.error(`  ❌ Failed to delete duplicate: ${deleteError.message}`);
      continue;
    }

    console.log(`  🗑️  Deleted duplicate Garmin workout\n`);
    deleted++;
  }

  console.log('='.repeat(50));
  console.log(`\n📊 Summary:`);
  console.log(`   Merged: ${merged} workouts`);
  console.log(`   Deleted: ${deleted} duplicates\n`);
}

mergeDuplicates();
