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
    .select('id, title, scheduled_date, status')
    .order('scheduled_date', { ascending: true })
    .limit(30);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Workouts in DB (raw scheduled_date values):');
  for (const w of data || []) {
    const title = w.title ? w.title.substring(0, 40) : 'No title';
    console.log(`  ${w.scheduled_date} | ${title} | ${w.status}`);
  }
}

main();
