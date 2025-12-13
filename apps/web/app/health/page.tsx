export const dynamic = 'force-dynamic';

import { getSupabase } from '@/lib/supabase';
import { getEnv } from '@/lib/env';
import { HealthRepository } from '@lifeos/database';
import { HealthView } from './HealthView';

export default async function HealthPage() {
  const supabase = getSupabase();
  const env = getEnv();
  const userId = env.USER_ID;
  const timezone = env.TIMEZONE;

  const healthRepo = new HealthRepository(supabase, timezone);

  // Fetch health data in parallel
  const [todaySnapshot, recentSnapshots, averages, recoveryScore] = await Promise.all([
    healthRepo.getToday(userId).catch(() => null),
    healthRepo.getRecentSnapshots(userId, 30).catch(() => []),
    healthRepo.getAverages(userId, 7).catch(() => ({
      sleepHours: null,
      sleepQuality: null,
      energyLevel: null,
      stressLevel: null,
      moodScore: null,
      hrv: null,
      restingHr: null,
    })),
    healthRepo.calculateRecoveryScore(userId).catch(() => 0.5),
  ]);

  // Fetch biomarker data (lab panels)
  const { data: labPanelsData } = await supabase
    .from('lab_panels')
    .select('*')
    .eq('user_id', userId)
    .order('panel_date', { ascending: false })
    .limit(5);

  // Type the lab panels
  const labPanels = labPanelsData as Array<{
    id: string;
    panel_date: string;
    panel_name: string;
    lab_provider: string;
    panel_type: string;
    ai_summary: string | null;
  }> | null;

  // Fetch recent biomarker results if we have lab panels
  let biomarkerResults: Array<{
    biomarkerCode: string;
    name: string;
    value: number;
    unit: string;
    flag: string;
    optimalStatus: string;
    panelDate: string;
  }> = [];

  if (labPanels && labPanels.length > 0) {
    const latestPanel = labPanels[0];
    const latestPanelId = latestPanel.id;

    // Query biomarker_results directly - data has biomarker_name and biomarker_code on the table
    const { data: results } = await supabase
      .from('biomarker_results')
      .select(`
        value,
        unit,
        flag,
        in_optimal_range,
        biomarker_name,
        biomarker_code
      `)
      .eq('panel_id', latestPanelId)
      .order('biomarker_name');

    if (results) {
      biomarkerResults = results.map((r: Record<string, unknown>) => {
        return {
          biomarkerCode: (r.biomarker_code as string) || 'unknown',
          name: (r.biomarker_name as string) || 'Unknown',
          value: r.value as number,
          unit: r.unit as string,
          flag: r.flag as string,
          optimalStatus: r.in_optimal_range ? 'optimal' : 'not_optimal',
          panelDate: latestPanel.panel_date || '',
        };
      });
    }
  }

  // Calculate trends for key metrics
  const calculateTrend = (snapshots: typeof recentSnapshots, key: keyof typeof recentSnapshots[0]) => {
    if (snapshots.length < 2) return { direction: 'stable' as const, change: 0 };

    const recent = snapshots.slice(0, 7);
    const older = snapshots.slice(7, 14);

    if (recent.length === 0 || older.length === 0) return { direction: 'stable' as const, change: 0 };

    const recentAvg = recent.reduce((sum, s) => sum + (Number(s[key]) || 0), 0) / recent.length;
    const olderAvg = older.reduce((sum, s) => sum + (Number(s[key]) || 0), 0) / older.length;

    const change = recentAvg - olderAvg;
    const direction = change > 0.5 ? 'up' : change < -0.5 ? 'down' : 'stable';

    return { direction: direction as 'up' | 'down' | 'stable', change: Math.round(change * 10) / 10 };
  };

  const trends = {
    hrv: calculateTrend(recentSnapshots, 'hrv'),
    restingHr: calculateTrend(recentSnapshots, 'restingHr'),
    sleepHours: calculateTrend(recentSnapshots, 'sleepHours'),
  };

  return (
    <HealthView
      todaySnapshot={todaySnapshot}
      recentSnapshots={recentSnapshots}
      averages={averages}
      recoveryScore={recoveryScore}
      trends={trends}
      biomarkerResults={biomarkerResults}
      latestLabPanel={labPanels?.[0] || null}
    />
  );
}
