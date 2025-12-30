import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function main() {
  const { data, error } = await supabase
    .from('workouts')
    .select('*')
    .gte('scheduled_date', '2025-12-23')
    .lte('scheduled_date', '2025-12-31')
    .order('scheduled_date', { ascending: true });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('\n=== WORKOUTS DEC 23-31, 2025 (DETAILED) ===\n');
  for (const w of data || []) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📅 ${w.scheduled_date} | ${(w.status || 'unknown').toUpperCase()}`);
    console.log(`   Title: ${w.title || 'No title'}`);
    console.log(`   Type: ${w.workout_type}`);
    console.log(`   ID: ${w.id}`);
    console.log(`   Garmin Activity ID: ${w.garmin_activity_id || 'NONE'}`);
    console.log(`   Distance: ${w.distance_miles || 'N/A'} mi`);
    console.log(`   Duration: ${w.duration_minutes || 'N/A'} min`);
    console.log(`   Avg HR: ${w.avg_heart_rate || 'N/A'}`);
    console.log(`   Avg Pace: ${w.avg_pace_per_mile || 'N/A'}`);
    console.log(`   Splits: ${w.splits ? JSON.stringify(w.splits).substring(0, 100) + '...' : 'NONE'}`);
    console.log(`   Athlete Feedback: ${w.athlete_feedback || 'NONE'}`);
    console.log(`   Coach Notes: ${w.coach_notes ? w.coach_notes.substring(0, 300) + '...' : 'NONE'}`);
    console.log(`   Updated: ${w.updated_at}`);
  }
  console.log(`\n\nTotal: ${data?.length || 0} workouts`);
}

main();
