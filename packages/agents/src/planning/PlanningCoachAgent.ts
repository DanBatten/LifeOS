import { BaseAgent } from '../base/BaseAgent.js';
import type { AgentContext, AgentTool } from '../base/types.js';
import type { LLMProvider } from '@lifeos/llm';
import { getAgentModelConfig } from '@lifeos/llm';

/**
 * Planning Coach Agent
 *
 * A specialized agent for strategic training plan management:
 * - Weekly planning and workout scheduling
 * - Pace zone adjustments based on fitness progression
 * - Workout prescription refinement
 * - Periodization and phase transitions
 *
 * Unlike the TrainingCoachAgent (reactive, chat-focused), this agent
 * is proactive and runs on a schedule (Sunday evenings) to prepare
 * the upcoming week's training.
 */
export class PlanningCoachAgent extends BaseAgent {
  constructor(llmClient: LLMProvider) {
    const modelConfig = getAgentModelConfig('training-coach'); // Uses same model tier

    super(
      {
        id: 'planning-coach',
        name: 'Planning Coach Agent',
        description: 'Strategic training plan manager - weekly planning, pace adjustments, periodization',
        model: modelConfig.model.id,
        temperature: 0.3, // Lower temperature for more consistent planning
        maxTokens: modelConfig.maxTokens,
      },
      llmClient
    );
  }

  protected registerTools(): AgentTool[] {
    return [
      this.adjustPaceZonesTool(),
      this.refineWorkoutPrescriptionTool(),
      this.assessWeeklyReadinessTool(),
      this.generateWeekPreviewTool(),
      this.requestNutritionPlanTool(),
      this.updateTrainingPhaseTool(),
    ];
  }

  protected buildSystemPrompt(context: AgentContext): string {
    const data = context.data as Record<string, unknown>;

    return `You are a strategic training planner specializing in marathon preparation. Your role is to look ahead and optimize training plans based on athlete progress.

## Your Planning Philosophy
- Periodization: Ensure proper build-recover-peak cycles
- Individualization: Adjust based on athlete's actual performance vs prescribed
- Progressive overload: Increase load systematically, never too fast
- Fatigue management: Watch for overreaching signals and adjust proactively
- Race preparation: Everything works backward from race day

## Key Planning Metrics
- **Pace Progression**: Is the athlete getting faster at given HR? Adjust zones accordingly.
- **Volume Tolerance**: Can they handle the planned mileage? Watch for injury signals.
- **Recovery Markers**: HRV trends, sleep quality, resting HR - are they adapting?
- **Key Workout Execution**: Are they hitting tempo/interval targets?

## Planning Context
- Athlete: ${context.userName}
- Race: ${data.goalEvent || 'Marathon'} on ${data.raceDate || 'TBD'}
- Goal Time: ${data.goalTime || 'Not set'}
- Current Phase: ${data.currentPhase || 'Base Building'}
- Week: ${data.currentWeek || '?'} of ${data.totalWeeks || '16'}
- Weeks to Race: ${data.weeksToRace || '?'}

## Current Pace Zones
- Easy: ${(data.paceZones as Record<string, string>)?.easy_pace || '8:15/mi'}
- Long Run: ${(data.paceZones as Record<string, string>)?.long_run_pace || '8:00/mi'}
- Marathon: ${(data.paceZones as Record<string, string>)?.marathon_pace || '6:41/mi'}
- Threshold: ${(data.paceZones as Record<string, string>)?.threshold_pace || '6:12/mi'}
- Interval: ${(data.paceZones as Record<string, string>)?.interval_pace || '5:55/mi'}

## Planning Style
- Be specific with pace and distance recommendations
- Explain the "why" behind adjustments
- Consider the athlete's life context (work, travel, etc.)
- Always have a backup plan for key workouts

## Today's Date: ${context.date}`;
  }

