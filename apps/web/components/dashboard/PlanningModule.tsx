import { ModuleCard, CardStack } from '../ui/ModuleCard';
import type { WhiteboardEntry, Task } from '@lifeos/core';

interface PlanningModuleProps {
  whiteboardEntries: WhiteboardEntry[];
  priorityTasks: Task[];
  alerts: WhiteboardEntry[];
}

const priorityColors: Record<string, string> = {
  p1_critical: 'bg-red-500',
  p2_high: 'bg-orange-500',
  p3_medium: 'bg-yellow-500',
  p4_low: 'bg-gray-400',
};

export function PlanningModule({
  whiteboardEntries,
  priorityTasks,
  alerts,
}: PlanningModuleProps) {
  const hasAlerts = alerts.length > 0;
  const hasInsights = whiteboardEntries.length > 0;
  const hasTasks = priorityTasks.length > 0;
  const hasContent = hasAlerts || hasInsights || hasTasks;

  if (!hasContent) {
    return (
      <ModuleCard color="light" showPattern={false}>
        <div className="text-center py-8">
          <div className="w-12 h-12 rounded-full bg-gray-200 mx-auto mb-4 flex items-center justify-center">
            <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p className="text-gray-500 font-medium">All clear for today</p>
          <p className="text-sm text-gray-400 mt-1">Your agents will post insights here</p>
        </div>
      </ModuleCard>
    );
  }

  return (
    <CardStack>
      {/* Alerts card (if any) */}
      {hasAlerts && (
        <ModuleCard color="lime" className="pb-8">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center">
              <span className="text-white text-xs font-bold">!</span>
            </div>
            <span className="font-semibold text-gray-900">Attention Needed</span>
          </div>
          {alerts.slice(0, 2).map((alert) => (
            <div key={alert.id} className="mb-2 last:mb-0">
              <p className="text-sm text-gray-800 font-medium">{alert.title || alert.content}</p>
              <p className="text-xs text-gray-600 mt-0.5">from {alert.agentId.replace('-', ' ')}</p>
            </div>
          ))}
        </ModuleCard>
      )}

      {/* Insights or Tasks card */}
      <ModuleCard
        color={hasAlerts ? 'dark' : 'light'}
        title={hasTasks ? 'Priority Tasks' : 'Agent Insights'}
        className="relative z-10"
      >
        {hasTasks ? (
          <div className="space-y-3">
            {priorityTasks.slice(0, 4).map((task, index) => (
              <div
                key={task.id}
                className={`flex items-center gap-3 ${index > 0 ? 'pt-3 border-t border-gray-200/20' : ''}`}
              >
                <div className={`w-2 h-2 rounded-full ${priorityColors[task.priority]}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${hasAlerts ? 'text-white' : 'text-gray-900'}`}>
                    {task.title}
                  </p>
                  {task.dueDate && (
                    <p className={`text-xs ${hasAlerts ? 'text-gray-400' : 'text-gray-500'}`}>
                      Due {new Date(task.dueDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </p>
                  )}
                </div>
                <div className={`
                  w-6 h-6 rounded-full flex items-center justify-center
                  ${hasAlerts ? 'bg-white/10' : 'bg-gray-100'}
                `}>
                  <svg className={`w-3 h-3 ${hasAlerts ? 'text-white' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        ) : hasInsights ? (
          <div className="space-y-3">
            {whiteboardEntries.slice(0, 3).map((entry, index) => (
              <div
                key={entry.id}
                className={`${index > 0 ? 'pt-3 border-t border-gray-200' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-gray-700 flex-1">
                    {entry.title || entry.content}
                  </p>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-600 whitespace-nowrap">
                    {entry.entryType}
                  </span>
                </div>
                {entry.title && (
                  <p className="text-xs text-gray-500 mt-1 line-clamp-1">{entry.content}</p>
                )}
              </div>
            ))}
          </div>
        ) : null}
      </ModuleCard>
    </CardStack>
  );
}
