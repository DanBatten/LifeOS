/**
 * SDK-based Health Agent
 *
 * This is the Agent SDK version of HealthAgent. It provides the same
 * functionality but uses the Anthropic Agent SDK as the execution harness.
 *
 * Benefits:
 * - Automatic context compaction (unlimited conversation length)
 * - Built-in streaming support
 * - Session persistence for multi-turn health consultations
 * - Better error handling and cost tracking
 */

import { SdkAgent } from './SdkAgent.js';
import type { AgentContext, AgentTool, WhiteboardEntryPayload } from '../base/types.js';
import { getAgentModelConfig } from '@lifeos/llm';
import { HealthRepository, WorkoutRepository, WhiteboardRepository } from '@lifeos/database';

/**
 * SDK-based Health Agent
 */
export class SdkHealthAgent extends SdkAgent {
  constructor() {
    const modelConfig = getAgentModelConfig('health-agent');

    super({
      id: 'health-agent-sdk',
      name: 'SDK Health & Recovery Agent',
      description: 'Monitors health metrics, analyzes recovery, and provides recommendations using Agent SDK',
      model: modelConfig.model.id,
      temperature: modelConfig.temperature,
      maxTokens: modelConfig.maxTokens,
      maxTurns: 10,
    });
  }

  protected registerTools(): AgentTool[] {
    return [
      this.getHealthHistoryTool(),
      this.getRecentWorkoutsTool(),
      this.calculateRecoveryScoreTool(),
      this.createWhiteboardEntryTool(),
      this.suggestScheduleChangeTool(),
    ];
  }

  protected buildSystemPrompt(context: AgentContext): string {
    const now = new Date();

    return `You are the Health & Recovery Agent for ${context.userName}'s LifeOS personal operating system.

Your role is to:
1. Monitor health metrics and recovery status
2. Identify potential issues before they become problems
3. Recommend rest, recovery, or schedule adjustments when truly needed
4. Support the user's training goals while protecting against injury
5. Track injuries and suggest modifications

## Your Personality
- Supportive and encouraging, not alarmist
- Evidence-based recommendations
- Balanced perspective - training stress is normal and necessary
- Respectful of user autonomy and experience
- Acknowledge that athletes know their bodies

## Key Context
- The user is an experienced runner training for a marathon
- Some training stress and fatigue is expected and normal
- Rest days are already built into their schedule
- Low HRV or body battery after hard workouts is expected
- A single bad night of sleep doesn't warrant major changes

## Decision Framework (use nuance, not rigid rules)
- Sleep < 5 hours consistently (2+ days): Suggest prioritizing sleep
- HRV trending down over 3+ days: Worth monitoring
- Body battery not recovering to 60+ overnight: Note recovery may be lagging
- Hard workout yesterday + poor sleep + low HRV today: Good day for easy effort
- One metric slightly off: Usually fine, mention but don't overreact

## Output Instructions
- Be helpful and balanced, not catastrophic
- Avoid urgent language unless truly necessary
- Frame suggestions as options, not mandates
- Acknowledge what's going well alongside concerns
- For simple questions, respond directly from provided data
- Only use tools when you need to POST information (whiteboard entries)

Current date: ${context.date}
Current time: ${now.toLocaleTimeString('en-US', { hour12: true })}
Timezone: ${context.timezone}`;
  }

  protected buildUserPrompt(context: AgentContext): string {
    const data = context.data as Record<string, unknown>;
    const taskType = (data.taskType as string) || 'health_analysis';

    switch (taskType) {
      case 'chat_response':
        return this.buildChatResponsePrompt(context);
      case 'health_analysis':
      default:
        return this.buildHealthAnalysisPrompt(context);
    }
  }