  protected buildUserPrompt(context: AgentContext): string {
    const data = context.data as Record<string, unknown>;
    const taskType = (data.taskType as string) || 'weekly_planning';

    switch (taskType) {
      case 'weekly_planning':
        return this.buildWeeklyPlanningPrompt(context);
      case 'pace_assessment':
        return this.buildPaceAssessmentPrompt(context);
      case 'phase_transition':
        return this.buildPhaseTransitionPrompt(context);
      default:
        return this.buildWeeklyPlanningPrompt(context);
    }
  }

  private buildWeeklyPlanningPrompt(context: AgentContext): string {
    const data = context.data as Record<string, unknown>;
    const completedWeek = data.completedWeekWorkouts as Array<Record<string, unknown>> || [];
    const upcomingWeek = data.upcomingWeekWorkouts as Array<Record<string, unknown>> || [];
    const readiness = data.athleteReadiness as Record<string, unknown> || {};

    return `## WEEKLY PLANNING TASK

Review the just-completed week and prepare the upcoming week's training.

### COMPLETED WEEK SUMMARY
${completedWeek.map(w =>
  `- ${w.title}: ${w.status === 'completed' ? '✓' : '✗'} ${w.actual_distance_miles || w.prescribed_distance_miles || '?'} mi @ ${w.avg_pace || w.prescribed_pace_per_mile || '?'}`
).join('\n') || 'No completed workouts'}

### ATHLETE READINESS
- HRV Trend: ${readiness.hrvTrend || 'unknown'}
- Sleep Quality: ${readiness.sleepQuality || 'unknown'}
- Training Load Status: ${readiness.trainingLoad || 'unknown'}
- Recommendation: ${readiness.recommendation || 'maintain'}

### UPCOMING WEEK (TO REVIEW/ADJUST)
${upcomingWeek.map(w =>
  `- ${w.scheduled_date}: ${w.title}
    Distance: ${w.prescribed_distance_miles || '?'} mi
    Pace: ${w.prescribed_pace_per_mile || '?'}
    Description: ${w.prescribed_description || 'None'}`
).join('\n\n') || 'No upcoming workouts'}

---

Your tasks:
1. **Assess last week**: Did the athlete handle the load well? Any concerns?
2. **Review upcoming workouts**: Are they appropriate given readiness?
3. **Make adjustments**: Use tools to modify any workouts that need it
4. **Request nutrition plans**: Coordinate with nutrition agent for fueling guidance
5. **Generate preview**: Create a motivating week preview for the athlete

Use the available tools to make your planning changes concrete.`;
  }

  private buildPaceAssessmentPrompt(context: AgentContext): string {
    const data = context.data as Record<string, unknown>;
    const recentWorkouts = data.recentWorkouts as Array<Record<string, unknown>> || [];

    return `## PACE ZONE ASSESSMENT

Analyze recent workout data to determine if pace zones should be adjusted.

### RECENT KEY WORKOUTS (Last 4 weeks)
${recentWorkouts.map(w => {
      const isQuality = ['tempo', 'threshold', 'interval', 'progression'].some(t =>
        (w.title as string || '').toLowerCase().includes(t)
      );
      if (!isQuality) return null;
      return `- ${w.scheduled_date}: ${w.title}
    Prescribed: ${w.prescribed_pace_per_mile || '?'}
    Actual: ${w.avg_pace || '?'}
    Avg HR: ${w.avg_heart_rate || '?'} bpm
    Execution: ${w.execution_score || '?'}%`;
    }).filter(Boolean).join('\n\n') || 'No quality workout data'}

### CURRENT PACE ZONES
${JSON.stringify(data.paceZones, null, 2)}

---

Analyze:
1. Is the athlete consistently beating prescribed paces at target HR?
2. Are they struggling to hit paces (HR too high)?
3. Should pace zones be adjusted up (faster) or down (slower)?
4. If adjusting, by how much (typically 5-10 sec/mi increments)?

Use adjust_pace_zones tool if changes are warranted.`;
  }

