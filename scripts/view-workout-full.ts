import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const workoutId = '2fca4ca0-b2da-4333-a021-7e96f2f1259a';

async function main() {
  const { data, error } = await supabase
    .from('workouts')
    .select('*')
    .eq('id', workoutId)
    .single();

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('=== FULL WORKOUT RECORD ===');
  console.log(JSON.stringify(data, null, 2));
}

main();
