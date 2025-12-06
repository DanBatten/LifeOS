import { BaseAgent } from '../base/BaseAgent.js';
import type { AgentContext, AgentTool, WhiteboardEntryPayload } from '../base/types.js';
import type { LLMProvider } from '@lifeos/llm';
// NOTE: Garmin real-time tools disabled - too slow
// import { createGarminClient, metersToMiles, formatPace } from '@lifeos/garmin';

// Type definitions for context data
interface WeekData {
  plannedVolume?: number;
  actualVolume?: number;
  plannedWorkouts?: number;
  completedWorkouts?: number;
  skippedWorkouts?: number;
  avgRestingHr?: number;
  avgSleep?: number;
  avgEnergy?: number;
  injuryFlags?: string[];
  totalLoad?: number;
  loadVsPrevious?: number;
}

interface AdaptationTrigger {
  type?: string;
  reason?: string;
  severity?: string;
  signals?: Record<string, unknown>;
}

interface HealthData {
  restingHr?: number;
  hrv?: number;
  sleepHours?: number;
  sleepQuality?: number;
  energyLevel?: number;
  sorenessLevel?: number;
  sorenessAreas?: string[];
}

interface TrainingLoad {
  acute?: number;
  chronic?: number;
  ratio?: number;
}

interface Workout {
  title?: string;
  scheduled_date?: string;
  prescribed_description?: string;
  prescribed_distance_miles?: number;
  prescribed_pace?: string;
  actual_distance_miles?: number;
  distance_miles?: number;
  actual_duration_minutes?: number;
  avg_pace?: string;
  avg_heart_rate?: number;
  max_heart_rate?: number;
  training_load?: number;
  training_effect_aerobic?: number;
  training_effect_anaerobic?: number;
  cadence_avg?: number;
  ground_contact_time_ms?: number;
  vertical_oscillation_cm?: number;
  avg_power_watts?: number;
  pre_workout_resting_hr?: number;
  personal_notes?: string;
  splits?: unknown[];
  workout_type?: string;
  status?: string;
  execution_score?: number;
}

interface Injury {
  body_part: string;
  severity: number;
  status: string;
}

/**
 * Training Coach Agent
 *
 * A sophisticated AI running coach that:
 * 1. Analyzes completed workouts and provides detailed coach notes
 * 2. Monitors fatigue signals (RHR, HRV, sleep, training load)
 * 3. Adapts future training based on execution and recovery
 * 4. Coordinates with Health Agent for injury/illness management
 * 5. Generates weekly summaries and plan adjustments
 */
export class TrainingCoachAgent extends BaseAgent {
  constructor(llmClient: LLMProvider) {
    super(
      {
        id: 'training-coach',
        name: 'Training Coach Agent',
        description: 'AI running coach for marathon training - analyzes workouts, monitors fatigue, adapts plans',
        model: 'claude-sonnet-4-20250514',
        temperature: 0.4,
        maxTokens: 3000,
      },
      llmClient
    );
  }

  protected registerTools(): AgentTool[] {
    return [
      this.analyzeWorkoutTool(),
      this.assessReadinessTool(),
      this.adaptPlanTool(),
      this.generateWeekSummaryTool(),
      this.postWhiteboardTool(),
      this.checkInjuryStatusTool(),
      this.calculateTrainingLoadTool(),
      // NOTE: Garmin real-time tools disabled - too slow (spawns Python process each call)
      // Use synced database data instead. Re-enable when we have persistent MCP connection.
      // this.getGarminActivityTool(),
      // this.getGarminRecentActivitiesTool(),
    ];
  }

