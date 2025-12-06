/**
 * Workflow: MorningFlow
 * 
 * Triggered by 6:05 AM cron job. Does the heavy lifting:
 * 1. Syncs Garmin data to database
 * 2. Loads context for agents
 * 3. Runs health agent analysis
 * 4. Runs training coach analysis  
 * 5. Writes findings to whiteboard
 * 
 * After this runs, the user can log in and see everything ready.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { LLMProvider } from '@lifeos/llm';
import { getLogger } from '@lifeos/core';
import { syncGarminMetrics, loadAgentContext, writeToWhiteboard } from '@lifeos/skills';
import type { AgentContext, WhiteboardEntry } from '@lifeos/skills';

const logger = getLogger();

export interface MorningFlowResult {
  success: boolean;
  garminSync: {
    success: boolean;
    metricsUpdated: string[];
    errors: string[];
  };
  healthAnalysis: {
    success: boolean;
    summary: string;
    recoveryScore: number | null;
    concerns: string[];
  };
  trainingAnalysis: {
    success: boolean;
    summary: string;
    todayRecommendation: string;
  };
  whiteboardEntries: number;
  duration: number;
  errors: string[];
}

export interface MorningFlowOptions {
  skipGarminSync?: boolean;
  skipHealthAnalysis?: boolean;
  skipTrainingAnalysis?: boolean;
}

/**
 * Run the morning flow workflow
 */
