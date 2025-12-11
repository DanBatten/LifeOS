import { GarminConnect } from 'garmin-connect';
import { getLogger } from '@lifeos/core';

const logger = getLogger();

import type {
  GarminActivity,
  GarminActivityDetail,
  GarminDailySummary,
  GarminSleepData,
  GarminHRVData,
  GarminBodyComposition,
  GarminConfig,
  GarminLapData,
} from './types.js';


// Garmin Connect API URLs for custom requests
const GARMIN_API = {
  USER_SUMMARY: 'https://connect.garmin.com/modern/proxy/usersummary-service/usersummary/daily',
  BODY_COMPOSITION: 'https://connect.garmin.com/modern/proxy/weight-service/weight/dateRange',
  ACTIVITY_SPLITS: 'https://connect.garmin.com/modern/proxy/activity-service/activity',
  ACTIVITIES_FOR_DATE: 'https://connect.garmin.com/modern/proxy/activitylist-service/activities/fordate',
} as const;

/**
 * Client for communicating with Garmin Connect using the garmin-connect npm package
 * This is a pure JavaScript implementation that works on Vercel serverless
 */
export class GarminMCPClient {
  private client: GarminConnect;
  private initialized = false;

  constructor(config: GarminConfig = {}) {
    const username = config.email || process.env.GARMIN_EMAIL || '';
    const password = config.password || process.env.GARMIN_PASSWORD || '';

    this.client = new GarminConnect({
      username,
      password,
    });
  }

  /**
   * Connect to Garmin (login)
   */
  async connect(): Promise<void> {
    if (this.initialized) {
      logger.debug('Already connected to Garmin Connect');
      return;
    }

    logger.info('Connecting to Garmin Connect...');

    try {
      await this.client.login();
      this.initialized = true;
      logger.info('Successfully connected to Garmin Connect');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Failed to connect to Garmin Connect', null, { errorMsg: message });
      throw error;
    }
  }

  /**
   * Disconnect from Garmin Connect
   * Note: garmin-connect doesn't have a disconnect method, but we reset state
   */
  disconnect(): void {
    this.initialized = false;
    logger.info('Disconnected from Garmin Connect');
  }

  /**
   * Check if connected and initialized
   */
  isConnected(): boolean {
    return this.initialized;
  }

  // ===========================================
  // Activity Methods
  // ===========================================

  /**
   * List recent activities
   */
  async listActivities(limit = 20): Promise<GarminActivity[]> {
    const activities = await this.client.getActivities(0, limit);
    return activities.map(activity => this.normalizeActivitySummary(activity as unknown as Record<string, unknown>));
  }

  /**
   * Get all activity IDs from list
   */
  async listActivityIds(limit = 100): Promise<number[]> {
    const activities = await this.client.getActivities(0, limit);
    return activities.map(a => a.activityId);
  }

  /**
   * Get activities for a specific date
   */
  async getActivitiesForDate(date: string): Promise<GarminActivity[]> {
    try {
      const response = await this.client.get<unknown[]>(
        `${GARMIN_API.ACTIVITIES_FOR_DATE}/${date}`
      );

      if (!Array.isArray(response)) {
        return [];
      }

      return response.map(activity => this.normalizeActivitySummary(activity as Record<string, unknown>));
    } catch (error) {
      logger.debug('Failed to get activities for date', { date, error: String(error) });
      return [];
    }
  }

  /**
   * Get detailed activity information
   */
  async getActivity(activityId: number): Promise<GarminActivityDetail> {
    const activity = await this.client.getActivity({ activityId });
    return this.normalizeActivityDetail(activity as unknown as Record<string, unknown>);
  }

  /**
   * Get activity splits/laps with structured data
   */
  async getActivitySplits(activityId: number): Promise<GarminLapData[]> {
    try {
      const response = await this.client.get<Record<string, unknown>>(
        `${GARMIN_API.ACTIVITY_SPLITS}/${activityId}/splits`
      );
      return this.normalizeSplitsResponse(response);
    } catch (error) {
      logger.debug('Failed to get activity splits', { activityId, error: String(error) });
      return [];
    }
  }

  /**
   * Get activities for a specific date range
   */
  async getActivitiesForDateRange(
    startDate: string,
    endDate: string,
    _activityType?: string
  ): Promise<GarminActivity[]> {
    // Get all activities in the range by fetching more and filtering
    const allActivities = await this.client.getActivities(0, 100);

    return allActivities
      .filter(activity => {
        const activityDate = activity.startTimeLocal.split('T')[0];
        return activityDate >= startDate && activityDate <= endDate;
      })
      .map(activity => this.normalizeActivitySummary(activity as unknown as Record<string, unknown>));
  }

