/**
 * Backfill Workout Splits
 * 
 * This script identifies completed runs that are missing splits/laps data
 * and attempts to fetch it from Garmin.
 * 
 * Usage:
 *   npx tsx scripts/backfill-workout-splits.ts [--dry-run] [--limit N]
 * 
 * Options:
 *   --dry-run   Show which workouts would be updated without making changes
 *   --limit N   Only process N workouts (default: all)
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const USER_ID = process.env.USER_ID || '00000000-0000-0000-0000-000000000001';

// Garmin credentials
const GARMIN_EMAIL = process.env.GARMIN_EMAIL;
const GARMIN_PASSWORD = process.env.GARMIN_PASSWORD;
const GARMIN_OAUTH1_TOKEN = process.env.GARMIN_OAUTH1_TOKEN;
const GARMIN_OAUTH2_TOKEN = process.env.GARMIN_OAUTH2_TOKEN;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitIndex = args.indexOf('--limit');
const limit = limitIndex >= 0 ? parseInt(args[limitIndex + 1]) : null;

interface WorkoutWithMissingSplits {
  id: string;
  title: string;
  scheduled_date: string;
  external_id: string | null;
  metadata: Record<string, unknown>;
  splits: unknown[] | null;
}

async function findWorkoutsWithoutSplits(): Promise<WorkoutWithMissingSplits[]> {
  console.log('\n🔍 Finding completed runs without splits data...\n');
  
  const { data, error } = await supabase
    .from('workouts')
    .select('id, title, scheduled_date, external_id, metadata, splits')
    .eq('user_id', USER_ID)
    .eq('status', 'completed')
    .not('external_id', 'is', null) // Must have a Garmin activity ID
    .order('scheduled_date', { ascending: false });
  
  if (error) {
    console.error('❌ Error fetching workouts:', error);
    return [];
  }
  
  // Filter to workouts without splits
  const withoutSplits = (data || []).filter(w => {
    const splits = w.splits as unknown[];
    const metadataLaps = (w.metadata as Record<string, unknown>)?.laps as unknown[];
    
    const hasSplits = splits && Array.isArray(splits) && splits.length > 0;
    const hasMetadataLaps = metadataLaps && Array.isArray(metadataLaps) && metadataLaps.length > 0;
    
    return !hasSplits && !hasMetadataLaps;
  });
  
  return withoutSplits;
}

async function connectToGarmin(): Promise<{
  getActivitySplits: (activityId: number) => Promise<unknown[]>;
  getActivity: (activityId: number) => Promise<Record<string, unknown>>;
  disconnect: () => void;
} | null> {
  try {
    // Dynamic import to avoid bundling issues
    const GarminConnectPkg = await import('garmin-connect');
    const GarminConnect = GarminConnectPkg.default?.GarminConnect || GarminConnectPkg.GarminConnect;
    
    const client = new GarminConnect({
      username: GARMIN_EMAIL,
      password: GARMIN_PASSWORD,
    });
    
    // Try to restore tokens first
    if (GARMIN_OAUTH1_TOKEN && GARMIN_OAUTH2_TOKEN) {
      try {
        const oauth1 = JSON.parse(GARMIN_OAUTH1_TOKEN);
        const oauth2 = JSON.parse(GARMIN_OAUTH2_TOKEN);
        client.restoreOrRefreshToken(oauth1, oauth2);
        console.log('✅ Restored Garmin tokens');
      } catch {
        console.log('⚠️ Could not restore tokens, will try login...');
        await client.login();
      }
    } else {
      await client.login();
    }
    
    return {
      getActivitySplits: async (activityId: number) => {
        try {
          const response = await client.get(
            `https://connect.garmin.com/modern/proxy/activity-service/activity/${activityId}/splits`
          );
          return normalizeSplits(response);
        } catch {
          return [];
        }
      },
      getActivity: async (activityId: number) => {
        try {
          return await client.getActivity({ activityId }) as Record<string, unknown>;
        } catch {
          return {};
        }
      },
      disconnect: () => {
        // No explicit disconnect needed
      },
    };
  } catch (error) {
    console.error('❌ Failed to connect to Garmin:', error);
    return null;
  }
}

function normalizeSplits(raw: unknown): unknown[] {
  if (!raw) return [];
  
  if (Array.isArray(raw)) {
    return raw.map((lap, idx) => normalizeLap(lap, idx + 1));
  }
  
  const obj = raw as Record<string, unknown>;
  const lapArray = obj.lapDTOs || obj.splits || obj.laps || obj.splitSummaries || [];
  
  if (Array.isArray(lapArray)) {
    return lapArray.map((lap, idx) => normalizeLap(lap, idx + 1));
  }
  
  return [];
}

function normalizeLap(lap: unknown, index: number): Record<string, unknown> {
  const l = lap as Record<string, unknown>;
  
  const durationSec = (l.duration || l.elapsedDuration || l.movingDuration || 0) as number;
  const distanceM = (l.distance || l.totalDistance || 0) as number;
  const distanceMi = distanceM / 1609.34;
  
  let pacePerMile: string | null = null;
  if (distanceMi > 0 && durationSec > 0) {
    const paceSeconds = durationSec / distanceMi;
    pacePerMile = `${Math.floor(paceSeconds / 60)}:${String(Math.round(paceSeconds % 60)).padStart(2, '0')}/mi`;
  }
  
  return {
    lapNumber: index,
    distanceMiles: Math.round(distanceMi * 100) / 100,
    durationSeconds: durationSec,
    pacePerMile,
    avgHeartRate: l.averageHR || l.avgHeartRate,
    maxHeartRate: l.maxHR || l.maxHeartRate,
    avgCadence: l.averageRunCadence || l.avgCadence || l.averageCadence,
    elevationGainFt: l.elevationGain ? Math.round((l.elevationGain as number) * 3.28084) : undefined,
  };
}

async function backfillSplits() {
  console.log('═'.repeat(60));
  console.log('  BACKFILL WORKOUT SPLITS');
  console.log('═'.repeat(60));
  
  if (dryRun) {
    console.log('🔵 DRY RUN MODE - No changes will be made\n');
  }
  
  // Find workouts without splits
  const workouts = await findWorkoutsWithoutSplits();
  
  if (workouts.length === 0) {
    console.log('✅ All completed runs already have splits data!');
    return;
  }
  
  console.log(`Found ${workouts.length} workouts without splits:\n`);
  
  for (const w of workouts) {
    const activityId = w.external_id || (w.metadata as Record<string, unknown>)?.garmin_activity_id;
    console.log(`  📅 ${w.scheduled_date} | ${w.title?.substring(0, 40)}`);
    console.log(`     Garmin ID: ${activityId || 'N/A'}`);
  }
  
  if (dryRun) {
    console.log('\n🔵 DRY RUN - Would attempt to fetch splits for these workouts');
    return;
  }
  
  // Connect to Garmin
  console.log('\n📡 Connecting to Garmin...');
  const garmin = await connectToGarmin();
  
  if (!garmin) {
    console.log('\n❌ Could not connect to Garmin. Splits cannot be fetched.');
    console.log('   Make sure GARMIN_EMAIL/PASSWORD or OAuth tokens are configured.');
    return;
  }
  
  console.log('✅ Connected to Garmin\n');
  
  // Process workouts
  const toProcess = limit ? workouts.slice(0, limit) : workouts;
  let updated = 0;
  let failed = 0;
  
  for (const workout of toProcess) {
    const activityId = workout.external_id || 
      (workout.metadata as Record<string, unknown>)?.garmin_activity_id as string;
    
    if (!activityId) {
      console.log(`⏭️  Skipping ${workout.scheduled_date} - no Garmin activity ID`);
      failed++;
      continue;
    }
    
    console.log(`\n📊 Processing: ${workout.scheduled_date} | ${workout.title?.substring(0, 35)}...`);
    
    // Try splits endpoint first
    let splits = await garmin.getActivitySplits(parseInt(activityId));
    
    // If no splits, try activity details
    if (splits.length === 0) {
      console.log('   Splits endpoint empty, trying activity details...');
      const details = await garmin.getActivity(parseInt(activityId));
      
      const embeddedSplits = details.splitSummaries || details.splits || details.laps;
      if (Array.isArray(embeddedSplits) && embeddedSplits.length > 0) {
        splits = embeddedSplits.map((s, idx) => normalizeLap(s, idx + 1));
      }
    }
    
    if (splits.length === 0) {
      console.log('   ⚠️  No splits available from Garmin');
      failed++;
      continue;
    }
    
    console.log(`   ✅ Found ${splits.length} splits`);
    
    // Preview first few splits
    for (const split of splits.slice(0, 3)) {
      const s = split as Record<string, unknown>;
      console.log(`      Mile ${s.lapNumber}: ${s.pacePerMile} | ${s.avgHeartRate || '?'} bpm`);
    }
    if (splits.length > 3) {
      console.log(`      ... and ${splits.length - 3} more`);
    }
    
    // Update the workout
    const existingMetadata = workout.metadata || {};
    const updatedMetadata = {
      ...existingMetadata,
      laps: splits,
      splitsBackfilledAt: new Date().toISOString(),
    };
    
    const { error } = await supabase
      .from('workouts')
      .update({
        splits: splits,
        metadata: updatedMetadata,
      })
      .eq('id', workout.id);
    
    if (error) {
      console.log(`   ❌ Failed to update: ${error.message}`);
      failed++;
    } else {
      console.log('   💾 Saved to database');
      updated++;
    }
    
    // Rate limiting - be nice to Garmin API
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  garmin.disconnect();
  
  console.log('\n' + '═'.repeat(60));
  console.log('  SUMMARY');
  console.log('═'.repeat(60));
  console.log(`  ✅ Updated: ${updated} workouts`);
  console.log(`  ⚠️  Failed/Skipped: ${failed} workouts`);
  console.log(`  📊 Total processed: ${toProcess.length} workouts`);
  console.log('═'.repeat(60) + '\n');
}

backfillSplits().catch(console.error);

