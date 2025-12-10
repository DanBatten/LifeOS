'use client';

import Link from 'next/link';
import type { HealthSnapshot } from '@lifeos/core';

interface HealthViewProps {
  todaySnapshot: HealthSnapshot | null;
  recentSnapshots: HealthSnapshot[];
  averages: {
    sleepHours: number | null;
    sleepQuality: number | null;
    energyLevel: number | null;
    stressLevel: number | null;
    moodScore: number | null;
    hrv: number | null;
    restingHr: number | null;
  };
  recoveryScore: number;
  trends: {
    hrv: { direction: 'up' | 'down' | 'stable'; change: number };
    restingHr: { direction: 'up' | 'down' | 'stable'; change: number };
    sleepHours: { direction: 'up' | 'down' | 'stable'; change: number };
  };
  biomarkerResults: Array<{
    biomarkerCode: string;
    name: string;
    value: number;
    unit: string;
    flag: string;
    optimalStatus: string;
    panelDate: string;
  }>;
  latestLabPanel: {
    id: string;
    panel_date: string;
    provider: string;
    panel_type: string;
    ai_summary: string | null;
  } | null;
}

function TrendIndicator({ direction, value, unit, inverse = false }: {
  direction: 'up' | 'down' | 'stable';
  value: number;
  unit: string;
  inverse?: boolean;
}) {
  // For metrics like resting HR, down is good (inverse)
  const isGood = inverse ? direction === 'down' : direction === 'up';
  const isBad = inverse ? direction === 'up' : direction === 'down';

  if (direction === 'stable') {
    return <span className="text-xs text-gray-500">Stable</span>;
  }

  return (
    <span className={`text-xs flex items-center gap-0.5 ${isGood ? 'text-green-600' : isBad ? 'text-red-500' : 'text-gray-500'}`}>
      {direction === 'up' ? '↑' : '↓'}
      {Math.abs(value)} {unit}
    </span>
  );
}

