'use client';

import { useTimeContext } from '@/providers/TimeProvider';

interface DashboardHeaderProps {
  /** Fallback date string from server render */
  serverDateString?: string;
}

export function DashboardHeader({ serverDateString }: DashboardHeaderProps) {
  const { timeContext } = useTimeContext();

  // Use client-side time context, falling back to server-rendered date
  const dateString = timeContext?.dateString || serverDateString;
  const greeting = timeContext?.greeting || 'LifeOS';

  return (
    <header className="px-6 pt-12 pb-8">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm text-gray-500">{dateString}</p>
          <div className="w-8 h-8 rounded-full bg-[#D4E157] flex items-center justify-center">
            <span className="text-xs font-bold text-gray-900">D</span>
          </div>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
          {greeting}
        </h1>
      </div>
    </header>
  );
}
