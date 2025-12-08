/**
 * Test Script for SDK-based Training Coach Agent
 *
 * This script demonstrates how to use the new SDK-based agent.
 * Run with: npx tsx scripts/test-sdk-agent.ts
 *
 * Prerequisites:
 * - ANTHROPIC_API_KEY environment variable set
 * - Supabase connection configured
 */

import { SdkTrainingCoachAgent } from '@lifeos/agents';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const USER_ID = process.env.USER_ID || '00000000-0000-0000-0000-000000000001';

async function main() {
  console.log('🚀 Testing SDK Training Coach Agent\n');

  // Create Supabase client
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Create the SDK-based agent
  const agent = new SdkTrainingCoachAgent();

  console.log(`Agent: ${agent.name}`);
  console.log(`ID: ${agent.id}`);
  console.log(`Description: ${agent.description}\n`);

  // Build test context
  const today = new Date().toISOString().split('T')[0];
  const context = {
    userId: USER_ID,
    date: today,
    userName: 'Daniel',
    timezone: 'America/Los_Angeles',
    supabase,
    data: {
      taskType: 'chat_response',
      userMessage: "How am I looking for my long run this weekend? Should I be concerned about anything?",
      baselineRhr: 48,
      currentPhase: 'Build',
      goalEvent: 'Marathon',
      goalTime: '2:55',
      goalPace: '6:40/mi',
      currentWeek: 8,
      totalWeeks: 16,
      todayHealth: {
        sleepHours: 7.5,
        hrv: 65,
        restingHr: 50,
        energyLevel: 7,
      },
      upcomingWorkouts: [
        {
          id: 'test-workout-1',
          title: 'Easy Recovery Run',
          scheduled_date: today,
          prescribed_distance_miles: 5,
          workout_type: 'easy',
        },
        {
          id: 'test-workout-2',
          title: 'Long Run',
          scheduled_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          prescribed_distance_miles: 16,
          workout_type: 'long',
        },
      ],
      recentWorkouts: [
        {
          scheduled_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          title: 'Tempo Run',
          actual_duration_minutes: 55,
          avg_heart_rate: 155,
          training_load: 180,
          status: 'completed',
        },
        {
          scheduled_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          title: 'Easy Run',
          actual_duration_minutes: 45,
          avg_heart_rate: 135,
          training_load: 90,
          status: 'completed',
        },
      ],
    },
  };

  console.log('📝 Test Query:', context.data.userMessage);
  console.log('\n--- Executing Agent (this may take 10-30 seconds) ---\n');

  try {
    // Execute the agent
    const startTime = Date.now();
    const output = await agent.execute(context);
    const duration = Date.now() - startTime;

    console.log('✅ Agent Response:\n');
    console.log(output.content);
    console.log('\n--- Execution Stats ---');
    console.log(`Duration: ${duration}ms`);
    console.log(`Token Usage: ${output.tokenUsage.totalTokens} tokens`);
    console.log(`  - Prompt: ${output.tokenUsage.promptTokens}`);
    console.log(`  - Completion: ${output.tokenUsage.completionTokens}`);
    if (output.totalCostUsd) {
      console.log(`Cost: $${output.totalCostUsd.toFixed(4)}`);
    }
    if (output.numTurns) {
      console.log(`Turns: ${output.numTurns}`);
    }
    if (output.sessionId) {
      console.log(`Session ID: ${output.sessionId}`);
    }
    console.log(`Tool Calls: ${output.toolCallsMade.length}`);
    if (output.toolCallsMade.length > 0) {
      console.log('Tools Used:');
      for (const tc of output.toolCallsMade) {
        console.log(`  - ${tc.name} (${tc.duration}ms)`);
      }
    }
    console.log(`Whiteboard Entries: ${output.whiteboardEntries.length}`);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

main().catch(console.error);
