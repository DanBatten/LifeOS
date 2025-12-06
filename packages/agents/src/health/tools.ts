import { HealthRepository, WorkoutRepository, WhiteboardRepository } from '@lifeos/database';
import type { AgentContext, AgentTool, WhiteboardEntryPayload } from '../base/types.js';
import { createGarminClient, getTodayString, getYesterdayString } from '@lifeos/garmin';

/**
 * Get health tools for the Health Agent
 */
export function getHealthTools(): AgentTool[] {
  return [
    // Garmin real-time tools
    ...getGarminHealthTools(),
    // Database tools
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

/**
 * Garmin-specific tools for real-time health data
 */
function getGarminHealthTools(): AgentTool[] {
  return [
    {
      name: 'get_garmin_daily_summary',
      description: 'Get real-time daily health summary from Garmin including Body Battery, stress, steps, and heart rate. Use this for the most current readiness data.',
      parameters: {
        type: 'object',
        properties: {
          date: {
            type: 'string',
            description: 'Date in YYYY-MM-DD format (default: today)',
          },
        },
        required: [],
      },
      execute: async (args: Record<string, unknown>, _context: AgentContext) => {
        const date = (args.date as string) || getTodayString();
        const client = createGarminClient();
        
        try {
          await client.connect();
          const summary = await client.getDailySummary(date);
          client.disconnect();
          
          return {
            date,
            restingHeartRate: summary.restingHeartRate,
            steps: summary.totalSteps,
            stepsGoal: summary.dailyStepGoal,
            bodyBattery: {
              current: summary.bodyBatteryMostRecentValue,
              highest: summary.bodyBatteryHighestValue,
              lowest: summary.bodyBatteryLowestValue,
            },
            stress: {
              average: summary.averageStressLevel,
              max: summary.maxStressLevel,
            },
            intensity: {
              moderate: summary.moderateIntensityMinutes,
              vigorous: summary.vigorousIntensityMinutes,
            },
            calories: {
              total: summary.totalKilocalories,
              active: summary.activeKilocalories,
            },
          };
        } catch (error) {
          client.disconnect();
          return {
            error: 'Failed to fetch Garmin data',
            message: error instanceof Error ? error.message : String(error),
          };
        }
      },
    },
    {
      name: 'get_garmin_sleep',
      description: 'Get detailed sleep data from Garmin including sleep stages, HRV, and sleep scores. Best called for last night\'s sleep.',
      parameters: {
        type: 'object',
        properties: {
          date: {
            type: 'string',
            description: 'Date in YYYY-MM-DD format (default: yesterday for last night\'s sleep)',
          },
        },
        required: [],
      },
      execute: async (args: Record<string, unknown>, _context: AgentContext) => {
        // Default to yesterday since sleep data is for the night before
        const date = (args.date as string) || getYesterdayString();
        const client = createGarminClient();
        
        try {
          await client.connect();
          const [sleep, hrv] = await Promise.all([
            client.getSleepData(date),
            client.getHRVData(date),
          ]);
          client.disconnect();
          
          return {
            date,
            sleepHours: sleep.sleepTimeSeconds ? Math.round((sleep.sleepTimeSeconds / 3600) * 10) / 10 : null,
            sleepStages: {
              deepMinutes: sleep.deepSleepSeconds ? Math.round(sleep.deepSleepSeconds / 60) : null,
              lightMinutes: sleep.lightSleepSeconds ? Math.round(sleep.lightSleepSeconds / 60) : null,
              remMinutes: sleep.remSleepSeconds ? Math.round(sleep.remSleepSeconds / 60) : null,
              awakeMinutes: sleep.awakeSleepSeconds ? Math.round(sleep.awakeSleepSeconds / 60) : null,
            },
            sleepScores: sleep.sleepScores,
            hrv: {
              overnightAverage: sleep.avgOvernightHrv,
              status: sleep.hrvStatus,
              weeklyAverage: hrv.weeklyAvg,
              baseline: hrv.baseline,
              feedback: hrv.feedbackPhrase,
            },
            bodyBatteryChange: sleep.bodyBatteryChange,
            restlessMoments: sleep.restlessMomentsCount,
          };
        } catch (error) {
          client.disconnect();
          return {
            error: 'Failed to fetch Garmin sleep data',
            message: error instanceof Error ? error.message : String(error),
          };
        }
      },
    },
    {
      name: 'get_garmin_readiness',
      description: 'Get comprehensive readiness assessment combining Body Battery, HRV, sleep, and stress from Garmin. Use this for morning readiness checks.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
      execute: async (_args: Record<string, unknown>, _context: AgentContext) => {
        const today = getTodayString();
        const yesterday = getYesterdayString();
        const client = createGarminClient();
        
        try {
          await client.connect();
          
          const [todaySummary, sleep, hrv] = await Promise.all([
            client.getDailySummary(today),
            client.getSleepData(yesterday),
            client.getHRVData(yesterday),
          ]);
          
          client.disconnect();
          
          // Calculate readiness score (0-100)
          let readinessScore = 50; // Default baseline
          let factors: string[] = [];
          
          // Body Battery factor (40% weight)
          if (todaySummary.bodyBatteryMostRecentValue) {
            const bbScore = todaySummary.bodyBatteryMostRecentValue;
            readinessScore += (bbScore - 50) * 0.4;
            if (bbScore >= 70) factors.push('Good Body Battery');
            else if (bbScore <= 30) factors.push('Low Body Battery');
          }
          
          // Sleep factor (30% weight)
          if (sleep.sleepScores?.totalScore) {
            const sleepScore = sleep.sleepScores.totalScore;
            readinessScore += (sleepScore - 50) * 0.3;
            if (sleepScore >= 70) factors.push('Good sleep quality');
            else if (sleepScore <= 40) factors.push('Poor sleep quality');
          }
          
          // HRV factor (20% weight)
          if (hrv.lastNightAvg && hrv.baseline?.balancedLow) {
            const hrvStatus = hrv.lastNightAvg >= hrv.baseline.balancedLow ? 'good' : 'low';
            if (hrvStatus === 'good') {
              readinessScore += 10;
              factors.push('HRV in healthy range');
            } else {
              readinessScore -= 10;
              factors.push('HRV below baseline');
            }
          }
          
          // Stress factor (10% weight)
          if (todaySummary.averageStressLevel) {
            if (todaySummary.averageStressLevel > 50) {
              readinessScore -= 5;
              factors.push('Elevated stress');
            }
          }
          
          // Clamp score
          readinessScore = Math.max(0, Math.min(100, Math.round(readinessScore)));
          
          return {
            readinessScore,
            readinessLevel: readinessScore >= 70 ? 'good' : readinessScore >= 50 ? 'moderate' : 'low',
            factors,
            metrics: {
              bodyBattery: todaySummary.bodyBatteryMostRecentValue,
              restingHR: todaySummary.restingHeartRate,
              sleepHours: sleep.sleepTimeSeconds ? Math.round((sleep.sleepTimeSeconds / 3600) * 10) / 10 : null,
              sleepScore: sleep.sleepScores?.totalScore,
              hrvLastNight: hrv.lastNightAvg,
              hrvBaseline: hrv.baseline?.balancedLow,
              stressLevel: todaySummary.averageStressLevel,
            },
            recommendation: readinessScore >= 70 
              ? 'Ready for normal training intensity'
              : readinessScore >= 50 
                ? 'Consider moderate intensity today'
                : 'Prioritize recovery - reduce training load',
          };
        } catch (error) {
          client.disconnect();
          return {
            error: 'Failed to fetch Garmin readiness data',
            message: error instanceof Error ? error.message : String(error),
          };
        }
      },
    },
  ];
}
