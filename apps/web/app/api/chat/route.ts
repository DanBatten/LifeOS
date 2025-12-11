import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createLLMClient } from '@lifeos/llm';
import { runChatFlow, type ConversationMessage } from '@lifeos/workflows';
import { getSupabase, getSupabaseService, insertRecord } from '@/lib/supabase';
import { getEnv } from '@/lib/env';
import { syncGarminMetrics, syncLatestActivity } from '@lifeos/skills';

/**
 * Context types that determine data loading and routing behavior:
 * - default: Broad context, all agents available, balanced data loading
 * - post-run: Training focused, syncs Garmin, routes to training-coach
 * - health: Health/recovery focused, routes to health-agent
 * - planning: Tasks/whiteboard focused, balanced routing
 */
const ChatRequestSchema = z.object({
  message: z.string().min(1),
  sessionId: z.string().uuid().nullish(),
  context: z.enum(['default', 'post-run', 'health', 'planning']).optional(),
});

/**
 * Detect if the user wants to log/sync a run from Garmin
 */
function detectRunLoggingIntent(message: string): boolean {
  const lowerMessage = message.toLowerCase();

  const runLoggingPatterns = [
    /\b(log|sync|record|add|import)\s+(my|a|the|today'?s?)?\s*(run|workout|activity)/i,
    /\b(just|finished|completed|did)\s+(my|a|the)?\s*(run|workout|training)/i,
    /\bpull\s+(in|from)\s+(my\s+)?(run|garmin|workout)/i,
    /\bget\s+(my\s+)?(run|workout)\s+(from\s+)?garmin/i,
    /\bsync\s+(from\s+)?garmin/i,
    /\b(how was|analyze)\s+my\s+(run|workout)/i,
  ];

  return runLoggingPatterns.some(pattern => pattern.test(lowerMessage));
}

/**
 * Chat Endpoint
 * 
 * Handles user chat messages using the ChatFlow workflow.
 * Features:
 * - Smart LLM-based routing to correct agent
 * - Conversation context for better routing decisions
 * - Fast responses (<10s) with pre-loaded data
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { message, sessionId, context } = ChatRequestSchema.parse(body);

    const env = getEnv();
    const supabase = getSupabase();
    const supabaseService = getSupabaseService();
    const llmClient = createLLMClient();

    // Get or create session ID
    const currentSessionId = sessionId || crypto.randomUUID();

    // Detect if user wants to log a run (auto-upgrade to post-run context)
    const wantsToLogRun = detectRunLoggingIntent(message);
    const effectiveContext = wantsToLogRun ? 'post-run' : (context || 'default');

    if (wantsToLogRun) {
      console.log('[Chat] Detected run-logging intent, switching to post-run context');
    }

    // For post-run context (explicit or detected), sync Garmin data first to get latest workout
    let activitySyncResult = null;
    if (effectiveContext === 'post-run') {
      console.log('[Chat] Post-run context detected, syncing Garmin activity...');
      try {
        // Sync the latest activity (workout) - this is the critical one for post-run
        activitySyncResult = await syncLatestActivity(supabaseService, env.USER_ID, {
          date: new Date().toISOString().split('T')[0],
          forceResync: false, // Don't re-sync if already synced
        });
        console.log('[Chat] Activity sync result:', {
          success: activitySyncResult.success,
          action: activitySyncResult.action,
          workout: activitySyncResult.workout?.title,
        });

        // Also sync health metrics in background
        syncGarminMetrics(supabaseService, env.USER_ID, {
          date: new Date().toISOString().split('T')[0],
        }).catch(err => console.error('[Chat] Background health sync failed:', err));

      } catch (syncError) {
        console.error('[Chat] Garmin activity sync failed:', syncError);
        // Continue anyway - we'll use whatever data is available
      }
    }

    // Fetch recent conversation history for context-aware routing
    let conversationHistory: ConversationMessage[] = [];
    if (sessionId) {
      const { data: messages } = await supabase
        .from('chat_messages')
        .select('role, content, responding_agent_id')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(6); // Last 6 messages for context

      if (messages && messages.length > 0) {
        conversationHistory = messages
          .reverse()
          .map((m: { role: string; content: string; responding_agent_id: string | null }) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
            agentId: m.responding_agent_id || undefined,
          }));
      }
    }

    // Run the chat workflow with conversation context
    const result = await runChatFlow(
      supabase,
      llmClient,
      env.USER_ID,
      message,
      env.TIMEZONE,
      {
        conversationHistory,
        context: effectiveContext,
        syncedWorkout: activitySyncResult?.workout || undefined,
      }
    );

    // Save chat messages to database
    const { error: userMsgError } = await insertRecord('chat_messages', {
      user_id: env.USER_ID,
      session_id: currentSessionId,
      role: 'user',
      content: message,
    });

    if (userMsgError) {
      console.error('Failed to save user message:', userMsgError);
    }

    const { error: assistantMsgError } = await insertRecord('chat_messages', {
      user_id: env.USER_ID,
      session_id: currentSessionId,
      role: 'assistant',
      content: result.response,
      responding_agent_id: result.agentId,
      prompt_tokens: result.tokenUsage.prompt,
      completion_tokens: result.tokenUsage.completion,
    });

    if (assistantMsgError) {
      console.error('Failed to save assistant message:', assistantMsgError);
    }

    // For post-run context (explicit or detected), save the coach analysis and athlete feedback to the workout
    // This happens regardless of sync action (created, updated, or already_synced)
    if (effectiveContext === 'post-run') {
      const workoutId = activitySyncResult?.workout?.id;
      console.log('[Chat] Post-run context - attempting to save notes. WorkoutId:', workoutId, 'SyncAction:', activitySyncResult?.action);

      if (workoutId) {
        try {
          const { error: workoutUpdateError } = await supabaseService
            .from('workouts')
            .update({
              coach_notes: result.response,
              personal_notes: message, // The user's message about their run
              updated_at: new Date().toISOString(),
            })
            .eq('id', workoutId);

          if (workoutUpdateError) {
            console.error('[Chat] Failed to save coach notes:', workoutUpdateError);
          } else {
            console.log('[Chat] Successfully saved coach notes to workout', workoutId);
          }
        } catch (saveError) {
          console.error('[Chat] Error saving coach notes:', saveError);
        }
      } else {
        console.warn('[Chat] Post-run context but no workout ID available. SyncResult:', {
          success: activitySyncResult?.success,
          action: activitySyncResult?.action,
          error: activitySyncResult?.error,
        });
      }
    }

    return NextResponse.json({
      success: true,
      sessionId: currentSessionId,
      response: result.response,
      agentId: result.agentId,
      routing: result.routing,
      duration: result.duration,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('Chat error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
        duration,
      },
      { status: 500 }
    );
  }
}
