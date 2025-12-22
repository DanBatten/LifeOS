/**
 * Chat Context Configuration
 *
 * Defines how the chat behaves based on which page the user is on.
 * This creates a scalable pattern where each page can define:
 * - Its context type (determines data loading priority)
 * - Placeholder text for the chat input
 * - Default agent routing
 * - Empty state messaging
 *
 * As new pages are added, simply add a new context configuration here.
 */

export type ChatContextType =
  | 'home'           // Broad context - all domains available
  | 'training'       // Training/schedule focused - workouts primary
  | 'health'         // Health/recovery focused - metrics primary
  | 'planning'       // Tasks/whiteboard focused - planning primary
  | 'post-run';      // Just finished a workout - analysis mode

export interface ChatContextConfig {
  type: ChatContextType;
  placeholder: string;
  emptyStateTitle: string;
  emptyStateSubtitle: string;
  primaryAgent: 'training-coach' | 'health-agent' | 'auto';
  // Data loading priorities (1 = highest priority, loaded first)
  dataPriority: {
    workouts: number;
    health: number;
    planning: number;
  };
  // Special behaviors
  autoSyncGarmin?: boolean;  // Sync latest activity before chat
  focusedAnalysis?: boolean; // Agent should focus on specific data vs broad overview
}

/**
 * Context configurations by page path
 */
export const PAGE_CONTEXT_MAP: Record<string, ChatContextConfig> = {
  // Home page - broad context covering everything
  '/': {
    type: 'home',
    placeholder: 'Ask me anything...',
    emptyStateTitle: 'Your AI Assistant',
    emptyStateSubtitle: 'Ask about your health, training, or daily planning',
    primaryAgent: 'auto',
    dataPriority: {
      workouts: 1,
      health: 1,
      planning: 1,
    },
  },

  // Schedule page - training focused, post-run detection
  '/schedule': {
    type: 'post-run',
    placeholder: 'How was your run today?',
    emptyStateTitle: 'Training Coach',
    emptyStateSubtitle: 'Tell me about your workout and I\'ll analyze it',
    primaryAgent: 'training-coach',
    dataPriority: {
      workouts: 1,
      health: 2,
      planning: 3,
    },
    autoSyncGarmin: true,
    focusedAnalysis: true,
  },

  // Run Companion - training focused (coach), but not always post-run sync
  '/run-companion': {
    type: 'training',
    placeholder: 'Ask me anything about your running...',
    emptyStateTitle: 'Run Coach',
    emptyStateSubtitle: 'Ask about your plan, paces, recovery, or today’s workout.',
    primaryAgent: 'training-coach',
    dataPriority: {
      workouts: 1,
      health: 2,
      planning: 3,
    },
    focusedAnalysis: true,
  },

  // Post-run page (dedicated post-workout analysis)
  '/post-run': {
    type: 'post-run',
    placeholder: 'How did your workout feel?',
    emptyStateTitle: 'Post-Workout Analysis',
    emptyStateSubtitle: 'Share your thoughts and I\'ll analyze your performance',
    primaryAgent: 'training-coach',
    dataPriority: {
      workouts: 1,
      health: 2,
      planning: 3,
    },
    autoSyncGarmin: true,
    focusedAnalysis: true,
  },

  // Future: Health-focused page
  // '/health': {
  //   type: 'health',
  //   placeholder: 'How are you feeling today?',
  //   emptyStateTitle: 'Health Advisor',
  //   emptyStateSubtitle: 'Ask about your recovery, sleep, or wellness',
  //   primaryAgent: 'health-agent',
  //   dataPriority: {
  //     health: 1,
  //     workouts: 2,
  //     planning: 3,
  //   },
  // },

  // Future: Planning-focused page
  // '/planning': {
  //   type: 'planning',
  //   placeholder: 'What do you need help planning?',
  //   emptyStateTitle: 'Planning Assistant',
  //   emptyStateSubtitle: 'Help with tasks, goals, and daily organization',
  //   primaryAgent: 'auto',
  //   dataPriority: {
  //     planning: 1,
  //     workouts: 2,
  //     health: 3,
  //   },
  // },
};

/**
 * Default context for unknown pages
 */
export const DEFAULT_CONTEXT: ChatContextConfig = PAGE_CONTEXT_MAP['/'];

/**
 * Get chat context config for a given pathname
 */
export function getChatContextForPath(pathname: string): ChatContextConfig {
  // Exact match first
  if (PAGE_CONTEXT_MAP[pathname]) {
    return PAGE_CONTEXT_MAP[pathname];
  }

  // Check for partial matches (e.g., /schedule/123 should use /schedule config)
  for (const [path, config] of Object.entries(PAGE_CONTEXT_MAP)) {
    if (path !== '/' && pathname.startsWith(path)) {
      return config;
    }
  }

  return DEFAULT_CONTEXT;
}

/**
 * Determine if we should auto-sync Garmin based on context
 */
export function shouldAutoSyncGarmin(context: ChatContextConfig): boolean {
  return context.autoSyncGarmin === true;
}

/**
 * Get the API context type to send to backend
 * Maps our rich context config to the simpler API context type
 */
export function getApiContextType(context: ChatContextConfig): 'default' | 'training' | 'post-run' | 'health' | 'planning' {
  switch (context.type) {
    case 'post-run':
      return 'post-run';
    case 'training':
      return 'training';
    case 'health':
      return 'health';
    case 'planning':
      return 'planning';
    case 'home':
    default:
      return 'default';
  }
}
