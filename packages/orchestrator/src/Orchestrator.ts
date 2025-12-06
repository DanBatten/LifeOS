import { EventEmitter } from 'events';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AgentId, DailyPlan } from '@lifeos/core';
import { getLogger, getTodayISO } from '@lifeos/core';
import type { LLMProvider } from '@lifeos/llm';
import type { BaseAgent, AgentOutput, AgentContext } from '@lifeos/agents';
import { HealthAgent, TrainingCoachAgent } from '@lifeos/agents';
import {
  UserRepository,
  EventRepository,
  TaskRepository,
  HealthRepository,
  WorkoutRepository,
  WhiteboardRepository,
} from '@lifeos/database';
import type {
  OrchestratorConfig,
  MorningFlowResult,
  EveningFlowResult,
  EventTrigger,
  OrchestratorContext,
  MessageClassification,
} from './types.js';

const logger = getLogger();

/**
 * Orchestrator coordinates agent activities and manages daily flows
 */
export class Orchestrator extends EventEmitter {
  private config: OrchestratorConfig;
  private llmClient: LLMProvider;
  private supabase: SupabaseClient;
  private agents: Map<AgentId, BaseAgent> = new Map();

  constructor(
    config: OrchestratorConfig,
    llmClient: LLMProvider,
    supabase: SupabaseClient
  ) {
    super();
    this.config = config;
    this.llmClient = llmClient;
    this.supabase = supabase;

    // Register default agents
    this.registerDefaultAgents();
  }

  /**
   * Register the default set of agents
   */
  private registerDefaultAgents(): void {
    this.registerAgent(new HealthAgent(this.llmClient));
    this.registerAgent(new TrainingCoachAgent(this.llmClient));
    // TODO: Register other agents as they are implemented
    // this.registerAgent(new WorkloadAgent(this.llmClient));
    // this.registerAgent(new ReflectionAgent(this.llmClient));
  }

  /**
   * Register an agent with the orchestrator
   */
  registerAgent(agent: BaseAgent): void {
    this.agents.set(agent.id as AgentId, agent);

    // Forward agent events
    agent.on('agent:start', (data) => this.emit('agent:dispatched', { agentId: data.agentId }));
    agent.on('agent:complete', (data) => this.emit('agent:completed', { agentId: data.agentId, output: data.output }));
    agent.on('agent:error', (data) => this.emit('agent:failed', { agentId: data.agentId, error: data.error }));

    logger.info(`Registered agent: ${agent.id}`, { agentId: agent.id });
  }

  /**
   * Build context for agent execution
   */
  async buildContext(date?: string): Promise<OrchestratorContext> {
    const targetDate = date || getTodayISO(this.config.timezone);

    // Get user info
    const userRepo = new UserRepository(this.supabase);
    const user = await userRepo.findById(this.config.userId);

    if (!user) {
      throw new Error(`User not found: ${this.config.userId}`);
    }

    // Fetch all relevant data in parallel
    const [events, tasks, healthSnapshot, recentWorkouts, whiteboardEntries] = await Promise.all([
      new EventRepository(this.supabase).findByDate(this.config.userId, new Date(targetDate)),
      new TaskRepository(this.supabase).findOpen(this.config.userId),
      new HealthRepository(this.supabase).findByDate(this.config.userId, new Date(targetDate)),
      new WorkoutRepository(this.supabase).findRecentCompleted(this.config.userId, 7),
      new WhiteboardRepository(this.supabase).getRecentForContext(this.config.userId),
    ]);

    return {
      userId: this.config.userId,
      date: targetDate,
      userName: user.name,
      timezone: this.config.timezone || user.timezone,
      events,
      tasks,
      healthSnapshot,
      recentWorkouts,
      activeInjuries: [], // TODO: Implement injury repository
      constraints: [], // TODO: Implement constraints repository
      whiteboardEntries,
    };
  }

