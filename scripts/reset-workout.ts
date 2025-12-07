import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function resetWorkout() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  // Reset the synced workout back to planned state
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
      source: 'manual',
      metadata: {},
      coach_notes: null
    })
    .eq('external_id', '21195169024')
    .select('id, title');

  if (error) {
    console.error('Error:', error.message);
  } else {
    console.log('✓ Reset workout to planned state:', data);
  }
}

resetWorkout();
