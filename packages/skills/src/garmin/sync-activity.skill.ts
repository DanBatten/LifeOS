/**
 * Skill: SyncLatestActivity
 * 
 * Fetches the latest activity from Garmin and syncs it to the database.
 * Used for post-run workflow to get the just-completed workout.
 * 
 * Flow:
 * 1. Fetch latest activity from Garmin
 * 2. Match to today's planned workout (if exists)
 * 3. Update workout with actual data OR create new workout entry
 * 4. Return the synced workout for analysis
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createGarminClient, formatDateString } from '@lifeos/garmin';
import { getLogger } from '@lifeos/core';

const logger = getLogger();

export interface SyncedWorkout {
  id: string;
  title: string;
  workoutType: string;
  scheduledDate: string;
  status: string;
  
  // Prescribed (from training plan)
  prescribedDistanceMiles: number | null;
  prescribedPacePerMile: string | null;
  prescribedDescription: string | null;
  
  // Actual (from Garmin)
  actualDurationMinutes: number | null;
  actualDistanceMiles: number | null;
  actualPacePerMile: string | null;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  calories: number | null;
  elevationGainFt: number | null;
  cadenceAvg: number | null;
  splits: unknown[];
  
  // Analysis
  coachNotes: string | null;
  athleteFeedback: string | null;
  perceivedExertion: number | null;
  
  // Matching info
  matchedToPlannedWorkout: boolean;
  garminActivityId: string | null;
}

export interface SyncActivityResult {
  success: boolean;
  workout: SyncedWorkout | null;
  action: 'created' | 'updated' | 'already_synced' | 'no_activity';
  error?: string;
}

export interface SyncActivityOptions {
  forceResync?: boolean; // Re-sync even if already synced
  date?: string; // Specific date to sync (defaults to today)
}

/**
 * Sync the latest activity from Garmin
 */
export async function syncLatestActivity(
  supabase: SupabaseClient,
  userId: string,
  options: SyncActivityOptions = {}
): Promise<SyncActivityResult> {
  const targetDate = options.date || formatDateString(new Date());
  
  logger.info(`[Skill:SyncLatestActivity] Syncing activity for ${targetDate}`);

  const client = createGarminClient();

  try {
    await client.connect();

    // 1. Fetch recent activities from Garmin and filter by target date
    // Using listActivities because getActivitiesForDate can be unreliable
    const allActivities = await client.listActivities(20);
    
    if (!allActivities || allActivities.length === 0) {
      logger.info(`[Skill:SyncLatestActivity] No activities found in Garmin`);
      return {
        success: true,
        workout: null,
        action: 'no_activity',
      };
    }

    // Filter to activities on the target date
    // Note: startTimeLocal format can be "2025-12-11 06:55:29" (space) or "2025-12-11T06:55:29" (T)
    const activities = allActivities.filter(a => {
      const dateStr = a.startTimeLocal || '';
      const activityDate = dateStr.split('T')[0].split(' ')[0]; // Handle both formats
      return activityDate === targetDate;
    });

    logger.info(`[Skill:SyncLatestActivity] Found ${activities.length} activities for ${targetDate} (of ${allActivities.length} total)`);

    if (activities.length === 0) {
      // Show what dates we do have activities for
      const availableDates = [...new Set(allActivities.map(a => {
        const dateStr = a.startTimeLocal || '';
        return dateStr.split('T')[0].split(' ')[0];
      }))];
      logger.info(`[Skill:SyncLatestActivity] Available dates: ${availableDates.join(', ')}`);

      return {
        success: true,
        workout: null,
        action: 'no_activity',
      };
    }

    // Get the most recent running activity
    const runningActivity = activities
      .filter(a => {
        // Check activityType - could be string or object
        const typeStr = typeof a.activityType === 'string' 
          ? a.activityType 
          : (a.activityType as { typeKey?: string })?.typeKey || '';
        return typeStr.toLowerCase().includes('running') || typeStr.toLowerCase().includes('run');
      })
      .sort((a, b) => new Date(b.startTimeGMT || 0).getTime() - new Date(a.startTimeGMT || 0).getTime())[0];

    if (!runningActivity) {
      logger.info(`[Skill:SyncLatestActivity] No running activities found for ${targetDate}`);
      return {
        success: true,
        workout: null,
        action: 'no_activity',
      };
    }

    const garminActivityId = runningActivity.activityId?.toString();

    // 2a. Fetch the lap/split data for detailed analysis
    let lapData: Array<{
      lapNumber: number;
      distanceMiles: number;
      durationSeconds: number;
      pacePerMile: string | null;
      avgHeartRate?: number;
      maxHeartRate?: number;
      avgCadence?: number;
      elevationGainFt?: number;
    }> = [];

    if (runningActivity.activityId) {
      try {
        lapData = await client.getActivitySplits(runningActivity.activityId);
        logger.info(`[Skill:SyncLatestActivity] Fetched ${lapData.length} laps for activity ${garminActivityId}`);
      } catch (lapError) {
        logger.warn(`[Skill:SyncLatestActivity] Could not fetch laps: ${lapError}`);
      }
    }

    // 2b. Check if this activity is already synced
    if (!options.forceResync && garminActivityId) {
      const { data: existing } = await supabase
        .from('workouts')
        .select('id')
        .eq('user_id', userId)
        .eq('external_id', garminActivityId)
        .single();

      if (existing) {
        logger.info(`[Skill:SyncLatestActivity] Activity ${garminActivityId} already synced`);
        
        // Fetch the full workout to return
        const { data: fullWorkout } = await supabase
          .from('workouts')
          .select('*')
          .eq('id', existing.id)
          .single();
          
        return {
          success: true,
          workout: fullWorkout ? transformWorkout(fullWorkout) : null,
          action: 'already_synced',
        };
      }
    }

    // 3. Try to match to a planned workout for this date
    const { data: plannedWorkouts } = await supabase
      .from('workouts')
      .select('*')
      .eq('user_id', userId)
      .eq('scheduled_date', targetDate)
      .eq('status', 'planned')
      .order('created_at', { ascending: true });

    // Find best match (prefer workouts without external_id i.e. not yet synced from Garmin)
    const plannedWorkout = plannedWorkouts?.find(w => !w.external_id) || plannedWorkouts?.[0];

    // 4. Parse Garmin activity data
    const durationMinutes = runningActivity.duration 
      ? Math.round(runningActivity.duration / 60) 
      : null;
    const distanceMiles = runningActivity.distance 
      ? Math.round(runningActivity.distance / 1609.34 * 100) / 100 
      : null;

    // Calculate actual pace
    const actualPace = distanceMiles && durationMinutes && distanceMiles > 0
      ? (() => {
          const paceSeconds = (durationMinutes * 60) / distanceMiles;
          return `${Math.floor(paceSeconds / 60)}:${String(Math.round(paceSeconds % 60)).padStart(2, '0')}/mi`;
        })()
      : null;

    const workoutData = {
      user_id: userId,
      scheduled_date: targetDate,
      status: 'completed',
      completed_at: new Date().toISOString(),
      
      // Core columns from base migration (001_initial_schema.sql)
      actual_duration_minutes: durationMinutes,
      avg_heart_rate: runningActivity.averageHR,
      max_heart_rate: runningActivity.maxHR,
      calories_burned: runningActivity.calories,
      external_id: garminActivityId, // Use external_id for Garmin activity ID
      source: 'garmin',
      
      // Store all Garmin data in metadata (always exists)
      metadata: {
        garmin: runningActivity,
        garmin_activity_id: garminActivityId,
        actual_distance_miles: distanceMiles,
        actual_pace: actualPace,
        elevation_gain_ft: runningActivity.elevationGain
          ? Math.round(runningActivity.elevationGain * 3.28084)
          : null,
        cadence_avg: runningActivity.avgRunningCadence,
        // Include lap/split data for detailed analysis
        laps: lapData,
        syncedAt: new Date().toISOString(),
      },
    };

    let result: SyncActivityResult;

    if (plannedWorkout) {
      // 5a. Update existing planned workout
      const { data: updated, error } = await supabase
        .from('workouts')
        .update(workoutData)
        .eq('id', plannedWorkout.id)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update workout: ${error.message}`);
      }

      logger.info(`[Skill:SyncLatestActivity] Updated planned workout ${plannedWorkout.id}`);
      
      result = {
        success: true,
        workout: transformWorkout({ ...plannedWorkout, ...updated }),
        action: 'updated',
      };
    } else {
      // 5b. Create new workout entry
      const newWorkout = {
        ...workoutData,
        title: runningActivity.activityName || `${targetDate} Run`,
        workout_type: 'run',
      };

      const { data: created, error } = await supabase
        .from('workouts')
        .insert(newWorkout)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create workout: ${error.message}`);
      }

      logger.info(`[Skill:SyncLatestActivity] Created new workout ${created.id}`);
      
      result = {
        success: true,
        workout: transformWorkout(created),
        action: 'created',
      };
    }

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`[Skill:SyncLatestActivity] Error: ${message}`);
    
    return {
      success: false,
      workout: null,
      action: 'no_activity',
      error: message,
    };
  } finally {
    client.disconnect();
  }
}

