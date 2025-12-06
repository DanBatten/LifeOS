import type { SupabaseClient } from '@supabase/supabase-js';
import type { Workout, WorkoutStatus, WorkoutType } from '@lifeos/core';
import type { CreateWorkout, CompleteWorkout } from '@lifeos/core';
import { subtractDays } from '@lifeos/core';
import { BaseRepository } from './base.repository.js';

export class WorkoutRepository extends BaseRepository<
  Workout,
  CreateWorkout,
  Partial<CreateWorkout> & Partial<CompleteWorkout>
> {
  constructor(client: SupabaseClient) {
    super(client, 'workouts');
  }

  /**
   * Find workouts for a specific date
   */
  async findByDate(userId: string, date: Date): Promise<Workout[]> {
    const dateStr = date.toISOString().split('T')[0];

    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .eq('scheduled_date', dateStr)
      .order('scheduled_time', { ascending: true, nullsFirst: false });

    if (error) throw error;

    return (data || []).map((item) => this.transformFromDb(item));
  }

  /**
   * Find today's workouts
   */
  async findToday(userId: string): Promise<Workout[]> {
    return this.findByDate(userId, new Date());
  }

  /**
   * Find workouts by status
   */
  async findByStatus(
    userId: string,
    status: WorkoutStatus | WorkoutStatus[]
  ): Promise<Workout[]> {
    const statuses = Array.isArray(status) ? status : [status];

    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .in('status', statuses)
      .order('scheduled_date', { ascending: false });

    if (error) throw error;

    return (data || []).map((item) => this.transformFromDb(item));
  }

  /**
   * Find upcoming planned workouts
   */
  async findUpcoming(userId: string, limit = 7): Promise<Workout[]> {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'planned')
      .gte('scheduled_date', today)
      .order('scheduled_date', { ascending: true })
      .limit(limit);

    if (error) throw error;

    return (data || []).map((item) => this.transformFromDb(item));
  }

  /**
   * Find recent completed workouts (deduplicated by date)
   * Prefers training plan workouts over standalone Garmin syncs
   */
  async findRecentCompleted(userId: string, days: number): Promise<Workout[]> {
    const startDate = subtractDays(new Date(), days);
    const startDateStr = startDate.toISOString().split('T')[0];

    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .gte('scheduled_date', startDateStr)
      .order('scheduled_date', { ascending: false });

    if (error) throw error;

    const workouts = (data || []).map((item) => this.transformFromDb(item));
    
    // Deduplicate: if multiple workouts on same date, prefer training plan workouts
    const byDate = new Map<string, Workout>();
    for (const workout of workouts) {
      const rawDate = workout.scheduledDate;
      if (!rawDate) continue;
      
      // Convert to string key (handle both Date and string types)
      const dateKey = rawDate instanceof Date 
        ? rawDate.toISOString().split('T')[0] 
        : String(rawDate);
      
      const existing = byDate.get(dateKey);
      if (!existing) {
        byDate.set(dateKey, workout);
      } else {
        // Prefer workout with planId (training plan workout) over Garmin-only sync
        const existingHasPlan = !!existing.planId;
        const currentHasPlan = !!workout.planId;
        
        if (currentHasPlan && !existingHasPlan) {
          byDate.set(dateKey, workout);
        }
        // If both or neither have plan, keep first (already sorted by date desc)
      }
    }
    
    return Array.from(byDate.values());
  }

  /**
   * Find workouts by type
   */
  async findByType(
    userId: string,
    workoutType: WorkoutType,
    options?: { limit?: number; days?: number }
  ): Promise<Workout[]> {
    let query = this.client
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .eq('workout_type', workoutType);

    if (options?.days) {
      const startDate = subtractDays(new Date(), options.days);
      query = query.gte('scheduled_date', startDate.toISOString().split('T')[0]);
    }

    query = query.order('scheduled_date', { ascending: false });

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) throw error;

    return (data || []).map((item) => this.transformFromDb(item));
  }

  /**
   * Complete a workout
   */
  async complete(id: string, completion: CompleteWorkout): Promise<Workout> {
    return this.update(id, {
      ...completion,
      completedAt: new Date(),
    });
  }

  /**
   * Skip a workout
   */
  async skip(id: string, reason?: string): Promise<Workout> {
    return this.update(id, {
      status: 'skipped',
      notes: reason,
    });
  }

  /**
   * Calculate training load for recent period
   * Uses duration * intensity as a simple load metric
   */
  async calculateTrainingLoad(
    userId: string,
    days: number
  ): Promise<{ totalLoad: number; avgLoad: number; workoutCount: number }> {
    const workouts = await this.findRecentCompleted(userId, days);

    let totalLoad = 0;
    for (const workout of workouts) {
      const duration = workout.actualDurationMinutes || workout.plannedDurationMinutes || 0;
      const intensity = workout.actualIntensity || workout.plannedIntensity || 5;
      totalLoad += duration * intensity;
    }

    return {
      totalLoad,
      avgLoad: workouts.length > 0 ? Math.round(totalLoad / workouts.length) : 0,
      workoutCount: workouts.length,
    };
  }

  /**
   * Get weekly summary
   */
  async getWeeklySummary(userId: string): Promise<{
    planned: number;
    completed: number;
    skipped: number;
    totalDuration: number;
    byType: Record<string, number>;
  }> {
    const workouts = await this.findRecentCompleted(userId, 7);
    const allWeekWorkouts = await this.findByUserId(userId, { limit: 100 });
    const weekStart = subtractDays(new Date(), 7);

    const weekWorkouts = allWeekWorkouts.filter(
      (w) => w.scheduledDate && new Date(w.scheduledDate) >= weekStart
    );

    const byType: Record<string, number> = {};
    let totalDuration = 0;

    for (const workout of workouts) {
      byType[workout.workoutType] = (byType[workout.workoutType] || 0) + 1;
      totalDuration += workout.actualDurationMinutes || 0;
    }

    return {
      planned: weekWorkouts.filter((w) => w.status === 'planned').length,
      completed: weekWorkouts.filter((w) => w.status === 'completed').length,
      skipped: weekWorkouts.filter((w) => w.status === 'skipped').length,
      totalDuration,
      byType,
    };
  }
}
