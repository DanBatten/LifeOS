// ===========================================
// Garmin MCP Response Types
// Based on garmin_mcp server capabilities
// ===========================================

/**
 * Garmin Activity from list_activities
 */
export interface GarminActivity {
  activityId: number;
  activityName: string;
  activityType: GarminActivityType;
  startTimeLocal: string;
  startTimeGMT: string;
  duration: number; // seconds
  distance: number; // meters
  calories: number;
  averageHR?: number;
  maxHR?: number;
  averageSpeed?: number; // m/s
  maxSpeed?: number;
  elevationGain?: number; // meters
  elevationLoss?: number; // meters
  steps?: number;
  avgStrideLength?: number; // cm
  avgVerticalOscillation?: number; // cm
  avgGroundContactTime?: number; // ms
  avgVerticalRatio?: number; // %
  avgRunningCadence?: number;
  maxRunningCadence?: number;
  avgPower?: number; // watts
  maxPower?: number;
  aerobicTrainingEffect?: number;
  anaerobicTrainingEffect?: number;
  trainingLoadPeak?: number;
  activityTrainingLoad?: number;
  vO2MaxValue?: number;
  lactateThresholdHeartRate?: number;
  lactateThresholdSpeed?: number;
}

export interface GarminActivityType {
  typeId: number;
  typeKey: string;
  parentTypeId?: number;
}

/**
 * Detailed activity with splits and laps
 */
export interface GarminActivityDetail extends GarminActivity {
  splits?: GarminSplit[];
  laps?: GarminLap[];
  samples?: GarminSample[];
}

export interface GarminSplit {
  distance: number; // meters
  duration: number; // seconds
  averageHR?: number;
  maxHR?: number;
  averageSpeed?: number;
  elevationGain?: number;
  elevationLoss?: number;
  averageCadence?: number;
  averagePower?: number;
}

export interface GarminLap {
  lapIndex: number;
  startTimeLocal: string;
  distance: number;
  duration: number;
  averageHR?: number;
  maxHR?: number;
  averageSpeed?: number;
  calories?: number;
  averageCadence?: number;
  maxCadence?: number;
  elevationGain?: number;
  elevationLoss?: number;
}

/**
 * Normalized lap data for analysis (converted to imperial units)
 */
export interface GarminLapData {
  lapNumber: number;
  distanceMiles: number;
  durationSeconds: number;
  pacePerMile: string | null;
  avgHeartRate?: number;
  maxHeartRate?: number;
  avgCadence?: number;
  elevationGainFt?: number;
  elevationLossFt?: number;
  calories?: number;
}

export interface GarminSample {
  timestamp: string;
  heartRate?: number;
  speed?: number;
  elevation?: number;
  cadence?: number;
  power?: number;
  latitude?: number;
  longitude?: number;
}

// ===========================================
// Health Metrics Types
// ===========================================

/**
 * Daily health summary from Garmin
 */
export interface GarminDailySummary {
  calendarDate: string;
  steps: number;
  totalSteps: number;
  dailyStepGoal: number;
  totalKilocalories?: number;
  activeKilocalories?: number;
  bmrKilocalories?: number;
  moderateIntensityMinutes?: number;
  vigorousIntensityMinutes?: number;
  floorsAscended?: number;
  floorsDescended?: number;
  minHeartRate?: number;
  maxHeartRate?: number;
  restingHeartRate?: number;
  averageStressLevel?: number;
  maxStressLevel?: number;
  stressDuration?: number;
  restStressDuration?: number;
  activityStressDuration?: number;
  lowStressDuration?: number;
  mediumStressDuration?: number;
  highStressDuration?: number;
  bodyBatteryChargedValue?: number;
  bodyBatteryDrainedValue?: number;
  bodyBatteryHighestValue?: number;
  bodyBatteryLowestValue?: number;
  bodyBatteryMostRecentValue?: number;
  averageSpo2?: number;
  lowestSpo2?: number;
  latestSpo2?: number;
}

/**
 * Sleep data from Garmin
 */
export interface GarminSleepData {
  calendarDate: string;
  sleepTimeSeconds: number;
  napTimeSeconds?: number;
  sleepStartTimestampLocal?: string;
  sleepEndTimestampLocal?: string;
  deepSleepSeconds?: number;
  lightSleepSeconds?: number;
  remSleepSeconds?: number;
  awakeSleepSeconds?: number;
  unmeasurableSleepSeconds?: number;
  avgSleepStress?: number;
  sleepScores?: GarminSleepScores;
  sleepNeed?: number;
  sleepMovement?: number;
  avgOvernightHrv?: number;
  hrvStatus?: string;
  bodyBatteryChange?: number;
  restlessMomentsCount?: number;
}

export interface GarminSleepScores {
  totalScore?: number;
  qualityScore?: number;
  recoveryScore?: number;
  durationScore?: number;
  remScore?: number;
  deepScore?: number;
  interruptionsScore?: number;
}

/**
 * Heart rate variability data
 */
export interface GarminHRVData {
  calendarDate: string;
  weeklyAvg?: number;
  lastNightAvg?: number;
  lastNight5MinHigh?: number;
  baseline?: GarminHRVBaseline;
  status?: string;
  feedbackPhrase?: string;
}

export interface GarminHRVBaseline {
  lowUpper: number;
  balancedLow: number;
  balancedUpper: number;
  markerValue?: number;
}

/**
 * Body composition data
 */
export interface GarminBodyComposition {
  calendarDate: string;
  weight?: number; // grams
  bmi?: number;
  bodyFat?: number; // percentage
  bodyWater?: number;
  muscleMass?: number;
  boneMass?: number;
  physiqueRating?: number;
  visceralFat?: number;
  metabolicAge?: number;
}

// ===========================================
// MCP Tool Response Types
// ===========================================

export interface GarminMCPToolResult {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
}

// ===========================================
// Sync Types
// ===========================================

export interface GarminSyncResult {
  activitiesSynced: number;
  healthSnapshotsSynced: number;
  errors: string[];
  lastSyncTimestamp: string;
}

export interface GarminSyncOptions {
  syncActivities?: boolean;
  syncSleep?: boolean;
  syncDailySummary?: boolean;
  syncBodyComposition?: boolean;
  daysBack?: number;
}

// ===========================================
// Configuration Types
// ===========================================

export interface GarminConfig {
  email?: string;
  password?: string;
  emailFile?: string;
  passwordFile?: string;
}

