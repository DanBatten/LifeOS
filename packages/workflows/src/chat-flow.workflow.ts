/**
 * Workflow: ChatFlow
 * 
 * Handles user chat messages with smart routing and full agent capabilities.
 * Agents CAN use tools when the user requests actions (schedule changes, etc.)
 * 
 * Flow:
 * 1. Quick/LLM routing to correct agent
 * 2. Load context from database (fast)
 * 3. Agent processes with full tool access
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { LLMProvider } from '@lifeos/llm';
import { getLogger } from '@lifeos/core';
import { loadAgentContext } from '@lifeos/skills';
import type { AgentContext } from '@lifeos/skills';
import { routeMessage, quickRoute, type RouteResult, type ConversationMessage } from './router.js';
import { HealthAgent, TrainingCoachAgent } from '@lifeos/agents';

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

/**
 * Context types determine routing and data priority:
 * - default: Broad context, auto-route based on message
 * - post-run: Training focused, force training-coach, include synced workout
 * - health: Health focused, prefer health-agent
 * - planning: Planning focused, balanced routing
 */
export interface ChatFlowOptions {
  conversationHistory?: ConversationMessage[];
  context?: 'default' | 'training' | 'post-run' | 'health' | 'planning';
  syncedWorkout?: {
    id: string;
    title: string;
    workoutType: string;
    scheduledDate: string;
    status: string;
    prescribedDistanceMiles: number | null;
    prescribedPacePerMile: string | null;
    prescribedDescription: string | null;
    actualDurationMinutes: number | null;
    actualDistanceMiles: number | null;
    actualPacePerMile: string | null;
    avgHeartRate: number | null;
    maxHeartRate: number | null;
    calories: number | null;
    elevationGainFt: number | null;
    cadenceAvg: number | null;
    splits: unknown[];
    coachNotes: string | null;
    athleteFeedback: string | null;
    perceivedExertion: number | null;
    matchedToPlannedWorkout: boolean;
    garminActivityId: string | null;
  };
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

  logger.info(`[Workflow:ChatFlow] Processing message: "${message.slice(0, 50)}..." (context: ${options.context || 'default'})`);

  // 1. Smart routing - context influences agent selection
  let routeResult: RouteResult;
  const pageContext = options.context || 'default';

  // Context-based routing: page context provides strong hints but doesn't always force
  if (pageContext === 'post-run') {
    // Post-run: Always route to training coach for workout analysis
    routeResult = {
      agentId: 'training-coach',
      confidence: 1.0,
      reasoning: 'Post-run context - routing to training coach for workout analysis',
      routingTimeMs: 0,
    };
    logger.info(`[Workflow:ChatFlow] Post-run context: routed to training-coach`);
    if (options.syncedWorkout) {
      logger.info(`[Workflow:ChatFlow] Synced workout available: ${options.syncedWorkout.title}`);
    }
  } else if (pageContext === 'training') {
    // Training context: Prefer training coach unless message clearly indicates health-only
    const quickResult = quickRoute(message);
    if (quickResult && quickResult.agentId === 'health-agent') {
      routeResult = {
        agentId: 'health-agent',
        confidence: 0.85,
        reasoning: 'Training context but explicit health query - routing to health agent',
        routingTimeMs: 0,
      };
      logger.info(`[Workflow:ChatFlow] Training context but health query: routed to health-agent`);
    } else {
      routeResult = {
        agentId: 'training-coach',
        confidence: 0.9,
        reasoning: 'Training page context - prioritizing training coach',
        routingTimeMs: 0,
      };
      logger.info(`[Workflow:ChatFlow] Training context: routed to training-coach`);
    }
  } else if (pageContext === 'health') {
    // Health context: Prefer health agent unless message clearly indicates training
    const quickResult = quickRoute(message);
    if (quickResult && quickResult.agentId === 'training-coach') {
      // User explicitly asked about training - honor that
      routeResult = quickResult;
      logger.info(`[Workflow:ChatFlow] Health context but training query: ${routeResult.agentId}`);
    } else {
      routeResult = {
        agentId: 'health-agent',
        confidence: 0.9,
        reasoning: 'Health page context - prioritizing health and recovery analysis',
        routingTimeMs: 0,
      };
      logger.info(`[Workflow:ChatFlow] Health context: routed to health-agent`);
    }
  } else {
    // Default or planning context: Use standard routing
    const quickResult = quickRoute(message);

    if (quickResult) {
      routeResult = quickResult;
      logger.info(`[Workflow:ChatFlow] Quick routed to: ${routeResult.agentId} (${routeResult.reasoning})`);
    } else {
      routeResult = await routeMessage(llmClient, message, options.conversationHistory);
      logger.info(`[Workflow:ChatFlow] LLM routed to: ${routeResult.agentId} (confidence: ${routeResult.confidence}, ${routeResult.routingTimeMs}ms)`);
    }
  }

