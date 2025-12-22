import type { SupabaseClient } from '@supabase/supabase-js';
import { BaseRepository } from './base.repository.js';
import { DatabaseError } from '@lifeos/core';

export interface RunningShoe {
  id: string;
  userId: string;
  brand: string;
  model: string;
  nickname: string | null;
  category: 'daily_trainer' | 'tempo' | 'race' | 'long_run' | 'trail' | 'recovery';
  stackHeightMm: number | null;
  dropMm: number | null;
  weightOz: number | null;
  hasCarbonPlate: boolean;
  cushionLevel: 'minimal' | 'moderate' | 'max' | null;
  totalMiles: number;
  maxMiles: number;
  purchaseDate: string | null;
  retiredAt: string | null;
  status: 'active' | 'retired' | 'reserved';
  isPrimary: boolean;
  imageUrl: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRunningShoe {
  brand: string;
  model: string;
  nickname?: string;
  category: RunningShoe['category'];
  stackHeightMm?: number;
  dropMm?: number;
  weightOz?: number;
  hasCarbonPlate?: boolean;
  cushionLevel?: RunningShoe['cushionLevel'];
  totalMiles?: number;
  maxMiles?: number;
  purchaseDate?: string;
  status?: RunningShoe['status'];
  isPrimary?: boolean;
  imageUrl?: string;
  notes?: string;
}

export interface UpdateRunningShoe {
  brand?: string;
  model?: string;
  nickname?: string;
  category?: RunningShoe['category'];
  totalMiles?: number;
  maxMiles?: number;
  status?: RunningShoe['status'];
  isPrimary?: boolean;
  imageUrl?: string;
  notes?: string;
  retiredAt?: string;
}

export class ShoeRepository extends BaseRepository<
  RunningShoe,
  CreateRunningShoe,
  UpdateRunningShoe
> {
  constructor(client: SupabaseClient) {
    super(client, 'running_shoes');
  }

  /**
   * Get all active shoes for a user
   */
  async getActiveShoes(userId: string): Promise<RunningShoe[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('category', { ascending: true });

    if (error) {
      throw new DatabaseError(error.message, {
        operation: 'getActiveShoes',
        table: this.tableName,
        userId,
      });
    }

    return (data || []).map((item) => this.transformFromDb(item));
  }

  /**
   * Get primary shoe for a specific category
   */
  async getPrimaryShoeForCategory(
    userId: string,
    category: RunningShoe['category']
  ): Promise<RunningShoe | null> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .eq('category', category)
      .eq('is_primary', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new DatabaseError(error.message, {
        operation: 'getPrimaryShoeForCategory',
        table: this.tableName,
        userId,
        category,
      });
    }

    return this.transformFromDb(data);
  }

  /**
   * Get recommended shoe for a workout type
   */
  async getRecommendedShoe(
    userId: string,
    workoutType: string,
    distanceMiles?: number
  ): Promise<RunningShoe | null> {
    // Map workout type to shoe category
    let category: RunningShoe['category'] = 'daily_trainer';
    
    if (['interval', 'tempo', 'threshold'].includes(workoutType)) {
      category = 'tempo';
    } else if (workoutType === 'race') {
      category = 'race';
    } else if (workoutType === 'long_run' && distanceMiles && distanceMiles >= 14) {
      category = 'long_run';
    } else if (workoutType === 'recovery') {
      category = 'recovery';
    } else if (workoutType === 'trail') {
      category = 'trail';
    }

    // Try to get primary shoe for category
    let shoe = await this.getPrimaryShoeForCategory(userId, category);
    
    // Fallback to daily trainer
    if (!shoe && category !== 'daily_trainer') {
      shoe = await this.getPrimaryShoeForCategory(userId, 'daily_trainer');
    }

    return shoe;
  }

  /**
   * Add miles to a shoe
   */
  async addMiles(shoeId: string, miles: number): Promise<RunningShoe> {
    const shoe = await this.findByIdOrThrow(shoeId);
    const newTotal = (shoe.totalMiles || 0) + miles;

    return this.update(shoeId, { totalMiles: newTotal });
  }

  /**
   * Retire a shoe
   */
  async retire(shoeId: string): Promise<RunningShoe> {
    return this.update(shoeId, {
      status: 'retired',
      retiredAt: new Date().toISOString(),
    });
  }
}

