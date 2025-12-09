/**
 * Sync Marathon Training Plan from Notion API
 *
 * Run: npx tsx scripts/sync-notion-workouts.ts
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Load env manually to avoid dotenv issues
const envContent = readFileSync('.env.local', 'utf8');
function getEnvVar(name: string): string {
  const match = envContent.match(new RegExp(`^${name}=(.+)$`, 'm'));
  return match ? match[1].trim() : '';
}

const NOTION_API_KEY = getEnvVar('NOTION_API_KEY');
const NOTION_DATABASE_ID = '6057e16c12e34889aaf4b341b56e4638';
const SUPABASE_URL = getEnvVar('SUPABASE_URL');
const SUPABASE_SERVICE_KEY = getEnvVar('SUPABASE_SERVICE_KEY');
const USER_ID = getEnvVar('USER_ID') || '00000000-0000-0000-0000-000000000001';

if (!NOTION_API_KEY) {
  console.error('Missing NOTION_API_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface NotionWorkout {
  id: string;
  title: string;
  date: string;
  week: number;
  phase: string;
  workoutType: string;
  distance: number | null;
  paceNotes: string | null;
  state: string;
  coachNotes: string | null;
}

async function queryNotion(startCursor?: string): Promise<any> {
  const body: any = {
    filter: {
      property: 'Type',
      select: {
        equals: 'Workout'
      }
    },
    sorts: [
      {
        property: 'Date',
        direction: 'ascending'
      }
    ],
    page_size: 100
  };

  if (startCursor) {
    body.start_cursor = startCursor;
  }

  const response = await fetch(`https://api.notion.com/v1/databases/${NOTION_DATABASE_ID}/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${NOTION_API_KEY}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Notion API error: ${response.status} - ${error}`);
  }

  return response.json();
}

async function fetchNotionWorkouts(): Promise<NotionWorkout[]> {
  console.log('📥 Fetching workouts from Notion...\n');

  const workouts: NotionWorkout[] = [];
  let hasMore = true;
  let startCursor: string | undefined;

  while (hasMore) {
    const response = await queryNotion(startCursor);

    for (const page of response.results) {
      const props = page.properties;

      // Extract title from "Event" property
      let title = '';
      if (props.Event?.title?.[0]?.plain_text) {
        title = props.Event.title[0].plain_text;
      }

      // Extract date
      let date = '';
      if (props.Date?.date?.start) {
        date = props.Date.date.start;
      }

      // Extract week number
      let week = 0;
      if (props.Week?.number) {
        week = props.Week.number;
      }

      // Extract phase
      let phase = '';
      if (props.Phase?.select?.name) {
        phase = props.Phase.select.name;
      }

      // Extract workout type
      let workoutType = '';
      if (props['Workout Type']?.select?.name) {
        workoutType = props['Workout Type'].select.name;
      }

      // Extract distance
      let distance: number | null = null;
      if (props['Distance (mi)']?.number) {
        distance = props['Distance (mi)'].number;
      }

      // Extract pace/notes
      let paceNotes: string | null = null;
      if (props['Pace/Notes']?.rich_text?.[0]?.plain_text) {
        paceNotes = props['Pace/Notes'].rich_text[0].plain_text;
      }

      // Extract state
      let state = '';
      if (props.State?.select?.name) {
        state = props.State.select.name;
      }

      // Extract coach notes
      let coachNotes: string | null = null;
      if (props['Coach Notes']?.rich_text?.[0]?.plain_text) {
        coachNotes = props['Coach Notes'].rich_text[0].plain_text;
      }

      if (title && date) {
        workouts.push({
          id: page.id,
          title,
          date,
          week,
          phase,
          workoutType,
          distance,
          paceNotes,
          state,
          coachNotes
        });
      }
    }

    hasMore = response.has_more;
    startCursor = response.next_cursor || undefined;
  }

  console.log(`   Found ${workouts.length} workouts in Notion\n`);
  return workouts;
}

function parseWorkoutType(_type: string): string {
  // Database enum only accepts 'run' - store specific type in metadata
  return 'run';
}

function getWorkoutSubtype(type: string): string {
  const t = type?.toLowerCase() || 'easy';
  if (t.includes('tempo') || t.includes('threshold')) return 'tempo';
  if (t.includes('interval')) return 'intervals';
  if (t.includes('long')) return 'long_run';
  if (t.includes('progression')) return 'progression';
  if (t.includes('easy')) return 'easy';
  if (t.includes('recovery')) return 'recovery';
  return 'easy';
}

function parseStatus(state: string): string {
  const s = state?.toLowerCase() || '';
  if (s.includes('done') || s.includes('completed')) return 'completed';
  if (s.includes('did not') || s.includes('skipped')) return 'skipped';
  return 'planned';
}

function parsePace(paceNotes: string | null): string | null {
  if (!paceNotes) return null;
  // Extract pace like "8:00/mi" or "6:30-6:40/mi"
  const match = paceNotes.match(/(\d+:\d+(?:-\d+:\d+)?)\/?mi/i);
  return match ? match[1] + '/mi' : paceNotes;
}

async function syncWorkouts(notionWorkouts: NotionWorkout[]) {
  console.log('🔄 Syncing future planned workouts to Supabase...\n');

  // Get today's date
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // Filter to future planned workouts only
  const futureWorkouts = notionWorkouts.filter(w => {
    return w.date >= todayStr && parseStatus(w.state) === 'planned';
  });

  console.log(`   Found ${futureWorkouts.length} future planned workouts\n`);

  // Get existing plan ID
  const { data: existingPlan } = await supabase
    .from('training_plans')
    .select('id')
    .eq('user_id', USER_ID)
    .single();

  const planId = existingPlan?.id;

  // Delete existing future planned workouts
  console.log('   Removing old future planned workouts...');
  const { error: deleteError } = await supabase
    .from('workouts')
    .delete()
    .eq('user_id', USER_ID)
    .eq('status', 'planned')
    .gte('scheduled_date', todayStr);

  if (deleteError) {
    console.error('   ❌ Failed to delete:', deleteError.message);
    return;
  }

  // Insert new workouts
  console.log('   Inserting workouts from Notion...\n');

  let inserted = 0;
  let failed = 0;

  for (const w of futureWorkouts) {
    const workoutData = {
      user_id: USER_ID,
      plan_id: planId,
      title: w.title,
      workout_type: parseWorkoutType(w.workoutType),
      scheduled_date: w.date.split('T')[0],
      status: 'planned',
      prescribed_distance_miles: w.distance,
      prescribed_pace_per_mile: parsePace(w.paceNotes),
      prescribed_description: w.paceNotes,
      notes: w.coachNotes,
      metadata: {
        notion_id: w.id,
        week_number: w.week,
        phase: w.phase,
        workout_subtype: getWorkoutSubtype(w.workoutType),
        synced_at: new Date().toISOString()
      }
    };

    const { error } = await supabase
      .from('workouts')
      .insert(workoutData);

    if (error) {
      console.error(`   ❌ ${w.title} (${w.date}):`, error.message);
      failed++;
    } else {
      const dayName = new Date(w.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' });
      console.log(`   ✅ ${w.date} (${dayName}): ${w.title}`);
      inserted++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Inserted: ${inserted}`);
  if (failed > 0) {
    console.log(`   ❌ Failed: ${failed}`);
  }
}

async function main() {
  console.log('\n🏃 Notion → Supabase Workout Sync\n');
  console.log('='.repeat(50) + '\n');

  try {
    const notionWorkouts = await fetchNotionWorkouts();

    // Show what we found
    console.log('📅 Workouts by week:\n');
    const byWeek = new Map<number, NotionWorkout[]>();
    for (const w of notionWorkouts) {
      const existing = byWeek.get(w.week) || [];
      existing.push(w);
      byWeek.set(w.week, existing);
    }

    for (const [week, workouts] of Array.from(byWeek.entries()).sort((a, b) => a[0] - b[0])) {
      const completed = workouts.filter(w => parseStatus(w.state) === 'completed').length;
      const planned = workouts.filter(w => parseStatus(w.state) === 'planned').length;
      console.log(`   Week ${week}: ${workouts.length} workouts (${completed} done, ${planned} planned)`);
    }

    console.log('');

    await syncWorkouts(notionWorkouts);

    console.log('\n✨ Sync complete!\n');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
