import type { SupabaseClient } from '@supabase/supabase-js';
import type { HealthSnapshot } from '@lifeos/core';
import type { CreateHealthSnapshot } from '@lifeos/core';
import { subtractDays } from '@lifeos/core';
import { BaseRepository } from './base.repository.js';

export class HealthRepository extends BaseRepository<
  HealthSnapshot,
  CreateHealthSnapshot,
  Partial<CreateHealthSnapshot>
> {
  private timezone?: string;

  constructor(client: SupabaseClient, timezone?: string) {
    super(client, 'health_snapshots');
    this.timezone = timezone;
  }

  /**
   * Find health snapshot for a specific date
   */
  async findByDate(userId: string, date: Date): Promise<HealthSnapshot | null> {
    // Use timezone-aware date conversion
    const dateStr = this.timezone
      ? date.toLocaleDateString('en-CA', { timeZone: this.timezone })
      : date.toISOString().split('T')[0];

    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .eq('snapshot_date', dateStr)
      .order('snapshot_time', { ascending: false, nullsFirst: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return this.transformFromDb(data);
  }

  /**
   * Get recent health snapshots
   */
  async getRecentSnapshots(
    userId: string,
    days: number
  ): Promise<HealthSnapshot[]> {
    const startDate = subtractDays(new Date(), days);
    const startDateStr = this.timezone
      ? startDate.toLocaleDateString('en-CA', { timeZone: this.timezone })
      : startDate.toISOString().split('T')[0];

    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .gte('snapshot_date', startDateStr)
      .order('snapshot_date', { ascending: false });

    if (error) throw error;

    return (data || []).map((item) => this.transformFromDb(item));
  }

  /**
   * Get today's health snapshot
   * Falls back to most recent snapshot with actual data if today has no data yet
   */
  async getToday(userId: string): Promise<HealthSnapshot | null> {
    const today = await this.findByDate(userId, new Date());

    // If we have today's data with actual values, return it
    if (today && (today.sleepHours || today.hrv || today.restingHr)) {
      return today;
    }

    // Otherwise get the most recent snapshot with actual data
    return this.getMostRecentWithData(userId);
  }

  /**
   * Get today's health snapshot with metadata about whether it's stale
   */
  async getTodayWithStatus(userId: string): Promise<{
    data: HealthSnapshot | null;
    isStale: boolean;
    dataDate: string | null;
  }> {
    const todayStr = this.timezone
      ? new Date().toLocaleDateString('en-CA', { timeZone: this.timezone })
      : new Date().toISOString().split('T')[0];

    const today = await this.findByDate(userId, new Date());

    // If we have today's data with actual values, return it
    if (today && (today.sleepHours || today.hrv || today.restingHr)) {
      return {
        data: today,
        isStale: false,
        dataDate: todayStr,
      };
    }

    // Otherwise get the most recent snapshot with actual data
    const fallback = await this.getMostRecentWithData(userId);

    if (!fallback) {
      return { data: null, isStale: false, dataDate: null };
    }

    // Format the date nicely
    const fallbackDate = fallback.snapshotDate instanceof Date
      ? fallback.snapshotDate
      : new Date(fallback.snapshotDate);
    const formattedDate = fallbackDate.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: this.timezone,
    });

    return {
      data: fallback,
      isStale: true,
      dataDate: formattedDate,
    };
  }

  /**
   * Get the most recent health snapshot that has actual data
   * (not just a placeholder record with null values)
   */
  async getMostRecentWithData(userId: string): Promise<HealthSnapshot | null> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .not('sleep_hours', 'is', null)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return this.transformFromDb(data);
  }

  /**
   * Calculate average metrics over a period
   */
  async getAverages(
    userId: string,
    days: number
  ): Promise<{
    sleepHours: number | null;
    sleepQuality: number | null;
    energyLevel: number | null;
    stressLevel: number | null;
    moodScore: number | null;
    hrv: number | null;
    restingHr: number | null;
  }> {
    const snapshots = await this.getRecentSnapshots(userId, days);

    if (snapshots.length === 0) {
      return {
        sleepHours: null,
        sleepQuality: null,
        energyLevel: null,
        stressLevel: null,
        moodScore: null,
        hrv: null,
        restingHr: null,
      };
    }

    const calculateAverage = (
      values: (number | undefined | null)[]
    ): number | null => {
      const valid = values.filter((v): v is number => v != null);
      if (valid.length === 0) return null;
      return Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10;
    };

    return {
      sleepHours: calculateAverage(snapshots.map((s) => s.sleepHours)),
      sleepQuality: calculateAverage(snapshots.map((s) => s.sleepQuality)),
      energyLevel: calculateAverage(snapshots.map((s) => s.energyLevel)),
      stressLevel: calculateAverage(snapshots.map((s) => s.stressLevel)),
      moodScore: calculateAverage(snapshots.map((s) => s.moodScore)),
      hrv: calculateAverage(snapshots.map((s) => s.hrv)),
      restingHr: calculateAverage(snapshots.map((s) => s.restingHr)),
    };
  }

  /**
   * Calculate recovery score based on recent metrics
   * Returns 0-1 score where 1 is fully recovered
   */
  async calculateRecoveryScore(userId: string): Promise<number> {
    const today = await this.getToday(userId);
    const averages = await this.getAverages(userId, 7);

    if (!today) {
      return 0.5; // Default when no data
    }

    let score = 0;
    let factors = 0;

    // Sleep factor (weight: 0.3)
    if (today.sleepHours && averages.sleepHours) {
      const sleepRatio = Math.min(today.sleepHours / 8, 1);
      score += sleepRatio * 0.3;
      factors += 0.3;
    }

    // Sleep quality factor (weight: 0.2)
    if (today.sleepQuality) {
      score += (today.sleepQuality / 10) * 0.2;
      factors += 0.2;
    }

    // Energy factor (weight: 0.2)
    if (today.energyLevel) {
      score += (today.energyLevel / 10) * 0.2;
      factors += 0.2;
    }

    // HRV factor (weight: 0.15) - higher is better
    if (today.hrv && averages.hrv) {
      const hrvRatio = Math.min(today.hrv / averages.hrv, 1.2);
      score += Math.min(hrvRatio, 1) * 0.15;
      factors += 0.15;
    }

    // Resting HR factor (weight: 0.15) - lower is better
    if (today.restingHr && averages.restingHr) {
      const hrRatio = averages.restingHr / today.restingHr;
      score += Math.min(hrRatio, 1) * 0.15;
      factors += 0.15;
    }

    // Normalize score if we don't have all factors
    if (factors > 0) {
      return Math.round((score / factors) * 100) / 100;
    }

    return 0.5;
  }

  /**
   * Create or update today's snapshot
   */
  async upsertToday(
    userId: string,
    data: CreateHealthSnapshot
  ): Promise<HealthSnapshot> {
    const today = await this.getToday(userId);

    if (today) {
      return this.update(today.id, data);
    }

    return this.create(
      {
        ...data,
        snapshotDate: new Date(),
      },
      userId
    );
  }
}
