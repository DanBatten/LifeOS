import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  WhiteboardEntry,
  WhiteboardReaction,
  WhiteboardEntryType,
  AgentId,
} from '@lifeos/core';
import type { CreateWhiteboardEntry, CreateWhiteboardReaction } from '@lifeos/core';
import { subtractDays } from '@lifeos/core';
import { BaseRepository } from './base.repository.js';

export class WhiteboardRepository extends BaseRepository<
  WhiteboardEntry,
  CreateWhiteboardEntry,
  Partial<CreateWhiteboardEntry>
> {
  constructor(client: SupabaseClient) {
    super(client, 'whiteboard_entries');
  }

  /**
   * Find entries for a specific date
   */
  async findByDate(userId: string, date: Date): Promise<WhiteboardEntry[]> {
    const dateStr = date.toISOString().split('T')[0];

    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .eq('context_date', dateStr)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((item) => this.transformFromDb(item));
  }

  /**
   * Find today's entries
   */
  async findToday(userId: string): Promise<WhiteboardEntry[]> {
    return this.findByDate(userId, new Date());
  }

  /**
   * Find entries by agent
   */
  async findByAgent(
    userId: string,
    agentId: AgentId,
    options?: { limit?: number; days?: number }
  ): Promise<WhiteboardEntry[]> {
    let query = this.client
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .eq('agent_id', agentId);

    if (options?.days) {
      const startDate = subtractDays(new Date(), options.days);
      query = query.gte('context_date', startDate.toISOString().split('T')[0]);
    }

    query = query
      .order('created_at', { ascending: false });

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) throw error;

    return (data || []).map((item) => this.transformFromDb(item));
  }

  /**
   * Find entries by type
   */
  async findByType(
    userId: string,
    entryType: WhiteboardEntryType | WhiteboardEntryType[],
    options?: { limit?: number; unreadOnly?: boolean }
  ): Promise<WhiteboardEntry[]> {
    const types = Array.isArray(entryType) ? entryType : [entryType];

    let query = this.client
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .in('entry_type', types);

    if (options?.unreadOnly) {
      query = query.eq('is_read', false);
    }

    query = query
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) throw error;

    return (data || []).map((item) => this.transformFromDb(item));
  }

  /**
   * Find unread entries
   */
  async findUnread(userId: string): Promise<WhiteboardEntry[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .eq('is_read', false)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((item) => this.transformFromDb(item));
  }

  /**
   * Find entries requiring response
   */
  async findRequiringResponse(userId: string): Promise<WhiteboardEntry[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .eq('requires_response', true)
      .eq('is_actioned', false)
      .order('priority', { ascending: false })
      .order('response_deadline', { ascending: true, nullsFirst: false });

    if (error) throw error;

    return (data || []).map((item) => this.transformFromDb(item));
  }

  /**
   * Find alerts (high priority)
   */
  async findAlerts(userId: string): Promise<WhiteboardEntry[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .eq('entry_type', 'alert')
      .eq('is_actioned', false)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((item) => this.transformFromDb(item));
  }

  /**
   * Mark entry as read
   */
  async markAsRead(id: string): Promise<WhiteboardEntry> {
    return this.update(id, { isRead: true } as Partial<CreateWhiteboardEntry>);
  }

  /**
   * Mark entry as actioned
   */
  async markAsActioned(id: string): Promise<WhiteboardEntry> {
    const { data, error } = await this.client
      .from(this.tableName)
      .update({
        is_actioned: true,
        actioned_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return this.transformFromDb(data);
  }

  /**
   * Get recent entries for context building
   */
  async getRecentForContext(
    userId: string,
    options?: { days?: number; limit?: number }
  ): Promise<WhiteboardEntry[]> {
    const days = options?.days || 3;
    const limit = options?.limit || 20;
    const startDate = subtractDays(new Date(), days);

    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .gte('context_date', startDate.toISOString().split('T')[0])
      .in('entry_type', ['observation', 'insight', 'alert', 'suggestion'])
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return (data || []).map((item) => this.transformFromDb(item));
  }

  /**
   * Clean up expired entries
   */
  async cleanupExpired(): Promise<number> {
    const now = new Date().toISOString();

    const { data, error } = await this.client
      .from(this.tableName)
      .delete()
      .lt('expires_at', now)
      .select('id');

    if (error) throw error;

    return data?.length || 0;
  }
}

/**
 * Repository for whiteboard reactions
 */
export class WhiteboardReactionRepository extends BaseRepository<
  WhiteboardReaction,
  CreateWhiteboardReaction,
  Partial<CreateWhiteboardReaction>
> {
  constructor(client: SupabaseClient) {
    super(client, 'whiteboard_reactions');
  }

  /**
   * Find reactions for an entry
   */
  async findByEntryId(entryId: string): Promise<WhiteboardReaction[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('entry_id', entryId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return (data || []).map((item) => this.transformFromDb(item));
  }

  /**
   * Add a reaction (upsert - one reaction per reactor per entry)
   */
  async addReaction(reaction: CreateWhiteboardReaction): Promise<WhiteboardReaction> {
    const { data, error } = await this.client
      .from(this.tableName)
      .upsert(
        this.camelToSnake(reaction as unknown as Record<string, unknown>),
        { onConflict: 'entry_id,reactor_type,reactor_id' }
      )
      .select()
      .single();

    if (error) throw error;

    return this.transformFromDb(data);
  }
}
