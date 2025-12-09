/**
 * Reschedule workouts to new cadence: Tue/Thu/Fri/Sun
 *
 * Run: npx tsx scripts/reschedule-workouts.ts
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envContent = readFileSync('.env.local', 'utf8');
function getEnvVar(name: string): string {
  const match = envContent.match(new RegExp(`^${name}=(.+)$`, 'm'));
  return match ? match[1].trim() : '';
}

const supabase = createClient(getEnvVar('SUPABASE_URL'), getEnvVar('SUPABASE_SERVICE_KEY'));

// New schedule: Tue=2, Thu=4, Fri=5, Sun=0
// Old schedule: Mon=1, Wed=3, Fri=5, Sat=6 or Sun=0

interface Workout {
  id: string;
  title: string;
  scheduled_date: string;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getDayName(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short' });
}

// Determine workout type from title
function getWorkoutRole(title: string): 'quality' | 'easy1' | 'easy2' | 'long' {
  const t = title.toLowerCase();
  if (t.includes('long') || t.includes('mi long')) return 'long';
  if (t.includes('threshold') || t.includes('tempo') || t.includes('interval') || t.includes('progression') || t.includes('marathon pace')) return 'quality';
  // For easy runs, check the day in title
  if (t.includes('wed')) return 'easy1';
  if (t.includes('fri')) return 'easy2';
  // Fallback based on distance
  return 'easy1';
}

// Map workout role to new day offset from week start (Monday)
// Tue=1, Thu=3, Fri=4, Sun=6
function getNewDayOffset(role: 'quality' | 'easy1' | 'easy2' | 'long'): number {
  switch (role) {
    case 'quality': return 1; // Tuesday
    case 'easy1': return 3;   // Thursday
    case 'easy2': return 4;   // Friday
    case 'long': return 6;    // Sunday
  }
}

async function reschedule() {
  console.log('\n📅 Rescheduling workouts to Tue/Thu/Fri/Sun\n');
  console.log('='.repeat(60) + '\n');

  // Get all future planned workouts
  const { data: workouts, error } = await supabase
    .from('workouts')
    .select('id, title, scheduled_date')
    .eq('status', 'planned')
    .gte('scheduled_date', '2025-12-08')
    .order('scheduled_date', { ascending: true });

  if (error) {
    console.error('Error:', error);
    return;
  }

  // Group by week
  const byWeek = new Map<string, Workout[]>();
  for (const w of workouts || []) {
    const date = new Date(w.scheduled_date + 'T12:00:00');
    const weekStart = formatDate(getWeekStart(date));
    if (!byWeek.has(weekStart)) byWeek.set(weekStart, []);
    byWeek.get(weekStart)!.push(w);
  }

  let updated = 0;

  for (const [weekStartStr, weekWorkouts] of byWeek) {
    const weekStart = new Date(weekStartStr + 'T12:00:00');
    console.log(`Week of ${weekStartStr} (${getDayName(weekStart)}):`);

    for (const workout of weekWorkouts) {
      const oldDate = new Date(workout.scheduled_date + 'T12:00:00');
      const role = getWorkoutRole(workout.title);
      const newOffset = getNewDayOffset(role);
      const newDate = addDays(weekStart, newOffset);
      const newDateStr = formatDate(newDate);

      const oldDay = getDayName(oldDate);
      const newDay = getDayName(newDate);

      if (workout.scheduled_date === newDateStr) {
        console.log(`  ✓ ${workout.title.substring(0, 40)}`);
        console.log(`    Already on ${newDay} ${newDateStr}`);
        continue;
      }

      console.log(`  → ${workout.title.substring(0, 40)}`);
      console.log(`    ${oldDay} ${workout.scheduled_date} → ${newDay} ${newDateStr}`);

      // Update the workout
      const { error: updateError } = await supabase
        .from('workouts')
        .update({ scheduled_date: newDateStr })
        .eq('id', workout.id);

      if (updateError) {
        console.log(`    ❌ Error: ${updateError.message}`);
      } else {
        console.log(`    ✅ Updated`);
        updated++;
      }
    }
    console.log('');
  }

  console.log('='.repeat(60));
  console.log(`\n📊 Updated ${updated} workouts\n`);
}

reschedule();