  // ===========================================
  // Health Metrics Methods
  // ===========================================

  /**
   * Get daily stats (steps, calories, etc.)
   */
  async getDailySummary(date: string): Promise<GarminDailySummary> {
    try {
      // Use getUserSummary which provides daily stats
      const response = await this.client.get<Record<string, unknown>>(
        `${GARMIN_API.USER_SUMMARY}/${date}`
      );

      return this.normalizeDailySummary(date, response);
    } catch (error) {
      logger.debug('Failed to get daily summary', { date, error: String(error) });
      return this.emptyDailySummary(date);
    }
  }

  /**
   * Get user summary (compatible API)
   */
  async getUserSummary(date: string): Promise<unknown> {
    return this.getDailySummary(date);
  }

  /**
   * Get sleep data for a date
   */
  async getSleepData(date: string): Promise<GarminSleepData> {
    const dateObj = new Date(date + 'T12:00:00');
    const sleepData = await this.client.getSleepData(dateObj);

    const dailySleep = sleepData.dailySleepDTO;

    return {
      calendarDate: date,
      sleepTimeSeconds: dailySleep.sleepTimeSeconds,
      napTimeSeconds: dailySleep.napTimeSeconds,
      sleepStartTimestampLocal: dailySleep.sleepStartTimestampLocal
        ? new Date(dailySleep.sleepStartTimestampLocal).toISOString()
        : undefined,
      sleepEndTimestampLocal: dailySleep.sleepEndTimestampLocal
        ? new Date(dailySleep.sleepEndTimestampLocal).toISOString()
        : undefined,
      deepSleepSeconds: dailySleep.deepSleepSeconds,
      lightSleepSeconds: dailySleep.lightSleepSeconds,
      remSleepSeconds: dailySleep.remSleepSeconds,
      awakeSleepSeconds: dailySleep.awakeSleepSeconds,
      unmeasurableSleepSeconds: dailySleep.unmeasurableSleepSeconds,
      avgSleepStress: dailySleep.avgSleepStress,
      sleepScores: dailySleep.sleepScores ? {
        totalScore: dailySleep.sleepScores.overall?.value,
        qualityScore: undefined,
        recoveryScore: undefined,
        durationScore: undefined,
        remScore: dailySleep.sleepScores.remPercentage?.value,
        deepScore: dailySleep.sleepScores.deepPercentage?.value,
        interruptionsScore: undefined,
      } : undefined,
      sleepNeed: undefined,
      sleepMovement: undefined,
      avgOvernightHrv: sleepData.avgOvernightHrv,
      hrvStatus: sleepData.hrvStatus,
      bodyBatteryChange: sleepData.bodyBatteryChange,
      restlessMomentsCount: sleepData.restlessMomentsCount,
    };
  }

  /**
   * Get resting heart rate for a date
   */
  async getRestingHeartRate(date: string): Promise<{ restingHeartRate?: number }> {
    try {
      const dateObj = new Date(date + 'T12:00:00');
      const sleepData = await this.client.getSleepData(dateObj);
      return { restingHeartRate: sleepData.restingHeartRate };
    } catch {
      return {};
    }
  }

  /**
   * Get heart rate data for a date
   */
  async getHeartRateData(date: string): Promise<unknown> {
    const dateObj = new Date(date + 'T12:00:00');
    return this.client.getHeartRate(dateObj);
  }

  /**
   * Get HRV data (extracted from sleep data)
   */
  async getHRVData(date: string): Promise<GarminHRVData> {
    try {
      const dateObj = new Date(date + 'T12:00:00');
      const sleepData = await this.client.getSleepData(dateObj);

      return {
        calendarDate: date,
        lastNightAvg: sleepData.avgOvernightHrv,
        status: sleepData.hrvStatus,
      };
    } catch {
      return {
        calendarDate: date,
      };
    }
  }

  /**
   * Get steps data for a date
   */
  async getSteps(date: string): Promise<unknown> {
    const dateObj = new Date(date + 'T12:00:00');
    const steps = await this.client.getSteps(dateObj);
    return { totalSteps: steps };
  }