  private buildPhaseTransitionPrompt(context: AgentContext): string {
    const data = context.data as Record<string, unknown>;

    return `## PHASE TRANSITION ASSESSMENT

Evaluate if it's time to transition to the next training phase.

### CURRENT STATE
- Current Phase: ${data.currentPhase}
- Weeks in Phase: ${data.weeksInPhase || '?'}
- Weeks to Race: ${data.weeksToRace}
- Next Phase: ${data.nextPhase || 'Unknown'}
- Next Phase Start (Planned): ${data.nextPhaseStart || 'TBD'}

### PHASE PROGRESSION INDICATORS
${JSON.stringify(data.phaseIndicators || {}, null, 2)}

---

Determine:
1. Is the athlete ready to transition?
2. Should we stay in current phase longer (not adapting well)?
3. Should we accelerate to next phase (adapting better than expected)?

Use update_training_phase tool to record any phase changes.`;
  }

  // ===========================================
  // PLANNING TOOLS
  // ===========================================

  private adjustPaceZonesTool(): AgentTool {
    return {
      name: 'adjust_pace_zones',
      description: 'Update the athlete\'s training pace zones based on fitness progression',
      parameters: {
        type: 'object',
        properties: {
          easy_pace: { type: 'string', description: 'New easy pace (e.g., "8:10/mi")' },
          long_run_pace: { type: 'string', description: 'New long run pace' },
          marathon_pace: { type: 'string', description: 'New marathon pace' },
          threshold_pace: { type: 'string', description: 'New threshold pace' },
          interval_pace: { type: 'string', description: 'New interval pace' },
          recovery_pace: { type: 'string', description: 'New recovery pace' },
          reason: { type: 'string', description: 'Why these adjustments are being made' },
        },
        required: ['reason'],
      },
      execute: async (args: Record<string, unknown>, context: AgentContext) => {
        const contextData = context.data as Record<string, unknown>;
        const planId = contextData.planId as string;

        // Get current plan metadata
        const { data: plan } = await context.supabase
          .from('training_plans')
          .select('metadata')
          .eq('id', planId)
          .single();

        if (!plan) {
          return { success: false, error: 'Training plan not found' };
        }

        const currentMeta = plan.metadata as Record<string, unknown>;
        const currentPaces = (currentMeta.pace_zones || {}) as Record<string, string>;

        // Build updated pace zones
        const updatedPaces: Record<string, string> = { ...currentPaces };
        if (args.easy_pace) updatedPaces.easy_pace = args.easy_pace as string;
        if (args.long_run_pace) updatedPaces.long_run_pace = args.long_run_pace as string;
        if (args.marathon_pace) updatedPaces.marathon_pace = args.marathon_pace as string;
        if (args.threshold_pace) updatedPaces.threshold_pace = args.threshold_pace as string;
        if (args.interval_pace) updatedPaces.interval_pace = args.interval_pace as string;
        if (args.recovery_pace) updatedPaces.recovery_pace = args.recovery_pace as string;

        // Update plan
        await context.supabase
          .from('training_plans')
          .update({
            metadata: {
              ...currentMeta,
              pace_zones: updatedPaces,
              pace_zones_updated: context.date,
              pace_zones_reason: args.reason,
            },
          })
          .eq('id', planId);

        // Log the change
        await context.supabase.from('whiteboard_entries').insert({
          user_id: context.userId,
          agent_type: 'planning_coach',
          entry_type: 'plan_adjustment',
          title: 'Pace Zones Updated',
          content: `${args.reason}\n\nNew zones:\n${Object.entries(updatedPaces).map(([k, v]) => `- ${k}: ${v}`).join('\n')}`,
          priority: 3,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        });

        return {
          success: true,
          previous: currentPaces,
          updated: updatedPaces,
          reason: args.reason,
        };
      },
    };
  }

