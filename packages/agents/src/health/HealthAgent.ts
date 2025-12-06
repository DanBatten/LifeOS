import type { LLMProvider } from '@lifeos/llm';
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
    super(
      {
        id: 'health-agent',
        name: 'Health & Recovery Agent',
        description: 'Monitors health metrics, analyzes recovery, and provides recommendations',
        model: 'claude-sonnet-4-20250514',
        temperature: 0.3,
        maxTokens: 2000,
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
    return JSON.stringify(data, null, 2);
  }
}
