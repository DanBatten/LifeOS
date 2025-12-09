import type {
  WorkoutType,
  WorkoutSplit,
} from '@lifeos/core';
import type {
  GarminActivity,
  GarminActivityDetail,
  GarminDailySummary,
  GarminSleepData,
  GarminHRVData,
  GarminSplit,
} from './types.js';

// ===========================================
// Garmin Mapped Data Types
// ===========================================

/**
 * Mapped workout data from Garmin activity
 * Includes all fields that can be extracted from Garmin data
 */
export interface GarminMappedWorkout {
  garminActivityId: string;
  title: string;
  workoutType: WorkoutType;
  status: 'completed';
  scheduledDate: Date;
  startedAt: Date;
  completedAt: Date;
  actualDurationMinutes: number;
  actualDistanceMiles?: number;
  avgPace?: string;
  avgHeartRate?: number;
  maxHeartRate?: number;
  trainingLoad?: number;
  trainingEffectAerobic?: number;
  trainingEffectAnaerobic?: number;
  cadenceAvg?: number;
  cadenceMax?: number;
  groundContactTimeMs?: number;
  verticalOscillationCm?: number;
  avgPowerWatts?: number;
  elevationGainFt?: number;
  elevationLossFt?: number;
  caloriesBurned?: number;
  deviceData: Record<string, unknown>;
  splits?: WorkoutSplit[];
  source: string;
  exercises: never[];
  tags: string[];
  metadata: Record<string, unknown>;
}

/**
 * Mapped health snapshot from Garmin daily data
 */
export interface GarminMappedHealthSnapshot {
  garminSyncId: string;
  snapshotDate: Date;
  source: string;
  sleepHours?: number;
  sleepQuality?: number;
  hrv?: number;
  restingHr?: number;
  stressLevel?: number;
  metadata: {
    bodyBattery?: {
      current?: number;
      highest?: number;
      lowest?: number;
      charged?: number;
      drained?: number;
    };
    steps?: {
      total: number;
      goal: number;
    };
    intensity?: {
      moderate?: number;
      vigorous?: number;
    };
    spo2?: {
      average?: number;
      lowest?: number;
      latest?: number;
    };
    sleep?: {
      deepMinutes?: number;
      lightMinutes?: number;
      remMinutes?: number;
      awakeMinutes?: number;
      scores?: unknown;
      startTime?: string;
      endTime?: string;
      restlessMoments?: number;
      avgStress?: number;
      bodyBatteryChange?: number;
    };
    hrv?: {
      weeklyAvg?: number;
      lastNightAvg?: number;
      lastNight5MinHigh?: number;
      baseline?: unknown;
      status?: string;
      feedback?: string;
    };
  };
}

// ===========================================
// Activity Type Mapping
// ===========================================

const GARMIN_ACTIVITY_TYPE_MAP: Record<string, WorkoutType> = {
  running: 'run',
  trail_running: 'run',
  treadmill_running: 'run',
  track_running: 'run',
  cycling: 'cycle',
  indoor_cycling: 'cycle',
  mountain_biking: 'cycle',
  gravel_cycling: 'cycle',
  swimming: 'swim',
  lap_swimming: 'swim',
  open_water_swimming: 'swim',
  walking: 'walk',
  hiking: 'walk',
  strength_training: 'strength',
  cardio: 'cardio',
  hiit: 'hiit',
  yoga: 'yoga',
  pilates: 'mobility',
  stretching: 'mobility',
  other: 'other',
};

/**
 * Map Garmin activity type to LifeOS workout type
 */
export function mapActivityType(garminType: string): WorkoutType {
  const normalized = garminType.toLowerCase().replace(/\s+/g, '_');
  return GARMIN_ACTIVITY_TYPE_MAP[normalized] || 'other';
}

// ===========================================
// Activity Mappers
// ===========================================

/**
 * Convert Garmin activity to mapped workout data
 */