  private refineWorkoutPrescriptionTool(): AgentTool {
    return {
      name: 'refine_workout_prescription',
      description: 'Adjust a workout\'s prescription (pace, distance, description)',
      parameters: {
        type: 'object',
        properties: {
          workout_id: { type: 'string', description: 'ID of the workout to adjust' },
          new_pace: { type: 'string', description: 'Updated pace prescription' },
          new_distance: { type: 'number', description: 'Updated distance in miles' },
          new_description: { type: 'string', description: 'Updated workout description with coaching notes' },
          adjustment_reason: { type: 'string', description: 'Why this adjustment is being made' },
        },
        required: ['workout_id', 'adjustment_reason'],
      },
      execute: async (args: Record<string, unknown>, context: AgentContext) => {
        const workoutId = args.workout_id as string;

        const updates: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };

        if (args.new_pace) updates.prescribed_pace_per_mile = args.new_pace;
        if (args.new_distance) updates.prescribed_distance_miles = args.new_distance;
        if (args.new_description) updates.prescribed_description = args.new_description;

        const { data, error } = await context.supabase
          .from('workouts')
          .update(updates)
          .eq('id', workoutId)
          .select('id, title, scheduled_date')
          .single();

        if (error) {
          return { success: false, error: error.message };
        }

        // Record the adaptation
        await context.supabase.from('workout_adaptations').insert({
          user_id: context.userId,
          workout_id: workoutId,
          adaptation_type: 'prescription_refinement',
          reason_category: 'progression',
          reason_details: args.adjustment_reason,
          adapted_prescription: updates,
          agent_id: 'planning-coach',
        });

        return {
          success: true,
          workout: data,
          adjustments: updates,
          reason: args.adjustment_reason,
        };
      },
    };
  }

  private assessWeeklyReadinessTool(): AgentTool {
    return {
      name: 'assess_weekly_readiness',
      description: 'Summarize athlete readiness for the upcoming week',
      parameters: {
        type: 'object',
        properties: {
          readiness_score: { type: 'integer', description: 'Overall readiness 0-100' },
          load_recommendation: {
            type: 'string',
            enum: ['increase', 'maintain', 'reduce', 'recovery_week'],
            description: 'Recommended training load approach',
          },
          key_focus: { type: 'string', description: 'Primary focus for the week' },
          watch_items: {
            type: 'array',
            items: { type: 'string' },
            description: 'Things to monitor during the week',
          },
          notes: { type: 'string', description: 'Additional coaching notes' },
        },
        required: ['readiness_score', 'load_recommendation', 'key_focus'],
      },
      execute: async (args: Record<string, unknown>) => {
        // This tool primarily returns data for use in the workflow
        return {
          readiness_score: args.readiness_score,
          load_recommendation: args.load_recommendation,
          key_focus: args.key_focus,
          watch_items: args.watch_items || [],
          notes: args.notes || '',
        };
      },
    };
  }

  private generateWeekPreviewTool(): AgentTool {
    return {
      name: 'generate_week_preview',
      description: 'Generate a motivating preview of the upcoming training week',
      parameters: {
        type: 'object',
        properties: {
          week_number: { type: 'integer', description: 'Training week number' },
          total_miles: { type: 'number', description: 'Total planned mileage' },
          key_workout: { type: 'string', description: 'The most important workout of the week' },
          weekly_focus: { type: 'string', description: 'The main training focus' },
          preview_message: { type: 'string', description: 'Motivating 2-3 sentence preview for the athlete' },
          tactical_tip: { type: 'string', description: 'One specific tactical tip for the week' },
        },
        required: ['week_number', 'preview_message'],
      },
      execute: async (args: Record<string, unknown>, context: AgentContext) => {
        // Post to whiteboard
        await context.supabase.from('whiteboard_entries').insert({
          user_id: context.userId,
          agent_type: 'planning_coach',
          entry_type: 'week_preview',
          title: `Week ${args.week_number} Training Preview`,
          content: `${args.preview_message}\n\n💡 ${args.tactical_tip || 'Stay consistent with your easy days.'}`,
          priority: 2,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          metadata: {
            total_miles: args.total_miles,
            key_workout: args.key_workout,
            weekly_focus: args.weekly_focus,
          },
        });

        return {
          success: true,
          week_number: args.week_number,
          preview: args.preview_message,
        };
      },
    };
  }

  private requestNutritionPlanTool(): AgentTool {
    return {
      name: 'request_nutrition_plan',
      description: 'Request the nutrition agent to generate fueling plans for specific workouts',
      parameters: {
        type: 'object',
        properties: {
          workout_ids: {
            type: 'array',
            items: { type: 'string' },
            description: 'IDs of workouts needing nutrition plans',
          },
          special_instructions: {
            type: 'string',
            description: 'Any special nutrition considerations (e.g., "practice race day nutrition")',
          },
        },
        required: ['workout_ids'],
      },
      execute: async (args: Record<string, unknown>, context: AgentContext) => {
        // Post a request to whiteboard for nutrition agent to pick up
        await context.supabase.from('whiteboard_entries').insert({
          user_id: context.userId,
          agent_type: 'planning_coach',
          entry_type: 'agent_request',
          title: 'Nutrition Plan Request',
          content: `Please generate nutrition/fueling plans for the following workouts.\n\n${args.special_instructions || 'Standard fueling based on workout type and duration.'}`,
          priority: 2,
          requires_action: true,
          metadata: {
            target_agent: 'nutrition',
            workout_ids: args.workout_ids,
            special_instructions: args.special_instructions,
          },
        });

        return {
          success: true,
          message: 'Nutrition plan request posted to whiteboard',
          workout_count: (args.workout_ids as string[]).length,
        };
      },
    };
  }

  private updateTrainingPhaseTool(): AgentTool {
    return {
      name: 'update_training_phase',
      description: 'Record a training phase transition',
      parameters: {
        type: 'object',
        properties: {
          new_phase: {
            type: 'string',
            enum: ['base_building', 'build', 'peak', 'taper', 'race_week', 'recovery'],
            description: 'The phase being transitioned to',
          },
          transition_reason: { type: 'string', description: 'Why transitioning now' },
          phase_goals: {
            type: 'array',
            items: { type: 'string' },
            description: 'Goals for this new phase',
          },
        },
        required: ['new_phase', 'transition_reason'],
      },
      execute: async (args: Record<string, unknown>, context: AgentContext) => {
        const contextData = context.data as Record<string, unknown>;
        const planId = contextData.planId as string;

        // Get current plan
        const { data: plan } = await context.supabase
          .from('training_plans')
          .select('metadata')
          .eq('id', planId)
          .single();

        if (!plan) {
          return { success: false, error: 'Training plan not found' };
        }

        const currentMeta = plan.metadata as Record<string, unknown>;
        const previousPhase = currentMeta.current_phase;

        // Update plan phase
        await context.supabase
          .from('training_plans')
          .update({
            metadata: {
              ...currentMeta,
              current_phase: args.new_phase,
              previous_phase: previousPhase,
              phase_transition_date: context.date,
              phase_goals: args.phase_goals,
            },
          })
          .eq('id', planId);

        // Post to whiteboard
        await context.supabase.from('whiteboard_entries').insert({
          user_id: context.userId,
          agent_type: 'planning_coach',
          entry_type: 'phase_transition',
          title: `Training Phase: ${(args.new_phase as string).replace('_', ' ')}`,
          content: `${args.transition_reason}\n\nPhase Goals:\n${((args.phase_goals as string[]) || []).map(g => `• ${g}`).join('\n')}`,
          priority: 1,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        });

        return {
          success: true,
          previous_phase: previousPhase,
          new_phase: args.new_phase,
          reason: args.transition_reason,
        };
      },
    };
  }
}