  /**
   * Run the morning flow - executes all agents and synthesizes daily plan
   */
  async runMorningFlow(): Promise<MorningFlowResult> {
    const startTime = Date.now();
    this.emit('flow:start', { type: 'morning' });

    logger.info('Starting morning flow', { userId: this.config.userId });

    const context = await this.buildContext();
    const agentOutputs: Record<string, AgentOutput> = {};

    // Build agent context
    const agentContext: AgentContext = {
      userId: context.userId,
      date: context.date,
      userName: context.userName,
      timezone: context.timezone,
      supabase: this.supabase,
      data: {
        healthSnapshot: context.healthSnapshot,
        healthHistory: [], // Will be fetched by agent tools
        recentWorkouts: context.recentWorkouts,
        activeInjuries: context.activeInjuries,
        todaysEvents: context.events,
        constraints: context.constraints,
        tasks: context.tasks,
        whiteboardEntries: context.whiteboardEntries,
      },
    };

    // Run Health Agent first
    const healthAgent = this.agents.get('health-agent');
    if (healthAgent) {
      try {
        const output = await healthAgent.execute(agentContext);
        agentOutputs['health-agent'] = output;

        // Update context with health assessment for other agents
        agentContext.data.healthAssessment = output.content;
      } catch (error) {
        logger.error('Health agent failed', error instanceof Error ? error : null, {
          agentId: 'health-agent',
        });
      }
    }

    // Run Training Coach Agent with health context
    const trainingAgent = this.agents.get('training-coach');
    if (trainingAgent) {
      try {
        // Add health assessment to training context
        agentContext.data.taskType = 'readiness_check';
        const output = await trainingAgent.execute(agentContext);
        agentOutputs['training-coach'] = output;

        // Update context with training assessment
        agentContext.data.trainingAssessment = output.content;
      } catch (error) {
        logger.error('Training coach agent failed', error instanceof Error ? error : null, {
          agentId: 'training-coach',
        });
      }
    }

    // TODO: Run workload agent with health + training context

    // Synthesize daily plan
    const dailyPlan = await this.synthesizeDailyPlan(agentOutputs, context);

    // Collect all whiteboard entries
    const whiteboardEntries = Object.values(agentOutputs)
      .flatMap((output) => output.whiteboardEntries || [])
      .map((entry) => ({
        ...entry,
        id: '', // Will be set by repository
        userId: context.userId,
        agentId: '', // Set by each agent
        visibility: 'all' as const,
        isRead: false,
        isActioned: false,
        contextDate: new Date(context.date),
        tags: [],
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

    const duration = Date.now() - startTime;
    this.emit('flow:complete', { type: 'morning', duration });

    logger.info('Morning flow completed', {
      duration,
      agentCount: Object.keys(agentOutputs).length,
    });

    return {
      dailyPlan,
      agentOutputs: agentOutputs as Record<AgentId, AgentOutput>,
      whiteboardEntries: whiteboardEntries as any,
      duration,
    };
  }

  /**
   * Run the evening flow - reflection and next-day prep
   */
  async runEveningFlow(): Promise<EveningFlowResult> {
    const startTime = Date.now();
    this.emit('flow:start', { type: 'evening' });

    logger.info('Starting evening flow', { userId: this.config.userId });

    // TODO: Implement evening flow with reflection agent

    const duration = Date.now() - startTime;
    this.emit('flow:complete', { type: 'evening', duration });

    return {
      reflection: {} as AgentOutput,
      whiteboardEntries: [],
      duration,
    };
  }

  /**
   * Handle an event trigger (e.g., calendar change, task completed)
   */
  async handleEventTrigger(trigger: EventTrigger): Promise<void> {
    this.emit('trigger:received', { trigger });
    this.emit('flow:start', { type: 'trigger' });

    const startTime = Date.now();

    logger.info('Handling event trigger', {
      triggerType: trigger.type,
      entityId: trigger.entityId,
    });

    const context = await this.buildContext();
    const agentContext: AgentContext = {
      userId: context.userId,
      date: context.date,
      userName: context.userName,
      timezone: context.timezone,
      supabase: this.supabase,
      data: {
        ...context,
        trigger,
      },
    };

    // Determine which agent(s) to run based on trigger type
    switch (trigger.type) {
      case 'health_checkin':
        await this.runAgent('health-agent', agentContext);
        break;

      case 'workout_completed':
        // Run health agent first to assess recovery impact
        await this.runAgent('health-agent', agentContext);
        // Then run training coach to analyze the workout
        agentContext.data.taskType = 'workout_analysis';
        agentContext.data.workoutId = trigger.entityId;
        await this.runAgent('training-coach', agentContext);
        break;

      case 'weekly_review':
        // Run training coach for weekly summary
        agentContext.data.taskType = 'weekly_review';
        await this.runAgent('training-coach', agentContext);
        break;

      case 'calendar_change':
      case 'task_completed':
      case 'task_added':
        // TODO: Run workload agent
        break;

      default:
        logger.warn('Unknown trigger type', { triggerType: trigger.type });
    }

    const duration = Date.now() - startTime;
    this.emit('flow:complete', { type: 'trigger', duration });
  }

  /**
   * Handle a user chat message
   */
  async handleUserMessage(message: string): Promise<AgentOutput> {
    this.emit('flow:start', { type: 'chat' });
    const startTime = Date.now();

    logger.info('Handling user message', { userId: this.config.userId });

    // Classify the message to determine which agent should respond
    const classification = await this.classifyMessage(message);

    const context = await this.buildContext();
    const agentContext: AgentContext = {
      userId: context.userId,
      date: context.date,
      userName: context.userName,
      timezone: context.timezone,
      supabase: this.supabase,
      data: {
        ...context,
        userMessage: message,
        messageClassification: classification,
      },
    };

    // Run the primary agent
    const output = await this.runAgent(classification.primaryAgent, agentContext);

    const duration = Date.now() - startTime;
    this.emit('flow:complete', { type: 'chat', duration });

    return output;
  }

  /**
   * Run a specific agent
   */
  private async runAgent(
    agentId: AgentId,
    context: AgentContext
  ): Promise<AgentOutput> {
    const agent = this.agents.get(agentId);

    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    return agent.execute(context);
  }

  /**
   * Classify a user message to determine which agent should handle it
   */
  private async classifyMessage(message: string): Promise<MessageClassification> {
    // Simple keyword-based classification for now
    // TODO: Use LLM for smarter classification
    const lowerMessage = message.toLowerCase();

    // Training and workout related messages
    if (
      lowerMessage.includes('workout') ||
      lowerMessage.includes('training') ||
      lowerMessage.includes('run') ||
      lowerMessage.includes('running') ||
      lowerMessage.includes('marathon') ||
      lowerMessage.includes('pace') ||
      lowerMessage.includes('tempo') ||
      lowerMessage.includes('interval') ||
      lowerMessage.includes('long run') ||
      lowerMessage.includes('mileage') ||
      lowerMessage.includes('week') ||
      lowerMessage.includes('plan') ||
      lowerMessage.includes('coach')
    ) {
      return {
        primaryAgent: 'training-coach',
        confidence: 0.85,
        topics: ['training', 'workout', 'running'],
        intent: 'question',
      };
    }

    // Health and recovery related messages
    if (
      lowerMessage.includes('health') ||
      lowerMessage.includes('sleep') ||
      lowerMessage.includes('tired') ||
      lowerMessage.includes('energy') ||
      lowerMessage.includes('recovery') ||
      lowerMessage.includes('sick') ||
      lowerMessage.includes('injury') ||
      lowerMessage.includes('sore') ||
      lowerMessage.includes('fatigue') ||
      lowerMessage.includes('hrv') ||
      lowerMessage.includes('resting hr') ||
      lowerMessage.includes('heart rate')
    ) {
      return {
        primaryAgent: 'health-agent',
        confidence: 0.8,
        topics: ['health', 'recovery'],
        intent: 'question',
      };
    }

    // Default to health agent for now
    return {
      primaryAgent: 'health-agent',
      confidence: 0.5,
      topics: [],
      intent: 'chat',
    };
  }

  /**
   * Synthesize agent outputs into a cohesive daily plan
   */
  private async synthesizeDailyPlan(
    agentOutputs: Record<string, AgentOutput>,
    context: OrchestratorContext
  ): Promise<DailyPlan> {
    // TODO: Use LLM to synthesize a cohesive plan from agent outputs
    // For now, create a basic structure

    const healthOutput = agentOutputs['health-agent'];
    const trainingOutput = agentOutputs['training-coach'];

    // Combine whiteboard entries from all agents
    const allRecommendations: string[] = [];
    const allAlerts: string[] = [];

    // Health recommendations and alerts
    if (healthOutput?.whiteboardEntries) {
      allRecommendations.push(
        ...healthOutput.whiteboardEntries
          .filter((e) => e.entryType === 'suggestion')
          .map((e) => e.content)
      );
      allAlerts.push(
        ...healthOutput.whiteboardEntries
          .filter((e) => e.entryType === 'alert')
          .map((e) => e.content)
      );
    }

    // Training recommendations and alerts
    if (trainingOutput?.whiteboardEntries) {
      allRecommendations.push(
        ...trainingOutput.whiteboardEntries
          .filter((e) => e.entryType === 'suggestion')
          .map((e) => e.content)
      );
      allAlerts.push(
        ...trainingOutput.whiteboardEntries
          .filter((e) => e.entryType === 'alert')
          .map((e) => e.content)
      );
    }

    return {
      date: context.date,
      summary: trainingOutput?.content
        ? `${trainingOutput.content}`
        : 'Daily plan synthesized from agent analysis.',
      healthStatus: {
        recoveryScore: 0.7, // TODO: Extract from health agent
        recommendations: allRecommendations,
        alerts: allAlerts,
      },
      schedule: context.events.map((event) => ({
        time: new Date(event.startTime).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        event,
        type: 'event' as const,
      })),
      prioritizedTasks: context.tasks
        .filter((t) => t.status !== 'done' && t.status !== 'archived')
        .sort((a, b) => {
          // Sort by priority
          const priorityOrder = { p1_critical: 0, p2_high: 1, p3_medium: 2, p4_low: 3 };
          return (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3);
        })
        .slice(0, 5),
      whiteboardHighlights: context.whiteboardEntries.slice(0, 3) as any,
    };
  }
}
