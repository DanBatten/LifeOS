import type { SupabaseClient } from '@supabase/supabase-js';
import { DatabaseError, NotFoundError } from '@lifeos/core';

export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}

/**
 * Base repository class with common CRUD operations
 */
export abstract class BaseRepository<T, CreateInput, UpdateInput> {
  protected client: SupabaseClient;
  protected tableName: string;
  protected primaryKey: string;

  constructor(
    client: SupabaseClient,
    tableName: string,
    primaryKey = 'id'
  ) {
    this.client = client;
    this.tableName = tableName;
    this.primaryKey = primaryKey;
  }

  /**
   * Find a record by ID
   */
  async findById(id: string): Promise<T | null> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq(this.primaryKey, id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new DatabaseError(error.message, {
        operation: 'findById',
        table: this.tableName,
        id,
      });
    }

    return this.transformFromDb(data);
  }

  /**
   * Find a record by ID or throw
   */
  async findByIdOrThrow(id: string): Promise<T> {
    const record = await this.findById(id);
    if (!record) {
      throw new NotFoundError(this.tableName, id);
    }
    return record;
  }

  /**
   * Find all records with optional filtering
   */
  async findAll(options?: QueryOptions): Promise<T[]> {
    let query = this.client.from(this.tableName).select('*');

    if (options?.orderBy) {
      query = query.order(options.orderBy, {
        ascending: options.orderDirection !== 'desc',
      });
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(
        options.offset,
        options.offset + (options.limit || 100) - 1
      );
    }

    const { data, error } = await query;

    if (error) {
      throw new DatabaseError(error.message, {
        operation: 'findAll',
        table: this.tableName,
      });
    }

    return (data || []).map((item) => this.transformFromDb(item));
  }

  /**
   * Find records by user ID
   */
  async findByUserId(userId: string, options?: QueryOptions): Promise<T[]> {
    let query = this.client
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId);

    if (options?.orderBy) {
      query = query.order(options.orderBy, {
        ascending: options.orderDirection !== 'desc',
      });
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(
        options.offset,
        options.offset + (options.limit || 100) - 1
      );
    }

    const { data, error } = await query;

    if (error) {
      throw new DatabaseError(error.message, {
        operation: 'findByUserId',
        table: this.tableName,
        userId,
      });
    }

    return (data || []).map((item) => this.transformFromDb(item));
  }

  /**
   * Create a new record
   */
  async create(input: CreateInput, userId?: string): Promise<T> {
    const dbData = this.transformToDb(input, userId);

    const { data, error } = await this.client
      .from(this.tableName)
      .insert(dbData)
      .select()
      .single();

    if (error) {
      throw new DatabaseError(error.message, {
        operation: 'create',
        table: this.tableName,
        input: dbData,
      });
    }

    return this.transformFromDb(data);
  }

  /**
   * Create multiple records
   */
  async createMany(inputs: CreateInput[], userId?: string): Promise<T[]> {
    const dbData = inputs.map((input) => this.transformToDb(input, userId));

    const { data, error } = await this.client
      .from(this.tableName)
      .insert(dbData)
      .select();

    if (error) {
      throw new DatabaseError(error.message, {
        operation: 'createMany',
        table: this.tableName,
        count: inputs.length,
      });
    }

    return (data || []).map((item) => this.transformFromDb(item));
  }

  /**
   * Update a record by ID
   */
  async update(id: string, input: UpdateInput): Promise<T> {
    const dbData = this.transformUpdateToDb(input);

    const { data, error } = await this.client
      .from(this.tableName)
      .update(dbData)
      .eq(this.primaryKey, id)
      .select()
      .single();

    if (error) {
      throw new DatabaseError(error.message, {
        operation: 'update',
        table: this.tableName,
        id,
      });
    }

    return this.transformFromDb(data);
  }

  /**
   * Delete a record by ID
   */
  async delete(id: string): Promise<void> {
    const { error } = await this.client
      .from(this.tableName)
      .delete()
      .eq(this.primaryKey, id);

    if (error) {
      throw new DatabaseError(error.message, {
        operation: 'delete',
        table: this.tableName,
        id,
      });
    }
  }

  /**
   * Count records (optionally by user)
   */
  async count(userId?: string): Promise<number> {
    let query = this.client
      .from(this.tableName)
      .select('*', { count: 'exact', head: true });

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { count, error } = await query;

    if (error) {
      throw new DatabaseError(error.message, {
        operation: 'count',
        table: this.tableName,
      });
    }

    return count || 0;
  }

  /**
   * Transform database row to domain model
   * Override in subclasses for custom transformation
   */
  protected transformFromDb(data: Record<string, unknown>): T {
    return this.snakeToCamel(data) as T;
  }

  /**
   * Transform create input to database format
   * Override in subclasses for custom transformation
   */
  protected transformToDb(
    input: CreateInput,
    userId?: string
  ): Record<string, unknown> {
    const dbData = this.camelToSnake(input as Record<string, unknown>);
    if (userId) {
      dbData.user_id = userId;
    }
    return dbData;
  }

  /**
   * Transform update input to database format
   */
  protected transformUpdateToDb(input: UpdateInput): Record<string, unknown> {
    return this.camelToSnake(input as Record<string, unknown>);
  }

  /**
   * Convert snake_case keys to camelCase
   */
  protected snakeToCamel(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) =>
        letter.toUpperCase()
      );
      result[camelKey] = value;
    }
    return result;
  }

  /**
   * Convert camelCase keys to snake_case
   */
  protected camelToSnake(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
      result[snakeKey] = value;
    }
    return result;
  }
}