  protected buildSystemPrompt(context: AgentContext): string {
    const data = context.data as Record<string, unknown>;
    return `You are an expert running coach specializing in marathon training. You analyze workout data with the precision of a sports scientist while communicating with the warmth and directness of an experienced coach.

## Your Coaching Philosophy
- Data-driven decisions: Use HR, pace, training load, and biometrics to assess fitness
- Recovery is training: Easy days must be truly easy; fatigue signals demand respect
- Progressive overload: Build fitness systematically, never chase single workouts
- Pattern recognition: Look for trends across days/weeks, not just individual sessions
- Injury prevention: Early warning signs (elevated RHR, recurring discomfort) require immediate attention

## Key Metrics You Monitor
- **Resting HR**: Baseline is ${data.baselineRhr || 48} bpm. Elevations of 3+ bpm signal fatigue
- **Training Load**: Track acute (7-day) vs chronic (28-day) load ratio. Target 0.8-1.3
- **HR Efficiency**: Pace-to-HR ratio should improve over time at given efforts
- **Sleep**: Critical limiter. Poor sleep = reduced adaptation capacity
- **Discomfort patterns**: Same location appearing multiple times = red flag

## Athlete Context
- Name: ${context.userName}
- Current Training Phase: ${data.currentPhase || 'Unknown'}
- Goal: ${data.goalEvent || 'Marathon'} in ${data.goalTime || '2:55'}
- Goal Pace: ${data.goalPace || '6:40/mi'}
- Week: ${data.currentWeek || 'Unknown'} of ${data.totalWeeks || 16}

## Communication Style
- Be direct and specific - cite actual numbers from the data
- Explain the "why" behind observations
- Give actionable forward guidance
- Acknowledge good execution; don't just focus on problems
- When concerned, be clear about severity and required action

## Today's Date: ${context.date}
## Timezone: ${context.timezone}`;
  }

  protected buildUserPrompt(context: AgentContext): string {
    const data = context.data as Record<string, unknown>;
    const taskType = (data.taskType as string) || 'workout_analysis';

    switch (taskType) {
      case 'workout_analysis':
        return this.buildWorkoutAnalysisPrompt(context);
      case 'readiness_check':
        return this.buildReadinessPrompt(context);
      case 'weekly_review':
        return this.buildWeeklyReviewPrompt(context);
      case 'plan_adaptation':
        return this.buildAdaptationPrompt(context);
      default:
        return this.buildWorkoutAnalysisPrompt(context);
    }
  }

  private buildWorkoutAnalysisPrompt(context: AgentContext): string {
    const data = context.data as Record<string, unknown>;
    const workout = (data.workout as Workout) || {};
    const recentWorkouts = (data.recentWorkouts as Workout[]) || [];
    const healthData = (data.healthData as HealthData) || {};
    const activeInjuries = (data.activeInjuries as Injury[]) || [];

    return `Analyze this completed workout and provide detailed coach notes.

## Workout Details
**Title**: ${workout.title || 'Unknown'}
**Date**: ${workout.scheduled_date || context.date}
**Prescribed**: ${workout.prescribed_description || 'Not specified'}
**Prescribed Distance**: ${workout.prescribed_distance_miles || 'N/A'} miles
**Prescribed Pace**: ${workout.prescribed_pace || 'N/A'}

## Execution Data
**Actual Distance**: ${workout.actual_distance_miles || workout.distance_miles || 'N/A'} miles
**Duration**: ${workout.actual_duration_minutes || 'N/A'} minutes
**Avg Pace**: ${workout.avg_pace || 'N/A'}
**Avg HR**: ${workout.avg_heart_rate || 'N/A'} bpm
**Max HR**: ${workout.max_heart_rate || 'N/A'} bpm
**Training Load**: ${workout.training_load || 'N/A'}
**Training Effect (Aerobic)**: ${workout.training_effect_aerobic || 'N/A'}
**Training Effect (Anaerobic)**: ${workout.training_effect_anaerobic || 'N/A'}

## Running Dynamics
**Cadence**: ${workout.cadence_avg || 'N/A'} spm
**Ground Contact Time**: ${workout.ground_contact_time_ms || 'N/A'} ms
**Vertical Oscillation**: ${workout.vertical_oscillation_cm || 'N/A'} cm
**Avg Power**: ${workout.avg_power_watts || 'N/A'} W

## Splits
${workout.splits ? JSON.stringify(workout.splits, null, 2) : 'No split data available'}

## Pre-Workout Context
**Resting HR**: ${workout.pre_workout_resting_hr || healthData.restingHr || 'N/A'} bpm (baseline: ${data.baselineRhr || 48})
**Sleep**: ${healthData.sleepHours || 'N/A'} hours
**Energy Level**: ${healthData.energyLevel || 'N/A'}/10

## Athlete Notes
"${workout.personal_notes || 'No notes provided'}"

## Recent Training Context (Last 7 Days)
${recentWorkouts.map((w) =>
  `- ${w.scheduled_date}: ${w.title} (Load: ${w.training_load || 'N/A'}, Status: ${w.status})`
).join('\n') || 'No recent workout data'}

## Active Injuries/Concerns
${activeInjuries.map((i) =>
  `- ${i.body_part}: Severity ${i.severity}/10, Status: ${i.status}`
).join('\n') || 'None reported'}

---

Provide comprehensive coach notes that:
1. Assess execution vs prescription (did they hit targets?)
2. Analyze HR efficiency and pacing patterns
3. Note any concerning signals (fatigue, discomfort, overreaching)
4. Compare to recent context (improvement/regression)
5. Provide specific forward guidance for next workouts
6. Call out anything requiring plan adaptation

Use the analyze_workout tool to save your analysis, then use post_to_whiteboard if there are important observations for other agents or the user.`;
  }