export async function runMorningFlow(
  supabase: SupabaseClient,
  llmClient: LLMProvider,
  userId: string,
  timezone: string = 'America/Los_Angeles',
  options: MorningFlowOptions = {}
): Promise<MorningFlowResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let whiteboardCount = 0;

  logger.info('[Workflow:MorningFlow] Starting morning flow');

  // 1. SKILL: Sync Garmin Data
  let garminResult = { success: true, metricsUpdated: [] as string[], errors: [] as string[] };
  if (!options.skipGarminSync) {
    logger.info('[Workflow:MorningFlow] Step 1: Syncing Garmin data');
    garminResult = await syncGarminMetrics(supabase, userId);
    if (!garminResult.success) {
      errors.push(`Garmin sync failed: ${garminResult.errors.join(', ')}`);
    }
  }

  // 2. SKILL: Load Context
  logger.info('[Workflow:MorningFlow] Step 2: Loading agent context');
  const context = await loadAgentContext(supabase, userId, timezone);

  // 3. AGENT: Health Analysis (pure interpretation)
  let healthResult = { success: false, summary: '', recoveryScore: null as number | null, concerns: [] as string[] };
  if (!options.skipHealthAnalysis) {
    logger.info('[Workflow:MorningFlow] Step 3: Running health analysis');
    try {
      healthResult = await runHealthAnalysis(llmClient, context);
      
      // Write to whiteboard
      if (healthResult.success && healthResult.summary) {
        const entry: WhiteboardEntry = {
          entryType: healthResult.concerns.length > 0 ? 'alert' : 'insight',
          title: `Recovery Status: ${healthResult.recoveryScore !== null ? Math.round(healthResult.recoveryScore * 100) + '%' : 'Unknown'}`,
          content: healthResult.summary,
          agentId: 'health-agent',
          priority: healthResult.concerns.length > 0 ? 4 : 3,
          expiresAt: getEndOfDay(timezone),
        };
        const writeResult = await writeToWhiteboard(supabase, userId, entry);
        if (writeResult.success) whiteboardCount++;
      }
    } catch (e) {
      errors.push(`Health analysis failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // 4. AGENT: Training Analysis (pure interpretation)
  let trainingResult = { success: false, summary: '', todayRecommendation: '' };
  if (!options.skipTrainingAnalysis) {
    logger.info('[Workflow:MorningFlow] Step 4: Running training analysis');
    try {
      trainingResult = await runTrainingAnalysis(llmClient, context);
      
      // Write to whiteboard
      if (trainingResult.success && trainingResult.summary) {
        const entry: WhiteboardEntry = {
          entryType: 'recommendation',
          title: context.todayWorkout 
            ? `Today's Training: ${context.todayWorkout.title}`
            : 'Training Update',
          content: trainingResult.summary,
          agentId: 'training-coach',
          priority: 3,
          expiresAt: getEndOfDay(timezone),
        };
        const writeResult = await writeToWhiteboard(supabase, userId, entry);
        if (writeResult.success) whiteboardCount++;
      }
    } catch (e) {
      errors.push(`Training analysis failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const duration = Date.now() - startTime;
  logger.info(`[Workflow:MorningFlow] Completed in ${duration}ms`);

  return {
    success: errors.length === 0,
    garminSync: garminResult,
    healthAnalysis: healthResult,
    trainingAnalysis: trainingResult,
    whiteboardEntries: whiteboardCount,
    duration,
    errors,
  };
}

/**
 * Run health agent analysis - NO TOOLS, pure interpretation
 */
async function runHealthAnalysis(
  llmClient: LLMProvider,
  context: AgentContext
): Promise<{ success: boolean; summary: string; recoveryScore: number | null; concerns: string[] }> {
  const systemPrompt = `You are a health and recovery analyst. Analyze the provided health data and give a brief assessment.

Output a JSON object with:
- summary: A 2-3 sentence summary of recovery status
- recoveryScore: A number 0-1 (1 = fully recovered)
- concerns: Array of specific concerns (empty if none)

Be concise. No tool calls needed - all data is provided.`;

  const userPrompt = `Analyze this health data for ${context.userName} on ${context.date}:

TODAY'S METRICS:
${context.todayHealth ? JSON.stringify({
  sleepHours: context.todayHealth.sleepHours,
  restingHr: context.todayHealth.restingHr,
  hrv: context.todayHealth.hrv,
  hrvStatus: context.todayHealth.hrvStatus,
  bodyBattery: context.todayHealth.bodyBattery,
  stressLevel: context.todayHealth.stressLevel,
}, null, 2) : 'No data yet today'}

RECENT TREND (last 7 days):
${context.recentHealth.slice(0, 5).map(h => `${h.snapshotDate}: HR=${h.restingHr}, HRV=${h.hrv}(${h.hrvStatus}), Sleep=${h.sleepHours?.toFixed(1)}h`).join('\n')}

ACTIVE INJURIES: ${context.activeInjuries.length > 0 ? context.activeInjuries.map(i => `${i.bodyPart} (${i.severity}/10)`).join(', ') : 'None'}

Respond with ONLY a JSON object.`;

  const response = await llmClient.chat({
    systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
    model: 'claude-sonnet-4-20250514',
    temperature: 0.2,
    maxTokens: 500,
  });

  try {
    // Parse JSON from response
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return {
        success: true,
        summary: result.summary || '',
        recoveryScore: result.recoveryScore ?? null,
        concerns: result.concerns || [],
      };
    }
  } catch (e) {
    // If JSON parsing fails, use the raw response
    return {
      success: true,
      summary: response.content.slice(0, 500),
      recoveryScore: null,
      concerns: [],
    };
  }

  return { success: false, summary: '', recoveryScore: null, concerns: [] };
}

/**
 * Run training coach analysis - NO TOOLS, pure interpretation
 */
async function runTrainingAnalysis(
  llmClient: LLMProvider,
  context: AgentContext
): Promise<{ success: boolean; summary: string; todayRecommendation: string }> {
  const systemPrompt = `You are a running coach. Analyze the training context and provide guidance for today.

Output a JSON object with:
- summary: A 2-3 sentence overview of training status
- todayRecommendation: Specific guidance for today's workout (or rest)

Be concise and actionable. No tool calls needed - all data is provided.`;

  const todayWorkout = context.todayWorkout;
  const recentWorkouts = context.recentWorkouts.slice(0, 5);

  const userPrompt = `Training analysis for ${context.userName} on ${context.date}:

TODAY'S PLANNED WORKOUT:
${todayWorkout ? JSON.stringify({
  title: todayWorkout.title,
  type: todayWorkout.workoutType,
  description: todayWorkout.prescribedDescription,
  distance: todayWorkout.prescribedDistanceMiles,
  pace: todayWorkout.prescribedPacePerMile,
}, null, 2) : 'Rest day - no workout scheduled'}

TRAINING PLAN:
- Week ${context.currentWeek || '?'} of ${context.trainingPlan?.totalWeeks || '?'}
- Phase: ${context.currentPhase || 'Unknown'}
- Goal: ${context.trainingPlan?.goalEvent || 'Marathon'} in ${context.trainingPlan?.goalTime || '2:55'}

RECENT COMPLETED WORKOUTS:
${recentWorkouts.map(w => `${w.scheduledDate}: ${w.title} - ${w.actualDurationMinutes || '?'}min`).join('\n') || 'No recent workouts'}

HEALTH CONTEXT:
- Sleep: ${context.todayHealth?.sleepHours?.toFixed(1) || '?'}h
- HRV: ${context.todayHealth?.hrv || '?'} (${context.todayHealth?.hrvStatus || 'unknown'})
- Body Battery: ${context.todayHealth?.bodyBattery ? `${context.todayHealth.bodyBattery.low}-${context.todayHealth.bodyBattery.high}` : '?'}

Respond with ONLY a JSON object.`;

  const response = await llmClient.chat({
    systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
    model: 'claude-sonnet-4-20250514',
    temperature: 0.3,
    maxTokens: 500,
  });

  try {
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return {
        success: true,
        summary: result.summary || '',
        todayRecommendation: result.todayRecommendation || '',
      };
    }
  } catch (e) {
    return {
      success: true,
      summary: response.content.slice(0, 500),
      todayRecommendation: '',
    };
  }

  return { success: false, summary: '', todayRecommendation: '' };
}

function getEndOfDay(_timezone: string): string {
  // TODO: Use timezone for proper end-of-day calculation
  const now = new Date();
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);
  return endOfDay.toISOString();
}