function transformWorkout(data: Record<string, unknown>): SyncedWorkout {
  const durationMin = data.actual_duration_minutes as number | null;
  const metadata = (data.metadata || {}) as Record<string, unknown>;

  // Get distance and pace from metadata (or columns if they exist)
  const distanceMi = (data.actual_distance_miles as number | null)
    || (metadata.actual_distance_miles as number | null);
  const actualPace = (metadata.actual_pace as string | null)
    || (durationMin && distanceMi && distanceMi > 0
        ? (() => {
            const paceSeconds = (durationMin * 60) / distanceMi;
            return `${Math.floor(paceSeconds / 60)}:${String(Math.round(paceSeconds % 60)).padStart(2, '0')}/mi`;
          })()
        : null);

  const garminActivityId = (data.external_id as string | null)
    || (metadata.garmin_activity_id as string | null);

  // Get lap data from metadata (the detailed per-mile breakdown)
  const laps = (metadata.laps as unknown[]) || (data.splits as unknown[]) || [];

  return {
    id: data.id as string,
    title: data.title as string,
    workoutType: data.workout_type as string,
    scheduledDate: data.scheduled_date as string,
    status: data.status as string,

    prescribedDistanceMiles: data.prescribed_distance_miles as number | null,
    prescribedPacePerMile: data.prescribed_pace_per_mile as string | null,
    prescribedDescription: data.prescribed_description as string | null,

    actualDurationMinutes: durationMin,
    actualDistanceMiles: distanceMi,
    actualPacePerMile: actualPace,
    avgHeartRate: data.avg_heart_rate as number | null,
    maxHeartRate: data.max_heart_rate as number | null,
    calories: data.calories as number | null,
    elevationGainFt: (data.elevation_gain_ft as number | null) || (metadata.elevation_gain_ft as number | null),
    cadenceAvg: (data.cadence_avg as number | null) || (metadata.cadence_avg as number | null),
    splits: laps,

    coachNotes: data.coach_notes as string | null,
    athleteFeedback: data.athlete_feedback as string | null,
    perceivedExertion: data.perceived_exertion as number | null,

    matchedToPlannedWorkout: !!(data.plan_id || data.week_number),
    garminActivityId,
  };
}

