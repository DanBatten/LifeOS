/**
 * Workflow: ChatFlow
 * 
 * Handles user chat messages. This should be FAST because:
 * 1. All data is pre-loaded from database (no Garmin calls)
 * 2. Agents respond from context (no tool calls for data)
 * 3. Smart LLM-based routing to correct agent
 * 
 * Target: <10 second response time
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { LLMProvider } from '@lifeos/llm';
import { getLogger } from '@lifeos/core';
import { loadAgentContext } from '@lifeos/skills';
import type { AgentContext } from '@lifeos/skills';
import { routeMessage, quickRoute, type RouteResult, type ConversationMessage } from './router.js';

const logger = getLogger();

export interface ChatFlowResult {
  success: boolean;
  response: string;
  agentId: string;
  routing: {
    confidence: number;
    reasoning: string;
    timeMs: number;
  };
  tokenUsage: {
    prompt: number;
    completion: number;
    total: number;
  };
  duration: number;
}

export interface ChatFlowOptions {
  conversationHistory?: ConversationMessage[];
}

/**
 * Run the chat flow - fast, context-based responses with smart routing
 */
export async function runChatFlow(
  supabase: SupabaseClient,
  llmClient: LLMProvider,
  userId: string,
  message: string,
  timezone: string = 'America/Los_Angeles',
  options: ChatFlowOptions = {}
): Promise<ChatFlowResult> {
  const startTime = Date.now();
  
  logger.info(`[Workflow:ChatFlow] Processing message: "${message.slice(0, 50)}..."`);

  // 1. Smart routing - try quick route first, then LLM if needed
  let routeResult: RouteResult;
  const quickResult = quickRoute(message);
  
  if (quickResult) {
    routeResult = quickResult;
    logger.info(`[Workflow:ChatFlow] Quick routed to: ${routeResult.agentId} (${routeResult.reasoning})`);
  } else {
    routeResult = await routeMessage(llmClient, message, options.conversationHistory);
    logger.info(`[Workflow:ChatFlow] LLM routed to: ${routeResult.agentId} (confidence: ${routeResult.confidence}, ${routeResult.routingTimeMs}ms)`);
  }

  // 2. SKILL: Load Context (fast DB reads)
  const context = await loadAgentContext(supabase, userId, timezone);

  // 3. AGENT: Get response (NO TOOLS - pure interpretation)
  const response = await getAgentResponse(llmClient, routeResult.agentId, context, message);

  const duration = Date.now() - startTime;
  logger.info(`[Workflow:ChatFlow] Completed in ${duration}ms`);

  return {
    success: true,
    response: response.content,
    agentId: routeResult.agentId,
    routing: {
      confidence: routeResult.confidence,
      reasoning: routeResult.reasoning,
      timeMs: routeResult.routingTimeMs,
    },
    tokenUsage: {
      prompt: response.usage.promptTokens,
      completion: response.usage.completionTokens,
      total: response.usage.totalTokens,
    },
    duration,
  };
}

/**
 * Get agent response - pure interpretation, no tools
 */
async function getAgentResponse(
  llmClient: LLMProvider,
  agentId: string,
  context: AgentContext,
  message: string
): Promise<{ content: string; usage: { promptTokens: number; completionTokens: number; totalTokens: number } }> {
  
  const systemPrompt = agentId === 'health-agent' 
    ? buildHealthAgentPrompt(context)
    : buildTrainingCoachPrompt(context);

  const userPrompt = `${message}

---
Remember: All data is provided above. Answer directly from the context. Be concise and helpful.`;

  const response = await llmClient.chat({
    systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
    model: 'claude-sonnet-4-20250514',
    temperature: 0.4,
    maxTokens: 1500,
  });

  return {
    content: response.content,
    usage: response.usage,
  };
}

/**
 * Build health agent system prompt with all context embedded
 */
