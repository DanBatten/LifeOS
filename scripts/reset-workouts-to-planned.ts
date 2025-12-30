import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function main() {
  // Reset workouts from Dec 25-30 back to planned
  const dates = ['2025-12-25', '2025-12-26', '2025-12-28', '2025-12-30'];
  
  console.log('Resetting workouts to planned status...\n');
  
  for (const date of dates) {
    const { data, error } = await supabase
      .from('workouts')
      .update({
        status: 'planned',
        avg_heart_rate: null,
        max_heart_rate: null,
        actual_duration_minutes: null,
        splits: [],
        external_id: null,
        coach_notes: null,
        completed_at: null,
        device_data: {},
        training_load: null,
      })
      .eq('scheduled_date', date)
      .select('id, title, scheduled_date, status');
    
    if (error) {
      console.error(`Error resetting ${date}:`, error.message);
    } else if (data && data.length > 0) {
      console.log(`✅ ${date}: Reset "${data[0].title}" to ${data[0].status}`);
    } else {
      console.log(`⚠️  ${date}: No workout found`);
    }
  }
  
  console.log('\nDone! Verifying...\n');
  
  // Verify
  const { data: verify } = await supabase
    .from('workouts')
    .select('scheduled_date, status, title')
    .gte('scheduled_date', '2025-12-23')
    .lte('scheduled_date', '2025-12-31')
    .order('scheduled_date');
  
  for (const w of verify || []) {
    console.log(`${w.scheduled_date} | ${w.status} | ${w.title}`);
  }
}

main();
