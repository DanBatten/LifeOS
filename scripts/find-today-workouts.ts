import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const userId = process.env.USER_ID!;
const today = new Date().toISOString().split('T')[0];

async function main() {
  const { data: workouts, error } = await supabase
    .from('workouts')
    .select('id, title, scheduled_date, status, external_id, metadata')
    .eq('user_id', userId)
    .eq('scheduled_date', today);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Today's workouts (${today}):`);
  for (const w of workouts || []) {
    const meta = w.metadata as Record<string, unknown> | null;
    console.log(`- ID: ${w.id}`);
    console.log(`  Title: ${w.title}`);
    console.log(`  Status: ${w.status}`);
    console.log(`  External ID (Garmin): ${w.external_id || 'none'}`);
    console.log(`  Has metadata.laps: ${meta?.laps ? 'yes' : 'no'}`);
    console.log('');
  }
}

main();
