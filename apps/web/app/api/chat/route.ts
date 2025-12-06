import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createLLMClient } from '@lifeos/llm';
import { runChatFlow, type ConversationMessage } from '@lifeos/workflows';
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
 * Features:
 * - Smart LLM-based routing to correct agent
 * - Conversation context for better routing decisions
 * - Fast responses (<10s) with pre-loaded data
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
      { conversationHistory }
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
