import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function check() {
  // Check whiteboard entries
  const { data: whiteboard, error: wbError } = await supabase
    .from('whiteboard')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('=== WHITEBOARD ENTRIES ===');
  if (wbError) {
    console.log('Error or no whiteboard table:', wbError.message);
  } else {
    console.log('Found:', whiteboard?.length || 0, 'entries');
    if (whiteboard) {
      for (const w of whiteboard) {
        console.log(JSON.stringify(w, null, 2));
      }
    }
  }

  // Check training_weeks table
  const { data: weeks, error: weeksError } = await supabase
    .from('training_weeks')
    .select('*')
    .order('week_number', { ascending: false })
    .limit(5);

  console.log('\n=== TRAINING WEEKS ===');
  if (weeksError) {
    console.log('Error or no training_weeks table:', weeksError.message);
  } else {
    console.log('Found:', weeks?.length || 0, 'weeks');
    if (weeks) {
      for (const w of weeks) {
        console.log('Week', w.week_number, '- Coach Summary:', w.coach_summary ? 'YES' : 'NO');
      }
    }
  }

  // Check training_phases table
  const { data: phases, error: phasesError } = await supabase
    .from('training_phases')
    .select('*')
    .limit(5);

  console.log('\n=== TRAINING PHASES ===');
  if (phasesError) {
    console.log('Error or no training_phases table:', phasesError.message);
  } else {
    console.log('Found:', phases?.length || 0, 'phases');
  }

  // Check if workouts have any week-level summaries
  const { data: workoutsWithNotes, error: wError } = await supabase
    .from('workouts')
    .select('week_number, coach_notes')
    .not('coach_notes', 'is', null)
    .order('week_number', { ascending: false });

  console.log('\n=== WORKOUTS WITH COACH NOTES BY WEEK ===');
  if (wError) {
    console.log('Error:', wError.message);
  } else {
    const byWeek = new Map<number, number>();
    workoutsWithNotes?.forEach(w => {
      if (w.week_number) {
        byWeek.set(w.week_number, (byWeek.get(w.week_number) || 0) + 1);
      }
    });
    console.log('Weeks with coach notes:');
    byWeek.forEach((count, week) => {
      console.log(`  Week ${week}: ${count} workouts`);
    });
  }
}

check();