  // 2. SKILL: Load Context (fast DB reads)
  const context = await loadAgentContext(supabase, userId, timezone);

  // 3. AGENT: Get response (with tools for modifications)
  const response = await getAgentResponse(supabase, llmClient, routeResult.agentId, context, message, options.syncedWorkout);

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
 * Get agent response using actual agent with tools
 */
async function getAgentResponse(
  supabase: SupabaseClient,
  llmClient: LLMProvider,
  agentId: string,
  context: AgentContext,
  message: string,
  syncedWorkout?: ChatFlowOptions['syncedWorkout']
): Promise<{ content: string; usage: { promptTokens: number; completionTokens: number; totalTokens: number } }> {

  // Check if this seems like a simple query or a modification request
  const isModificationRequest = detectModificationRequest(message);

  if (isModificationRequest) {
    // Use full agent with tools for modification requests
    logger.info(`[ChatFlow] Detected modification request, using full agent with tools`);
    return getAgentResponseWithTools(supabase, llmClient, agentId, context, message);
  }

  // For simple queries, use fast path (no tools)
  const systemPrompt = agentId === 'health-agent'
    ? buildHealthAgentPrompt(context)
    : buildTrainingCoachPrompt(context, syncedWorkout);

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
 * Detect if message is requesting a modification/action
 */
function detectModificationRequest(message: string): boolean {
  const modificationPatterns = [
    /\b(update|change|modify|move|reschedule|shift|switch)\b/i,
    /\b(add|set|create|insert)\s+(nutrition|fueling|notes|guidance)/i,
    /\bwant\s+to\s+run\b.*\b(mon|tue|wed|thu|fri|sat|sun)/i,
    /\b(my|the)\s+schedule\b/i,
    /\brest\s+days?\b/i,
    /\bmove\s+(my|the|this)\b/i,
    // Sync/log patterns - trigger Garmin sync tool
    /\b(sync|synch|log|pull|fetch)\s+(my|the|those|these)?\s*(run|runs|workout|workouts|activity|activities)/i,
    /\b(sync|synch|log)\s+(from|my)\s*(garmin)?/i,
    /\bneed\s+to\s+(log|sync)/i,
    /\bcompleted\s+(my|a|the)?\s*(run|workout)/i,
    /\bdid\s+(my|a|the)\s*(run|workout|long run|intervals|tempo)/i,
  ];
  
  return modificationPatterns.some(pattern => pattern.test(message));
}

/**
 * Get agent response with full tool capabilities
 */
async function getAgentResponseWithTools(
  supabase: SupabaseClient,
  llmClient: LLMProvider,
  agentId: string,
  context: AgentContext,
  message: string
): Promise<{ content: string; usage: { promptTokens: number; completionTokens: number; totalTokens: number } }> {
  
  // Create the actual agent
  const agent = agentId === 'health-agent'
    ? new HealthAgent(llmClient)
    : new TrainingCoachAgent(llmClient);
  
  // Build agent context with supabase for tool execution
  const agentContext = {
    userId: context.userId,
    userName: context.userName,
    date: context.date,
    timezone: context.timezone,
    supabase,
    data: {
      taskType: 'chat_response',
      userMessage: message,
      todayHealth: context.todayHealth,
      recentHealth: context.recentHealth,
      todayWorkout: context.todayWorkout,
      upcomingWorkouts: context.upcomingWorkouts,
      recentWorkouts: context.recentWorkouts,
      whiteboardEntries: context.whiteboardEntries,
      activeInjuries: context.activeInjuries,
      trainingPlan: context.trainingPlan,
      currentWeek: context.currentWeek,
      currentPhase: context.currentPhase,
    },
  };

  // Execute with full tool access
  const result = await agent.execute(agentContext);
  
  return {
    content: result.content,
    usage: {
      promptTokens: result.tokenUsage.promptTokens,
      completionTokens: result.tokenUsage.completionTokens,
      totalTokens: result.tokenUsage.totalTokens,
    },
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
function buildTrainingCoachPrompt(context: AgentContext, syncedWorkout?: ChatFlowOptions['syncedWorkout']): string {
  const todayWorkout = context.todayWorkout;
  const upcomingWorkouts = context.upcomingWorkouts.slice(0, 3);
  const recentWorkouts = context.recentWorkouts.slice(0, 5);
  const health = context.todayHealth;

  // Calculate timezone-aware dates (timezone comes from user's database settings)
  const userTimezone = context.timezone || 'America/Los_Angeles';
  const now = new Date();
  const userNow = new Date(now.toLocaleString('en-US', { timeZone: userTimezone }));
  const todayInUserTz = userNow.toISOString().split('T')[0];
  const yesterdayInUserTz = new Date(userNow.getTime() - 86400000).toISOString().split('T')[0];

  // Build the synced workout section if available (freshly synced from Garmin)
  let syncedWorkoutSection = '';
  if (syncedWorkout) {
    // Format lap data for analysis
    let lapAnalysis = '';
    if (syncedWorkout.splits && syncedWorkout.splits.length > 0) {
      const laps = syncedWorkout.splits as Array<{
        lapNumber: number;
        distanceMiles: number;
        durationSeconds: number;
        pacePerMile: string | null;
        avgHeartRate?: number;
        elevationGainFt?: number;
      }>;

      // Calculate totals for context
      const totalLapDistance = laps.reduce((sum, l) => sum + l.distanceMiles, 0);
      const totalLapTime = laps.reduce((sum, l) => sum + l.durationSeconds, 0);

      lapAnalysis = `
### LAP-BY-LAP DATA (USE THIS FOR ANALYSIS)
| Lap | Distance | Duration | Pace | Avg HR | Elevation |
|-----|----------|----------|------|--------|-----------|
${laps.map(lap => {
  const mins = Math.floor(lap.durationSeconds / 60);
  const secs = Math.round(lap.durationSeconds % 60);
  return `| ${lap.lapNumber} | ${lap.distanceMiles.toFixed(2)} mi | ${mins}:${String(secs).padStart(2, '0')} | ${lap.pacePerMile || 'N/A'} | ${lap.avgHeartRate || 'N/A'} bpm | +${lap.elevationGainFt || 0} ft |`;
}).join('\n')}
| **TOTAL** | **${totalLapDistance.toFixed(2)} mi** | **${Math.floor(totalLapTime / 60)}:${String(Math.round(totalLapTime % 60)).padStart(2, '0')}** | | | |
`;
    }

    // Parse the prescribed workout to help the agent understand the structure
    const prescription = syncedWorkout.prescribedDescription || '';
    let workoutStructure = '';

    // Parse common workout formats like "2 mi WU → 35 min @ 6:10-6:15/mi → 1 mi CD"
    const wuMatch = prescription.match(/(\d+(?:\.\d+)?)\s*mi\s*WU/i);
    const cdMatch = prescription.match(/(\d+(?:\.\d+)?)\s*mi\s*CD/i);
    const mainSetTimeMatch = prescription.match(/(\d+)\s*min\s*@\s*([0-9:]+(?:-[0-9:]+)?)/i);
    const mainSetDistMatch = prescription.match(/(\d+(?:\.\d+)?)\s*mi\s*@\s*([0-9:]+(?:-[0-9:]+)?)/i);
    const hrMatch = prescription.match(/HR\s*(\d+)-(\d+)/i);

    if (wuMatch || cdMatch || mainSetTimeMatch || mainSetDistMatch) {
      workoutStructure = `
### PARSED WORKOUT STRUCTURE (from prescription)
`;
      if (wuMatch) workoutStructure += `- **Warmup:** ${wuMatch[1]} miles easy\n`;
      if (mainSetTimeMatch) {
        workoutStructure += `- **Main Set:** ${mainSetTimeMatch[1]} MINUTES at ${mainSetTimeMatch[2]} pace\n`;
      } else if (mainSetDistMatch) {
        workoutStructure += `- **Main Set:** ${mainSetDistMatch[1]} miles at ${mainSetDistMatch[2]} pace\n`;
      }
      if (cdMatch) workoutStructure += `- **Cooldown:** ${cdMatch[1]} mile(s) easy\n`;
      if (hrMatch) workoutStructure += `- **Target HR:** ${hrMatch[1]}-${hrMatch[2]} bpm\n`;

      workoutStructure += `
**HOW TO IDENTIFY MAIN SET LAPS:**
1. Look for laps with pace close to the target pace (${mainSetTimeMatch?.[2] || mainSetDistMatch?.[2] || 'prescribed pace'})
2. Look for laps with HR in the target zone (${hrMatch ? `${hrMatch[1]}-${hrMatch[2]} bpm` : '~170-180 bpm for threshold'})
3. WU laps are typically SLOWER pace and LOWER HR
4. CD laps are typically SLOWER pace (often 8:00+/mi) at the END
5. Elevation can slow pace - account for this in hilly sections
`;
    }

    syncedWorkoutSection = `
## 🏃 JUST COMPLETED - FRESH FROM GARMIN
**${syncedWorkout.title}**

### OVERALL TOTALS (⚠️ includes warmup & cooldown - NOT useful for main set analysis)
- Total Distance: ${syncedWorkout.actualDistanceMiles?.toFixed(2) || 'N/A'} miles
- Total Duration: ${syncedWorkout.actualDurationMinutes || 'N/A'} minutes
- Overall Avg Pace: ${syncedWorkout.actualPacePerMile || 'N/A'}/mi (misleading - includes WU/CD!)
- Overall Avg HR: ${syncedWorkout.avgHeartRate || 'N/A'} bpm (misleading - includes WU/CD!)
- Max HR: ${syncedWorkout.maxHeartRate || 'N/A'} bpm
- Elevation Gain: ${syncedWorkout.elevationGainFt || 'N/A'} ft

### PRESCRIBED WORKOUT
**${syncedWorkout.prescribedDescription || 'No prescription linked'}**
${syncedWorkout.prescribedPacePerMile ? `Target Pace: ${syncedWorkout.prescribedPacePerMile}` : ''}
${workoutStructure}
${lapAnalysis}

## ⚠️ CRITICAL ANALYSIS INSTRUCTIONS ⚠️
You MUST analyze this workout correctly:

1. **READ THE PRESCRIPTION CAREFULLY** - It tells you the workout structure (WU distance, main set TIME or DISTANCE, CD distance)

2. **IDENTIFY MAIN SET LAPS** by looking at:
   - Pace that matches target (e.g., 6:10-6:15/mi for threshold)
   - HR in target zone (e.g., 172-180 bpm for threshold)
   - NOT the first few laps (those are warmup)
   - NOT the last lap if it's slow (that's cooldown)

3. **CALCULATE MAIN SET TOTALS**:
   - Add up ONLY the main set laps' distance and time
   - Calculate average pace and HR for JUST those laps
   - Compare to prescription targets

4. **ACCOUNT FOR TERRAIN** - If laps show high elevation gain, pace will be slower than flat ground

5. **NEVER USE OVERALL AVERAGES** - They are meaningless for structured workouts

6. **SHOW YOUR WORK** - List which laps you identified as main set and why
`;
  }

  return `You are an expert running coach for ${context.userName}.

## TIMEZONE & DATE REFERENCE
- Athlete's timezone: ${userTimezone}  
- TODAY in athlete's timezone: ${todayInUserTz}
- YESTERDAY in athlete's timezone: ${yesterdayInUserTz}
- Use these dates when athlete says "today", "yesterday", "last run", etc.
${syncedWorkoutSection}

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
