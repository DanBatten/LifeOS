/**
 * Skill: WriteWhiteboard
 * 
 * Writes entries to the whiteboard for the user to see.
 * Used by agents to persist their analysis and recommendations.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getLogger } from '@lifeos/core';

const logger = getLogger();

export interface WhiteboardEntry {
  entryType: 'insight' | 'alert' | 'recommendation' | 'summary' | 'note';
  title: string;
  content: string;
  agentId?: string;
  priority?: number; // 1-5, higher = more important
  expiresAt?: string; // ISO date string
  metadata?: Record<string, unknown>;
}

export interface WriteWhiteboardResult {
  success: boolean;
  entryId?: string;
  error?: string;
}

/**
 * Write a single entry to the whiteboard
 */
export async function writeToWhiteboard(
  supabase: SupabaseClient,
  userId: string,
  entry: WhiteboardEntry
): Promise<WriteWhiteboardResult> {
  logger.info(`[Skill:WriteWhiteboard] Writing ${entry.entryType}: ${entry.title}`);

  try {
    const { data, error } = await supabase
      .from('whiteboard_entries')
      .insert({
        user_id: userId,
        entry_type: entry.entryType,
        title: entry.title,
        content: entry.content,
        agent_id: entry.agentId,
        priority: entry.priority || 3,
        expires_at: entry.expiresAt,
        metadata: entry.metadata || {},
      })
      .select('id')
      .single();

    if (error) {
      logger.error(`[Skill:WriteWhiteboard] Failed: ${error.message}`);
      return { success: false, error: error.message };
    }

    return { success: true, entryId: data.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`[Skill:WriteWhiteboard] Exception: ${message}`);
    return { success: false, error: message };
  }
}

/**
 * Write multiple entries to the whiteboard
 */
export async function writeMultipleToWhiteboard(
  supabase: SupabaseClient,
  userId: string,
  entries: WhiteboardEntry[]
): Promise<{ success: boolean; entriesWritten: number; errors: string[] }> {
  const errors: string[] = [];
  let entriesWritten = 0;

  for (const entry of entries) {
    const result = await writeToWhiteboard(supabase, userId, entry);
    if (result.success) {
      entriesWritten++;
    } else if (result.error) {
      errors.push(result.error);
    }
  }

  return {
    success: errors.length === 0,
    entriesWritten,
    errors,
  };
}

/**
 * Clear expired whiteboard entries
 */
export async function clearExpiredWhiteboardEntries(
  supabase: SupabaseClient,
  userId: string
): Promise<{ success: boolean; deletedCount: number }> {
  try {
    const { data, error } = await supabase
      .from('whiteboard_entries')
      .delete()
      .eq('user_id', userId)
      .lt('expires_at', new Date().toISOString())
      .select('id');

    if (error) {
      logger.error(`[Skill:WriteWhiteboard] Clear failed: ${error.message}`);
      return { success: false, deletedCount: 0 };
    }

    return { success: true, deletedCount: data?.length || 0 };
  } catch (error) {
    return { success: false, deletedCount: 0 };
  }
}







