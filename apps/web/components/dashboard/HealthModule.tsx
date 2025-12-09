import { ModuleCard, MiniCard } from '../ui/ModuleCard';
import { StatDisplay, CompactStat } from '../ui/StatDisplay';
import type { HealthSnapshot } from '@lifeos/core';

interface HealthModuleProps {
  healthData: HealthSnapshot | null;
  recoveryScore?: number;
  averages?: {
    sleepHours: number | null;
    hrv: number | null;
    restingHr: number | null;
  };
}

export function HealthModule({ healthData, recoveryScore, averages }: HealthModuleProps) {
  const recoveryPct = recoveryScore ? Math.round(recoveryScore * 100) : null;

  // Calculate comparison text
  const getComparisonText = () => {
    if (!recoveryPct || !averages?.hrv) return null;
    const diff = healthData?.hrv && averages.hrv
      ? Math.round(healthData.hrv - averages.hrv)
      : null;
    if (diff === null) return null;
    if (diff > 0) return `+${diff}ms above your 7-day average`;
    if (diff < 0) return `${diff}ms below your 7-day average`;
    return 'Same as your 7-day average';
  };

  // If no data, show empty state
  if (!healthData) {
    return (
      <ModuleCard color="light" showPattern={false}>
        <div className="text-center py-8">
          <div className="w-12 h-12 rounded-full bg-gray-200 mx-auto mb-4 flex items-center justify-center">
            <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <p className="text-gray-500 font-medium">No health data yet</p>
          <p className="text-sm text-gray-400 mt-1">Sync Garmin to see metrics</p>
        </div>
      </ModuleCard>
    );
  }

  const sleepHours = healthData.sleepHours?.toFixed(1) ?? '--';
  const hrv = healthData.hrv ?? '--';
  const restingHr = healthData.restingHr ?? '--';

  return (
    <div className="space-y-3">
      {/* Mini cards row */}
      <div className="flex gap-3">
        <MiniCard
          title="Sleep"
          value={sleepHours}
          sublabel="hours"
        />
        <MiniCard
          title="Resting HR"
          value={restingHr}
          sublabel="bpm"
        />
      </div>

      {/* Main recovery card */}
      <ModuleCard color="lime" title="Recovery Status" actionButton>
        <StatDisplay
          value={recoveryPct ?? '--'}
          prefix=""
          label={recoveryPct !== null ? (recoveryPct >= 70 ? 'Ready to perform' : recoveryPct >= 50 ? 'Moderate recovery' : 'Rest recommended') : undefined}
          comparison={getComparisonText() ?? undefined}
          size="xl"
        />

        {/* HRV highlight */}
        <div className="mt-6 pt-4 border-t border-[#c4d147]/30">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">HRV</span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold">{hrv}</span>
              <span className="text-sm text-gray-600">ms</span>
            </div>
          </div>
        </div>
      </ModuleCard>
    </div>
  );
}
