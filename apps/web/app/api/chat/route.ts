import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createLLMClient } from '@lifeos/llm';
import { runChatFlow } from '@lifeos/workflows';
import { getSupabase, insertRecord } from '@/lib/supabase';
import { getEnv } from '@/lib/env';

const ChatRequestSchema = z.object({
  message: z.string().min(1),
  sessionId: z.string().uuid().nullish(),
});

/**
 * Chat Endpoint
 * 
 * Handles user chat messages using the ChatFlow workflow.
 * This should be FAST (<10s) because:
 * - All data is pre-loaded from database (no Garmin calls)
 * - Agents respond from context (no tool calls for data fetching)
 * 
 * Heavy analysis happens in the morning cron job.
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { message, sessionId } = ChatRequestSchema.parse(body);

    const env = getEnv();
    const supabase = getSupabase();
    const llmClient = createLLMClient();

    // Get or create session ID
    const currentSessionId = sessionId || crypto.randomUUID();

    // Run the chat workflow
    const result = await runChatFlow(
      supabase,
      llmClient,
      env.USER_ID,
      message,
      env.TIMEZONE
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

    return NextResponse.json({
      success: true,
      sessionId: currentSessionId,
      response: result.response,
      agentId: result.agentId,
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