  private buildReadinessPrompt(context: AgentContext): string {
    const data = context.data as Record<string, unknown>;
    const healthData = (data.healthData as HealthData) || {};
    const plannedWorkout = (data.plannedWorkout as Workout) || {};
    const recentLoad = (data.recentTrainingLoad as TrainingLoad) || {};

    return `Assess training readiness for today's planned workout.

## Today's Health Data
**Resting HR**: ${healthData.restingHr || 'N/A'} bpm (baseline: ${data.baselineRhr || 48})
**HRV**: ${healthData.hrv || 'N/A'} (baseline: ${data.baselineHrv || 'N/A'})
**Sleep**: ${healthData.sleepHours || 'N/A'} hours (quality: ${healthData.sleepQuality || 'N/A'}/10)
**Energy**: ${healthData.energyLevel || 'N/A'}/10
**Soreness**: ${healthData.sorenessLevel || 'N/A'}/10
**Soreness Areas**: ${healthData.sorenessAreas?.join(', ') || 'None'}

## Planned Workout
**Title**: ${plannedWorkout.title || 'Unknown'}
**Type**: ${plannedWorkout.workout_type || 'Unknown'}
**Distance**: ${plannedWorkout.prescribed_distance_miles || 'N/A'} miles
**Description**: ${plannedWorkout.prescribed_description || 'Not specified'}

## Training Load Context
**7-Day Load (Acute)**: ${recentLoad.acute || 'N/A'}
**28-Day Load (Chronic)**: ${recentLoad.chronic || 'N/A'}
**Acute:Chronic Ratio**: ${recentLoad.ratio || 'N/A'} (target: 0.8-1.3)

## Active Concerns
${(data.activeInjuries as Injury[] || []).map((i) =>
  `- ${i.body_part}: Severity ${i.severity}/10`
).join('\n') || 'None'}

---

Using assess_readiness, determine:
1. Overall readiness score (0-100)
2. Whether to proceed as planned, modify, or skip
3. Specific modifications if needed (reduce volume, lower intensity, etc.)
4. Warning signs to monitor during the workout`;
  }

  private buildWeeklyReviewPrompt(context: AgentContext): string {
    const data = context.data as Record<string, unknown>;
    const weekData = (data.weekData as WeekData) || {};
    const workouts = (data.weekWorkouts as Workout[]) || [];

    return `Generate a comprehensive weekly training review.

## Week ${data.currentWeek || 'N/A'} Summary
**Phase**: ${data.currentPhase || 'Unknown'}
**Planned Volume**: ${weekData.plannedVolume || 'N/A'} miles
**Actual Volume**: ${weekData.actualVolume || 'N/A'} miles
**Workouts Planned**: ${weekData.plannedWorkouts || 'N/A'}
**Workouts Completed**: ${weekData.completedWorkouts || 'N/A'}
**Workouts Skipped**: ${weekData.skippedWorkouts || 'N/A'}

## Individual Workouts
${workouts.map((w) =>
  `- ${w.title}: ${w.status} (Load: ${w.training_load || 'N/A'}, Execution: ${w.execution_score || 'N/A'}%)`
).join('\n') || 'No workout data'}

## Health Trends This Week
**Avg Resting HR**: ${weekData.avgRestingHr || 'N/A'} bpm
**Avg Sleep**: ${weekData.avgSleep || 'N/A'} hours
**Avg Energy**: ${weekData.avgEnergy || 'N/A'}/10
**Injury Flags**: ${weekData.injuryFlags?.join(', ') || 'None'}

## Training Load
**Week Total Load**: ${weekData.totalLoad || 'N/A'}
**Load vs Previous Week**: ${weekData.loadVsPrevious || 'N/A'}%

---

Using generate_week_summary, provide:
1. Overall week assessment (execution quality, adaptation signals)
2. Key achievements and concerns
3. Fitness trajectory assessment
4. Specific adjustments for next week
5. Long-term plan implications`;
  }

