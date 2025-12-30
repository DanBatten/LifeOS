import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function main() {
  console.log('=== Current State ===\n');
  
  // Get all workouts Dec 23-31
  const { data: workouts } = await supabase
    .from('workouts')
    .select('*')
    .gte('scheduled_date', '2025-12-23')
    .lte('scheduled_date', '2025-12-31')
    .order('scheduled_date');
  
  for (const w of workouts || []) {
    console.log(`${w.scheduled_date} | ${w.status} | ${w.title}`);
    if (w.external_id) console.log(`  Garmin ID: ${w.external_id}`);
    if (w.actual_duration_minutes) console.log(`  Duration: ${w.actual_duration_minutes} min`);
  }
  
  console.log('\n=== Applying Fixes ===\n');
  
  // FIX 1: Dec 23 MP run - Mark as completed (ran on Dec 25 due to travel)
  // The Garmin activity from Dec 25 (6.75mi @ 6:58) was this workout
  const dec23Fix = await supabase
    .from('workouts')
    .update({
      status: 'completed',
      completed_at: '2025-12-25T09:00:00+13:00', // NZT
      actual_duration_minutes: 47, // ~6.75mi @ 6:58
      avg_heart_rate: 156,
      max_heart_rate: 177,
      coach_notes: `**Completed Dec 25 NZT (rescheduled from Dec 23 due to travel)**

Flew to NZ on Dec 22, landed Dec 24 morning. Ran this MP workout on Dec 25 while jetlagged.

**Execution:** 6.75 mi @ 6:58/mi avg, 156 bpm avg, 177 max
- Ran faster than easy pace but felt aerobically inefficient due to jetlag
- HR elevated for the effort level (156 avg for sub-7 pace indicates stress)
- Got through it despite travel fatigue - good mental toughness

**Coaching Note:** Smart to delay this workout until after arrival rather than skip entirely. The elevated HR was expected given jetlag. Adaptation still occurred.`,
      personal_notes: 'Jetlagged from NZ travel. Felt inefficient aerobically but pushed through.',
    })
    .eq('scheduled_date', '2025-12-23')
    .select('title');
  
  console.log('✅ Dec 23 (MP Run):', dec23Fix.data?.[0]?.title || 'not found');
  
  // FIX 2: Dec 25 Easy Run - Mark as SKIPPED (the MP run was done on this day instead)
  const dec25Fix = await supabase
    .from('workouts')
    .update({
      status: 'skipped',
      coach_notes: `**Skipped - Travel Week Compression**

This easy run was skipped as the athlete used this day to complete the Dec 23 MP workout that was delayed due to international travel (arrived NZ on Dec 24).

Smart prioritization: Getting in the quality MP work was more important than this easy mileage.`,
    })
    .eq('scheduled_date', '2025-12-25')
    .select('title');
  
  console.log('✅ Dec 25 (Easy):', dec25Fix.data?.[0]?.title || 'not found');
  
  // FIX 3: Dec 26 Easy Run - Completed, felt good
  const dec26Fix = await supabase
    .from('workouts')
    .update({
      status: 'completed',
      completed_at: '2025-12-26T09:00:00+13:00',
      actual_duration_minutes: 34, // 3.89mi @ 8:44
      avg_heart_rate: 130,
      coach_notes: `**Good Recovery Run**

**Execution:** 3.89 mi @ 8:44/mi, 130 bpm avg
- Truly easy effort with excellent HR control (130 bpm)
- Slightly shorter than prescribed 5mi - appropriate given jetlag recovery
- Skipped strides - smart call while still adapting to timezone

**Coaching Note:** This is exactly how easy runs should feel. The low HR indicates good aerobic efficiency despite recent travel stress. Body recovering well.`,
      personal_notes: 'Easy run, felt good. Keeping it short while adjusting to NZ timezone.',
    })
    .eq('scheduled_date', '2025-12-26')
    .select('title');
  
  console.log('✅ Dec 26 (Easy):', dec26Fix.data?.[0]?.title || 'not found');
  
  // FIX 4: Dec 28 Long Run - Cut short but felt good
  const dec28Fix = await supabase
    .from('workouts')
    .update({
      status: 'completed',
      completed_at: '2025-12-28T08:00:00+13:00',
      actual_duration_minutes: 90, // ~11.6mi @ 7:44
      avg_heart_rate: 147,
      max_heart_rate: 160,
      coach_notes: `**Long Run - Smart Modification**

**Prescribed:** 15 mi progressive (12 @ 8:00, last 3 @ 6:30 MP)
**Actual:** 11.63 mi @ 7:44/mi avg, 147 bpm avg, 160 max

**Decision Making:** Cut 3.4 miles short due to:
- Poor sleep quality
- Low HRV reading
- Elevated RHR

**Execution Assessment:** Despite cutting distance, the effort was solid. Ran slightly faster than prescribed easy pace (7:44 vs 8:00) but didn't push the MP finish given the recovery signals.

**Coaching Note:** This was the RIGHT call. With compromised biometrics, completing 11.6 miles at a controlled effort preserves training adaptations without digging into recovery reserves. You listened to your body - exactly what marathon training requires.`,
      personal_notes: 'Cut short due to poor sleep and low HRV. Run itself felt pretty good throughout.',
    })
    .eq('scheduled_date', '2025-12-28')
    .select('title');
  
  console.log('✅ Dec 28 (Long Run):', dec28Fix.data?.[0]?.title || 'not found');
  
  // FIX 5: Dec 30 Intervals - Challenging but felt good
  const dec30Fix = await supabase
    .from('workouts')
    .update({
      status: 'completed',
      completed_at: '2025-12-30T09:00:00+13:00',
      actual_duration_minutes: 51,
      avg_heart_rate: 163,
      max_heart_rate: 185,
      coach_notes: `**3×12 min Intervals - Strong Execution**

**Prescribed:** 3×12 min @ 6:12/mi (8 mi total with warmup)
**Actual:** 7.58 mi @ 6:44/mi avg, 163 bpm avg, 185 max

**Execution:** Challenging workout but executed well. The avg pace of 6:44 across the full run (including warmup/cooldown) suggests interval segments were at or near target 6:12 pace.

**Athlete Feedback:** "Hard but felt good" - exactly how Week 14 intervals should feel at this point in the build.

**Coaching Note:** Despite travel fatigue still lingering, you showed up and executed a quality session. The 185 max HR indicates you were working hard in the intervals. Good sign for race fitness.`,
      personal_notes: 'Challenging but felt good. Had a few quick breaks in the last interval but overall strong.',
    })
    .eq('scheduled_date', '2025-12-30')
    .select('title');
  
  console.log('✅ Dec 30 (Intervals):', dec30Fix.data?.[0]?.title || 'not found');
  
  // Also skip the second easy run that was missed
  const dec27Check = await supabase
    .from('workouts')
    .select('*')
    .eq('scheduled_date', '2025-12-27');
  
  if (dec27Check.data && dec27Check.data.length > 0) {
    const dec27Fix = await supabase
      .from('workouts')
      .update({
        status: 'skipped',
        coach_notes: `**Skipped - Travel Week Compression**

Second easy run of the week skipped due to compressed schedule from international travel. With the timezone shift and delayed workouts, prioritizing quality sessions over volume was the right call.`,
      })
      .eq('scheduled_date', '2025-12-27')
      .select('title');
    
    console.log('✅ Dec 27 (if exists):', dec27Fix.data?.[0]?.title || 'no workout');
  }
  
  console.log('\n=== Final State ===\n');
  
  const { data: final } = await supabase
    .from('workouts')
    .select('scheduled_date, status, title, coach_notes')
    .gte('scheduled_date', '2025-12-23')
    .lte('scheduled_date', '2025-12-31')
    .order('scheduled_date');
  
  for (const w of final || []) {
    console.log(`${w.scheduled_date} | ${w.status.toUpperCase().padEnd(9)} | ${w.title}`);
    if (w.coach_notes) {
      const firstLine = w.coach_notes.split('\n')[0];
      console.log(`  └─ ${firstLine}`);
    }
  }
}

main();