function buildHealthAgentPrompt(context: AgentContext): string {
  const health = context.todayHealth;
  const recentHealth = context.recentHealth.slice(0, 5);
  
  return `You are a supportive health and recovery advisor for ${context.userName}. Today is ${context.date}.

## Your Role
- Analyze health metrics and recovery status
- Provide balanced, supportive recommendations
- Flag concerns without being alarmist
- Acknowledge that training stress is normal

## TODAY'S HEALTH DATA
${health ? `
- Sleep: ${health.sleepHours?.toFixed(1) || '?'} hours
- Resting HR: ${health.restingHr || '?'} bpm
- HRV: ${health.hrv || '?'} (Status: ${health.hrvStatus || 'unknown'})
- Body Battery: ${health.bodyBattery ? `${health.bodyBattery.low} - ${health.bodyBattery.high}` : 'Not available'}
- Stress Level: ${health.stressLevel || 'Not available'}
` : 'No health data synced for today yet.'}

## RECENT HEALTH TREND (last 5 days)
${recentHealth.length > 0 ? recentHealth.map(h => 
  `${h.snapshotDate}: Sleep=${h.sleepHours?.toFixed(1) || '?'}h, HR=${h.restingHr || '?'}, HRV=${h.hrv || '?'}(${h.hrvStatus || '?'})`
).join('\n') : 'No recent health data'}

## RECENT WHITEBOARD NOTES
${context.whiteboardEntries.length > 0 ? context.whiteboardEntries.slice(0, 3).map(e => 
  `[${e.entryType}] ${e.title}: ${e.content.slice(0, 100)}...`
).join('\n') : 'No recent notes'}

## ACTIVE INJURIES
${context.activeInjuries.length > 0 ? context.activeInjuries.map(i => 
  `${i.bodyPart}: Severity ${i.severity}/10 - ${i.notes || 'No notes'}`
).join('\n') : 'None'}

## INSTRUCTIONS
- Answer questions directly from the data provided above
- DO NOT say you need to check or fetch data - it's all here
- Be concise and actionable
- If data is missing, say so but give best guidance based on what's available`;
}

/**
 * Build training coach system prompt with all context embedded
 */
function buildTrainingCoachPrompt(context: AgentContext): string {
  const todayWorkout = context.todayWorkout;
  const upcomingWorkouts = context.upcomingWorkouts.slice(0, 3);
  const recentWorkouts = context.recentWorkouts.slice(0, 5);
  const health = context.todayHealth;

  return `You are an expert running coach for ${context.userName}. Today is ${context.date}.

## Training Context
- Week ${context.currentWeek || '?'} of ${context.trainingPlan?.totalWeeks || '16'}
- Phase: ${context.currentPhase || 'Build'}
- Goal: ${context.trainingPlan?.goalEvent || 'Marathon'} - Target ${context.trainingPlan?.goalTime || '2:55'}

## TODAY'S WORKOUT
${todayWorkout ? `
**${todayWorkout.title}**
- Type: ${todayWorkout.workoutType}
- Distance: ${todayWorkout.prescribedDistanceMiles || '?'} miles
- Pace: ${todayWorkout.prescribedPacePerMile || 'As prescribed'}
- Description: ${todayWorkout.prescribedDescription || 'See plan'}
` : '**Rest Day** - No workout scheduled'}

## UPCOMING WORKOUTS
${upcomingWorkouts.length > 0 ? upcomingWorkouts.map(w => 
  `${w.scheduledDate}: ${w.title} (${w.prescribedDistanceMiles || '?'} mi)`
).join('\n') : 'No upcoming workouts loaded'}

## RECENT COMPLETED WORKOUTS (last 7 days)
${recentWorkouts.length > 0 ? recentWorkouts.map(w => {
  const details = [
    `**${w.scheduledDate}: ${w.title}**`,
    `- Type: ${w.workoutType}`,
    w.prescribedDistanceMiles ? `- Distance: ${w.prescribedDistanceMiles} miles` : null,
    w.actualDurationMinutes ? `- Duration: ${w.actualDurationMinutes} min` : null,
    w.avgHeartRate ? `- Avg HR: ${w.avgHeartRate} bpm` : null,
    w.prescribedPacePerMile ? `- Prescribed Pace: ${w.prescribedPacePerMile}` : null,
    w.prescribedDescription ? `- Description: ${w.prescribedDescription}` : null,
    w.splits && w.splits.length > 0 ? `- Splits: ${JSON.stringify(w.splits)}` : null,
    w.coachNotes ? `- Coach Notes: ${w.coachNotes.slice(0, 300)}${w.coachNotes.length > 300 ? '...' : ''}` : null,
  ].filter(Boolean).join('\n');
  return details;
}).join('\n\n') : 'No recent completed workouts'}

## TODAY'S RECOVERY STATUS
${health ? `
- Sleep: ${health.sleepHours?.toFixed(1) || '?'} hours
- HRV: ${health.hrv || '?'} (${health.hrvStatus || 'unknown'})
- Body Battery: ${health.bodyBattery ? `${health.bodyBattery.low}-${health.bodyBattery.high}` : '?'}
` : 'No health data synced yet'}

## RECENT COACH NOTES
${context.whiteboardEntries.filter(e => e.agentId === 'training-coach').slice(0, 2).map(e => 
  `${e.title}: ${e.content.slice(0, 150)}...`
).join('\n') || 'No recent notes'}

## INSTRUCTIONS
- Answer questions directly from the data provided above
- DO NOT say you need to analyze or fetch data - it's all here
- Be specific: cite paces, distances, HR targets when relevant
- Be encouraging but honest about concerns
- If asked about today's run, reference the workout details above`;
}