  private buildAdaptationPrompt(context: AgentContext): string {
    const data = context.data as Record<string, unknown>;
    const trigger = (data.adaptationTrigger as AdaptationTrigger) || {};
    const upcomingWorkouts = (data.upcomingWorkouts as Workout[]) || [];

    return `Evaluate whether the training plan needs adaptation.

## Trigger for Evaluation
**Type**: ${trigger.type || 'routine_check'}
**Reason**: ${trigger.reason || 'Scheduled review'}
**Severity**: ${trigger.severity || 'normal'}

## Current Signals
${JSON.stringify(trigger.signals || {}, null, 2)}

## Upcoming Planned Workouts
${upcomingWorkouts.map((w) =>
  `- ${w.scheduled_date}: ${w.title}\n  ${w.prescribed_description || ''}`
).join('\n\n') || 'No upcoming workouts'}

## Adaptation Options
- Volume reduction (reduce mileage by X%)
- Intensity reduction (convert quality session to easy)
- Reschedule (move hard workout to later date)
- Substitute (replace workout type)
- Skip (remove workout entirely)
- Proceed as planned

---

Using adapt_plan, determine:
1. Whether adaptation is needed (yes/no)
2. What specific changes to make
3. Rationale for the decision
4. How this affects the broader plan`;
  }

  // Tool implementations
  private analyzeWorkoutTool(): AgentTool {
    return {
      name: 'analyze_workout',
      description: 'Save detailed analysis of a completed workout',
      parameters: {
        type: 'object',
        properties: {
          workout_id: { type: 'string', description: 'ID of the workout' },
          coach_notes: { type: 'string', description: 'Detailed coach analysis' },
          execution_score: {
            type: 'integer',
            description: 'How well targets were hit (0-100)',
          },
          key_observations: {
            type: 'object',
            description: 'Structured insights from the workout',
          },
          recommendations: {
            type: 'array',
            items: { type: 'string' },
            description: 'Forward-looking recommendations',
          },
          adaptation_triggers: {
            type: 'object',
            description: 'Signals that might require plan changes',
          },
        },
        required: ['workout_id', 'coach_notes', 'execution_score'],
      },
      execute: async (args: Record<string, unknown>, context: AgentContext) => {
        const { data, error } = await context.supabase
          .from('workouts')
          .update({
            coach_notes: args.coach_notes as string,
            execution_score: args.execution_score as number,
            key_observations: args.key_observations,
            recommendations: args.recommendations,
            adaptation_triggers: args.adaptation_triggers,
            updated_at: new Date().toISOString(),
          })
          .eq('id', args.workout_id as string)
          .select()
          .single();

        if (error) throw error;

        // Also save to coaching_interactions for history
        await context.supabase.from('coaching_interactions').insert({
          user_id: context.userId,
          workout_id: args.workout_id,
          interaction_type: 'workout_analysis',
          context_date: context.date,
          analysis_response: args.coach_notes,
          key_insights: args.key_observations,
          action_items: args.recommendations,
        } as never);

        return { success: true, workout: data };
      },
    };
  }

  private assessReadinessTool(): AgentTool {
    return {
      name: 'assess_readiness',
      description: 'Assess athlete readiness and provide workout guidance',
      parameters: {
        type: 'object',
        properties: {
          readiness_score: {
            type: 'integer',
            description: 'Overall readiness 0-100',
          },
          recommendation: {
            type: 'string',
            enum: ['proceed', 'modify', 'easy_only', 'skip'],
            description: 'Recommended action',
          },
          modifications: {
            type: 'object',
            description: 'Specific modifications if needed',
          },
          warnings: {
            type: 'array',
            items: { type: 'string' },
            description: 'Things to monitor during workout',
          },
          rationale: { type: 'string', description: 'Explanation of assessment' },
        },
        required: ['readiness_score', 'recommendation', 'rationale'],
      },
      execute: async (args: Record<string, unknown>, context: AgentContext) => {
        const readinessScore = args.readiness_score as number;
        const recommendation = args.recommendation as string;

        // Post to whiteboard if readiness is concerning
        if (readinessScore < 60 || recommendation !== 'proceed') {
          await context.supabase.from('whiteboard_entries').insert({
            user_id: context.userId,
            agent_id: 'training-coach',
            entry_type: readinessScore < 40 ? 'alert' : 'observation',
            title: `Training Readiness: ${readinessScore}/100`,
            content: args.rationale as string,
            priority: readinessScore < 40 ? 80 : 60,
            requires_response: recommendation === 'skip',
            structured_data: {
              readiness_score: readinessScore,
              recommendation: recommendation,
              modifications: args.modifications,
            },
            context_date: context.date,
            tags: ['training', 'readiness', 'health'],
          } as never);
        }

        return {
          readiness_score: readinessScore,
          recommendation: recommendation,
          modifications: args.modifications,
          warnings: args.warnings,
          rationale: args.rationale,
        };
      },
    };
  }