  private buildHealthAnalysisPrompt(context: AgentContext): string {
    const data = context.data as Record<string, unknown>;

    return `Please analyze my current health and recovery status.

## Today's Health Snapshot
${this.formatData(data.healthSnapshot || data.todayHealth, 'No health data recorded for today')}

## Recent Health History (last 7 days)
${this.formatData(data.healthHistory || data.recentHealth, 'No recent health history')}

## Recent Workouts (last 7 days)
${this.formatData(data.recentWorkouts, 'No recent workouts')}

## Active Injuries
${this.formatData(data.activeInjuries, 'No active injuries')}

## Today's Schedule
${this.formatData(data.todaysEvents || data.todayWorkout, 'No events scheduled')}

---

Based on this data:
1. Assess my current recovery status
2. Flag any concerns or risks
3. Provide specific recommendations for today
4. Note any injury-related modifications

Be specific and actionable in your recommendations.`;
  }

  private buildChatResponsePrompt(context: AgentContext): string {
    const data = context.data as Record<string, unknown>;
    const userMessage = (data.userMessage as string) || '';
    const todayHealth = data.todayHealth as Record<string, unknown> | undefined;
    const recentHealth = (data.recentHealth as unknown[]) || [];

    return `The user sent this message:
"${userMessage}"

## TODAY'S HEALTH DATA
${todayHealth ? `
- Sleep: ${(todayHealth.sleepHours as number)?.toFixed(1) || '?'} hours
- Resting HR: ${todayHealth.restingHr || '?'} bpm
- HRV: ${todayHealth.hrv || '?'} (Status: ${todayHealth.hrvStatus || 'unknown'})
- Body Battery: ${todayHealth.bodyBattery ? JSON.stringify(todayHealth.bodyBattery) : 'Not available'}
- Stress Level: ${todayHealth.stressLevel || 'Not available'}
` : 'No health data synced for today yet.'}

## RECENT HEALTH TREND (last 5 days)
${recentHealth.length > 0 ? recentHealth.slice(0, 5).map((h: unknown) => {
  const health = h as Record<string, unknown>;
  return `${health.snapshotDate || health.snapshot_date}: Sleep=${((health.sleepHours || health.sleep_hours) as number)?.toFixed(1) || '?'}h, HR=${health.restingHr || health.resting_hr || '?'}, HRV=${health.hrv || '?'}`;
}).join('\n') : 'No recent health data'}

## ACTIVE INJURIES
${(data.activeInjuries as unknown[])?.length > 0 ? (data.activeInjuries as Array<{ bodyPart?: string; body_part?: string; severity?: number; notes?: string }>).map(i =>
  `${i.bodyPart || i.body_part}: Severity ${i.severity}/10 - ${i.notes || 'No notes'}`
).join('\n') : 'None'}

---

Respond helpfully to the user's question based on the data provided above.
Be concise and conversational.`;
  }

  private formatData(data: unknown, emptyMessage: string): string {
    if (!data || (Array.isArray(data) && data.length === 0)) {
      return emptyMessage;
    }

    if (Array.isArray(data)) {
      const limited = data.slice(0, 7);
      return JSON.stringify(limited, null, 2);
    }

    return JSON.stringify(data, null, 2);
  }

  // ===========================================
  // TOOL IMPLEMENTATIONS
  // ===========================================

  private getHealthHistoryTool(): AgentTool {
    return {
      name: 'get_health_history',
      description: 'Get health snapshots for a specified number of days in the past',
      parameters: {
        type: 'object',
        properties: {
          days: {
            type: 'number',
            description: 'Number of days to look back (default: 7)',
          },
        },
      },
      execute: async (args: Record<string, unknown>, context: AgentContext) => {
        const days = (args.days as number) || 7;
        const repo = new HealthRepository(context.supabase);
        return repo.getRecentSnapshots(context.userId, days);
      },
    };
  }

  private getRecentWorkoutsTool(): AgentTool {
    return {
      name: 'get_recent_workouts',
      description: 'Get completed workouts for a specified number of days',
      parameters: {
        type: 'object',
        properties: {
          days: {
            type: 'number',
            description: 'Number of days to look back (default: 7)',
          },
        },
      },
      execute: async (args: Record<string, unknown>, context: AgentContext) => {
        const days = (args.days as number) || 7;
        const repo = new WorkoutRepository(context.supabase);
        return repo.findRecentCompleted(context.userId, days);
      },
    };
  }

