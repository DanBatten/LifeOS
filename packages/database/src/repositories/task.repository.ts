import type { SupabaseClient } from '@supabase/supabase-js';
import type { Task, TaskStatus, TaskPriority } from '@lifeos/core';
import type { CreateTask, UpdateTask } from '@lifeos/core';
import { startOfDay, endOfDay } from '@lifeos/core';
import { BaseRepository } from './base.repository.js';

export class TaskRepository extends BaseRepository<Task, CreateTask, UpdateTask> {
  constructor(client: SupabaseClient) {
    super(client, 'tasks');
  }

  /**
   * Find tasks by status
   */
  async findByStatus(
    userId: string,
    status: TaskStatus | TaskStatus[]
  ): Promise<Task[]> {
    const statuses = Array.isArray(status) ? status : [status];

    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .in('status', statuses)
      .order('priority', { ascending: true })
      .order('due_date', { ascending: true, nullsFirst: false });

    if (error) throw error;

    return (data || []).map((item) => this.transformFromDb(item));
  }

  /**
   * Find open tasks (not done or archived)
   */
  async findOpen(userId: string): Promise<Task[]> {
    return this.findByStatus(userId, ['inbox', 'todo', 'in_progress', 'blocked']);
  }

  /**
   * Find tasks due today
   */
  async findDueToday(userId: string): Promise<Task[]> {
    const today = new Date();
    const dayStart = startOfDay(today);
    const dayEnd = endOfDay(today);

    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .not('status', 'in', '("done","archived")')
      .gte('due_date', dayStart.toISOString().split('T')[0])
      .lte('due_date', dayEnd.toISOString().split('T')[0])
      .order('priority', { ascending: true });

    if (error) throw error;

    return (data || []).map((item) => this.transformFromDb(item));
  }

  /**
   * Find overdue tasks
   */
  async findOverdue(userId: string): Promise<Task[]> {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .not('status', 'in', '("done","archived")')
      .lt('due_date', today)
      .order('due_date', { ascending: true });

    if (error) throw error;

    return (data || []).map((item) => this.transformFromDb(item));
  }

  /**
   * Find tasks by priority
   */
  async findByPriority(
    userId: string,
    priority: TaskPriority | TaskPriority[]
  ): Promise<Task[]> {
    const priorities = Array.isArray(priority) ? priority : [priority];

    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .in('priority', priorities)
      .not('status', 'in', '("done","archived")')
      .order('due_date', { ascending: true, nullsFirst: false });

    if (error) throw error;

    return (data || []).map((item) => this.transformFromDb(item));
  }

  /**
   * Find high priority tasks (P1 and P2)
   */
  async findHighPriority(userId: string): Promise<Task[]> {
    return this.findByPriority(userId, ['p1_critical', 'p2_high']);
  }

  /**
   * Find tasks by project
   */
  async findByProject(userId: string, project: string): Promise<Task[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .eq('project', project)
      .order('priority', { ascending: true })
      .order('due_date', { ascending: true, nullsFirst: false });

    if (error) throw error;

    return (data || []).map((item) => this.transformFromDb(item));
  }

  /**
   * Find tasks completed today
   */
  async findCompletedToday(userId: string): Promise<Task[]> {
    const today = new Date();
    const dayStart = startOfDay(today);

    const { data, error } = await this.client
      .from(this.tableName)
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'done')
      .gte('completed_at', dayStart.toISOString())
      .order('completed_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((item) => this.transformFromDb(item));
  }

  /**
   * Complete a task
   */
  async complete(id: string, actualMinutes?: number): Promise<Task> {
    return this.update(id, {
      status: 'done',
      completedAt: new Date(),
      actualMinutes,
    });
  }

  /**
   * Mark a task as blocked
   */
  async block(id: string, reason: string): Promise<Task> {
    return this.update(id, {
      status: 'blocked',
      blockedReason: reason,
    });
  }

  /**
   * Update task priority
   */
  async updatePriority(id: string, priority: TaskPriority): Promise<Task> {
    return this.update(id, { priority });
  }

  /**
   * Get unique projects for a user
   */
  async getProjects(userId: string): Promise<string[]> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select('project')
      .eq('user_id', userId)
      .not('project', 'is', null);

    if (error) throw error;

    const projects = new Set<string>();
    for (const row of data || []) {
      if (row.project) {
        projects.add(row.project);
      }
    }

    return Array.from(projects).sort();
  }
}
