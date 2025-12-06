/**
 * Workflow: PostRunFlow
 * 
 * Triggered after a run to:
 * 1. Sync the latest activity from Garmin
 * 2. Generate coach analysis
 * 3. Save coach notes to database
 * 4. Initiate conversation with training coach
 * 
 * Returns initial coach analysis that can be followed up with chat.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { LLMProvider } from '@lifeos/llm';
import { getLogger } from '@lifeos/core';
import { 
  syncLatestActivity, 
  loadAgentContext, 
  writeToWhiteboard,
  type SyncedWorkout 
} from '@lifeos/skills';

const logger = getLogger();

export interface PostRunFlowResult {
  success: boolean;
  workout: SyncedWorkout | null;
  syncAction: 'created' | 'updated' | 'already_synced' | 'no_activity';
  coachAnalysis: {
    summary: string;
    highlights: string[];
    areasToNote: string[];
    nextSteps: string;
  } | null;
  coachNotesSaved: boolean;
  conversationStarter: string;
  duration: number;
  error?: string;
}

export interface PostRunFlowOptions {
  date?: string;
  forceResync?: boolean;
  athleteFeedback?: string; // Optional user feedback about how they felt
  perceivedExertion?: number; // 1-10 RPE scale
}

/**
 * Run the post-run workflow
 */
export async function runPostRunFlow(
  supabase: SupabaseClient,
  llmClient: LLMProvider,
  userId: string,
  timezone: string = 'America/Los_Angeles',
  options: PostRunFlowOptions = {}
): Promise<PostRunFlowResult> {
  const startTime = Date.now();
  
  logger.info('[Workflow:PostRunFlow] Starting post-run analysis');

  try {
    // 1. SKILL: Sync latest activity from Garmin
    logger.info('[Workflow:PostRunFlow] Step 1: Syncing activity');
    const syncResult = await syncLatestActivity(supabase, userId, {
      date: options.date,
      forceResync: options.forceResync,
    });

    if (!syncResult.success || !syncResult.workout) {
      return {
        success: false,
        workout: null,
        syncAction: syncResult.action,
        coachAnalysis: null,
        coachNotesSaved: false,
        conversationStarter: syncResult.error 
          ? `I couldn't sync your run: ${syncResult.error}` 
          : "I don't see a recent run to analyze. Did you sync your watch?",
        duration: Date.now() - startTime,
        error: syncResult.error,
      };
    }

    const workout = syncResult.workout;
    logger.info(`[Workflow:PostRunFlow] Synced workout: ${workout.title}`);

    // 2. Save athlete feedback if provided
    if (options.athleteFeedback || options.perceivedExertion) {
      await supabase
        .from('workouts')
        .update({
          athlete_feedback: options.athleteFeedback,
          perceived_exertion: options.perceivedExertion,
        })
        .eq('id', workout.id);
    }

    // 3. SKILL: Load full context for analysis
    logger.info('[Workflow:PostRunFlow] Step 2: Loading context');
    const context = await loadAgentContext(supabase, userId, timezone);

    // 4. AGENT: Generate coach analysis
    logger.info('[Workflow:PostRunFlow] Step 3: Generating coach analysis');
    const coachAnalysis = await generateCoachAnalysis(llmClient, workout, context, options);

    // 5. Save coach notes to database
    logger.info('[Workflow:PostRunFlow] Step 4: Saving coach notes');
    const coachNotes = formatCoachNotes(coachAnalysis);
    
    const { error: updateError } = await supabase
      .from('workouts')
      .update({ coach_notes: coachNotes })
      .eq('id', workout.id);

    const coachNotesSaved = !updateError;
    if (updateError) {
      logger.error(`[Workflow:PostRunFlow] Failed to save coach notes: ${updateError.message}`);
    }

    // 6. Write to whiteboard for visibility
    await writeToWhiteboard(supabase, userId, {
      entryType: 'summary',
      title: `Post-Run Analysis: ${workout.title}`,
      content: coachAnalysis.summary,
      agentId: 'training-coach',
      priority: 4,
    });

    // 7. Generate conversation starter
    const conversationStarter = generateConversationStarter(workout, coachAnalysis, options);

    const duration = Date.now() - startTime;
    logger.info(`[Workflow:PostRunFlow] Completed in ${duration}ms`);

    return {
      success: true,
      workout,
      syncAction: syncResult.action,
      coachAnalysis,
      coachNotesSaved,
      conversationStarter,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`[Workflow:PostRunFlow] Error: ${message}`);

    return {
      success: false,
      workout: null,
      syncAction: 'no_activity',
      coachAnalysis: null,
      coachNotesSaved: false,
      conversationStarter: `Sorry, I ran into an issue analyzing your run: ${message}`,
      duration,
      error: message,
    };
  }
}

/**
 * Generate coach analysis using LLM
 */
