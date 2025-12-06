import type { SupabaseClient } from '@supabase/supabase-js';
import type { CalendarEvent } from '@lifeos/core';
import type { CreateEvent } from '@lifeos/core';
import { startOfDay, endOfDay } from '@lifeos/core';
import { BaseRepository } from './base.repository.js';

export class EventRepository extends BaseRepository<
  CalendarEvent,
  CreateEvent,
  Partial<CreateEvent>
> {
  constructor(client: SupabaseClient) {
    super(client, 'events');
  }

  /**
   * Find events for a specific date
   */
  async findByDate(userId: string, date: Date): Promise<CalendarEvent[]> {
    const dayStart = startOfDay(date);
    const dayEnd = endOfDay(date);

    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .gte('start_time', dayStart.toISOString())
      .lte('start_time', dayEnd.toISOString())
      .order('start_time', { ascending: true });

    if (error) throw error;

    return (data || []).map((item) => this.transformFromDb(item));
  }

  /**
   * Find events in a date range
   */
  async findByDateRange(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<CalendarEvent[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .gte('start_time', startDate.toISOString())
      .lte('start_time', endDate.toISOString())
      .order('start_time', { ascending: true });

    if (error) throw error;

    return (data || []).map((item) => this.transformFromDb(item));
  }

  /**
   * Find events by Google Calendar ID
   */
  async findByGoogleEventId(
    userId: string,
    googleEventId: string
  ): Promise<CalendarEvent | null> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .eq('google_event_id', googleEventId)
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
   * Find upcoming events
   */
  async findUpcoming(
    userId: string,
    limit = 10
  ): Promise<CalendarEvent[]> {
    const now = new Date();

    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .gte('start_time', now.toISOString())
      .order('start_time', { ascending: true })
      .limit(limit);

    if (error) throw error;

    return (data || []).map((item) => this.transformFromDb(item));
  }

  /**
   * Find events by type
   */
  async findByType(
    userId: string,
    eventType: string,
    options?: { limit?: number; startDate?: Date; endDate?: Date }
  ): Promise<CalendarEvent[]> {
    let query = this.client
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .eq('event_type', eventType);

    if (options?.startDate) {
      query = query.gte('start_time', options.startDate.toISOString());
    }

    if (options?.endDate) {
      query = query.lte('start_time', options.endDate.toISOString());
    }

    query = query.order('start_time', { ascending: true });

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) throw error;

    return (data || []).map((item) => this.transformFromDb(item));
  }

  /**
   * Update or create event from Google Calendar sync
   */
  async upsertFromGoogle(
    userId: string,
    googleEventId: string,
    eventData: CreateEvent
  ): Promise<CalendarEvent> {
    const existing = await this.findByGoogleEventId(userId, googleEventId);

    if (existing) {
      return this.update(existing.id, {
        ...eventData,
        source: 'google_calendar',
      });
    }

    const dbData = this.transformToDb(
      { ...eventData, source: 'google_calendar' },
      userId
    );
    dbData.google_event_id = googleEventId;
    dbData.synced_at = new Date().toISOString();

    const { data, error } = await this.client
      .from(this.tableName)
      .insert(dbData)
      .select()
      .single();

    if (error) throw error;

    return this.transformFromDb(data);
  }

  /**
   * Calculate total meeting hours for a date
   */
  async getTotalMeetingHours(userId: string, date: Date): Promise<number> {
    const events = await this.findByDate(userId, date);

    const meetingEvents = events.filter(
      (e) => e.eventType === 'meeting' || e.eventType === 'focus_block'
    );

    let totalMinutes = 0;
    for (const event of meetingEvents) {
      const duration =
        (new Date(event.endTime).getTime() - new Date(event.startTime).getTime()) /
        (1000 * 60);
      totalMinutes += duration;
    }

    return Math.round((totalMinutes / 60) * 10) / 10;
  }
}
