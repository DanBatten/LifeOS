import type { SupabaseClient } from '@supabase/supabase-js';
import type { User } from '@lifeos/core';
import type { CreateUser } from '@lifeos/core';
import { BaseRepository } from './base.repository.js';

export class UserRepository extends BaseRepository<User, CreateUser, Partial<CreateUser>> {
  constructor(client: SupabaseClient) {
    super(client, 'users');
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('email', email)
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
   * Get or create the default user (Dan) for v1
   */
  async getOrCreateDefaultUser(): Promise<User> {
    const defaultUserId = process.env.USER_ID || '00000000-0000-0000-0000-000000000001';

    let user = await this.findById(defaultUserId);

    if (!user) {
      user = await this.create({
        email: 'dan@lifeos.local',
        name: 'Dan',
        timezone: process.env.TIMEZONE || 'America/Los_Angeles',
        preferences: {
          morningDigestTime: '07:00',
          eveningDigestTime: '21:00',
          workingHours: { start: '09:00', end: '18:00' },
          defaultLLMProvider: 'anthropic',
        },
      });
    }

    return user;
  }
}
