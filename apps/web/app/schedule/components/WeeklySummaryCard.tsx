'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';

interface WeeklySummaryCardProps {
  weekNumber: number;
  actualVolumeMiles?: number | null;
  actualWorkoutsCompleted?: number | null;
  plannedVolumeMiles?: number | null;
  summary: string;
}

/**
 * Infographic-style weekly summary card
 * Shows key stats prominently with a one-sentence preview and expandable content
 */
export function WeeklySummaryCard({
  weekNumber,
  actualVolumeMiles,
  actualWorkoutsCompleted,
  plannedVolumeMiles,
  summary,
}: WeeklySummaryCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Get first sentence as preview
  const firstSentence = summary.split(/\.\s/)[0] + '.';
  const hasMore = summary.length > firstSentence.length + 10;

  // Calculate completion percentage
  const completionPct = plannedVolumeMiles && actualVolumeMiles
    ? Math.round((actualVolumeMiles / plannedVolumeMiles) * 100)
    : null;

  return (
    <div className="bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/30 dark:to-indigo-900/30 rounded-2xl overflow-hidden border border-purple-200 dark:border-purple-800">
      {/* Stats header bar */}
      <div className="bg-purple-500 dark:bg-purple-600 px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">Week {weekNumber}</h3>
              <p className="text-purple-100 text-xs">Summary</p>
            </div>
          </div>

          {/* Stats chips */}
          <div className="flex items-center gap-3">
            {actualVolumeMiles && (
              <div className="text-right">
                <p className="text-2xl font-bold text-white">{actualVolumeMiles.toFixed(1)}</p>
                <p className="text-xs text-purple-100">miles</p>
              </div>
            )}
            {actualWorkoutsCompleted && (
              <div className="text-right">
                <p className="text-2xl font-bold text-white">{actualWorkoutsCompleted}</p>
                <p className="text-xs text-purple-100">workouts</p>
              </div>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {completionPct && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-purple-100 mb-1">
              <span>Volume completed</span>
              <span>{completionPct}%</span>
            </div>
            <div className="h-2 bg-purple-400/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all"
                style={{ width: `${Math.min(completionPct, 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Summary content */}
      <div className="p-5">
        {!isExpanded ? (
          <p className="text-gray-700 dark:text-gray-200 text-sm leading-relaxed">
            {firstSentence}
          </p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none prose-p:text-gray-700 dark:prose-p:text-gray-200 prose-p:my-2 prose-strong:text-purple-700 dark:prose-strong:text-purple-300">
            <ReactMarkdown>{summary}</ReactMarkdown>
          </div>
        )}

        {hasMore && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="mt-3 text-sm font-medium text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-200 flex items-center gap-1"
          >
            {isExpanded ? (
              <>
                Show less
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </>
            ) : (
              <>
                Read full summary
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
