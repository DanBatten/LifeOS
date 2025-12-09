// Garmin MCP Integration for LifeOS
// Provides sync services and real-time queries to Garmin Connect

export { GarminMCPClient, createGarminClient } from './client.js';
export { GarminSyncService, createGarminSyncService } from './sync.js';
export {
  mapActivityToWorkout,
  mapDailyDataToHealthSnapshot,
  mapActivityType,
  extractBodyBattery,
  metersToMiles,
  metersToFeet,
  formatPace,
  parsePace,
  formatDateString,
  getYesterdayString,
  getTodayString,
} from './mappers.js';
export type {
  GarminMappedWorkout,
  GarminMappedHealthSnapshot,
} from './mappers.js';
export type {
  // Activity types
  GarminActivity,
  GarminActivityDetail,
  GarminActivityType,
  GarminSplit,
  GarminLap,
  GarminLapData,
  GarminSample,
  // Health types
  GarminDailySummary,
  GarminSleepData,
  GarminSleepScores,
  GarminHRVData,
  GarminHRVBaseline,
  GarminBodyComposition,
  // Sync types
  GarminSyncResult,
  GarminSyncOptions,
  GarminConfig,
} from './types.js';