  /**
   * Get body battery data
   */
  async getBodyBattery(_startDate: string, _endDate?: string): Promise<unknown> {
    // Body battery is included in sleep data
    // Try to get from sleep data
    try {
      const dateObj = new Date(_startDate + 'T12:00:00');
      const sleepData = await this.client.getSleepData(dateObj);
      return {
        bodyBatteryChange: sleepData.bodyBatteryChange,
        sleepBodyBattery: sleepData.sleepBodyBattery,
      };
    } catch {
      return {};
    }
  }

  /**
   * Get training readiness
   */
  async getTrainingReadiness(_date: string): Promise<unknown> {
    // Not directly available in garmin-connect, return empty
    return {};
  }

  /**
   * Get training status
   */
  async getTrainingStatus(_date: string): Promise<unknown> {
    // Not directly available in garmin-connect, return empty
    return {};
  }

  // ===========================================
  // Body Composition Methods
  // ===========================================

  /**
   * Get body composition data
   */
  async getBodyComposition(startDate: string, endDate?: string): Promise<GarminBodyComposition> {
    try {
      const end = endDate || startDate;
      const response = await this.client.get<Record<string, unknown>>(
        `${GARMIN_API.BODY_COMPOSITION}?startDate=${startDate}&endDate=${end}`
      );

      return this.normalizeBodyComposition(startDate, response);
    } catch {
      return { calendarDate: startDate };
    }
  }

  // ===========================================
  // Convenience Methods
  // ===========================================

  /**
   * Get comprehensive daily health data
   */
  async getDailyHealth(date: string): Promise<{
    summary: GarminDailySummary | null;
    sleep: GarminSleepData | null;
    hrv: GarminHRVData | null;
    bodyComposition: GarminBodyComposition | null;
  }> {
    const [summary, sleep, hrv, bodyComposition] = await Promise.allSettled([
      this.getDailySummary(date),
      this.getSleepData(date),
      this.getHRVData(date),
      this.getBodyComposition(date),
    ]);

    return {
      summary: summary.status === 'fulfilled' ? summary.value : null,
      sleep: sleep.status === 'fulfilled' ? sleep.value : null,
      hrv: hrv.status === 'fulfilled' ? hrv.value : null,
      bodyComposition: bodyComposition.status === 'fulfilled' ? bodyComposition.value : null,
    };
  }

  // ===========================================
  // Normalization Helpers
  // ===========================================

  /**
   * Normalize activity summary from garmin-connect format
   */
  private normalizeActivitySummary(raw: Record<string, unknown>): GarminActivity {
    const activityType = raw.activityType as Record<string, unknown> | undefined;

    return {
      activityId: raw.activityId as number,
      activityName: raw.activityName as string,
      activityType: {
        typeId: activityType?.typeId as number || 0,
        typeKey: activityType?.typeKey as string || 'other',
        parentTypeId: activityType?.parentTypeId as number,
      },
      startTimeLocal: raw.startTimeLocal as string,
      startTimeGMT: raw.startTimeGMT as string,
      duration: raw.duration as number,
      distance: raw.distance as number,
      calories: raw.calories as number,
      averageHR: raw.averageHR as number | undefined,
      maxHR: raw.maxHR as number | undefined,
      averageSpeed: raw.averageSpeed as number | undefined,
      maxSpeed: raw.maxSpeed as number | undefined,
      elevationGain: raw.elevationGain as number | undefined,
      elevationLoss: raw.elevationLoss as number | undefined,
      steps: raw.steps as number | undefined,
      avgStrideLength: raw.avgStrideLength as number | undefined,
      avgVerticalOscillation: raw.avgVerticalOscillation as number | undefined,
      avgGroundContactTime: raw.avgGroundContactTime as number | undefined,
      avgVerticalRatio: raw.avgVerticalRatio as number | undefined,
      avgRunningCadence: raw.averageRunningCadenceInStepsPerMinute as number | undefined,
      maxRunningCadence: raw.maxRunningCadenceInStepsPerMinute as number | undefined,
      avgPower: raw.avgPower as number | undefined,
      maxPower: raw.maxPower as number | undefined,
      aerobicTrainingEffect: raw.aerobicTrainingEffect as number | undefined,
      anaerobicTrainingEffect: raw.anaerobicTrainingEffect as number | undefined,
      trainingLoadPeak: raw.trainingLoadPeak as number | undefined,
      activityTrainingLoad: raw.activityTrainingLoad as number | undefined,
      vO2MaxValue: raw.vO2MaxValue as number | undefined,
      lactateThresholdHeartRate: raw.lactateThresholdBpm as number | undefined,
      lactateThresholdSpeed: raw.lactateThresholdSpeed as number | undefined,
    };
  }

