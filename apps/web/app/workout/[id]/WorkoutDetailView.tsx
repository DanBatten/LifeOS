'use client';

import ReactMarkdown from 'react-markdown';

interface Lap {
  lapNumber: number;
  distanceMiles: number;
  durationSeconds: number;
  pacePerMile: string | null;
  avgHeartRate?: number;
  maxHeartRate?: number;
  avgCadence?: number;
  elevationGainFt?: number;
  elevationLossFt?: number;
  calories?: number;
}

interface WorkoutData {
  id: string;
  title: string;
  workoutType: string;
  status: string;
  scheduledDate: string;
  completedAt: string | null;

  prescribedDescription: string | null;
  prescribedDistanceMiles: number | null;
  prescribedPacePerMile: string | null;
  prescribedHrZone: string | null;

  actualDurationMinutes: number | null;
  actualDistanceMiles: number | null;
  actualPacePerMile: string | null;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  calories: number | null;
  elevationGainFt: number | null;
  cadenceAvg: number | null;

  laps: Lap[];

  personalNotes: string | null;
  coachNotes: string | null;
  perceivedExertion: number | null;

  garminActivityId: string | null;
  aerobicTrainingEffect: number | null;
  anaerobicTrainingEffect: number | null;
}

interface WorkoutDetailViewProps {
  workout: WorkoutData;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function StatCard({ label, value, unit, subtext }: { label: string; value: string | number | null | undefined; unit?: string; subtext?: string }) {
  if (value === null || value === undefined) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
      <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</div>
      <div className="text-2xl font-bold text-gray-900 dark:text-white">
        {value}
        {unit && <span className="text-sm font-normal text-gray-500 ml-1">{unit}</span>}
      </div>
      {subtext && <div className="text-xs text-gray-500 mt-1">{subtext}</div>}
    </div>
  );
}

export function WorkoutDetailView({ workout }: WorkoutDetailViewProps) {
  const isCompleted = workout.status === 'completed';

  return (
    <div className="max-w-2xl mx-auto px-6 py-6 space-y-6">
      {/* Prescribed Workout */}
      {workout.prescribedDescription && (
        <section className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-5 border border-blue-200 dark:border-blue-800">
          <h2 className="text-sm font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide mb-2">
            Prescribed Workout
          </h2>
          <p className="text-gray-900 dark:text-white">{workout.prescribedDescription}</p>
          <div className="flex gap-4 mt-3 text-sm text-gray-600 dark:text-gray-400">
            {workout.prescribedDistanceMiles && (
              <span>{workout.prescribedDistanceMiles} mi</span>
            )}
            {workout.prescribedPacePerMile && (
              <span>@ {workout.prescribedPacePerMile}</span>
            )}
            {workout.prescribedHrZone && (
              <span>HR {workout.prescribedHrZone}</span>
            )}
          </div>
        </section>
      )}

      {/* Summary Stats */}
      {isCompleted && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Summary
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Distance"
              value={workout.actualDistanceMiles?.toFixed(2)}
              unit="mi"
            />
            <StatCard
              label="Duration"
              value={workout.actualDurationMinutes}
              unit="min"
            />
            <StatCard
              label="Avg Pace"
              value={workout.actualPacePerMile}
              unit="/mi"
            />
            <StatCard
              label="Avg HR"
              value={workout.avgHeartRate}
              unit="bpm"
              subtext={workout.maxHeartRate ? `Max: ${workout.maxHeartRate}` : undefined}
            />
            <StatCard
              label="Elevation"
              value={workout.elevationGainFt}
              unit="ft"
            />
            <StatCard
              label="Calories"
              value={workout.calories}
              unit="cal"
            />
          </div>
        </section>
      )}

      {/* Lap Data */}
      {workout.laps && workout.laps.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Splits
          </h2>
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr className="text-gray-500 text-xs uppercase">
                  <th className="py-3 px-4 text-left">Lap</th>
                  <th className="py-3 px-3 text-right">Dist</th>
                  <th className="py-3 px-3 text-right">Pace</th>
                  <th className="py-3 px-3 text-right">HR</th>
                  <th className="py-3 px-4 text-right">Elev</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {workout.laps.map((lap) => {
                  // Identify if this might be warmup, main set, or cooldown based on pace
                  const paceNum = lap.pacePerMile ? parseInt(lap.pacePerMile.split(':')[0]) * 60 + parseInt(lap.pacePerMile.split(':')[1]) : 0;
                  const isSlowLap = paceNum > 480; // > 8:00/mi
                  const isThresholdLap = lap.avgHeartRate && lap.avgHeartRate >= 170;

                  return (
                    <tr
                      key={lap.lapNumber}
                      className={`${
                        isThresholdLap
                          ? 'bg-green-50 dark:bg-green-900/20'
                          : isSlowLap
                          ? 'bg-gray-50 dark:bg-gray-900/50'
                          : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">
                        {lap.lapNumber}
                        {isSlowLap && lap.lapNumber === 1 && (
                          <span className="ml-2 text-xs text-gray-400">WU</span>
                        )}
                        {isSlowLap && lap.lapNumber === workout.laps.length && (
                          <span className="ml-2 text-xs text-gray-400">CD</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right text-gray-600 dark:text-gray-400">
                        {lap.distanceMiles.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-gray-900 dark:text-white">
                        {lap.pacePerMile || '-'}
                      </td>
                      <td className="py-3 px-3 text-right text-gray-600 dark:text-gray-400">
                        {lap.avgHeartRate || '-'}
                      </td>
                      <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-400">
                        {lap.elevationGainFt ? `+${lap.elevationGainFt}` : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Personal Notes */}
      {workout.personalNotes && (
        <section className="bg-yellow-50 dark:bg-yellow-900/20 rounded-2xl p-5 border border-yellow-200 dark:border-yellow-800">
          <h2 className="text-sm font-semibold text-yellow-700 dark:text-yellow-400 uppercase tracking-wide mb-2">
            My Notes
          </h2>
          <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{workout.personalNotes}</p>
        </section>
      )}

      {/* Coach Notes */}
      {workout.coachNotes && (
        <section className="bg-green-50 dark:bg-green-900/20 rounded-2xl p-5 border border-green-200 dark:border-green-800">
          <h2 className="text-sm font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide mb-3 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Coach Analysis
          </h2>
          <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:text-green-800 dark:prose-headings:text-green-300 prose-headings:font-semibold prose-headings:mt-4 prose-headings:mb-2 prose-p:text-gray-700 dark:prose-p:text-gray-200 prose-strong:text-green-700 dark:prose-strong:text-green-400 prose-li:text-gray-700 dark:prose-li:text-gray-200">
            <ReactMarkdown>{workout.coachNotes}</ReactMarkdown>
          </div>
        </section>
      )}

      {/* Training Effect */}
      {(workout.aerobicTrainingEffect || workout.anaerobicTrainingEffect) && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Training Effect
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {workout.aerobicTrainingEffect && (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Aerobic</div>
                <div className="text-2xl font-bold text-blue-600">{workout.aerobicTrainingEffect.toFixed(1)}</div>
              </div>
            )}
            {workout.anaerobicTrainingEffect && (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Anaerobic</div>
                <div className="text-2xl font-bold text-orange-600">{workout.anaerobicTrainingEffect.toFixed(1)}</div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Garmin Link */}
      {workout.garminActivityId && (
        <div className="text-center pt-4">
          <a
            href={`https://connect.garmin.com/modern/activity/${workout.garminActivityId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            View in Garmin Connect
          </a>
        </div>
      )}
    </div>
  );
}
