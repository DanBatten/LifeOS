import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

type Args = {
  id: string | null;
  yes: boolean;
  dryRun: boolean;
};

function parseArgs(argv: string[]): Args {
  const args: Args = { id: null, yes: false, dryRun: false };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--id') args.id = argv[i + 1] ?? null;
    if (a === '--yes') args.yes = true;
    if (a === '--dry-run') args.dryRun = true;
  }

  return args;
}

function sanitizeMetadata(metadata: unknown): Record<string, unknown> {
  const base: Record<string, unknown> =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? { ...(metadata as Record<string, unknown>) }
      : {};

  // Remove Garmin/execution keys while preserving training-plan metadata like phase/notion_id/week_number.
  const keysToRemove = [
    'garmin',
    'garmin_activity_id',
    'actual_distance_miles',
    'actual_pace',
    'elevation_gain_ft',
    'cadence_avg',
    'laps',
    'syncedAt',
  ];

  for (const k of keysToRemove) delete base[k];
  return base;
}

function pickExistingColumns<T extends Record<string, unknown>>(
  update: T,
  existingRow: Record<string, unknown>
): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(update)) {
    if (k in existingRow) (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

async function main() {
  const { id, yes, dryRun } = parseArgs(process.argv.slice(2));

  if (!id) {
    console.error('Usage: tsx scripts/uncomplete-workout.ts --id <workout-uuid> [--yes] [--dry-run]');
    process.exit(1);
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    console.error('Missing env vars. Ensure SUPABASE_URL and SUPABASE_SERVICE_KEY are set (e.g. in .env.local).');
    process.exit(1);
  }

  const supabase = createClient(url, key);

  const { data: before, error: beforeError } = await supabase
    .from('workouts')
    // Use '*' so this works across DBs that may not yet have newer columns.
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (beforeError) {
    console.error('Error fetching workout:', beforeError);
    process.exit(1);
  }

  if (!before) {
    console.error(`No workout found for id ${id}`);
    process.exit(1);
  }

  console.log('=== BEFORE ===');
  console.log(
    JSON.stringify(
      {
        id: before.id,
        title: (before.title as string | undefined) ?? null,
        scheduled_date: (before.scheduled_date as string | undefined) ?? null,
        status: (before.status as string | undefined) ?? null,
        started_at: (before.started_at as string | undefined) ?? null,
        completed_at: (before.completed_at as string | undefined) ?? null,
        prescribed_distance_miles:
          (before.prescribed_distance_miles as number | undefined) ?? null,
        actual_duration_minutes:
          (before.actual_duration_minutes as number | undefined) ?? null,
        external_id: (before.external_id as string | undefined) ?? null,
        garmin_activity_id: (before.garmin_activity_id as string | undefined) ?? null,
        source: (before.source as string | undefined) ?? null,
      },
      null,
      2
    )
  );

  const desiredUpdate = {
    status: 'planned',
    started_at: null,
    completed_at: null,
    actual_duration_minutes: null,
    actual_intensity: null,
    rpe: null,
    avg_heart_rate: null,
    max_heart_rate: null,
    calories_burned: null,
    coach_notes: null,
    key_observations: null,
    recommendations: null,
    adaptation_triggers: null,
    execution_score: null,
    external_id: null,
    garmin_activity_id: null,
    source: 'manual',
    metadata: sanitizeMetadata(before.metadata),
  } as const;

  // Only include columns that actually exist in the connected database.
  const update = pickExistingColumns(desiredUpdate as Record<string, unknown>, before as Record<string, unknown>);

  if (dryRun) {
    console.log('=== DRY RUN (no update applied) ===');
    console.log(JSON.stringify(update, null, 2));
    return;
  }

  if (!yes) {
    console.error('Refusing to update without --yes. Re-run with --yes to apply.');
    process.exit(1);
  }

  // Some environments may have PostgREST schema cache drift or partially-applied migrations.
  // If we hit "column does not exist", iteratively drop that field and retry.
  let payload: Record<string, unknown> = { ...(update as Record<string, unknown>) };
  let after: Record<string, unknown> | null = null;

  for (let attempt = 0; attempt < 10; attempt++) {
    const { data, error } = await supabase
      .from('workouts')
      .update(payload)
      .eq('id', id)
      // Select a minimal set of guaranteed base columns.
      .select('id, title, scheduled_date, status, started_at, completed_at, source, updated_at')
      .single();

    if (!error) {
      after = data as Record<string, unknown>;
      break;
    }

    const message = (error as { message?: string; code?: string }).message || '';
    const code = (error as { code?: string }).code;

    // Example: "column workouts.garmin_activity_id does not exist"
    const m = message.match(/column\s+workouts\.([a-zA-Z0-9_]+)\s+does not exist/);
    const missingColumn = m?.[1];

    if (code === '42703' && missingColumn && missingColumn in payload) {
      console.warn(`Warning: DB missing column "${missingColumn}". Dropping it from update payload and retrying...`);
      delete payload[missingColumn];
      continue;
    }

    console.error('Error updating workout:', error);
    process.exit(1);
  }

  if (!after) {
    console.error('Failed to update workout after retries.');
    process.exit(1);
  }

  console.log('=== AFTER ===');
  console.log(JSON.stringify(after, null, 2));
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});