export function mapActivityToWorkout(
  activity: GarminActivity | GarminActivityDetail
): GarminMappedWorkout {
  const startDate = new Date(activity.startTimeLocal);
  const durationMinutes = Math.round(activity.duration / 60);
  const distanceMiles = metersToMiles(activity.distance);
  
  // Calculate average pace (minutes per mile)
  const avgPacePerMile = activity.distance > 0
    ? formatPace((activity.duration / 60) / distanceMiles)
    : undefined;

  const workout: GarminMappedWorkout = {
    garminActivityId: String(activity.activityId),
    title: activity.activityName,
    workoutType: mapActivityType(activity.activityType.typeKey),
    status: 'completed',
    scheduledDate: startDate,
    startedAt: startDate,
    completedAt: new Date(startDate.getTime() + activity.duration * 1000),
    actualDurationMinutes: durationMinutes,
    
    // Distance and pace
    actualDistanceMiles: distanceMiles,
    avgPace: avgPacePerMile,
    
    // Heart rate
    avgHeartRate: activity.averageHR,
    maxHeartRate: activity.maxHR,
    
    // Training metrics
    trainingLoad: activity.activityTrainingLoad,
    trainingEffectAerobic: activity.aerobicTrainingEffect,
    trainingEffectAnaerobic: activity.anaerobicTrainingEffect,
    
    // Running dynamics
    cadenceAvg: activity.avgRunningCadence,
    cadenceMax: activity.maxRunningCadence,
    groundContactTimeMs: activity.avgGroundContactTime,
    verticalOscillationCm: activity.avgVerticalOscillation,
    avgPowerWatts: activity.avgPower,
    
    // Elevation
    elevationGainFt: activity.elevationGain ? metersToFeet(activity.elevationGain) : undefined,
    elevationLossFt: activity.elevationLoss ? metersToFeet(activity.elevationLoss) : undefined,
    
    // Calories
    caloriesBurned: activity.calories,
    
    // Store raw Garmin data
    deviceData: {
      source: 'garmin',
      activityId: activity.activityId,
      activityType: activity.activityType,
      vO2Max: activity.vO2MaxValue,
      lactateThresholdHR: activity.lactateThresholdHeartRate,
      lactateThresholdSpeed: activity.lactateThresholdSpeed,
      avgStrideLength: activity.avgStrideLength,
      avgVerticalRatio: activity.avgVerticalRatio,
      maxSpeed: activity.maxSpeed,
      trainingLoadPeak: activity.trainingLoadPeak,
    },
    
    source: 'garmin',
    exercises: [],
    tags: ['garmin-synced'],
    metadata: {},
  };

  // Add splits if available (detailed activity)
  if ('splits' in activity && activity.splits) {
    workout.splits = mapSplitsToWorkoutSplits(activity.splits);
  }

  return workout;
}

/**
 * Convert Garmin splits to LifeOS workout splits
 */
function mapSplitsToWorkoutSplits(garminSplits: GarminSplit[]): WorkoutSplit[] {
  return garminSplits.map((split, index) => {
    const distanceMiles = metersToMiles(split.distance);
    const paceMinutes = split.duration / 60 / distanceMiles;
    
    return {
      mile: index + 1,
      pace: formatPace(paceMinutes),
      avgHr: split.averageHR,
      elevation: split.elevationGain 
        ? `+${Math.round(metersToFeet(split.elevationGain))}ft`
        : undefined,
    };
  });
}

// ===========================================
// Health Snapshot Mappers
// ===========================================

/**
 * Convert Garmin daily data to mapped health snapshot
 */
