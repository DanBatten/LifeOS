import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createLLMClient } from '@lifeos/llm';
import { Orchestrator } from '@lifeos/orchestrator';
import { getSupabase, insertRecord } from '@/lib/supabase';
import { getEnv } from '@/lib/env';

const ChatRequestSchema = z.object({
  message: z.string().min(1),
  sessionId: z.string().uuid().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, sessionId } = ChatRequestSchema.parse(body);

    const env = getEnv();
    const supabase = getSupabase();
    const llmClient = createLLMClient(env.LLM_PROVIDER);

    // Get or create session ID
    const currentSessionId = sessionId || crypto.randomUUID();

    // Create orchestrator
    const orchestrator = new Orchestrator(
      {
        userId: env.USER_ID,
        timezone: env.TIMEZONE,
      },
      llmClient,
      supabase
    );

    // Handle the message
    const output = await orchestrator.handleUserMessage(message);

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
      content: output.content,
      responding_agent_id: output.agentId,
      prompt_tokens: output.tokenUsage.promptTokens,
      completion_tokens: output.tokenUsage.completionTokens,
    });

    if (assistantMsgError) {
      console.error('Failed to save assistant message:', assistantMsgError);
    }

    return NextResponse.json({
      success: true,
      sessionId: currentSessionId,
      response: output.content,
      agentId: output.agentId,
      whiteboardEntries: output.whiteboardEntries,
    });
  } catch (error) {
    console.error('Chat error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
