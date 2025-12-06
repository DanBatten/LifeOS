#!/usr/bin/env npx tsx
/**
 * Garmin Data Backfill Script
 * 
 * Pulls historical data from Garmin Connect and populates the LifeOS database
 * with health snapshots, workouts, and calculated baselines.
 * 
 * Usage:
 *   npx tsx scripts/garmin-backfill.ts
 * 
 * Options:
 *   --days=365      Number of days to backfill (default: 365)
 *   --dry-run       Print what would be done without writing to DB
 *   --skip-health   Skip health data sync
 *   --skip-activities Skip activities sync
 *   --calculate-only Only calculate baselines from existing data
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local (apps/web) and root .env
config({ path: resolve(process.cwd(), 'apps/web/.env.local') });
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { 
  createGarminClient, 
  GarminMCPClient,
  formatDateString,
  metersToMiles,
  formatPace,
  type GarminActivity,
  type GarminDailySummary,
  type GarminSleepData,
  type GarminHRVData,
} from '@lifeos/garmin';

// ===========================================
// Configuration
// ===========================================

interface BackfillConfig {
  daysBack: number;
  dryRun: boolean;
  skipHealth: boolean;
  skipActivities: boolean;
  calculateOnly: boolean;
  userId: string;
}

// Known lower-volume periods to flag (not exclude)
const LOW_VOLUME_PERIODS = [
  { start: '2024-03-15', end: '2024-04-15', reason: 'Post-NY Half + Recovery' },
  { start: '2024-06-01', end: '2024-08-15', reason: 'Move to LA / Summer transition' },
];

// Race results - Dan's half marathons
const RACE_RESULTS = [
  {
    name: 'NYC Half Marathon',
    date: '2025-03-16',
    distance_miles: 13.25,
    distance_type: 'half_marathon',
    finish_time_seconds: 5052, // 1:24:12
    race_location: 'Brooklyn, New York',
    weather_temp_f: 49,
    weather_conditions: 'Foggy, 97% humidity, feels like 44°F',
    course_type: 'road',
    elevation_gain_ft: 495,
    notes: 'PR! Proud of this one. Negative split - started conservative then picked it up. Strong finish with 6:04 and 6:01/mi in miles 11-12.',
    taper_days: 7,
    shoes: 'Nike AlphaFly 3',
    splits: [
      { mile: 1, pace: '6:46', hr: 142 },
      { mile: 2, pace: '6:36', hr: 148 },
      { mile: 3, pace: '6:15', hr: 142 },
      { mile: 4, pace: '6:24', hr: 143 },
      { mile: 5, pace: '6:46', hr: 152 },
      { mile: 6, pace: '6:13', hr: 146 },
      { mile: 7, pace: '6:14', hr: 149 },
      { mile: 8, pace: '6:10', hr: 144 },
      { mile: 9, pace: '6:20', hr: 143 },
      { mile: 10, pace: '6:19', hr: 146 },
      { mile: 11, pace: '6:04', hr: 150 },
      { mile: 12, pace: '6:09', hr: 150 },
      { mile: 13, pace: '6:17', hr: 147 },
      { mile: 14, pace: '6:01', hr: 151, distance: 0.25 },
    ],
  },
  {
    name: 'Copenhagen Half Marathon', 
    date: '2025-09-14',
    distance_miles: 13.25,
    distance_type: 'half_marathon',
    finish_time_seconds: 5075, // 1:24:35
    race_location: 'Copenhagen, Denmark',
    weather_temp_f: 58,
    weather_conditions: 'Rainy, 86% humidity, feels like 53°F, 8.9 mi/h wind SSW',
    course_type: 'road',
    elevation_gain_ft: 135,
    notes: 'Very wet race, very jet lagged, but pretty happy with the result. More even pacing than NYC - consistent 6:19-6:30 through mile 9, then picked it up with a 6:10 mile 10.',
    taper_days: 7,
    shoes: 'Adidas Adios Pro 4',
    splits: [
      { mile: 1, pace: '6:19', hr: 146 },
      { mile: 2, pace: '6:28', hr: 156 },
      { mile: 3, pace: '6:26', hr: 154 },
      { mile: 4, pace: '6:19', hr: 153 },
      { mile: 5, pace: '6:20', hr: 159 },
      { mile: 6, pace: '6:23', hr: 173 },
      { mile: 7, pace: '6:30', hr: 175 },
      { mile: 8, pace: '6:28', hr: 178 },
      { mile: 9, pace: '6:24', hr: 177 },
      { mile: 10, pace: '6:10', hr: 178 },
      { mile: 11, pace: '6:26', hr: 173 },
      { mile: 12, pace: '6:20', hr: 173 },
      { mile: 13, pace: '6:21', hr: 169 },
      { mile: 14, pace: '6:04', hr: 168, distance: 0.25 },
    ],
  },
];

// ===========================================
// Main Script
// ===========================================

async function main() {
  console.log('🏃 LifeOS Garmin Backfill Script\n');
  console.log('='.repeat(50));

  // Parse command line args
  const config = parseArgs();
  
  // Validate environment
  validateEnv();
  
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  if (config.calculateOnly) {
    console.log('\n📊 Calculate-only mode: Computing baselines from existing data...\n');
    await calculateAndStoreBaselines(supabase, config.userId);
    return;
  }

  // Connect to Garmin
  console.log('\n📡 Connecting to Garmin MCP...');
  const garmin = createGarminClient();
  
  try {
    await garmin.connect();
    console.log('✅ Connected to Garmin\n');

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - config.daysBack);

    console.log(`📅 Backfill period: ${formatDateString(startDate)} to ${formatDateString(endDate)}`);
    console.log(`   (${config.daysBack} days)\n`);

    // Phase 1: Sync Health Data
    if (!config.skipHealth) {
      console.log('━'.repeat(50));
      console.log('📊 PHASE 1: Health Data Sync');
      console.log('━'.repeat(50));
      await syncHealthData(garmin, supabase, startDate, endDate, config);
    }

    // Phase 2: Sync Activities
    if (!config.skipActivities) {
      console.log('\n' + '━'.repeat(50));
      console.log('🏃 PHASE 2: Activities Sync');
      console.log('━'.repeat(50));
      await syncActivities(garmin, supabase, config);
    }

    // Phase 3: Calculate Baselines
    console.log('\n' + '━'.repeat(50));
    console.log('📈 PHASE 3: Calculate Baselines');
    console.log('━'.repeat(50));
    await calculateAndStoreBaselines(supabase, config.userId);

    // Phase 4: Import Race Results
    console.log('\n' + '━'.repeat(50));
    console.log('🏆 PHASE 4: Race Results');
    console.log('━'.repeat(50));
    await importRaceResults(supabase, config);

    console.log('\n' + '='.repeat(50));
    console.log('✅ Backfill complete!');
    console.log('='.repeat(50));

  } catch (error) {
    console.error('\n❌ Backfill failed:', error);
    process.exit(1);
  } finally {
    garmin.disconnect();
  }
}

// ===========================================
// Health Data Sync
// ===========================================

async function syncHealthData(
  garmin: GarminMCPClient,
  supabase: SupabaseClient,
  startDate: Date,
  endDate: Date,
  config: BackfillConfig
) {
  const dates = getDateRange(startDate, endDate);
  console.log(`\nSyncing health data for ${dates.length} days...\n`);

  let syncedCount = 0;
  let errorCount = 0;

  // Process in batches to avoid overwhelming the API
  const batchSize = 7; // One week at a time
  
  for (let i = 0; i < dates.length; i += batchSize) {
    const batch = dates.slice(i, i + batchSize);
    const batchStart = batch[0];
    const batchEnd = batch[batch.length - 1];
    
    process.stdout.write(`  Processing ${batchStart} to ${batchEnd}... `);

    for (const date of batch) {
      try {
        // Fetch all health data for the date
        const [daily, sleep, hrv] = await Promise.allSettled([
          garmin.getDailySummary(date),
          garmin.getSleepData(date),
          garmin.getHRVData(date),
        ]);

        const dailyData = daily.status === 'fulfilled' ? daily.value : null;
        const sleepData = sleep.status === 'fulfilled' ? sleep.value : null;
        const hrvData = hrv.status === 'fulfilled' ? hrv.value : null;

        if (!dailyData && !sleepData && !hrvData) {
          continue;
        }

        // Check if in low-volume period
        const lowVolumePeriod = LOW_VOLUME_PERIODS.find(
          p => date >= p.start && date <= p.end
        );

        const snapshotData = mapToHealthSnapshot(date, dailyData, sleepData, hrvData, lowVolumePeriod);

        if (!config.dryRun) {
          const insertData = {
            user_id: config.userId,
            snapshot_date: date,
            snapshot_time: null, // Garmin daily data doesn't have a specific time
            ...snapshotData,
          };
          
          // Check if record exists first
          const { data: existing } = await supabase
            .from('health_snapshots')
            .select('id')
            .eq('user_id', config.userId)
            .eq('snapshot_date', date)
            .is('snapshot_time', null)
            .maybeSingle();

          let error;
          if (existing) {
            // Update existing record
            const result = await supabase
              .from('health_snapshots')
              .update(snapshotData)
              .eq('id', existing.id);
            error = result.error;
          } else {
            // Insert new record
            const result = await supabase
              .from('health_snapshots')
              .insert(insertData);
            error = result.error;
          }

          if (error) {
            // Log first error for debugging
            if (errorCount === 0) {
              console.log(`\n   First error: ${error.message}`);
              console.log(`   Error details: ${JSON.stringify(error.details || error.hint || 'none')}`);
              console.log(`   Insert data keys: ${Object.keys(insertData).join(', ')}`);
            }
            throw error;
          }
        }

        syncedCount++;
      } catch (error) {
        errorCount++;
      }

      // Small delay to be nice to the API
      await sleep(100);
    }

    console.log(`✓ (${syncedCount} synced, ${errorCount} errors)`);
  }

  console.log(`\n✅ Health data sync complete: ${syncedCount} days synced, ${errorCount} errors`);
}

function mapToHealthSnapshot(
  date: string,
  daily: GarminDailySummary | null,
  sleepData: GarminSleepData | null,
  hrvData: GarminHRVData | null,
  lowVolumePeriod?: { reason: string }
) {
  // Use ONLY columns that exist in the original schema to avoid cache issues
  // All extra Garmin data goes into metadata
  const snapshot: Record<string, unknown> = {
    source: 'garmin',
    soreness_areas: [],
    illness_symptoms: [],
  };

  // Core columns from original schema
  if (daily) {
    snapshot.resting_hr = daily.restingHeartRate || null;
    snapshot.stress_level = daily.averageStressLevel 
      ? Math.min(10, Math.max(1, Math.round(daily.averageStressLevel / 10)))
      : null;
  }

  // Sleep from original schema
  if (sleepData) {
    snapshot.sleep_hours = sleepData.sleepTimeSeconds 
      ? Math.round((sleepData.sleepTimeSeconds / 3600) * 10) / 10 
      : null;
    snapshot.sleep_quality = sleepData.sleepScores?.totalScore 
      ? Math.min(10, Math.max(1, Math.round(sleepData.sleepScores.totalScore / 10)))
      : null;
    snapshot.hrv = sleepData.avgOvernightHrv 
      ? Math.round(sleepData.avgOvernightHrv) 
      : null;
  }

  // HRV data (may override sleep HRV)
  if (hrvData?.lastNightAvg) {
    snapshot.hrv = Math.round(hrvData.lastNightAvg);
  }

  // Store ALL Garmin data in metadata (bypasses schema cache issues)
  snapshot.metadata = {
    garminSyncId: `garmin-${date}`,
    garmin: {
      // Daily metrics
      steps: daily?.totalSteps,
      stepsGoal: daily?.dailyStepGoal,
      activeCalories: daily?.activeKilocalories,
      totalCalories: daily?.totalKilocalories,
      moderateIntensityMinutes: daily?.moderateIntensityMinutes,
      vigorousIntensityMinutes: daily?.vigorousIntensityMinutes,
      floorsAscended: daily?.floorsAscended,
      avgSpo2: daily?.averageSpo2,
      minSpo2: daily?.lowestSpo2,
      // Body Battery
      bodyBattery: daily ? {
        highest: daily.bodyBatteryHighestValue,
        lowest: daily.bodyBatteryLowestValue,
        charged: daily.bodyBatteryChargedValue,
        drained: daily.bodyBatteryDrainedValue,
      } : null,
      // Sleep details
      sleep: sleepData ? {
        deepMinutes: sleepData.deepSleepSeconds ? Math.round(sleepData.deepSleepSeconds / 60) : null,
        remMinutes: sleepData.remSleepSeconds ? Math.round(sleepData.remSleepSeconds / 60) : null,
        lightMinutes: sleepData.lightSleepSeconds ? Math.round(sleepData.lightSleepSeconds / 60) : null,
        awakeMinutes: sleepData.awakeSleepSeconds ? Math.round(sleepData.awakeSleepSeconds / 60) : null,
        scores: sleepData.sleepScores,
        restingHr: (sleepData as any).restingHeartRate,
        bodyBatteryChange: (sleepData as any).bodyBatteryChange,
      } : null,
      // HRV details
      hrv: hrvData ? {
        lastNightAvg: hrvData.lastNightAvg,
        weeklyAvg: hrvData.weeklyAvg,
        baseline: hrvData.baseline,
        status: hrvData.status,
      } : null,
      // Stress details
      stress: daily ? {
        avg: daily.averageStressLevel,
        max: daily.maxStressLevel,
      } : null,
    },
    lowVolumePeriod: lowVolumePeriod?.reason || null,
    syncedAt: new Date().toISOString(),
  };

  return snapshot;
}

// ===========================================
// Activities Sync
// ===========================================

async function syncActivities(
  garmin: GarminMCPClient,
  supabase: SupabaseClient,
  config: BackfillConfig
) {
  console.log('\nFetching activities from Garmin...');

  // Step 1: Get all activity IDs from list_activities
  console.log('  Getting activity IDs...');
  const activityIds = await garmin.listActivityIds(500);
  console.log(`  Found ${activityIds.length} activity IDs`);
  
  if (activityIds.length === 0) {
    console.log('  No activities found');
    return;
  }
  
  // Step 2: Fetch each activity's details
  const allActivities: GarminActivity[] = [];
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - config.daysBack);
  
  console.log(`  Fetching activity details (cutoff: ${formatDateString(cutoffDate)})...`);
  
  for (let i = 0; i < activityIds.length; i++) {
    const id = activityIds[i];
    
    // Progress every 10 activities
    if (i % 10 === 0) {
      process.stdout.write(`  ${i + 1}/${activityIds.length}...`);
    }
    
    try {
      const activity = await garmin.getActivity(id);
      
      if (activity?.activityId) {
        // Check if activity is within date range
        const activityDate = new Date(activity.startTimeLocal || activity.startTimeGMT);
        
        if (activityDate >= cutoffDate) {
          allActivities.push(activity);
        }
      }
    } catch {
      // Skip failed fetches
    }
    
    // Progress
    if (i % 10 === 9 || i === activityIds.length - 1) {
      console.log(` ${allActivities.length} activities in range`);
    }
    
    await sleep(200); // Rate limiting
  }
  
  console.log(`\nFetched ${allActivities.length} activities in date range`);

  // Filter to running activities (and walking for recovery walks)
  const relevantActivities = allActivities.filter(a => {
    if (!a?.activityType?.typeKey) return false;
    const type = a.activityType.typeKey.toLowerCase();
    return type.includes('running') || 
           type.includes('run') || 
           type.includes('walking') ||
           type.includes('treadmill') ||
           type.includes('track');
  });

  console.log(`  ${relevantActivities.length} running/walking activities`);

  let syncedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const activity of relevantActivities) {
    try {
      const activityId = String(activity.activityId);
      
      // Check if already exists (use external_id which is in original schema)
      const { data: existing } = await supabase
        .from('workouts')
        .select('id')
        .eq('external_id', activityId)
        .eq('source', 'garmin')
        .maybeSingle();

      if (existing) {
        skippedCount++;
        continue;
      }

      // Get detailed activity data
      let detailed;
      try {
        detailed = await garmin.getActivity(activity.activityId);
      } catch {
        detailed = activity;
      }

      const workoutData = mapToWorkout(detailed, config.userId);

      if (!config.dryRun) {
        const { error } = await supabase
          .from('workouts')
          .insert(workoutData);

        if (error) {
          // Log first error for debugging
          if (errorCount === 0) {
            console.log(`\n   First activity error: ${error.message}`);
            console.log(`   Error details: ${JSON.stringify(error.details || error.hint || 'none')}`);
          }
          throw error;
        }
      }

      syncedCount++;
      
      // Progress indicator
      if (syncedCount % 10 === 0) {
        process.stdout.write('.');
      }

      await sleep(200); // Rate limiting
    } catch (error) {
      errorCount++;
    }
  }

  console.log(`\n\n✅ Activities sync complete: ${syncedCount} synced, ${skippedCount} skipped, ${errorCount} errors`);
}

function mapToWorkout(activity: GarminActivity, userId: string) {
  const startDate = new Date(activity.startTimeLocal);
  const activityDate = formatDateString(startDate);
  const durationMinutes = Math.round(activity.duration / 60);
  const distanceMiles = metersToMiles(activity.distance);
  
  // Calculate pace
  const avgPaceMinutes = activity.distance > 0
    ? (activity.duration / 60) / distanceMiles
    : 0;
  const avgPace = avgPaceMinutes > 0 ? formatPace(avgPaceMinutes) : null;

  // Determine workout type based on activity patterns
  const workoutType = categorizeWorkout(activity, avgPaceMinutes);

  // Use ONLY columns from original schema to avoid cache issues
  // All Garmin-specific data goes into metadata
  return {
    user_id: userId,
    title: activity.activityName,
    workout_type: mapGarminActivityType(activity.activityType?.typeKey || 'run'),
    status: 'completed',
    scheduled_date: activityDate,
    started_at: startDate.toISOString(),
    completed_at: new Date(startDate.getTime() + activity.duration * 1000).toISOString(),
    actual_duration_minutes: durationMinutes,
    avg_heart_rate: activity.averageHR || null,
    max_heart_rate: activity.maxHR || null,
    calories_burned: activity.calories || null,
    external_id: String(activity.activityId), // Use external_id instead of garmin_activity_id
    source: 'garmin',
    exercises: [],
    tags: ['garmin-synced', workoutType],
    metadata: {
      // Store all Garmin data in metadata (bypasses cache issues)
      garminActivityId: activity.activityId,
      importedAt: new Date().toISOString(),
      backfill: true,
      // Distance and pace
      distanceMiles,
      avgPace,
      distanceMeters: activity.distance,
      // Training metrics
      trainingLoad: activity.activityTrainingLoad,
      trainingEffectAerobic: activity.aerobicTrainingEffect,
      trainingEffectAnaerobic: activity.anaerobicTrainingEffect,
      vo2max: activity.vO2MaxValue,
      // Running dynamics
      cadenceAvg: activity.avgRunningCadence,
      cadenceMax: activity.maxRunningCadence,
      groundContactTimeMs: activity.avgGroundContactTime,
      verticalOscillationCm: activity.avgVerticalOscillation,
      strideLengthCm: activity.avgStrideLength,
      verticalRatio: activity.avgVerticalRatio,
      avgPowerWatts: activity.avgPower,
      // Elevation
      elevationGainFt: activity.elevationGain ? Math.round(activity.elevationGain * 3.28084) : null,
      elevationLossFt: activity.elevationLoss ? Math.round(activity.elevationLoss * 3.28084) : null,
      elevationGainM: activity.elevationGain,
      elevationLossM: activity.elevationLoss,
      // Raw activity data
      activityType: activity.activityType,
      maxSpeed: activity.maxSpeed,
      avgSpeed: activity.averageSpeed,
    },
  };
}

function mapGarminActivityType(typeKey: string): string {
  const type = typeKey.toLowerCase();
  if (type.includes('running') || type.includes('run')) return 'run';
  if (type.includes('walking') || type.includes('walk')) return 'walk';
  if (type.includes('treadmill')) return 'run';
  return 'other';
}

function categorizeWorkout(activity: GarminActivity, avgPaceMinutes: number): string {
  const distanceMiles = metersToMiles(activity.distance);
  const aerobicEffect = activity.aerobicTrainingEffect || 0;
  const anaerobicEffect = activity.anaerobicTrainingEffect || 0;

  // Long run: 10+ miles
  if (distanceMiles >= 10) return 'long-run';
  
  // High intensity: high anaerobic effect or fast pace
  if (anaerobicEffect >= 3.0 || avgPaceMinutes < 7.0) return 'workout';
  
  // Tempo/threshold: moderate distance, moderate-high aerobic
  if (distanceMiles >= 5 && aerobicEffect >= 3.5) return 'tempo';
  
  // Recovery: short and easy
  if (distanceMiles < 4 && aerobicEffect < 2.5) return 'recovery';
  
  // Default: easy run
  return 'easy';
}

// ===========================================
// Baseline Calculations
// ===========================================

async function calculateAndStoreBaselines(supabase: SupabaseClient, userId: string) {
  console.log('\nCalculating baselines from synced data...\n');

  const today = new Date();
  const oneYearAgo = new Date(today);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const fourMonthsAgo = new Date(today);
  fourMonthsAgo.setMonth(fourMonthsAgo.getMonth() - 4);

  // Fetch all health snapshots
  const { data: healthData } = await supabase
    .from('health_snapshots')
    .select('*')
    .eq('user_id', userId)
    .gte('snapshot_date', formatDateString(oneYearAgo))
    .order('snapshot_date', { ascending: true });

  // Fetch all workouts
  const { data: workouts } = await supabase
    .from('workouts')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .gte('scheduled_date', formatDateString(oneYearAgo))
    .order('scheduled_date', { ascending: true });

  if (!healthData || !workouts) {
    console.log('⚠️  No data found for baseline calculations');
    return;
  }

  console.log(`  Found ${healthData.length} health snapshots`);
  console.log(`  Found ${workouts.length} completed workouts\n`);

  // Calculate health baselines
  const healthBaselines = calculateHealthBaselines(healthData, fourMonthsAgo);
  
  // Calculate training baselines
  const trainingBaselines = calculateTrainingBaselines(workouts, fourMonthsAgo);

  // Display results
  console.log('📊 HEALTH BASELINES (12 months)');
  console.log('─'.repeat(40));
  console.log(`  Resting HR:     ${healthBaselines.yearlyRhr?.avg?.toFixed(1) || 'N/A'} bpm (range: ${healthBaselines.yearlyRhr?.min || 'N/A'}-${healthBaselines.yearlyRhr?.max || 'N/A'})`);
  console.log(`  HRV:            ${healthBaselines.yearlyHrv?.avg?.toFixed(1) || 'N/A'} ms (range: ${healthBaselines.yearlyHrv?.min || 'N/A'}-${healthBaselines.yearlyHrv?.max || 'N/A'})`);
  console.log(`  Sleep:          ${healthBaselines.yearlySleep?.avg?.toFixed(1) || 'N/A'} hrs/night`);
  console.log(`  Sleep Quality:  ${healthBaselines.yearlySleepQuality?.avg?.toFixed(1) || 'N/A'}/10`);
  console.log(`  Body Battery:   ${healthBaselines.yearlyBodyBattery?.avg?.toFixed(0) || 'N/A'} (morning avg)`);

  console.log('\n📊 HEALTH BASELINES (4 months)');
  console.log('─'.repeat(40));
  console.log(`  Resting HR:     ${healthBaselines.recentRhr?.avg?.toFixed(1) || 'N/A'} bpm`);
  console.log(`  HRV:            ${healthBaselines.recentHrv?.avg?.toFixed(1) || 'N/A'} ms`);
  console.log(`  Sleep:          ${healthBaselines.recentSleep?.avg?.toFixed(1) || 'N/A'} hrs/night`);

  console.log('\n🏃 TRAINING BASELINES (12 months)');
  console.log('─'.repeat(40));
  console.log(`  Weekly Mileage: ${trainingBaselines.yearlyMileage?.avgWeekly?.toFixed(1) || 'N/A'} mi (peak: ${trainingBaselines.yearlyMileage?.peakWeek?.toFixed(1) || 'N/A'} mi)`);
  console.log(`  Runs/Week:      ${trainingBaselines.yearlyVolume?.runsPerWeek?.toFixed(1) || 'N/A'}`);
  console.log(`  Avg Run:        ${trainingBaselines.yearlyVolume?.avgRunMiles?.toFixed(1) || 'N/A'} mi`);
  console.log(`  Easy Pace:      ${trainingBaselines.yearlyPace?.easyPace || 'N/A'}`);
  console.log(`  Easy HR:        ${trainingBaselines.yearlyPace?.easyHr?.toFixed(0) || 'N/A'} bpm`);

  console.log('\n🏃 TRAINING BASELINES (4 months)');
  console.log('─'.repeat(40));
  console.log(`  Weekly Mileage: ${trainingBaselines.recentMileage?.avgWeekly?.toFixed(1) || 'N/A'} mi`);
  console.log(`  Easy Pace:      ${trainingBaselines.recentPace?.easyPace || 'N/A'}`);
  console.log(`  Training Load:  ${trainingBaselines.recentLoad?.chronic?.toFixed(0) || 'N/A'} (chronic)`);

  console.log('\n🎯 RUNNING DYNAMICS');
  console.log('─'.repeat(40));
  console.log(`  Cadence:        ${trainingBaselines.dynamics?.cadence?.toFixed(0) || 'N/A'} spm`);
  console.log(`  GCT:            ${trainingBaselines.dynamics?.groundContactTime?.toFixed(0) || 'N/A'} ms`);
  console.log(`  Vert Osc:       ${trainingBaselines.dynamics?.verticalOscillation?.toFixed(1) || 'N/A'} cm`);
  console.log(`  Stride Length:  ${trainingBaselines.dynamics?.strideLength?.toFixed(0) || 'N/A'} cm`);
  console.log(`  Power:          ${trainingBaselines.dynamics?.power?.toFixed(0) || 'N/A'} W`);

  console.log('\n📈 FITNESS INDICATORS');
  console.log('─'.repeat(40));
  console.log(`  VO2 Max:        ${trainingBaselines.fitness?.vo2max?.toFixed(1) || 'N/A'}`);
  console.log(`  LT Heart Rate:  ${trainingBaselines.fitness?.ltHr || 'N/A'} bpm`);
  console.log(`  LT Pace:        ${trainingBaselines.fitness?.ltPace || 'N/A'}`);

  // Store baselines in database
  const baselineRecord = {
    user_id: userId,
    baseline_date: formatDateString(today),
    period_days: 365,
    
    // Health baselines
    resting_hr_baseline: healthBaselines.yearlyRhr?.avg,
    resting_hr_stddev: healthBaselines.yearlyRhr?.stddev,
    resting_hr_min: healthBaselines.yearlyRhr?.min,
    resting_hr_max: healthBaselines.yearlyRhr?.max,
    
    hrv_baseline: healthBaselines.yearlyHrv?.avg,
    hrv_stddev: healthBaselines.yearlyHrv?.stddev,
    hrv_low_threshold: healthBaselines.yearlyHrv?.avg 
      ? healthBaselines.yearlyHrv.avg - healthBaselines.yearlyHrv.stddev! 
      : null,
    hrv_high_threshold: healthBaselines.yearlyHrv?.avg 
      ? healthBaselines.yearlyHrv.avg + healthBaselines.yearlyHrv.stddev! 
      : null,
    
    sleep_hours_baseline: healthBaselines.yearlySleep?.avg,
    sleep_hours_stddev: healthBaselines.yearlySleep?.stddev,
    sleep_quality_baseline: healthBaselines.yearlySleepQuality?.avg,
    
    body_battery_baseline: healthBaselines.yearlyBodyBattery?.avg 
      ? Math.round(healthBaselines.yearlyBodyBattery.avg) 
      : null,
    body_battery_stddev: healthBaselines.yearlyBodyBattery?.stddev,
    
    // Training load baselines
    weekly_mileage_avg: trainingBaselines.yearlyMileage?.avgWeekly,
    weekly_mileage_peak: trainingBaselines.yearlyMileage?.peakWeek,
    runs_per_week_avg: trainingBaselines.yearlyVolume?.runsPerWeek,
    avg_run_distance_miles: trainingBaselines.yearlyVolume?.avgRunMiles,
    
    chronic_training_load: trainingBaselines.recentLoad?.chronic,
    acute_training_load: trainingBaselines.recentLoad?.acute,
    training_load_ratio: trainingBaselines.recentLoad?.ratio,
    
    // Pace baselines
    easy_pace_baseline: trainingBaselines.yearlyPace?.easyPace,
    easy_hr_baseline: trainingBaselines.yearlyPace?.easyHr 
      ? Math.round(trainingBaselines.yearlyPace.easyHr) 
      : null,
    threshold_pace_baseline: trainingBaselines.fitness?.ltPace,
    threshold_hr_baseline: trainingBaselines.fitness?.ltHr,
    
    // Running dynamics
    cadence_avg: trainingBaselines.dynamics?.cadence 
      ? Math.round(trainingBaselines.dynamics.cadence) 
      : null,
    ground_contact_time_ms: trainingBaselines.dynamics?.groundContactTime 
      ? Math.round(trainingBaselines.dynamics.groundContactTime) 
      : null,
    vertical_oscillation_cm: trainingBaselines.dynamics?.verticalOscillation,
    stride_length_cm: trainingBaselines.dynamics?.strideLength 
      ? Math.round(trainingBaselines.dynamics.strideLength) 
      : null,
    power_avg_watts: trainingBaselines.dynamics?.power 
      ? Math.round(trainingBaselines.dynamics.power) 
      : null,
    
    // Fitness indicators
    vo2max_estimate: trainingBaselines.fitness?.vo2max,
    lactate_threshold_hr: trainingBaselines.fitness?.ltHr,
    lactate_threshold_pace: trainingBaselines.fitness?.ltPace,
    
    // Metadata
    health_data_points: healthData.length,
    workout_data_points: workouts.length,
    source: 'garmin',
    
    metadata: {
      calculatedAt: new Date().toISOString(),
      yearlyBaselines: {
        health: healthBaselines,
        training: trainingBaselines,
      },
      lowVolumePeriods: LOW_VOLUME_PERIODS,
    },
  };

  const { error } = await supabase
    .from('training_baselines')
    .upsert(baselineRecord, {
      onConflict: 'user_id,baseline_date,period_days',
    });

  if (error) {
    console.error('\n⚠️  Failed to store baselines:', error.message);
  } else {
    console.log('\n✅ Baselines stored in training_baselines table');
  }
}

function calculateHealthBaselines(data: any[], fourMonthsAgo: Date) {
  const recentData = data.filter(d => new Date(d.snapshot_date) >= fourMonthsAgo);
  
  return {
    yearlyRhr: calcStats(data.map(d => d.resting_hr).filter(Boolean)),
    yearlyHrv: calcStats(data.map(d => d.hrv).filter(Boolean)),
    yearlySleep: calcStats(data.map(d => d.sleep_hours).filter(Boolean)),
    yearlySleepQuality: calcStats(data.map(d => d.sleep_quality).filter(Boolean)),
    yearlyBodyBattery: calcStats(data.map(d => d.body_battery_morning).filter(Boolean)),
    
    recentRhr: calcStats(recentData.map(d => d.resting_hr).filter(Boolean)),
    recentHrv: calcStats(recentData.map(d => d.hrv).filter(Boolean)),
    recentSleep: calcStats(recentData.map(d => d.sleep_hours).filter(Boolean)),
  };
}

function calculateTrainingBaselines(workouts: any[], fourMonthsAgo: Date) {
  const runs = workouts.filter(w => w.workout_type === 'run');
  const recentRuns = runs.filter(w => new Date(w.scheduled_date) >= fourMonthsAgo);
  
  // Easy runs for pace baseline (filter by training effect < 3.0)
  const easyRuns = runs.filter(w => 
    w.training_effect_aerobic && w.training_effect_aerobic < 3.0 &&
    w.actual_distance_miles && w.actual_distance_miles >= 3
  );
  
  // Weekly mileage calculation
  const weeklyMileage = calculateWeeklyMileage(runs);
  const recentWeeklyMileage = calculateWeeklyMileage(recentRuns);
  
  // Training load (last 28 days = chronic, last 7 = acute)
  const last28Days = runs.filter(w => {
    const runDate = new Date(w.scheduled_date);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 28);
    return runDate >= cutoff;
  });
  const last7Days = runs.filter(w => {
    const runDate = new Date(w.scheduled_date);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    return runDate >= cutoff;
  });
  
  const chronicLoad = last28Days.reduce((sum, w) => sum + (w.training_load || 0), 0) / 4;
  const acuteLoad = last7Days.reduce((sum, w) => sum + (w.training_load || 0), 0);
  
  // Easy pace (convert from string or calculate)
  const easyPaces = easyRuns
    .filter(w => w.avg_pace)
    .map(w => parsePace(w.avg_pace))
    .filter(p => p > 0 && p < 15); // Filter reasonable paces
  
  const avgEasyPace = easyPaces.length > 0 
    ? easyPaces.reduce((a, b) => a + b, 0) / easyPaces.length 
    : null;
  
  // Easy HR
  const easyHrs = easyRuns
    .filter(w => w.avg_heart_rate)
    .map(w => w.avg_heart_rate);
  
  // Running dynamics
  const dynamics = {
    cadence: calcAvg(runs.map(w => w.cadence_avg).filter(Boolean)),
    groundContactTime: calcAvg(runs.map(w => w.ground_contact_time_ms).filter(Boolean)),
    verticalOscillation: calcAvg(runs.map(w => w.vertical_oscillation_cm).filter(Boolean)),
    strideLength: calcAvg(runs.map(w => w.avg_stride_length_cm).filter(Boolean)),
    power: calcAvg(runs.map(w => w.avg_power_watts).filter(Boolean)),
  };
  
  // Latest fitness indicators
  const latestWithVo2 = runs.filter(w => w.vo2max_estimate).slice(-10);
  const latestVo2 = latestWithVo2.length > 0 
    ? latestWithVo2[latestWithVo2.length - 1].vo2max_estimate 
    : null;
  
  const latestWithLt = runs.filter(w => w.lactate_threshold_hr).slice(-1);
  const ltHr = latestWithLt.length > 0 ? latestWithLt[0].lactate_threshold_hr : null;
  const ltSpeed = latestWithLt.length > 0 ? latestWithLt[0].lactate_threshold_speed : null;
  
  return {
    yearlyMileage: weeklyMileage,
    recentMileage: recentWeeklyMileage,
    yearlyVolume: {
      runsPerWeek: runs.length / 52,
      avgRunMiles: calcAvg(runs.map(w => w.actual_distance_miles).filter(Boolean)),
    },
    yearlyPace: {
      easyPace: avgEasyPace ? formatPace(avgEasyPace) : null,
      easyHr: calcAvg(easyHrs),
    },
    recentPace: {
      easyPace: avgEasyPace ? formatPace(avgEasyPace) : null,
    },
    recentLoad: {
      chronic: chronicLoad,
      acute: acuteLoad,
      ratio: chronicLoad > 0 ? acuteLoad / chronicLoad : null,
    },
    dynamics,
    fitness: {
      vo2max: latestVo2,
      ltHr,
      ltPace: ltSpeed ? formatPace(ltSpeed * 26.8224) : null, // m/s to min/mile
    },
  };
}

function calculateWeeklyMileage(runs: any[]) {
  if (runs.length === 0) return { avgWeekly: 0, peakWeek: 0 };
  
  // Group by week
  const weeklyTotals: Record<string, number> = {};
  
  for (const run of runs) {
    const date = new Date(run.scheduled_date);
    const weekStart = getWeekStart(date);
    const weekKey = formatDateString(weekStart);
    
    weeklyTotals[weekKey] = (weeklyTotals[weekKey] || 0) + (run.actual_distance_miles || 0);
  }
  
  const totals = Object.values(weeklyTotals);
  
  return {
    avgWeekly: calcAvg(totals),
    peakWeek: Math.max(...totals),
    weeks: Object.keys(weeklyTotals).length,
  };
}

// ===========================================
// Race Results Import
// ===========================================

async function importRaceResults(supabase: SupabaseClient, config: BackfillConfig) {
  console.log('\nRace results to import:');
  
  let importedCount = 0;
  let skippedCount = 0;
  
  for (const race of RACE_RESULTS) {
    console.log(`\n  🏆 ${race.name} (${race.date})`);
    
    if (race.finish_time_seconds === 0) {
      console.log('     ⚠️  Finish time not set - skipping');
      skippedCount++;
      continue;
    }
    
    // Check if already exists
    const { data: existing } = await supabase
      .from('race_results')
      .select('id')
      .eq('user_id', config.userId)
      .eq('race_name', race.name)
      .eq('race_date', race.date)
      .maybeSingle();
    
    if (existing) {
      console.log('     ⏭️  Already exists - skipping');
      skippedCount++;
      continue;
    }
    
    const paceMinutes = race.finish_time_seconds / 60 / race.distance_miles;
    const pace = formatPace(paceMinutes);
    
    console.log(`     Distance: ${race.distance_miles} mi`);
    console.log(`     Time: ${formatTime(race.finish_time_seconds)}`);
    console.log(`     Pace: ${pace}`);
    
    if (!config.dryRun) {
      const raceRecord: Record<string, unknown> = {
        user_id: config.userId,
        race_name: race.name,
        race_date: race.date,
        race_location: race.race_location,
        distance_miles: race.distance_miles,
        distance_type: race.distance_type,
        finish_time_seconds: race.finish_time_seconds,
        pace_per_mile: pace,
        weather_conditions: race.weather_conditions || null,
        course_type: race.course_type,
        taper_days: race.taper_days,
        notes: race.notes,
        tags: ['garmin-imported'],
        metadata: {
          importedAt: new Date().toISOString(),
          shoes: (race as any).shoes || null,
        },
      };
      
      // Add optional fields if present
      if ((race as any).weather_temp_f) {
        raceRecord.weather_temp_f = (race as any).weather_temp_f;
      }
      if ((race as any).elevation_gain_ft) {
        raceRecord.elevation_gain_ft = (race as any).elevation_gain_ft;
      }
      if ((race as any).splits) {
        raceRecord.splits = (race as any).splits;
      }
      
      const { error } = await supabase
        .from('race_results')
        .insert(raceRecord);
      
      if (error) {
        console.log(`     ❌ Error: ${error.message}`);
      } else {
        console.log('     ✅ Imported');
        importedCount++;
      }
    } else {
      console.log('     [DRY RUN - would import]');
    }
  }
  
  if (skippedCount > 0) {
    console.log('\n📝 To import remaining race results:');
    console.log('   1. Edit scripts/garmin-backfill.ts');
    console.log('   2. Update RACE_RESULTS with your finish times');
    console.log('   3. Format: hours*3600 + minutes*60 + seconds');
    console.log('   4. Example: 1:45:30 = 1*3600 + 45*60 + 30 = 6330');
    console.log('   5. Re-run this script');
  }
  
  console.log(`\n✅ Race results: ${importedCount} imported, ${skippedCount} skipped`);
}

// ===========================================
// Utility Functions
// ===========================================

function parseArgs(): BackfillConfig {
  const args = process.argv.slice(2);
  const config: BackfillConfig = {
    daysBack: 365,
    dryRun: false,
    skipHealth: false,
    skipActivities: false,
    calculateOnly: false,
    userId: process.env.USER_ID || '00000000-0000-0000-0000-000000000001',
  };

  for (const arg of args) {
    if (arg.startsWith('--days=')) {
      config.daysBack = parseInt(arg.split('=')[1], 10);
    } else if (arg === '--dry-run') {
      config.dryRun = true;
    } else if (arg === '--skip-health') {
      config.skipHealth = true;
    } else if (arg === '--skip-activities') {
      config.skipActivities = true;
    } else if (arg === '--calculate-only') {
      config.calculateOnly = true;
    }
  }

  return config;
}

function validateEnv() {
  const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY'];
  const missing = required.filter(k => !process.env[k]);
  
  if (missing.length > 0) {
    console.error(`❌ Missing environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }

  if (!process.env.GARMIN_EMAIL && !process.env.GARMIN_EMAIL_FILE) {
    console.error('❌ Missing Garmin credentials (GARMIN_EMAIL or GARMIN_EMAIL_FILE)');
    process.exit(1);
  }
}

function getDateRange(start: Date, end: Date): string[] {
  const dates: string[] = [];
  const current = new Date(start);
  
  while (current <= end) {
    dates.push(formatDateString(current));
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  return new Date(d.setDate(diff));
}

function calcStats(values: number[]): { avg: number; min: number; max: number; stddev: number } | null {
  if (values.length === 0) return null;
  
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length;
  const stddev = Math.sqrt(variance);
  
  return { avg, min, max, stddev };
}

function calcAvg(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function parsePace(paceStr: string): number {
  // Parse "8:30/mi" format to minutes per mile
  const match = paceStr.match(/(\d+):(\d+)/);
  if (!match) return 0;
  return parseInt(match[1], 10) + parseInt(match[2], 10) / 60;
}

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run the script
main().catch(console.error);