export function mapDailyDataToHealthSnapshot(
  date: string,
  daily?: GarminDailySummary | null,
  sleep?: GarminSleepData | null,
  hrv?: GarminHRVData | null
): GarminMappedHealthSnapshot {
  const snapshotDate = new Date(date);
  
  const snapshot: GarminMappedHealthSnapshot = {
    garminSyncId: `garmin-${date}`,
    snapshotDate,
    source: 'garmin',
    metadata: {},
  };

  // Daily summary data
  if (daily) {
    snapshot.restingHr = daily.restingHeartRate;
    // Convert 0-100 to 1-10 scale (constraint requires >= 1)
    if (daily.averageStressLevel && daily.averageStressLevel > 0) {
      const scaled = Math.round(daily.averageStressLevel / 10);
      snapshot.stressLevel = Math.max(1, scaled); // Ensure minimum of 1
    }
    
    // Body Battery
    snapshot.metadata = {
      ...snapshot.metadata,
      bodyBattery: {
        current: daily.bodyBatteryMostRecentValue,
        highest: daily.bodyBatteryHighestValue,
        lowest: daily.bodyBatteryLowestValue,
        charged: daily.bodyBatteryChargedValue,
        drained: daily.bodyBatteryDrainedValue,
      },
      steps: {
        total: daily.totalSteps,
        goal: daily.dailyStepGoal,
      },
      intensity: {
        moderate: daily.moderateIntensityMinutes,
        vigorous: daily.vigorousIntensityMinutes,
      },
      spo2: {
        average: daily.averageSpo2,
        lowest: daily.lowestSpo2,
        latest: daily.latestSpo2,
      },
    };
  }

  // Sleep data
  if (sleep) {
    snapshot.sleepHours = sleep.sleepTimeSeconds 
      ? Math.round((sleep.sleepTimeSeconds / 3600) * 10) / 10
      : undefined;
    
    // Map sleep quality from Garmin sleep score (0-100) to our scale (1-10)
    if (sleep.sleepScores?.totalScore) {
      snapshot.sleepQuality = Math.round(sleep.sleepScores.totalScore / 10);
    }
    
    // HRV from sleep
    if (sleep.avgOvernightHrv) {
      snapshot.hrv = Math.round(sleep.avgOvernightHrv);
    }
    
    snapshot.metadata = {
      ...snapshot.metadata,
      sleep: {
        deepMinutes: sleep.deepSleepSeconds ? Math.round(sleep.deepSleepSeconds / 60) : undefined,
        lightMinutes: sleep.lightSleepSeconds ? Math.round(sleep.lightSleepSeconds / 60) : undefined,
        remMinutes: sleep.remSleepSeconds ? Math.round(sleep.remSleepSeconds / 60) : undefined,
        awakeMinutes: sleep.awakeSleepSeconds ? Math.round(sleep.awakeSleepSeconds / 60) : undefined,
        scores: sleep.sleepScores,
        startTime: sleep.sleepStartTimestampLocal,
        endTime: sleep.sleepEndTimestampLocal,
        restlessMoments: sleep.restlessMomentsCount,
        avgStress: sleep.avgSleepStress,
        bodyBatteryChange: sleep.bodyBatteryChange,
      },
    };
  }

  // HRV data (may override sleep HRV with more detailed data)
  if (hrv) {
    // Handle structured HRV response with lastNightAvg
    if (hrv.lastNightAvg) {
      snapshot.hrv = Math.round(hrv.lastNightAvg);
    }
    // Handle array-like HRV response with numbered keys containing {value, startGMT}
    else if (typeof hrv === 'object') {
      const values = Object.values(hrv)
        .filter((v): v is { value: number } => v && typeof v === 'object' && 'value' in v && typeof v.value === 'number')
        .map(v => v.value);
      if (values.length > 0) {
        snapshot.hrv = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
      }
    }

    snapshot.metadata = {
      ...snapshot.metadata,
      hrv: {
        weeklyAvg: hrv.weeklyAvg,
        lastNightAvg: hrv.lastNightAvg,
        lastNight5MinHigh: hrv.lastNight5MinHigh,
        baseline: hrv.baseline,
        status: hrv.status,
        feedback: hrv.feedbackPhrase,
      },
    };
  }

  return snapshot;
}

/**
 * Extract Body Battery from daily summary for health snapshot
 */
export function extractBodyBattery(daily: GarminDailySummary): {
  morning?: number;
  current?: number;
} {
  return {
    morning: daily.bodyBatteryHighestValue, // Usually highest at wake
    current: daily.bodyBatteryMostRecentValue,
  };
}

// ===========================================
// Utility Functions
// ===========================================

/**
 * Convert meters to miles
 */
export function metersToMiles(meters: number): number {
  return Math.round((meters / 1609.344) * 100) / 100;
}

/**
 * Convert meters to feet
 */
export function metersToFeet(meters: number): number {
  return Math.round(meters * 3.28084);
}

/**
 * Format pace as MM:SS per mile
 */
export function formatPace(minutesPerMile: number): string {
  const minutes = Math.floor(minutesPerMile);
  const seconds = Math.round((minutesPerMile - minutes) * 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}/mi`;
}

/**
 * Parse pace string to minutes per mile
 */
export function parsePace(paceString: string): number {
  const match = paceString.match(/(\d+):(\d+)/);
  if (!match) return 0;
  return parseInt(match[1]) + parseInt(match[2]) / 60;
}

/**
 * Calculate speed in mph from m/s
 */
export function metersPerSecondToMph(mps: number): number {
  return Math.round(mps * 2.237 * 10) / 10;
}

/**
 * Get date string in YYYY-MM-DD format
 */
export function formatDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Get yesterday's date string
 */
export function getYesterdayString(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return formatDateString(yesterday);
}

/**
 * Get today's date string
 */
export function getTodayString(): string {
  return formatDateString(new Date());
}

