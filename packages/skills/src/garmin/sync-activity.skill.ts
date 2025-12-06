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

    // 1. Fetch latest activities from Garmin for the target date
    const activities = await client.getActivitiesForDate(targetDate);
    
    if (!activities || activities.length === 0) {
      logger.info(`[Skill:SyncLatestActivity] No activities found for ${targetDate}`);
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

    // 2. Check if this activity is already synced
    if (!options.forceResync) {
      const { data: existing } = await supabase
        .from('workouts')
        .select('id')
        .eq('user_id', userId)
        .eq('garmin_activity_id', garminActivityId)
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

    // Find best match (prefer workouts without garmin_activity_id)
    const plannedWorkout = plannedWorkouts?.find(w => !w.garmin_activity_id) || plannedWorkouts?.[0];

    // 4. Parse Garmin activity data
    const durationMinutes = runningActivity.duration 
      ? Math.round(runningActivity.duration / 60) 
      : null;
    const distanceMiles = runningActivity.distance 
      ? Math.round(runningActivity.distance / 1609.34 * 100) / 100 
      : null;

    const workoutData = {
      user_id: userId,
      scheduled_date: targetDate,
      status: 'completed',
      completed_date: targetDate,
      garmin_activity_id: garminActivityId,
      
      // Actual data from Garmin
      actual_duration_minutes: durationMinutes,
      actual_distance_miles: distanceMiles,
      avg_heart_rate: runningActivity.averageHR,
      max_heart_rate: runningActivity.maxHR,
      calories: runningActivity.calories,
      elevation_gain_ft: runningActivity.elevationGain 
        ? Math.round(runningActivity.elevationGain * 3.28084) 
        : null,
      cadence_avg: runningActivity.avgRunningCadence,
      
      // Store raw Garmin data in metadata
      metadata: {
        garmin: runningActivity,
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
  const distanceMi = data.actual_distance_miles as number | null;
  
  // Calculate actual pace if we have distance and duration
  let actualPace: string | null = null;
  if (durationMin && distanceMi && distanceMi > 0) {
    const paceSeconds = (durationMin * 60) / distanceMi;
    actualPace = `${Math.floor(paceSeconds / 60)}:${String(Math.round(paceSeconds % 60)).padStart(2, '0')}/mi`;
  }

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
    elevationGainFt: data.elevation_gain_ft as number | null,
    cadenceAvg: data.cadence_avg as number | null,
    splits: (data.splits as unknown[]) || [],
    
    coachNotes: data.coach_notes as string | null,
    athleteFeedback: data.athlete_feedback as string | null,
    perceivedExertion: data.perceived_exertion as number | null,
    
    matchedToPlannedWorkout: !!(data.plan_id || data.week_number),
    garminActivityId: data.garmin_activity_id as string | null,
  };
}