  /**
   * Normalize detailed activity from garmin-connect format
   */
  private normalizeActivityDetail(raw: Record<string, unknown>): GarminActivityDetail {
    // The garmin-connect library returns both summary and detailed formats
    // Check if it has summaryDTO (detailed) or direct properties (summary)
    const summary = raw.summaryDTO as Record<string, unknown> | undefined;
    const activityType = raw.activityTypeDTO as Record<string, unknown> ||
                         raw.activityType as Record<string, unknown> || {};

    if (summary) {
      // Detailed format
      return {
        activityId: raw.activityId as number,
        activityName: raw.activityName as string,
        activityType: {
          typeId: activityType.typeId as number || 0,
          typeKey: activityType.typeKey as string || 'other',
          parentTypeId: activityType.parentTypeId as number,
        },
        startTimeLocal: summary.startTimeLocal as string,
        startTimeGMT: summary.startTimeGMT as string,
        duration: summary.duration as number,
        distance: summary.distance as number,
        calories: summary.calories as number,
        averageHR: summary.averageHR as number | undefined,
        maxHR: summary.maxHR as number | undefined,
        averageSpeed: summary.averageSpeed as number | undefined,
        maxSpeed: summary.maxSpeed as number | undefined,
        elevationGain: summary.elevationGain as number | undefined,
        elevationLoss: summary.elevationLoss as number | undefined,
        avgStrideLength: summary.strideLength as number | undefined,
        avgVerticalOscillation: summary.verticalOscillation as number | undefined,
        avgGroundContactTime: summary.groundContactTime as number | undefined,
        avgVerticalRatio: summary.verticalRatio as number | undefined,
        avgRunningCadence: summary.averageRunCadence as number | undefined,
        maxRunningCadence: summary.maxRunCadence as number | undefined,
        avgPower: summary.averagePower as number | undefined,
        maxPower: summary.maxPower as number | undefined,
        aerobicTrainingEffect: summary.trainingEffect as number | undefined,
        anaerobicTrainingEffect: summary.anaerobicTrainingEffect as number | undefined,
        activityTrainingLoad: summary.activityTrainingLoad as number | undefined,
        vO2MaxValue: summary.vO2MaxValue as number | undefined,
      };
    }

    // Summary format - use normalizeActivitySummary
    return this.normalizeActivitySummary(raw) as GarminActivityDetail;
  }

  /**
   * Normalize daily summary response
   */
  private normalizeDailySummary(date: string, raw: Record<string, unknown>): GarminDailySummary {
    return {
      calendarDate: date,
      steps: raw.totalSteps as number || 0,
      totalSteps: raw.totalSteps as number || 0,
      dailyStepGoal: raw.dailyStepGoal as number || 10000,
      totalKilocalories: raw.totalKilocalories as number | undefined,
      activeKilocalories: raw.activeKilocalories as number | undefined,
      bmrKilocalories: raw.bmrKilocalories as number | undefined,
      moderateIntensityMinutes: raw.moderateIntensityMinutes as number | undefined,
      vigorousIntensityMinutes: raw.vigorousIntensityMinutes as number | undefined,
      floorsAscended: raw.floorsAscended as number | undefined,
      floorsDescended: raw.floorsDescended as number | undefined,
      minHeartRate: raw.minHeartRate as number | undefined,
      maxHeartRate: raw.maxHeartRate as number | undefined,
      restingHeartRate: raw.restingHeartRate as number | undefined,
      averageStressLevel: raw.averageStressLevel as number | undefined,
      maxStressLevel: raw.maxStressLevel as number | undefined,
      stressDuration: raw.stressDuration as number | undefined,
      restStressDuration: raw.restStressDuration as number | undefined,
      activityStressDuration: raw.activityStressDuration as number | undefined,
      lowStressDuration: raw.lowStressDuration as number | undefined,
      mediumStressDuration: raw.mediumStressDuration as number | undefined,
      highStressDuration: raw.highStressDuration as number | undefined,
      bodyBatteryChargedValue: raw.bodyBatteryChargedValue as number | undefined,
      bodyBatteryDrainedValue: raw.bodyBatteryDrainedValue as number | undefined,
      bodyBatteryHighestValue: raw.bodyBatteryHighestValue as number | undefined,
      bodyBatteryLowestValue: raw.bodyBatteryLowestValue as number | undefined,
      bodyBatteryMostRecentValue: raw.bodyBatteryMostRecentValue as number | undefined,
      averageSpo2: raw.averageSpo2 as number | undefined,
      lowestSpo2: raw.lowestSpo2 as number | undefined,
      latestSpo2: raw.latestSpo2 as number | undefined,
    };
  }

