import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function main() {
  // Find all planned workouts
  const { data, error } = await supabase
    .from('workouts')
    .select('id, title, scheduled_date, status')
    .eq('status', 'planned')
    .order('scheduled_date', { ascending: true });

  if (error) {
    console.error('Error:', error);
    return;
  }

  // Group by date
  const byDate = new Map<string, typeof data>();
  for (const w of data || []) {
    const date = w.scheduled_date;
    const existing = byDate.get(date) || [];
    existing.push(w);
    byDate.set(date, existing);
  }

  console.log('Dates with multiple planned workouts:\n');
  const duplicateIds: string[] = [];

  for (const [date, workouts] of byDate) {
    if (workouts.length > 1) {
      console.log(`${date} (${workouts.length} workouts):`);
      for (const w of workouts) {
        const title = w.title ? w.title.substring(0, 45) : 'No title';
        console.log(`  - ${w.id.substring(0, 8)} | ${title}`);

        // Mark workouts that have wrong day in title (e.g., "Week 12 — Wed" on a Friday)
        const dayOfWeek = new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' });
        const titleDay = w.title?.match(/— (Mon|Tue|Wed|Thu|Fri|Sat|Sun)/)?.[1];
        if (titleDay && !dayOfWeek.startsWith(titleDay.substring(0, 3))) {
          console.log(`    ^ MISMATCH: Title says ${titleDay} but date is ${dayOfWeek}`);
          duplicateIds.push(w.id);
        }
      }
      console.log('');
    }
  }

  console.log('\nWorkout IDs to potentially delete (mismatched day in title):');
  console.log(duplicateIds.join('\n'));
}

main();
