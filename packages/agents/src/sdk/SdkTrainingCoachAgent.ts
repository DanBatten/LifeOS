/**
 * SDK-based Training Coach Agent
 *
 * This is the Agent SDK version of TrainingCoachAgent. It provides the same
 * functionality but uses the Anthropic Agent SDK as the execution harness.
 *
 * Benefits:
 * - Automatic context compaction (unlimited conversation length)
 * - Built-in streaming support
 * - Session persistence for multi-turn coaching
 * - Better error handling and cost tracking
 */

import { SdkAgent } from './SdkAgent.js';
import type { AgentContext, AgentTool, WhiteboardEntryPayload } from '../base/types.js';
import { getAgentModelConfig } from '@lifeos/llm';

// Re-use type definitions from original TrainingCoachAgent
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
  id?: string;
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
  week_number?: number;
}

interface Injury {
  body_part: string;
  severity: number;
  status: string;
}

/**
 * SDK-based Training Coach Agent
 */
export class SdkTrainingCoachAgent extends SdkAgent {
  constructor() {
    const modelConfig = getAgentModelConfig('training-coach');

    super({
      id: 'training-coach-sdk',
      name: 'SDK Training Coach Agent',
      description: 'AI running coach for marathon training using Agent SDK - analyzes workouts, monitors fatigue, adapts plans',
      model: modelConfig.model.id,
      temperature: modelConfig.temperature,
      maxTokens: modelConfig.maxTokens,
      maxTurns: 15, // Allow more turns for complex coaching conversations
    });
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
      this.updateWorkoutTool(),
      this.rescheduleWorkoutsTool(),
      this.addNutritionGuidanceTool(),
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
- **Resting HR**: Baseline is ${data.baselineRhr || 51} bpm. Elevations of 3+ bpm signal fatigue
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

## Training Plan Modification - YOU HAVE THESE CAPABILITIES
You have tools to modify the athlete's training plan directly:

- **reschedule_workouts**: Change running days (e.g., "run Tues/Thurs/Fri/Sun")
  → Day numbers: 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday, 7=Sunday

- **update_workout**: Update a single workout (reschedule, add notes, modify)

- **add_nutrition_guidance**: Add fueling guidance to workouts

When the athlete asks to change their schedule, USE these tools directly.

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
      case 'chat_response':
        return this.buildChatResponsePrompt(context);
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

## Running Dynamics
**Cadence**: ${workout.cadence_avg || 'N/A'} spm
**Ground Contact Time**: ${workout.ground_contact_time_ms || 'N/A'} ms
**Vertical Oscillation**: ${workout.vertical_oscillation_cm || 'N/A'} cm

## Pre-Workout Context
**Resting HR**: ${workout.pre_workout_resting_hr || healthData.restingHr || 'N/A'} bpm
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

Provide comprehensive coach notes analyzing execution vs prescription, HR efficiency, and forward guidance.
Use the analyze_workout tool to save your analysis.`;
  }

  private buildReadinessPrompt(context: AgentContext): string {
    const data = context.data as Record<string, unknown>;
    const healthData = (data.healthData as HealthData) || {};
    const plannedWorkout = (data.plannedWorkout as Workout) || {};
    const recentLoad = (data.recentTrainingLoad as TrainingLoad) || {};

    return `Assess training readiness for today's planned workout.

## Today's Health Data
**Resting HR**: ${healthData.restingHr || 'N/A'} bpm (baseline: ${data.baselineRhr || 48})
**HRV**: ${healthData.hrv || 'N/A'}
**Sleep**: ${healthData.sleepHours || 'N/A'} hours (quality: ${healthData.sleepQuality || 'N/A'}/10)
**Energy**: ${healthData.energyLevel || 'N/A'}/10
**Soreness**: ${healthData.sorenessLevel || 'N/A'}/10

## Planned Workout
**Title**: ${plannedWorkout.title || 'Unknown'}
**Type**: ${plannedWorkout.workout_type || 'Unknown'}
**Distance**: ${plannedWorkout.prescribed_distance_miles || 'N/A'} miles
**Description**: ${plannedWorkout.prescribed_description || 'Not specified'}

## Training Load Context
**7-Day Load (Acute)**: ${recentLoad.acute || 'N/A'}
**28-Day Load (Chronic)**: ${recentLoad.chronic || 'N/A'}
**Acute:Chronic Ratio**: ${recentLoad.ratio || 'N/A'} (target: 0.8-1.3)

---

Using assess_readiness, determine readiness score and whether to proceed, modify, or skip.`;
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
**Workouts Completed**: ${weekData.completedWorkouts || 'N/A'}/${weekData.plannedWorkouts || 'N/A'}

## Individual Workouts
${workouts.map((w) =>
  `- ${w.title}: ${w.status} (Load: ${w.training_load || 'N/A'})`
).join('\n') || 'No workout data'}

## Health Trends This Week
**Avg Resting HR**: ${weekData.avgRestingHr || 'N/A'} bpm
**Avg Sleep**: ${weekData.avgSleep || 'N/A'} hours
**Injury Flags**: ${weekData.injuryFlags?.join(', ') || 'None'}

---

Using generate_week_summary, provide overall assessment, achievements, concerns, and next week focus.`;
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

## Upcoming Planned Workouts
${upcomingWorkouts.map((w) =>
  `- ${w.scheduled_date}: ${w.title}\n  ${w.prescribed_description || ''}`
).join('\n\n') || 'No upcoming workouts'}

---

Using adapt_plan, determine if adaptation is needed and what changes to make.`;
  }

  private buildChatResponsePrompt(context: AgentContext): string {
    const data = context.data as Record<string, unknown>;
    const userMessage = (data.userMessage as string) || '';
    const upcomingWorkouts = (data.upcomingWorkouts as Workout[]) || [];
    const recentWorkouts = (data.recentWorkouts as Workout[]) || [];
    const healthData = (data.todayHealth as HealthData) || {};

    return `The athlete sent this message:
"${userMessage}"

## UPCOMING WORKOUTS (with IDs for modification)
${upcomingWorkouts.map((w) =>
  `- [ID: ${w.id || 'unknown'}] ${w.scheduled_date}: ${w.title} (${w.prescribed_distance_miles || '?'} mi)`
).join('\n') || 'No upcoming workouts'}

## RECENT COMPLETED WORKOUTS
${recentWorkouts.slice(0, 5).map((w) =>
  `- ${w.scheduled_date}: ${w.title} - ${w.actual_duration_minutes || '?'} min`
).join('\n') || 'No recent workouts'}

## TODAY'S HEALTH
- Sleep: ${healthData.sleepHours || '?'} hrs
- HRV: ${healthData.hrv || '?'}
- Energy: ${healthData.energyLevel || '?'}/10

---

Respond helpfully. If they want to change their schedule, USE the reschedule_workouts or update_workout tools.
Day numbers for reschedule: 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 7=Sun`;
  }

  // ===========================================
  // TOOL IMPLEMENTATIONS
  // ===========================================

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
        },
        required: ['workout_id', 'coach_notes', 'execution_score'],
      },
      execute: async (args: Record<string, unknown>, context: AgentContext) => {
        const { error } = await context.supabase
          .from('workouts')
          .update({
            coach_notes: args.coach_notes as string,
            execution_score: args.execution_score as number,
            key_observations: args.key_observations,
            recommendations: args.recommendations,
            updated_at: new Date().toISOString(),
          })
          .eq('id', args.workout_id as string)
          .select()
          .single();

        if (error) throw error;

        await context.supabase.from('coaching_interactions').insert({
          user_id: context.userId,
          workout_id: args.workout_id,
          interaction_type: 'workout_analysis',
          context_date: context.date,
          analysis_response: args.coach_notes,
          key_insights: args.key_observations,
          action_items: args.recommendations,
        } as never);

        return { success: true, message: 'Workout analysis saved' };
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
          readiness_score: { type: 'integer', description: 'Overall readiness 0-100' },
          recommendation: {
            type: 'string',
            enum: ['proceed', 'modify', 'easy_only', 'skip'],
          },
          modifications: { type: 'object', description: 'Specific modifications if needed' },
          warnings: { type: 'array', items: { type: 'string' } },
          rationale: { type: 'string', description: 'Explanation of assessment' },
        },
        required: ['readiness_score', 'recommendation', 'rationale'],
      },
      execute: async (args: Record<string, unknown>, context: AgentContext) => {
        const readinessScore = args.readiness_score as number;
        const recommendation = args.recommendation as string;

        if (readinessScore < 60 || recommendation !== 'proceed') {
          await context.supabase.from('whiteboard_entries').insert({
            user_id: context.userId,
            agent_id: 'training-coach-sdk',
            entry_type: readinessScore < 40 ? 'alert' : 'observation',
            title: `Training Readiness: ${readinessScore}/100`,
            content: args.rationale as string,
            priority: readinessScore < 40 ? 80 : 60,
            requires_response: recommendation === 'skip',
            structured_data: {
              readiness_score: readinessScore,
              recommendation,
              modifications: args.modifications,
            },
            context_date: context.date,
            tags: ['training', 'readiness', 'health'],
          } as never);
        }

        return {
          readiness_score: readinessScore,
          recommendation,
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
          affected_workouts: { type: 'array', items: { type: 'string' } },
          changes: { type: 'object' },
          reason_category: {
            type: 'string',
            enum: ['fatigue', 'injury', 'illness', 'schedule', 'weather', 'performance'],
          },
          reason_details: { type: 'string' },
          plan_impact: { type: 'string' },
        },
        required: ['adaptation_needed', 'adaptation_type', 'reason_category'],
      },
      execute: async (args: Record<string, unknown>, context: AgentContext) => {
        if (!args.adaptation_needed) {
          return { adapted: false, message: 'No adaptation needed' };
        }

        const contextData = context.data as Record<string, unknown>;

        await context.supabase.from('workout_adaptations').insert({
          user_id: context.userId,
          plan_id: contextData.planId,
          adaptation_type: args.adaptation_type as string,
          reason_category: args.reason_category as string,
          reason_details: args.reason_details as string,
          adapted_prescription: args.changes,
          agent_id: 'training-coach-sdk',
        } as never);

        await context.supabase.from('whiteboard_entries').insert({
          user_id: context.userId,
          agent_id: 'training-coach-sdk',
          entry_type: 'plan',
          title: `Plan Adaptation: ${(args.adaptation_type as string).replace('_', ' ')}`,
          content: `${args.reason_details}\n\nPlan Impact: ${args.plan_impact}`,
          priority: 70,
          structured_data: args,
          context_date: context.date,
          tags: ['training', 'adaptation', args.reason_category as string],
        } as never);

        return { adapted: true, message: 'Plan adaptation recorded' };
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

        await context.supabase.from('whiteboard_entries').insert({
          user_id: context.userId,
          agent_id: 'training-coach-sdk',
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
        await context.supabase.from('whiteboard_entries').insert({
          user_id: context.userId,
          agent_id: 'training-coach-sdk',
          entry_type: args.entry_type as string,
          title: args.title as string,
          content: args.content as string,
          priority: (args.priority as number) || 50,
          requires_response: (args.requires_response as boolean) || false,
          context_date: context.date,
          tags: ['training', ...((args.tags as string[]) || [])],
        } as never);

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
          include_recovering: { type: 'boolean' },
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
          days_acute: { type: 'integer' },
          days_chronic: { type: 'integer' },
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

        const { data: workouts } = await context.supabase
          .from('workouts')
          .select('scheduled_date, training_load, status')
          .eq('user_id', context.userId)
          .eq('status', 'completed')
          .gte('scheduled_date', chronicStart.toISOString().split('T')[0])
          .lte('scheduled_date', today.toISOString().split('T')[0]);

        const allWorkouts = (workouts || []) as Array<{
          scheduled_date: string;
          training_load: number | null;
          status: string;
        }>;

        const acuteWorkouts = allWorkouts.filter(
          (w) => new Date(w.scheduled_date) >= acuteStart
        );

        const acuteLoad = acuteWorkouts.reduce((sum, w) => sum + (w.training_load || 0), 0);
        const chronicLoad = allWorkouts.reduce((sum, w) => sum + (w.training_load || 0), 0) / (chronicDays / 7);
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

  private updateWorkoutTool(): AgentTool {
    return {
      name: 'update_workout',
      description: 'Update a specific workout - reschedule it, add notes, or modify details',
      parameters: {
        type: 'object',
        properties: {
          workout_id: { type: 'string', description: 'The UUID of the workout to update' },
          scheduled_date: { type: 'string', description: 'New date (YYYY-MM-DD format)' },
          personal_notes: { type: 'string' },
          fueling_pre: { type: 'object' },
          fueling_during: { type: 'object' },
          status: { type: 'string', enum: ['planned', 'completed', 'skipped', 'modified'] },
        },
        required: ['workout_id'],
      },
      execute: async (args: Record<string, unknown>, context: AgentContext) => {
        const workoutId = args.workout_id as string;
        const updateData: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };

        if (args.scheduled_date) updateData.scheduled_date = args.scheduled_date;
        if (args.personal_notes) updateData.personal_notes = args.personal_notes;
        if (args.status) updateData.status = args.status;
        if (args.fueling_pre) updateData.fueling_pre = args.fueling_pre;
        if (args.fueling_during) updateData.fueling_during = args.fueling_during;

        const { data, error } = await context.supabase
          .from('workouts')
          .update(updateData)
          .eq('id', workoutId)
          .eq('user_id', context.userId)
          .select('id, title, scheduled_date, status')
          .single();

        if (error) {
          return { success: false, error: error.message };
        }

        return { success: true, message: `Updated workout: ${data.title}`, workout: data };
      },
    };
  }

  private rescheduleWorkoutsTool(): AgentTool {
    return {
      name: 'reschedule_workouts',
      description: 'Bulk reschedule upcoming workouts to match a preferred weekly schedule',
      parameters: {
        type: 'object',
        properties: {
          preferred_run_days: {
            type: 'array',
            items: { type: 'integer' },
            description: 'Days of week to run (1=Monday, 7=Sunday)',
          },
          start_date: { type: 'string', description: 'Start date (YYYY-MM-DD). Defaults to tomorrow.' },
          weeks_to_reschedule: { type: 'integer', description: 'Number of weeks. Default is 4.' },
        },
        required: ['preferred_run_days'],
      },
      execute: async (args: Record<string, unknown>, context: AgentContext) => {
        const preferredDays = args.preferred_run_days as number[];
        const weeksToReschedule = (args.weeks_to_reschedule as number) || 4;

        const startDate = args.start_date
          ? new Date(args.start_date as string)
          : new Date(context.date);
        startDate.setDate(startDate.getDate() + 1);

        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + weeksToReschedule * 7);

        const { data: workouts, error: fetchError } = await context.supabase
          .from('workouts')
          .select('*')
          .eq('user_id', context.userId)
          .eq('status', 'planned')
          .gte('scheduled_date', startDate.toISOString().split('T')[0])
          .lte('scheduled_date', endDate.toISOString().split('T')[0])
          .order('scheduled_date', { ascending: true });

        if (fetchError) {
          return { success: false, error: fetchError.message };
        }

        if (!workouts || workouts.length === 0) {
          return { success: false, error: 'No upcoming workouts found to reschedule' };
        }

        // Group workouts by week
        const workoutsByWeek: Map<number, typeof workouts> = new Map();
        workouts.forEach((w) => {
          const weekNum =
            w.week_number ||
            Math.floor((new Date(w.scheduled_date).getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
          if (!workoutsByWeek.has(weekNum)) {
            workoutsByWeek.set(weekNum, []);
          }
          workoutsByWeek.get(weekNum)!.push(w);
        });

        const updates: Array<{ id: string; oldDate: string; newDate: string; title: string }> = [];

        for (const [_weekNum, weekWorkouts] of workoutsByWeek) {
          const sortedWorkouts = [...weekWorkouts].sort((a, b) => {
            const getPriority = (w: (typeof a)) => {
              const type = (w.workout_type || w.title || '').toLowerCase();
              if (type.includes('long')) return 1;
              if (type.includes('tempo') || type.includes('threshold') || type.includes('interval')) return 2;
              return 3;
            };
            return getPriority(a) - getPriority(b);
          });

          const dayAssignments = [...preferredDays].sort((a, b) => {
            if (a === 7) return -1;
            if (b === 7) return 1;
            if (a === 2) return -1;
            if (b === 2) return 1;
            return a - b;
          });

          const firstWorkoutDate = new Date(sortedWorkouts[0].scheduled_date);
          const dayOfWeek = firstWorkoutDate.getDay() || 7;
          const monday = new Date(firstWorkoutDate);
          monday.setDate(monday.getDate() - (dayOfWeek - 1));

          sortedWorkouts.forEach((workout, idx) => {
            if (idx < dayAssignments.length) {
              const targetDay = dayAssignments[idx];
              const newDate = new Date(monday);
              newDate.setDate(monday.getDate() + (targetDay - 1));
              const newDateStr = newDate.toISOString().split('T')[0];

              if (newDateStr !== workout.scheduled_date) {
                updates.push({
                  id: workout.id,
                  oldDate: workout.scheduled_date,
                  newDate: newDateStr,
                  title: workout.title,
                });
              }
            }
          });
        }

        for (const update of updates) {
          await context.supabase
            .from('workouts')
            .update({
              scheduled_date: update.newDate,
              updated_at: new Date().toISOString(),
            })
            .eq('id', update.id);
        }

        return {
          success: true,
          message: `Rescheduled ${updates.length} workouts to your preferred schedule`,
          changes: updates.map((u) => ({ title: u.title, from: u.oldDate, to: u.newDate })),
          preferred_days: preferredDays.map((d) => ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][d]),
        };
      },
    };
  }

  private addNutritionGuidanceTool(): AgentTool {
    return {
      name: 'add_nutrition_guidance',
      description: 'Add nutrition and fueling guidance to upcoming workouts',
      parameters: {
        type: 'object',
        properties: {
          workout_ids: { type: 'array', items: { type: 'string' } },
          guidance_type: {
            type: 'string',
            enum: ['all', 'long_runs', 'hard_workouts', 'easy_runs'],
          },
        },
      },
      execute: async (args: Record<string, unknown>, context: AgentContext) => {
        const guidanceType = (args.guidance_type as string) || 'all';
        const workoutIds = args.workout_ids as string[] | undefined;

        let query = context.supabase
          .from('workouts')
          .select('*')
          .eq('user_id', context.userId)
          .eq('status', 'planned')
          .gte('scheduled_date', context.date)
          .order('scheduled_date', { ascending: true })
          .limit(20);

        if (workoutIds && workoutIds.length > 0) {
          query = query.in('id', workoutIds);
        }

        const { data: workouts, error } = await query;

        if (error) {
          return { success: false, error: error.message };
        }

        const updatedWorkouts: Array<{ title: string; date: string; guidance: string }> = [];

        for (const workout of workouts || []) {
          const type = (workout.workout_type || workout.title || '').toLowerCase();
          const distance = workout.prescribed_distance_miles || 0;

          const isLongRun = type.includes('long') || distance >= 12;
          const isHardWorkout =
            type.includes('tempo') || type.includes('threshold') || type.includes('interval');
          const isEasyRun = !isLongRun && !isHardWorkout;

          if (guidanceType === 'long_runs' && !isLongRun) continue;
          if (guidanceType === 'hard_workouts' && !isHardWorkout) continue;
          if (guidanceType === 'easy_runs' && !isEasyRun) continue;

          let fuelingPre: Record<string, unknown> = {};
          let fuelingDuring: Record<string, unknown> = {};
          let nutritionNotes = '';

          if (isLongRun) {
            fuelingPre = {
              meal: 'Oatmeal with banana and honey',
              timing_minutes: 120,
              caffeine_mg: distance >= 16 ? 100 : 0,
              hydration_oz: 16,
            };
            fuelingDuring = {
              gels: distance >= 14 ? ['Gel at miles 6, 10, 14'] : ['Gel at mile 6'],
              electrolytes: 'LMNT or similar every 45 min',
              water_oz: Math.round(distance * 1.5),
            };
            nutritionNotes = `Long run fueling: ${distance >= 16 ? 'Practice race-day nutrition' : 'Focus on hydration'}`;
          } else if (isHardWorkout) {
            fuelingPre = {
              meal: 'Light meal 2-3 hours before',
              timing_minutes: 90,
              hydration_oz: 12,
            };
            fuelingDuring = { water_oz: 8 };
            nutritionNotes = 'Hard workout: Light stomach, stay hydrated';
          } else {
            fuelingPre = { meal: 'Whatever feels comfortable', hydration_oz: 8 };
            fuelingDuring = { water_oz: distance >= 6 ? 8 : 0 };
            nutritionNotes = 'Easy run: No special fueling needed';
          }

          await context.supabase
            .from('workouts')
            .update({
              fueling_pre: fuelingPre,
              fueling_during: fuelingDuring,
              personal_notes: workout.personal_notes
                ? `${workout.personal_notes}\n\nNutrition: ${nutritionNotes}`
                : `Nutrition: ${nutritionNotes}`,
              updated_at: new Date().toISOString(),
            })
            .eq('id', workout.id);

          updatedWorkouts.push({
            title: workout.title,
            date: workout.scheduled_date,
            guidance: nutritionNotes,
          });
        }

        return {
          success: true,
          message: `Added nutrition guidance to ${updatedWorkouts.length} workouts`,
          workouts: updatedWorkouts,
        };
      },
    };
  }
}
