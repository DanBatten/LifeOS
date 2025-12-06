import { HealthRepository, WorkoutRepository, WhiteboardRepository } from '@lifeos/database';
import type { AgentContext, AgentTool, WhiteboardEntryPayload } from '../base/types.js';

/**
 * Get health tools for the Health Agent
 */
export function getHealthTools(): AgentTool[] {
  return [
    {
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
        required: [],
      },
      execute: async (args: Record<string, unknown>, context: AgentContext) => {
        const days = (args.days as number) || 7;
        const repo = new HealthRepository(context.supabase);
        return repo.getRecentSnapshots(context.userId, days);
      },
    },
    {
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
        required: [],
      },
      execute: async (args: Record<string, unknown>, context: AgentContext) => {
        const days = (args.days as number) || 7;
        const repo = new WorkoutRepository(context.supabase);
        return repo.findRecentCompleted(context.userId, days);
      },
    },
    {
      name: 'calculate_recovery_score',
      description: 'Calculate the current recovery score based on health metrics',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
      execute: async (_args: Record<string, unknown>, context: AgentContext) => {
        const repo = new HealthRepository(context.supabase);
        const score = await repo.calculateRecoveryScore(context.userId);
        return { recoveryScore: score };
      },
    },
    {
      name: 'create_whiteboard_entry',
      description: 'Post an observation, alert, or suggestion to the whiteboard for the user or other agents to see',
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
          structured_data: {
            type: 'object',
            description: 'Optional structured data (e.g., metrics, scores)',
          },
        },
        required: ['entry_type', 'content'],
      },
      execute: async (args: Record<string, unknown>, context: AgentContext) => {
        const repo = new WhiteboardRepository(context.supabase);

        // Save to database
        await repo.create(
          {
            agentId: 'health-agent',
            entryType: args.entry_type as WhiteboardEntryPayload['entryType'],
            title: args.title as string | undefined,
            content: args.content as string,
            priority: (args.priority as number) || 50,
            requiresResponse: (args.requires_response as boolean) || false,
            structuredData: args.structured_data as Record<string, unknown> | undefined,
            contextDate: new Date(context.date),
            visibility: 'all',
            tags: ['health', 'recovery'],
            metadata: {},
          },
          context.userId
        );

        // Return as WhiteboardEntryPayload for collection
        const result: WhiteboardEntryPayload = {
          entryType: args.entry_type as WhiteboardEntryPayload['entryType'],
          title: args.title as string | undefined,
          content: args.content as string,
          priority: (args.priority as number) || 50,
          requiresResponse: (args.requires_response as boolean) || false,
          structuredData: args.structured_data as Record<string, unknown> | undefined,
        };
        return result;
      },
    },
    {
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

        // Create a suggestion entry with structured schedule change data
        const entry = await repo.create(
          {
            agentId: 'health-agent',
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
    },
  ];
}
