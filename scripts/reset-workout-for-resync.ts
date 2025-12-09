import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const workoutId = '2fca4ca0-b2da-4333-a021-7e96f2f1259a';

async function main() {
  console.log('Resetting workout for re-sync...');

  // Reset the workout to planned state and clear Garmin data
  const { data, error } = await supabase
    .from('workouts')
    .update({
      status: 'planned',
      completed_at: null,
      actual_duration_minutes: null,
      avg_heart_rate: null,
      max_heart_rate: null,
      calories_burned: null,
      external_id: null,
      source: null,
      metadata: {},
    })
    .eq('id', workoutId)
    .select('id, title, status')
    .single();

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Reset successful:');
  console.log(`  ID: ${data.id}`);
  console.log(`  Title: ${data.title}`);
  console.log(`  Status: ${data.status}`);
  console.log('\nYou can now re-sync from the schedule page to test the new lap data fetching.');
}

main();