  private adaptPlanTool(): AgentTool {
    return {
      name: 'adapt_plan',
      description: 'Record a training plan adaptation',
      parameters: {
        type: 'object',
        properties: {
          adaptation_needed: { type: 'boolean' },
          adaptation_type: {
            type: 'string',
            enum: ['volume_reduction', 'intensity_reduction', 'reschedule', 'substitute', 'skip', 'none'],
          },
          affected_workouts: {
            type: 'array',
            items: { type: 'string' },
            description: 'Workout IDs to modify',
          },
          changes: {
            type: 'object',
            description: 'Specific changes to make',
          },
          reason_category: {
            type: 'string',
            enum: ['fatigue', 'injury', 'illness', 'schedule', 'weather', 'performance'],
          },
          reason_details: { type: 'string' },
          plan_impact: { type: 'string', description: 'How this affects broader goals' },
        },
        required: ['adaptation_needed', 'adaptation_type', 'reason_category'],
      },
      execute: async (args: Record<string, unknown>, context: AgentContext) => {
        if (!args.adaptation_needed) {
          return { adapted: false, message: 'No adaptation needed' };
        }

        const contextData = context.data as Record<string, unknown>;

        // Record the adaptation
        const { data: adaptation } = await context.supabase
          .from('workout_adaptations')
          .insert({
            user_id: context.userId,
            plan_id: contextData.planId,
            adaptation_type: args.adaptation_type as string,
            reason_category: args.reason_category as string,
            reason_details: args.reason_details as string,
            adapted_prescription: args.changes,
            triggering_signals: (contextData.adaptationTrigger as AdaptationTrigger)?.signals,
            agent_id: 'training-coach',
          } as never)
          .select()
          .single();

        // Post to whiteboard
        await context.supabase.from('whiteboard_entries').insert({
          user_id: context.userId,
          agent_id: 'training-coach',
          entry_type: 'plan',
          title: `Plan Adaptation: ${(args.adaptation_type as string).replace('_', ' ')}`,
          content: `${args.reason_details}\n\nPlan Impact: ${args.plan_impact}`,
          priority: 70,
          requires_response: false,
          structured_data: args,
          context_date: context.date,
          tags: ['training', 'adaptation', args.reason_category as string],
        } as never);

        return { adapted: true, adaptation };
      },
    };
  }

  private generateWeekSummaryTool(): AgentTool {
    return {
      name: 'generate_week_summary',
      description: 'Save weekly training summary',
      parameters: {
        type: 'object',
        properties: {
          week_number: { type: 'integer' },
          overall_assessment: { type: 'string' },
          achievements: { type: 'array', items: { type: 'string' } },
          concerns: { type: 'array', items: { type: 'string' } },
          fitness_trajectory: {
            type: 'string',
            enum: ['improving', 'maintaining', 'declining', 'recovering'],
          },
          next_week_focus: { type: 'array', items: { type: 'string' } },
          plan_adjustments: { type: 'array', items: { type: 'string' } },
        },
        required: ['week_number', 'overall_assessment', 'fitness_trajectory'],
      },
      execute: async (args: Record<string, unknown>, context: AgentContext) => {
        const contextData = context.data as Record<string, unknown>;

        // Update training_weeks table
        await context.supabase
          .from('training_weeks')
          .update({
            week_summary: args.overall_assessment as string,
            recommendations: {
              achievements: args.achievements,
              concerns: args.concerns,
              next_week_focus: args.next_week_focus,
              adjustments: args.plan_adjustments,
            },
            status: 'completed',
          })
          .eq('plan_id', contextData.planId as string)
          .eq('week_number', args.week_number as number);

        // Post reflection to whiteboard
        await context.supabase.from('whiteboard_entries').insert({
          user_id: context.userId,
          agent_id: 'training-coach',
          entry_type: 'reflection',
          title: `Week ${args.week_number} Training Review`,
          content: args.overall_assessment as string,
          priority: 60,
          structured_data: args,
          context_date: context.date,
          tags: ['training', 'weekly_review', args.fitness_trajectory as string],
        } as never);

        return { success: true, summary: args };
      },
    };
  }

