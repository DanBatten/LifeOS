'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import {
  TimeContext,
  TimeContextConfig,
  createTimeContext,
  getModulePriorities,
  getContextualCopy,
} from '@/lib/time-context';

interface TimeProviderValue {
  timeContext: TimeContext;
  modulePriorities: string[];
  copy: ReturnType<typeof getContextualCopy>;
  refresh: () => void;
}

const TimeContextReact = createContext<TimeProviderValue | null>(null);

interface TimeProviderProps {
  children: ReactNode;
  config: TimeContextConfig;
  /**
   * Auto-refresh interval in milliseconds
   * Default: 60000 (1 minute)
   * Set to 0 to disable auto-refresh
   */
  refreshInterval?: number;
}

/**
 * TimeProvider - Provides time-of-day context to the app
 *
 * Usage:
 * ```tsx
 * <TimeProvider config={{ timezone: 'America/Los_Angeles', userName: 'Dan' }}>
 *   <App />
 * </TimeProvider>
 * ```
 */
export function TimeProvider({
  children,
  config,
  refreshInterval = 60000,
}: TimeProviderProps) {
  const [timeContext, setTimeContext] = useState(() => createTimeContext(config));

  // Refresh time context
  const refresh = () => {
    setTimeContext(createTimeContext(config));
  };

  // Auto-refresh on interval
  useEffect(() => {
    if (refreshInterval <= 0) return;

    const interval = setInterval(refresh, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval, config.timezone, config.userName]);

  // Also refresh when window regains focus (user returns to tab)
  useEffect(() => {
    const handleFocus = () => refresh();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [config.timezone, config.userName]);

  // Derived values
  const modulePriorities = useMemo(
    () => getModulePriorities(timeContext),
    [timeContext]
  );

  const copy = useMemo(
    () => getContextualCopy(timeContext),
    [timeContext]
  );

  const value = useMemo(
    () => ({
      timeContext,
      modulePriorities,
      copy,
      refresh,
    }),
    [timeContext, modulePriorities, copy]
  );

  return (
    <TimeContextReact.Provider value={value}>
      {children}
    </TimeContextReact.Provider>
  );
}

/**
 * Hook to access time context
 *
 * Usage:
 * ```tsx
 * function MyComponent() {
 *   const { timeContext, copy } = useTimeContext();
 *   return <h1>{timeContext.greeting}</h1>;
 * }
 * ```
 */
export function useTimeContext(): TimeProviderValue {
  const context = useContext(TimeContextReact);

  if (!context) {
    throw new Error('useTimeContext must be used within a TimeProvider');
  }

  return context;
}

/**
 * Hook to get just the time period
 */
export function useTimePeriod() {
  const { timeContext } = useTimeContext();
  return timeContext.period;
}

/**
 * Hook to check contextual flags
 */
export function useTimeFlags() {
  const { timeContext } = useTimeContext();
  return {
    isWorkHours: timeContext.isWorkHours,
    isPreWorkout: timeContext.isPreWorkout,
    isPostWorkout: timeContext.isPostWorkout,
    isMealTime: timeContext.isMealTime,
    isWindingDown: timeContext.isWindingDown,
  };
}
