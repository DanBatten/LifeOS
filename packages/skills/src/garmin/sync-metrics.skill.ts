/**
 * Skill: SyncGarminMetrics
 * 
 * Syncs daily health metrics from Garmin to the database.
 * This is a deterministic skill - no LLM involved.
 * 
 * Tool calls:
 * 1. garminClient.getDailySummary() - Get steps, calories, stress
 * 2. garminClient.getSleepData() - Get sleep details
 * 3. garminClient.getHRVData() - Get HRV metrics
 * 4. garminClient.getBodyBattery() - Get body battery
 * 5. database.upsert('health_snapshots', data) - Save to DB
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createGarminClient, formatDateString } from '@lifeos/garmin';
import { getLogger } from '@lifeos/core';

const logger = getLogger();

export interface SyncMetricsResult {
  success: boolean;
  date: string;
  metricsUpdated: string[];
  errors: string[];
}

export interface SyncMetricsOptions {
  date?: string; // Defaults to today
  dryRun?: boolean;
}

/**
 * Sync daily health metrics from Garmin to database
 */
export async function syncGarminMetrics(
  supabase: SupabaseClient,
  userId: string,
  options: SyncMetricsOptions = {}
): Promise<SyncMetricsResult> {
  const targetDate = options.date || formatDateString(new Date());
  const metricsUpdated: string[] = [];
  const errors: string[] = [];

  logger.info(`[Skill:SyncGarminMetrics] Starting sync for ${targetDate}`);

  const client = createGarminClient();

  try {
    await client.connect();

    // Collect all metrics
    const healthData: Record<string, unknown> = {
      user_id: userId,
      snapshot_date: targetDate,
      source: 'garmin',
    };

    // 1. Daily Summary (steps, calories, stress)
    try {
      const dailySummary = await client.getDailySummary(targetDate);
      if (dailySummary) {
        healthData.stress_level = dailySummary.averageStressLevel;
        healthData.metadata = {
          ...(healthData.metadata as object || {}),
          garmin: {
            steps: dailySummary.totalSteps,
            stepsGoal: dailySummary.dailyStepGoal,
            totalCalories: dailySummary.totalKilocalories,
            activeCalories: dailySummary.activeKilocalories,
            floorsAscended: dailySummary.floorsAscended,
            moderateIntensityMinutes: dailySummary.moderateIntensityMinutes,
            vigorousIntensityMinutes: dailySummary.vigorousIntensityMinutes,
            stress: {
              avg: dailySummary.averageStressLevel,
              max: dailySummary.maxStressLevel,
            },
            avgSpo2: dailySummary.averageSpo2,
            minSpo2: dailySummary.lowestSpo2,
          },
        };
        metricsUpdated.push('daily_summary');
      }
    } catch (e) {
      errors.push(`daily_summary: ${e instanceof Error ? e.message : String(e)}`);
    }

    // 2. Sleep Data
    try {
      const sleepData = await client.getSleepData(targetDate);
      if (sleepData) {
        healthData.sleep_hours = sleepData.sleepTimeSeconds ? sleepData.sleepTimeSeconds / 3600 : null;
        // restingHeartRate may come from sleep scores or daily summary (via raw data)
        const sleepRaw = sleepData as unknown as Record<string, unknown>;
        const restingHr = sleepRaw.restingHeartRate as number | undefined;
        if (restingHr) healthData.resting_hr = restingHr;
        
        const meta = healthData.metadata as Record<string, unknown>;
        meta.garmin = {
          ...(meta.garmin as object || {}),
          sleep: {
            deepMinutes: sleepData.deepSleepSeconds ? Math.round(sleepData.deepSleepSeconds / 60) : null,
            lightMinutes: sleepData.lightSleepSeconds ? Math.round(sleepData.lightSleepSeconds / 60) : null,
            remMinutes: sleepData.remSleepSeconds ? Math.round(sleepData.remSleepSeconds / 60) : null,
            awakeMinutes: sleepData.awakeSleepSeconds ? Math.round(sleepData.awakeSleepSeconds / 60) : null,
            restingHr: restingHr,
            scores: sleepData.sleepScores,
            bodyBatteryChange: sleepData.bodyBatteryChange,
          },
        };
        metricsUpdated.push('sleep');
      }
    } catch (e) {
      errors.push(`sleep: ${e instanceof Error ? e.message : String(e)}`);
    }

    // 3. HRV Data
    try {
      const hrvData = await client.getHRVData(targetDate);
      if (hrvData) {
        healthData.hrv = hrvData.lastNightAvg;
        
        const meta = healthData.metadata as Record<string, unknown>;
        meta.garmin = {
          ...(meta.garmin as object || {}),
          hrv: {
            lastNightAvg: hrvData.lastNightAvg,
            status: hrvData.status,
            baseline: hrvData.baseline,
          },
        };
        metricsUpdated.push('hrv');
      }
    } catch (e) {
      errors.push(`hrv: ${e instanceof Error ? e.message : String(e)}`);
    }

    // 4. Body Battery
    try {
      const bodyBattery = await client.getBodyBattery(targetDate, targetDate);
      if (bodyBattery && Array.isArray(bodyBattery) && bodyBattery.length > 0) {
        const latest = bodyBattery[bodyBattery.length - 1];
        
        const meta = healthData.metadata as Record<string, unknown>;
        meta.garmin = {
          ...(meta.garmin as object || {}),
          bodyBattery: {
            lowest: latest.bodyBatteryLow || latest.lowest,
            highest: latest.bodyBatteryHigh || latest.highest,
            charged: latest.bodyBatteryCharged || latest.charged,
            drained: latest.bodyBatteryDrained || latest.drained,
          },
        };
        metricsUpdated.push('body_battery');
      }
    } catch (e) {
      errors.push(`body_battery: ${e instanceof Error ? e.message : String(e)}`);
    }

    // Add sync timestamp
    const meta = healthData.metadata as Record<string, unknown>;
    meta.syncedAt = new Date().toISOString();
    meta.garminSyncId = `garmin-${targetDate}`;

    // Save to database
    if (!options.dryRun && metricsUpdated.length > 0) {
      const { error } = await supabase
        .from('health_snapshots')
        .upsert(healthData, { onConflict: 'user_id,snapshot_date' });

      if (error) {
        errors.push(`database: ${error.message}`);
      } else {
        logger.info(`[Skill:SyncGarminMetrics] Saved metrics: ${metricsUpdated.join(', ')}`);
      }
    }

    return {
      success: errors.length === 0,
      date: targetDate,
      metricsUpdated,
      errors,
    };
  } catch (error) {
    logger.error(`[Skill:SyncGarminMetrics] Failed: ${error instanceof Error ? error.message : String(error)}`);
    return {
      success: false,
      date: targetDate,
      metricsUpdated,
      errors: [...errors, error instanceof Error ? error.message : String(error)],
    };
  } finally {
    client.disconnect();
  }
}