  private postWhiteboardTool(): AgentTool {
    return {
      name: 'post_to_whiteboard',
      description: 'Post an observation, alert, or insight to the shared whiteboard',
      parameters: {
        type: 'object',
        properties: {
          entry_type: {
            type: 'string',
            enum: ['observation', 'alert', 'insight', 'suggestion'],
          },
          title: { type: 'string' },
          content: { type: 'string' },
          priority: { type: 'integer', description: '0-100, higher = more important' },
          requires_response: { type: 'boolean' },
          tags: { type: 'array', items: { type: 'string' } },
        },
        required: ['entry_type', 'title', 'content'],
      },
      execute: async (args: Record<string, unknown>, context: AgentContext) => {
        await context.supabase
          .from('whiteboard_entries')
          .insert({
            user_id: context.userId,
            agent_id: 'training-coach',
            entry_type: args.entry_type as string,
            title: args.title as string,
            content: args.content as string,
            priority: (args.priority as number) || 50,
            requires_response: (args.requires_response as boolean) || false,
            context_date: context.date,
            tags: ['training', ...((args.tags as string[]) || [])],
          } as never)
          .select()
          .single();

        const result: WhiteboardEntryPayload = {
          entryType: args.entry_type as WhiteboardEntryPayload['entryType'],
          title: args.title as string | undefined,
          content: args.content as string,
          priority: (args.priority as number) || 50,
          requiresResponse: (args.requires_response as boolean) || false,
          tags: ['training', ...((args.tags as string[]) || [])],
        };

        return result;
      },
    };
  }

  private checkInjuryStatusTool(): AgentTool {
    return {
      name: 'check_injury_status',
      description: 'Check for active injuries that might affect training',
      parameters: {
        type: 'object',
        properties: {
          include_recovering: { type: 'boolean', default: true },
        },
      },
      execute: async (args: Record<string, unknown>, context: AgentContext) => {
        const statuses = ['active'];
        if (args.include_recovering) statuses.push('recovering');

        const { data } = await context.supabase
          .from('injuries')
          .select('*')
          .eq('user_id', context.userId)
          .in('status', statuses)
          .order('severity', { ascending: false });

        return { injuries: data || [] };
      },
    };
  }

  private calculateTrainingLoadTool(): AgentTool {
    return {
      name: 'calculate_training_load',
      description: 'Calculate acute and chronic training load',
      parameters: {
        type: 'object',
        properties: {
          days_acute: { type: 'integer', default: 7 },
          days_chronic: { type: 'integer', default: 28 },
        },
      },
      execute: async (args: Record<string, unknown>, context: AgentContext) => {
        const acuteDays = (args.days_acute as number) || 7;
        const chronicDays = (args.days_chronic as number) || 28;

        const today = new Date(context.date);
        const acuteStart = new Date(today);
        acuteStart.setDate(acuteStart.getDate() - acuteDays);
        const chronicStart = new Date(today);
        chronicStart.setDate(chronicStart.getDate() - chronicDays);

        // Get workouts for both periods
        const { data: workouts } = await context.supabase
          .from('workouts')
          .select('scheduled_date, training_load, status')
          .eq('user_id', context.userId)
          .eq('status', 'completed')
          .gte('scheduled_date', chronicStart.toISOString().split('T')[0])
          .lte('scheduled_date', today.toISOString().split('T')[0]);

        const allWorkouts = (workouts || []) as Array<{ scheduled_date: string; training_load: number | null; status: string }>;

        const acuteWorkouts = allWorkouts.filter(
          (w) => new Date(w.scheduled_date) >= acuteStart
        );

        const acuteLoad = acuteWorkouts.reduce(
          (sum, w) => sum + (w.training_load || 0),
          0
        );
        const chronicLoad = allWorkouts.reduce(
          (sum, w) => sum + (w.training_load || 0),
          0
        ) / (chronicDays / 7);

        const ratio = chronicLoad > 0 ? acuteLoad / chronicLoad : 1;

        return {
          acute_load: Math.round(acuteLoad),
          chronic_load: Math.round(chronicLoad),
          ratio: Math.round(ratio * 100) / 100,
          status: ratio < 0.8 ? 'undertraining' : ratio > 1.5 ? 'overreaching' : ratio > 1.3 ? 'elevated' : 'optimal',
        };
      },
    };
  }

  // NOTE: Garmin real-time tools available in @lifeos/garmin package
  // Disabled here because spawning Python process per call is too slow
  // To re-enable: uncomment the tools in registerTools() above
}