async function generateCoachAnalysis(
  llmClient: LLMProvider,
  workout: SyncedWorkout,
  context: Awaited<ReturnType<typeof loadAgentContext>>,
  options: PostRunFlowOptions
): Promise<{
  summary: string;
  highlights: string[];
  areasToNote: string[];
  nextSteps: string;
}> {
  const systemPrompt = `You are an expert running coach analyzing a just-completed workout. Provide specific, actionable feedback.

Output a JSON object with:
- summary: 2-3 sentence overall assessment
- highlights: Array of 2-3 positive observations
- areasToNote: Array of 0-2 areas to watch or improve (be constructive, not critical)
- nextSteps: One sentence on what to focus on next

Be encouraging but honest. Reference specific metrics when possible.`;

  const workoutDetails = `
COMPLETED WORKOUT:
- Title: ${workout.title}
- Date: ${workout.scheduledDate}
- Distance: ${workout.actualDistanceMiles || '?'} miles
- Duration: ${workout.actualDurationMinutes || '?'} minutes
- Pace: ${workout.actualPacePerMile || 'Unknown'}
- Avg HR: ${workout.avgHeartRate || '?'} bpm
- Max HR: ${workout.maxHeartRate || '?'} bpm
- Elevation Gain: ${workout.elevationGainFt || '?'} ft
- Cadence: ${workout.cadenceAvg || '?'} spm

PRESCRIBED (if from training plan):
- Distance: ${workout.prescribedDistanceMiles || 'N/A'} miles
- Pace: ${workout.prescribedPacePerMile || 'N/A'}
- Description: ${workout.prescribedDescription || 'N/A'}

${options.athleteFeedback ? `ATHLETE FEEDBACK: ${options.athleteFeedback}` : ''}
${options.perceivedExertion ? `PERCEIVED EXERTION (RPE): ${options.perceivedExertion}/10` : ''}

TRAINING CONTEXT:
- Week ${context.currentWeek || '?'} of ${context.trainingPlan?.totalWeeks || '16'}
- Phase: ${context.currentPhase || 'Build'}
- Goal: ${context.trainingPlan?.goalEvent || 'Marathon'} in ${context.trainingPlan?.goalTime || '2:55'}

RECOVERY STATUS:
- Sleep: ${context.todayHealth?.sleepHours?.toFixed(1) || '?'} hours
- HRV: ${context.todayHealth?.hrv || '?'} (${context.todayHealth?.hrvStatus || 'unknown'})
`;

  const response = await llmClient.chat({
    systemPrompt,
    messages: [{ role: 'user', content: `Analyze this workout:\n${workoutDetails}` }],
    model: 'claude-sonnet-4-20250514',
    temperature: 0.4,
    maxTokens: 800,
  });

  try {
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return {
        summary: result.summary || 'Good effort today!',
        highlights: result.highlights || [],
        areasToNote: result.areasToNote || [],
        nextSteps: result.nextSteps || 'Keep up the consistency.',
      };
    }
  } catch {
    // If parsing fails, extract what we can
  }

  return {
    summary: response.content.slice(0, 200),
    highlights: ['Completed the workout!'],
    areasToNote: [],
    nextSteps: 'Keep building consistency.',
  };
}

/**
 * Format coach analysis into notes for database storage
 */
function formatCoachNotes(analysis: {
  summary: string;
  highlights: string[];
  areasToNote: string[];
  nextSteps: string;
}): string {
  let notes = `## Summary\n${analysis.summary}\n\n`;
  
  if (analysis.highlights.length > 0) {
    notes += `## Highlights\n${analysis.highlights.map(h => `- ${h}`).join('\n')}\n\n`;
  }
  
  if (analysis.areasToNote.length > 0) {
    notes += `## Areas to Note\n${analysis.areasToNote.map(a => `- ${a}`).join('\n')}\n\n`;
  }
  
  notes += `## Next Steps\n${analysis.nextSteps}`;
  
  return notes;
}

/**
 * Generate a natural conversation starter from the coach
 */
function generateConversationStarter(
  workout: SyncedWorkout,
  analysis: {
    summary: string;
    highlights: string[];
    areasToNote: string[];
    nextSteps: string;
  },
  options: PostRunFlowOptions
): string {
  const distance = workout.actualDistanceMiles 
    ? `${workout.actualDistanceMiles} miles` 
    : 'your run';

  let starter = `Great work on ${distance} today! `;
  starter += analysis.summary + '\n\n';

  if (analysis.highlights.length > 0) {
    starter += `**What stood out:**\n`;
    starter += analysis.highlights.map(h => `• ${h}`).join('\n');
    starter += '\n\n';
  }

  if (analysis.areasToNote.length > 0) {
    starter += `**Things to keep in mind:**\n`;
    starter += analysis.areasToNote.map(a => `• ${a}`).join('\n');
    starter += '\n\n';
  }

  starter += `**Looking ahead:** ${analysis.nextSteps}\n\n`;

  // Prompt for more conversation
  if (!options.athleteFeedback) {
    starter += `How did you feel during the run? Any specific moments that stood out?`;
  } else {
    starter += `Anything else you'd like to discuss about this workout?`;
  }

  return starter;
}

