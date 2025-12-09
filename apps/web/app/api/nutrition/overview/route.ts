import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createLLMClient } from '@lifeos/llm';

const OverviewRequestSchema = z.object({
  sleepHours: z.number().nullable(),
  sleepQuality: z.string().nullable(), // 'solid', 'light', etc.
  runMiles: z.number().nullable(),
  runTime: z.string().nullable(), // e.g., "6:30am"
  runType: z.string().nullable(), // e.g., "easy run", "tempo", "long run"
  isMorningRun: z.boolean(),
  hasRunToday: z.boolean(),
  nextRunMiles: z.number().nullable(),
  nextRunDay: z.string().nullable(),
  hrvStatus: z.string().nullable(), // 'good', 'low', etc.
  userName: z.string().default('Dan'),
});

/**
 * Generate a conversational nutrition overview using Haiku
 * This creates natural-sounding text from structured data
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = OverviewRequestSchema.parse(body);

    const llmClient = createLLMClient();

    // Build context for Haiku
    const context = buildContext(data);

    const response = await llmClient.chat({
      model: 'claude-3-5-haiku-latest', // Fast, lightweight model for quick text generation
      systemPrompt: `You are a friendly nutrition coach for an endurance athlete. Write a brief, conversational 1-2 sentence greeting and nutrition focus for the day. Be warm but not overly enthusiastic. Sound natural, like a knowledgeable friend giving quick advice.

Rules:
- Start with "Hi ${data.userName}," or "Good morning ${data.userName}," (pick what fits)
- Keep it to 1-2 sentences max
- Be specific about pre-run food timing if there's a run today
- Mention post-run recovery if applicable
- Don't use exclamation marks excessively
- Don't use phrases like "I recommend" or "you should consider"
- Be direct and conversational`,
      messages: [
        {
          role: 'user',
          content: `Generate a nutrition overview greeting based on this context:\n\n${context}`,
        },
      ],
      maxTokens: 150,
      temperature: 0.7,
    });

    return NextResponse.json({
      overview: response.content,
    });
  } catch (error) {
    console.error('[Nutrition Overview] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate overview' },
      { status: 500 }
    );
  }
}

function buildContext(data: z.infer<typeof OverviewRequestSchema>): string {
  const parts: string[] = [];

  // Sleep context
  if (data.sleepHours !== null) {
    if (data.sleepHours >= 7.5) {
      parts.push(`Great sleep last night (${data.sleepHours.toFixed(1)} hours)`);
    } else if (data.sleepHours >= 6.5) {
      parts.push(`Decent sleep (${data.sleepHours.toFixed(1)} hours)`);
    } else {
      parts.push(`Light sleep last night (${data.sleepHours.toFixed(1)} hours)`);
    }
  }

  // HRV context
  if (data.hrvStatus === 'low') {
    parts.push('HRV is lower than usual, body may need extra recovery support');
  }

  // Today's run
  if (data.hasRunToday && data.runMiles && data.runTime) {
    const runDesc = data.runType ? `${data.runMiles} mile ${data.runType}` : `${data.runMiles} mile run`;
    parts.push(`${runDesc} scheduled at ${data.runTime}`);

    if (data.isMorningRun) {
      parts.push('Morning run - needs light pre-run snack (banana, rice cake) about 30-45 min before');
      parts.push('Post-run breakfast should focus on carbs + protein for recovery');
    } else {
      parts.push('Afternoon/evening run - front-load carbs at breakfast, keep lunch moderate');
      parts.push('Have light snack 30-45 min before run');
    }

    if (data.runMiles > 10) {
      parts.push('Long run day - prioritize carb-rich recovery meals and hydration throughout the day');
    }
  } else if (data.nextRunMiles && data.nextRunDay) {
    parts.push(`Rest day today. Next run: ${data.nextRunMiles} miles on ${data.nextRunDay}`);
    parts.push('Focus on balanced nutrition and staying hydrated for upcoming training');
  } else {
    parts.push('No run scheduled today - focus on balanced whole foods');
  }

  return parts.join('\n');
}
