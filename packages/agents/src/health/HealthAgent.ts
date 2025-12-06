import type { LLMProvider } from '@lifeos/llm';
import { getAgentModelConfig } from '@lifeos/llm';
import { BaseAgent } from '../base/BaseAgent.js';
import type { AgentContext, AgentTool } from '../base/types.js';
import { getHealthTools } from './tools.js';
import { HEALTH_AGENT_SYSTEM_PROMPT, HEALTH_USER_PROMPT_TEMPLATE } from './prompts.js';

/**
 * Health & Recovery Agent
 *
 * Monitors health metrics, analyzes recovery status, and provides
 * recommendations for maintaining optimal health and preventing burnout.
 */
export class HealthAgent extends BaseAgent {
  constructor(llmClient: LLMProvider) {
    const modelConfig = getAgentModelConfig('health-agent');
    
    super(
      {
        id: 'health-agent',
        name: 'Health & Recovery Agent',
        description: 'Monitors health metrics, analyzes recovery, and provides recommendations',
        model: modelConfig.model.id,
        temperature: modelConfig.temperature,
        maxTokens: modelConfig.maxTokens,
      },
      llmClient
    );
  }

  protected registerTools(): AgentTool[] {
    return getHealthTools();
  }

  protected buildSystemPrompt(context: AgentContext): string {
    const now = new Date();

    return HEALTH_AGENT_SYSTEM_PROMPT
      .replace('{{user_name}}', context.userName)
      .replace('{{current_date}}', context.date)
      .replace('{{current_time}}', now.toLocaleTimeString('en-US', { hour12: true }))
      .replace('{{timezone}}', context.timezone);
  }

  protected buildUserPrompt(context: AgentContext): string {
    const {
      healthSnapshot,
      healthHistory,
      recentWorkouts,
      activeInjuries,
      todaysEvents,
      constraints,
    } = context.data;

    return HEALTH_USER_PROMPT_TEMPLATE
      .replace('{{health_snapshot}}', this.formatData(healthSnapshot, 'No health data recorded for today'))
      .replace('{{health_history}}', this.formatData(healthHistory, 'No recent health history'))
      .replace('{{recent_workouts}}', this.formatData(recentWorkouts, 'No recent workouts'))
      .replace('{{active_injuries}}', this.formatData(activeInjuries, 'No active injuries'))
      .replace('{{todays_events}}', this.formatData(todaysEvents, 'No events scheduled'))
      .replace('{{constraints}}', this.formatData(constraints, 'No constraints defined'));
  }

  private formatData(data: unknown, emptyMessage: string): string {
    if (!data || (Array.isArray(data) && data.length === 0)) {
      return emptyMessage;
    }
    
    // Limit array size to prevent huge prompts
    if (Array.isArray(data)) {
      const limited = data.slice(0, 7); // Max 7 items
      const summary = limited.map((item: Record<string, unknown>) => {
        // Extract only key fields to reduce token count
        if (item.scheduledDate || item.scheduled_date) {
          // Workout
          return {
            date: item.scheduledDate || item.scheduled_date,
            title: item.title,
            type: item.workoutType || item.workout_type,
            status: item.status,
            duration: item.actualDurationMinutes || item.actual_duration_minutes,
          };
        }
        if (item.snapshotDate || item.snapshot_date) {
          // Health snapshot
          return {
            date: item.snapshotDate || item.snapshot_date,
            sleepHours: item.sleepHours || item.sleep_hours,
            sleepQuality: item.sleepQuality || item.sleep_quality,
            hrv: item.hrv,
            restingHr: item.restingHr || item.resting_hr,
            energyLevel: item.energyLevel || item.energy_level,
          };
        }
        return item;
      });
      return JSON.stringify(summary, null, 2);
    }
    
    return JSON.stringify(data, null, 2);
  }
}