  /**
   * Empty daily summary for error fallback
   */
  private emptyDailySummary(date: string): GarminDailySummary {
    return {
      calendarDate: date,
      steps: 0,
      totalSteps: 0,
      dailyStepGoal: 10000,
    };
  }

  /**
   * Normalize body composition response
   */
  private normalizeBodyComposition(date: string, raw: Record<string, unknown>): GarminBodyComposition {
    // Response may be a list of measurements
    const measurements = raw.dateWeightList as Array<Record<string, unknown>> ||
                         raw.weightList as Array<Record<string, unknown>> || [];

    const latest = measurements[measurements.length - 1] || raw;

    return {
      calendarDate: date,
      weight: latest.weight as number | undefined,
      bmi: latest.bmi as number | undefined,
      bodyFat: latest.bodyFat as number | undefined,
      bodyWater: latest.bodyWater as number | undefined,
      muscleMass: latest.muscleMass as number | undefined,
      boneMass: latest.boneMass as number | undefined,
      physiqueRating: latest.physiqueRating as number | undefined,
      visceralFat: latest.visceralFat as number | undefined,
      metabolicAge: latest.metabolicAge as number | undefined,
    };
  }

  /**
   * Normalize splits response to structured lap data
   */
  private normalizeSplitsResponse(raw: unknown): GarminLapData[] {
    const laps: GarminLapData[] = [];

    if (!raw) return laps;

    // If it's already an array of laps
    if (Array.isArray(raw)) {
      for (const lap of raw) {
        laps.push(this.normalizeOneLap(lap, laps.length + 1));
      }
      return laps;
    }

    // If it's an object with lapDTOs or splits array
    const obj = raw as Record<string, unknown>;
    const lapArray = obj.lapDTOs || obj.splits || obj.laps || [];

    if (Array.isArray(lapArray)) {
      for (const lap of lapArray) {
        laps.push(this.normalizeOneLap(lap, laps.length + 1));
      }
    }

    return laps;
  }

  /**
   * Normalize a single lap to our format
   */
  private normalizeOneLap(lap: unknown, index: number): GarminLapData {
    const l = lap as Record<string, unknown>;

    // Convert duration from seconds and distance from meters
    const durationSec = (l.duration || l.elapsedDuration || l.movingDuration || 0) as number;
    const distanceM = (l.distance || 0) as number;
    const distanceMi = distanceM / 1609.34;

    // Calculate pace (min/mi)
    let pacePerMile: string | null = null;
    if (distanceMi > 0 && durationSec > 0) {
      const paceSeconds = durationSec / distanceMi;
      const mins = Math.floor(paceSeconds / 60);
      const secs = Math.round(paceSeconds % 60);
      pacePerMile = `${mins}:${String(secs).padStart(2, '0')}`;
    }

    return {
      lapNumber: (l.lapIndex || l.splitNumber || index) as number,
      distanceMiles: Math.round(distanceMi * 100) / 100,
      durationSeconds: Math.round(durationSec),
      pacePerMile,
      avgHeartRate: (l.averageHR || l.avgHr || l.averageHeartRate) as number | undefined,
      maxHeartRate: (l.maxHR || l.maxHr || l.maxHeartRate) as number | undefined,
      avgCadence: (l.averageRunCadence || l.averageCadence || l.avgCadence) as number | undefined,
      elevationGainFt: l.elevationGain ? Math.round((l.elevationGain as number) * 3.28084) : undefined,
      elevationLossFt: l.elevationLoss ? Math.round((l.elevationLoss as number) * 3.28084) : undefined,
      calories: l.calories as number | undefined,
    };
  }
}

/**
 * Create a Garmin client with configuration from environment
 */
export function createGarminClient(config?: Partial<GarminConfig>): GarminMCPClient {
  return new GarminMCPClient({
    email: process.env.GARMIN_EMAIL,
    password: process.env.GARMIN_PASSWORD,
    emailFile: process.env.GARMIN_EMAIL_FILE,
    passwordFile: process.env.GARMIN_PASSWORD_FILE,
    ...config,
  });
}