  private calculateRecoveryScoreTool(): AgentTool {
    return {
      name: 'calculate_recovery_score',
      description: 'Calculate the current recovery score based on health metrics',
      parameters: {
        type: 'object',
        properties: {},
      },
      execute: async (_args: Record<string, unknown>, context: AgentContext) => {
        const repo = new HealthRepository(context.supabase);
        const score = await repo.calculateRecoveryScore(context.userId);
        return { recoveryScore: score };
      },
    };
  }

  private createWhiteboardEntryTool(): AgentTool {
    return {
      name: 'create_whiteboard_entry',
      description: 'Post an observation, alert, or suggestion to the whiteboard',
      parameters: {
        type: 'object',
        properties: {
          entry_type: {
            type: 'string',
            enum: ['observation', 'suggestion', 'alert', 'insight'],
            description: 'Type of entry',
          },
          title: {
            type: 'string',
            description: 'Short title for the entry',
          },
          content: {
            type: 'string',
            description: 'Detailed content of the entry',
          },
          priority: {
            type: 'number',
            description: 'Priority 0-100 (higher = more important)',
          },
          requires_response: {
            type: 'boolean',
            description: 'Whether this entry requires user action',
          },
        },
        required: ['entry_type', 'content'],
      },
      execute: async (args: Record<string, unknown>, context: AgentContext) => {
        const repo = new WhiteboardRepository(context.supabase);

        await repo.create(
          {
            agentId: 'health-agent-sdk',
            entryType: args.entry_type as WhiteboardEntryPayload['entryType'],
            title: args.title as string | undefined,
            content: args.content as string,
            priority: (args.priority as number) || 50,
            requiresResponse: (args.requires_response as boolean) || false,
            contextDate: new Date(context.date),
            visibility: 'all',
            tags: ['health', 'recovery'],
            metadata: {},
          },
          context.userId
        );

        const result: WhiteboardEntryPayload = {
          entryType: args.entry_type as WhiteboardEntryPayload['entryType'],
          title: args.title as string | undefined,
          content: args.content as string,
          priority: (args.priority as number) || 50,
          requiresResponse: (args.requires_response as boolean) || false,
        };
        return result;
      },
    };
  }

  private suggestScheduleChangeTool(): AgentTool {
    return {
      name: 'suggest_schedule_change',
      description: 'Suggest moving, cancelling, or modifying an event for health/recovery reasons',
      parameters: {
        type: 'object',
        properties: {
          event_id: {
            type: 'string',
            description: 'ID of the event to modify',
          },
          action: {
            type: 'string',
            enum: ['reschedule', 'cancel', 'shorten', 'reduce_intensity'],
            description: 'Suggested action',
          },
          reason: {
            type: 'string',
            description: 'Health-related reason for the change',
          },
          suggested_time: {
            type: 'string',
            description: 'For reschedule: ISO datetime for new time',
          },
        },
        required: ['event_id', 'action', 'reason'],
      },
      execute: async (args: Record<string, unknown>, context: AgentContext) => {
        const repo = new WhiteboardRepository(context.supabase);

        const entry = await repo.create(
          {
            agentId: 'health-agent-sdk',
            entryType: 'suggestion',
            title: `Schedule Change: ${args.action}`,
            content: args.reason as string,
            structuredData: {
              type: 'schedule_change',
              eventId: args.event_id,
              action: args.action,
              suggestedTime: args.suggested_time,
            },
            priority: 70,
            requiresResponse: true,
            relatedEntityType: 'event',
            relatedEntityId: args.event_id as string,
            contextDate: new Date(context.date),
            visibility: 'all',
            tags: ['health', 'schedule-change'],
            metadata: {},
          },
          context.userId
        );

        return {
          entryType: 'suggestion',
          title: `Schedule Change: ${args.action}`,
          content: args.reason,
          structuredData: {
            type: 'schedule_change',
            eventId: args.event_id,
            action: args.action,
            suggestedTime: args.suggested_time,
          },
          id: entry.id,
        } as WhiteboardEntryPayload;
      },
    };
  }
}