function MetricCard({ title, value, unit, subtitle, trend, trendInverse, color = 'gray' }: {
  title: string;
  value: string | number;
  unit: string;
  subtitle?: string;
  trend?: { direction: 'up' | 'down' | 'stable'; change: number };
  trendInverse?: boolean;
  color?: 'gray' | 'lime' | 'blue' | 'amber';
}) {
  const colorClasses = {
    gray: 'bg-white border-gray-200',
    lime: 'bg-[#f0f7d4] border-[#d4e157]',
    blue: 'bg-blue-50 border-blue-200',
    amber: 'bg-amber-50 border-amber-200',
  };

  return (
    <div className={`rounded-2xl border p-4 ${colorClasses[color]}`}>
      <div className="flex items-start justify-between mb-2">
        <span className="text-sm font-medium text-gray-600">{title}</span>
        {trend && <TrendIndicator direction={trend.direction} value={trend.change} unit={unit} inverse={trendInverse} />}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-bold text-gray-900">{value}</span>
        <span className="text-sm text-gray-500">{unit}</span>
      </div>
      {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
    </div>
  );
}

function BiomarkerFlag({ flag, optimalStatus }: { flag: string; optimalStatus: string }) {
  const getFlagColor = () => {
    if (flag === 'critical_low' || flag === 'critical_high') return 'bg-red-100 text-red-700';
    if (flag === 'low' || flag === 'high') return 'bg-amber-100 text-amber-700';
    if (optimalStatus === 'optimal') return 'bg-green-100 text-green-700';
    return 'bg-gray-100 text-gray-600';
  };

  const getLabel = () => {
    if (flag === 'critical_low') return 'Critical Low';
    if (flag === 'critical_high') return 'Critical High';
    if (flag === 'low') return 'Low';
    if (flag === 'high') return 'High';
    if (optimalStatus === 'optimal') return 'Optimal';
    return 'Normal';
  };

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${getFlagColor()}`}>
      {getLabel()}
    </span>
  );
}

export function HealthView({
  todaySnapshot,
  recentSnapshots,
  averages,
  recoveryScore,
  trends,
  biomarkerResults,
  latestLabPanel,
}: HealthViewProps) {
  const recoveryPct = Math.round(recoveryScore * 100);
  const recoveryStatus = recoveryPct >= 70 ? 'Ready to perform' : recoveryPct >= 50 ? 'Moderate recovery' : 'Rest recommended';
  const recoveryColor = recoveryPct >= 70 ? 'lime' : recoveryPct >= 50 ? 'amber' : 'gray';

  // Get last 7 days of data for sparkline
  const last7Days = recentSnapshots.slice(0, 7).reverse();

  return (
    <main className="min-h-screen bg-[#fafafa] dark:bg-[#0a0a0a] pb-8">
      {/* Header */}
      <header className="px-6 pt-8 pb-6 bg-white border-b">
        <div className="max-w-2xl mx-auto">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-4">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Health & Recovery</h1>
          <p className="text-gray-500 mt-1">Track your vitals, recovery, and biomarkers</p>
        </div>
      </header>

      <div className="px-6 py-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Recovery Score Hero */}
          <div className={`rounded-3xl p-6 ${recoveryColor === 'lime' ? 'bg-[#e8f5c8]' : recoveryColor === 'amber' ? 'bg-amber-100' : 'bg-gray-100'}`}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-gray-600">Today&apos;s Recovery</span>
              <span className={`text-sm font-medium px-3 py-1 rounded-full ${
                recoveryPct >= 70 ? 'bg-green-100 text-green-700' :
                recoveryPct >= 50 ? 'bg-amber-100 text-amber-700' :
                'bg-red-100 text-red-700'
              }`}>
                {recoveryStatus}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-6xl font-bold text-gray-900">{recoveryPct}</span>
              <span className="text-2xl text-gray-500">%</span>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              Based on sleep, HRV, and resting heart rate
            </p>
          </div>

          {/* Today's Vitals */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Today&apos;s Vitals</h2>
            <div className="grid grid-cols-2 gap-3">
              <MetricCard
                title="HRV"
                value={todaySnapshot?.hrv ?? '--'}
                unit="ms"
                subtitle={averages.hrv ? `7-day avg: ${averages.hrv}ms` : undefined}
                trend={trends.hrv}
                color={todaySnapshot?.hrv && averages.hrv && todaySnapshot.hrv >= averages.hrv ? 'lime' : 'gray'}
              />
              <MetricCard
                title="Resting HR"
                value={todaySnapshot?.restingHr ?? '--'}
                unit="bpm"
                subtitle={averages.restingHr ? `7-day avg: ${averages.restingHr}bpm` : undefined}
                trend={trends.restingHr}
                trendInverse
                color={todaySnapshot?.restingHr && averages.restingHr && todaySnapshot.restingHr <= averages.restingHr ? 'lime' : 'gray'}
              />
              <MetricCard
                title="Sleep"
                value={todaySnapshot?.sleepHours?.toFixed(1) ?? '--'}
                unit="hrs"
                subtitle={averages.sleepHours ? `7-day avg: ${averages.sleepHours}hrs` : undefined}
                trend={trends.sleepHours}
                color={todaySnapshot?.sleepHours && todaySnapshot.sleepHours >= 7 ? 'lime' : 'gray'}
              />
              <MetricCard
                title="Sleep Quality"
                value={todaySnapshot?.sleepQuality ?? '--'}
                unit="/10"
                subtitle={averages.sleepQuality ? `7-day avg: ${averages.sleepQuality}/10` : undefined}
              />
            </div>
          </section>

          {/* Activity & Calories */}
          {todaySnapshot && (todaySnapshot.totalCalories || todaySnapshot.steps) && (
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Activity</h2>
              <div className="grid grid-cols-2 gap-3">
                {todaySnapshot.steps && (
                  <MetricCard
                    title="Steps"
                    value={todaySnapshot.steps.toLocaleString()}
                    unit=""
                    subtitle={todaySnapshot.stepsGoal ? `Goal: ${todaySnapshot.stepsGoal.toLocaleString()}` : undefined}
                    color={todaySnapshot.stepsGoal && todaySnapshot.steps >= todaySnapshot.stepsGoal ? 'lime' : 'gray'}
                  />
                )}
                {todaySnapshot.totalCalories && (
                  <MetricCard
                    title="Total Calories"
                    value={todaySnapshot.totalCalories.toLocaleString()}
                    unit="cal"
                    subtitle={todaySnapshot.activeCalories ? `${todaySnapshot.activeCalories} active` : undefined}
                  />
                )}
              </div>
            </section>
          )}

          {/* HRV Trend Sparkline */}
          {last7Days.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">7-Day HRV Trend</h2>
              <div className="bg-white rounded-2xl border p-4">
                <div className="flex items-end justify-between h-24 gap-2">
                  {last7Days.map((snapshot, i) => {
                    const hrv = snapshot.hrv || 0;
                    const max = Math.max(...last7Days.map(s => s.hrv || 0), 1);
                    const height = (hrv / max) * 100;
                    const isToday = i === last7Days.length - 1;

                    return (
                      <div key={i} className="flex-1 flex flex-col items-center">
                        <div className="w-full flex-1 flex items-end">
                          <div
                            className={`w-full rounded-t transition-all ${isToday ? 'bg-[#D4E157]' : 'bg-gray-300'}`}
                            style={{ height: `${Math.max(height, 10)}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-gray-500 mt-1">
                          {new Date(snapshot.snapshotDate || '').toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          )}

          {/* Biomarkers Section */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Biomarkers</h2>
              {latestLabPanel && (
                <span className="text-xs text-gray-500">
                  Last panel: {new Date(latestLabPanel.panel_date).toLocaleDateString()}
                </span>
              )}
            </div>

            {biomarkerResults.length > 0 ? (
              <div className="bg-white rounded-2xl border overflow-hidden">
                <div className="divide-y">
                  {biomarkerResults.slice(0, 10).map((result, i) => (
                    <div key={i} className="p-4 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{result.name}</p>
                        <p className="text-sm text-gray-500">{result.biomarkerCode}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">
                          {result.value} <span className="text-sm font-normal text-gray-500">{result.unit}</span>
                        </p>
                        <BiomarkerFlag flag={result.flag} optimalStatus={result.optimalStatus} />
                      </div>
                    </div>
                  ))}
                </div>
                {biomarkerResults.length > 10 && (
                  <div className="p-4 border-t bg-gray-50 text-center">
                    <button className="text-sm text-[#7cb342] font-medium">
                      View all {biomarkerResults.length} biomarkers →
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border p-8 text-center">
                <div className="w-12 h-12 rounded-full bg-gray-100 mx-auto mb-4 flex items-center justify-center">
                  <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-gray-500 font-medium">No lab results yet</p>
                <p className="text-sm text-gray-400 mt-1">Upload a lab panel to track biomarkers</p>
              </div>
            )}

            {/* Lab Panel Summary */}
            {latestLabPanel?.ai_summary && (
              <div className="mt-4 bg-blue-50 rounded-2xl p-4">
                <h3 className="text-sm font-medium text-blue-900 mb-2">AI Analysis</h3>
                <p className="text-sm text-blue-800">{latestLabPanel.ai_summary}</p>
              </div>
            )}
          </section>

          {/* Wellness Indicators */}
          {todaySnapshot && (todaySnapshot.energyLevel || todaySnapshot.stressLevel || todaySnapshot.moodScore) && (
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Wellness</h2>
              <div className="grid grid-cols-3 gap-3">
                {todaySnapshot.energyLevel && (
                  <div className="bg-white rounded-2xl border p-4 text-center">
                    <p className="text-2xl font-bold text-gray-900">{todaySnapshot.energyLevel}</p>
                    <p className="text-xs text-gray-500 mt-1">Energy</p>
                  </div>
                )}
                {todaySnapshot.stressLevel && (
                  <div className="bg-white rounded-2xl border p-4 text-center">
                    <p className="text-2xl font-bold text-gray-900">{todaySnapshot.stressLevel}</p>
                    <p className="text-xs text-gray-500 mt-1">Stress</p>
                  </div>
                )}
                {todaySnapshot.moodScore && (
                  <div className="bg-white rounded-2xl border p-4 text-center">
                    <p className="text-2xl font-bold text-gray-900">{todaySnapshot.moodScore}</p>
                    <p className="text-xs text-gray-500 mt-1">Mood</p>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
