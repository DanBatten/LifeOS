import type { SupabaseClient } from '@supabase/supabase-js';
import { getLogger } from '@lifeos/core';

const logger = getLogger();

import { GarminMCPClient, createGarminClient } from './client.js';
import {
  mapActivityToWorkout,
  mapDailyDataToHealthSnapshot,
  formatDateString,
  getTodayString,
} from './mappers.js';
import type { GarminSyncResult, GarminSyncOptions, GarminConfig } from './types.js';


/**
 * Garmin Sync Service
 * Handles syncing data from Garmin to the LifeOS database
 */
export class GarminSyncService {
  private client: GarminMCPClient;
  private supabase: SupabaseClient;
  private userId: string;

  constructor(
    supabase: SupabaseClient,
    userId: string,
    config?: GarminConfig
  ) {
    this.client = createGarminClient(config);
    this.supabase = supabase;
    this.userId = userId;
  }

  /**
   * Run a full sync based on options
   */
  async sync(options: GarminSyncOptions = {}): Promise<GarminSyncResult> {
    const {
      syncActivities = true,
      syncSleep = true,
      syncDailySummary = true,
      syncBodyComposition = false,
      daysBack = 1,
    } = options;

    const result: GarminSyncResult = {
      activitiesSynced: 0,
      healthSnapshotsSynced: 0,
      errors: [],
      lastSyncTimestamp: new Date().toISOString(),
    };

    logger.info('Starting Garmin sync', { syncOptions: JSON.stringify(options) });

    try {
      await this.client.connect();

      // Calculate date range
      const endDate = getTodayString();
      const startDate = formatDateString(
        new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)
      );

      // Sync activities
      if (syncActivities) {
        try {
          const activityCount = await this.syncActivities(startDate, endDate);
          result.activitiesSynced = activityCount;
          logger.info(`Synced ${activityCount} activities`);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          result.errors.push(`Activities sync failed: ${message}`);
          logger.error('Activities sync failed', null, { errorMsg: message });
        }
      }

      // Sync health data for each day
      if (syncSleep || syncDailySummary) {
        try {
          const healthCount = await this.syncHealthData(
            startDate,
            endDate,
            { syncSleep, syncDailySummary, syncBodyComposition }
          );
          result.healthSnapshotsSynced = healthCount;
          logger.info(`Synced ${healthCount} health snapshots`);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          result.errors.push(`Health data sync failed: ${message}`);
          logger.error('Health data sync failed', null, { errorMsg: message });
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.errors.push(`Connection failed: ${message}`);
      logger.error('Garmin sync connection failed', null, { errorMsg: message });
    } finally {
      this.client.disconnect();
    }

    logger.info('Garmin sync completed', { 
      activitiesSynced: result.activitiesSynced, 
      healthSnapshotsSynced: result.healthSnapshotsSynced,
      errorCount: result.errors.length,
    });
    return result;
  }

  /**
   * Sync activities from Garmin
   */
  private async syncActivities(startDate: string, endDate: string): Promise<number> {
    // First, get list of recent activities
    const activities = await this.client.listActivities(50);
    
    // Filter to date range
    const filteredActivities = activities.filter(activity => {
      const activityDate = activity.startTimeLocal.split('T')[0];
      return activityDate >= startDate && activityDate <= endDate;
    });

    let syncedCount = 0;

    for (const activity of filteredActivities) {
      try {
        // Check if already synced
        const { data: existing } = await this.supabase
          .from('workouts')
          .select('id')
          .eq('garmin_activity_id', String(activity.activityId))
          .single();

        if (existing) {
          logger.debug(`Activity ${activity.activityId} already synced`);
          continue;
        }

        // Get detailed activity data
        let detailedActivity;
        try {
          detailedActivity = await this.client.getActivity(activity.activityId);
        } catch {
          detailedActivity = activity; // Fall back to basic data
        }

        // Map to workout
        const workoutData = mapActivityToWorkout(detailedActivity);

        // Check for matching planned workout on the same date
        const activityDate = activity.startTimeLocal.split('T')[0];
        const { data: plannedWorkout } = await this.supabase
          .from('workouts')
          .select('id, title, plan_id, phase_id, week_id, week_number, day_of_week, prescribed_description, prescribed_distance_miles, prescribed_pace_per_mile, prescribed_hr_zone')
          .eq('user_id', this.userId)
          .eq('scheduled_date', activityDate)
          .eq('status', 'planned')
          .maybeSingle();

        if (plannedWorkout) {
          // Update existing planned workout with execution data
          const { error } = await this.supabase
            .from('workouts')
            .update({
              garmin_activity_id: workoutData.garminActivityId,
              status: 'completed',
              actual_duration_minutes: workoutData.actualDurationMinutes,
              started_at: workoutData.startedAt,
              completed_at: workoutData.completedAt,
              avg_heart_rate: workoutData.avgHeartRate,
              max_heart_rate: workoutData.maxHeartRate,
              training_load: workoutData.trainingLoad,
              training_effect_aerobic: workoutData.trainingEffectAerobic,
              training_effect_anaerobic: workoutData.trainingEffectAnaerobic,
              cadence_avg: workoutData.cadenceAvg,
              cadence_max: workoutData.cadenceMax,
              ground_contact_time_ms: workoutData.groundContactTimeMs,
              vertical_oscillation_cm: workoutData.verticalOscillationCm,
              avg_power_watts: workoutData.avgPowerWatts,
              elevation_gain_ft: workoutData.elevationGainFt,
              elevation_loss_ft: workoutData.elevationLossFt,
              calories_burned: workoutData.caloriesBurned,
              device_data: workoutData.deviceData,
              splits: workoutData.splits,
              source: 'garmin',
              updated_at: new Date().toISOString(),
            })
            .eq('id', plannedWorkout.id);

          if (error) throw error;
          logger.debug(`Updated planned workout ${plannedWorkout.id} with Garmin data`);
        } else {
          // Insert as new workout
          const { error } = await this.supabase
            .from('workouts')
            .insert({
              user_id: this.userId,
              garmin_activity_id: workoutData.garminActivityId,
              title: workoutData.title,
              workout_type: workoutData.workoutType,
              status: workoutData.status,
              scheduled_date: activityDate,
              started_at: workoutData.startedAt,
              completed_at: workoutData.completedAt,
              actual_duration_minutes: workoutData.actualDurationMinutes,
              avg_heart_rate: workoutData.avgHeartRate,
              max_heart_rate: workoutData.maxHeartRate,
              training_load: workoutData.trainingLoad,
              training_effect_aerobic: workoutData.trainingEffectAerobic,
              training_effect_anaerobic: workoutData.trainingEffectAnaerobic,
              cadence_avg: workoutData.cadenceAvg,
              cadence_max: workoutData.cadenceMax,
              ground_contact_time_ms: workoutData.groundContactTimeMs,
              vertical_oscillation_cm: workoutData.verticalOscillationCm,
              avg_power_watts: workoutData.avgPowerWatts,
              elevation_gain_ft: workoutData.elevationGainFt,
              elevation_loss_ft: workoutData.elevationLossFt,
              calories_burned: workoutData.caloriesBurned,
              device_data: workoutData.deviceData,
              splits: workoutData.splits,
              source: 'garmin',
              exercises: [],
              tags: ['garmin-synced'],
              metadata: {},
            });

          if (error) throw error;
          logger.debug(`Inserted new workout from Garmin activity ${activity.activityId}`);
        }

        syncedCount++;
      } catch (error) {
        logger.error(`Failed to sync activity ${activity.activityId}`, 
          error instanceof Error ? error : null,
          { activityId: String(activity.activityId) }
        );
      }
    }

    return syncedCount;
  }

  /**
   * Sync health data for a date range
   */
  private async syncHealthData(
    startDate: string,
    endDate: string,
    options: { syncSleep: boolean; syncDailySummary: boolean; syncBodyComposition: boolean }
  ): Promise<number> {
    let syncedCount = 0;
    const dates = getDateRange(startDate, endDate);

    for (const date of dates) {
      try {
        // Fetch all health data for the date
        const [daily, sleep, hrv] = await Promise.allSettled([
          options.syncDailySummary ? this.client.getDailySummary(date) : Promise.resolve(null),
          options.syncSleep ? this.client.getSleepData(date) : Promise.resolve(null),
          options.syncSleep ? this.client.getHRVData(date) : Promise.resolve(null),
        ]);

        const dailyData = daily.status === 'fulfilled' ? daily.value : null;
        const sleepData = sleep.status === 'fulfilled' ? sleep.value : null;
        const hrvData = hrv.status === 'fulfilled' ? hrv.value : null;

        // Skip if no data
        if (!dailyData && !sleepData && !hrvData) {
          continue;
        }

        // Map to health snapshot
        const snapshotData = mapDailyDataToHealthSnapshot(date, dailyData, sleepData, hrvData);

        // Check for existing snapshot
        const { data: existing } = await this.supabase
          .from('health_snapshots')
          .select('id')
          .eq('user_id', this.userId)
          .eq('snapshot_date', date)
          .maybeSingle();

        if (existing) {
          // Update existing snapshot
          const { error } = await this.supabase
            .from('health_snapshots')
            .update({
              sleep_hours: snapshotData.sleepHours,
              sleep_quality: snapshotData.sleepQuality,
              hrv: snapshotData.hrv,
              resting_hr: snapshotData.restingHr,
              stress_level: snapshotData.stressLevel,
              body_battery_morning: dailyData?.bodyBatteryHighestValue,
              sleep_deep_minutes: snapshotData.metadata?.sleep?.deepMinutes,
              sleep_rem_minutes: snapshotData.metadata?.sleep?.remMinutes,
              sleep_light_minutes: snapshotData.metadata?.sleep?.lightMinutes,
              sleep_awake_minutes: snapshotData.metadata?.sleep?.awakeMinutes,
              source: 'garmin',
              metadata: snapshotData.metadata,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);

          if (error) throw error;
          logger.debug(`Updated health snapshot for ${date}`);
        } else {
          // Insert new snapshot
          const { error } = await this.supabase
            .from('health_snapshots')
            .insert({
              user_id: this.userId,
              snapshot_date: date,
              sleep_hours: snapshotData.sleepHours,
              sleep_quality: snapshotData.sleepQuality,
              hrv: snapshotData.hrv,
              resting_hr: snapshotData.restingHr,
              stress_level: snapshotData.stressLevel,
              body_battery_morning: dailyData?.bodyBatteryHighestValue,
              sleep_deep_minutes: snapshotData.metadata?.sleep?.deepMinutes,
              sleep_rem_minutes: snapshotData.metadata?.sleep?.remMinutes,
              sleep_light_minutes: snapshotData.metadata?.sleep?.lightMinutes,
              sleep_awake_minutes: snapshotData.metadata?.sleep?.awakeMinutes,
              source: 'garmin',
              soreness_areas: [],
              illness_symptoms: [],
              metadata: snapshotData.metadata,
            });

          if (error) throw error;
          logger.debug(`Inserted health snapshot for ${date}`);
        }

        syncedCount++;
      } catch (error) {
        let errorMsg: string;
        if (error instanceof Error) {
          errorMsg = error.message;
        } else if (error && typeof error === 'object' && 'message' in error) {
          errorMsg = String((error as { message: unknown }).message);
        } else {
          errorMsg = JSON.stringify(error);
        }
        logger.error(`Failed to sync health data for ${date}: ${errorMsg}`,
          error instanceof Error ? error : null,
          { date, errorMsg }
        );
      }
    }

    return syncedCount;
  }

  /**
   * Quick sync for morning flow - just yesterday's sleep and today's readiness
   */
  async syncMorningData(): Promise<GarminSyncResult> {
    return this.sync({
      syncActivities: true,
      syncSleep: true,
      syncDailySummary: true,
      syncBodyComposition: false,
      daysBack: 1,
    });
  }

  /**
   * Backfill historical data
   */
  async backfill(daysBack: number): Promise<GarminSyncResult> {
    logger.info(`Starting backfill for ${daysBack} days`);
    
    return this.sync({
      syncActivities: true,
      syncSleep: true,
      syncDailySummary: true,
      syncBodyComposition: true,
      daysBack,
    });
  }
}

/**
 * Get array of date strings between start and end (inclusive)
 */
function getDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    dates.push(formatDateString(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

/**
 * Create a sync service instance
 */
export function createGarminSyncService(
  supabase: SupabaseClient,
  userId: string,
  config?: GarminConfig
): GarminSyncService {
  return new GarminSyncService(supabase, userId, config);
}

