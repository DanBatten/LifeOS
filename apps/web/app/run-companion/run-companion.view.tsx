'use client';

import Link from 'next/link';
import type { TimeContext } from '@/lib/time-context';
import type { WhiteboardEntry } from '@lifeos/core';
import { RunCompanionScheduleRail } from './run-companion-schedule-rail';
import { RunCompanionChatPanel } from './run-companion-chat-panel';

interface SerializedWorkout {
  id: string;
  title: string;
  workoutType: string;
  status: string;
  scheduledDate: string | null;
  prescribedDistanceMiles?: number | null;
  prescribedPacePerMile?: string | null;
  prescribedDescription?: string | null;
  prescribedHrZone?: string | null;
  plannedDurationMinutes?: number | null;
  actualDurationMinutes?: number | null;
  avgHeartRate?: number | null;
  elevationGainFt?: number | null;
  actualDistanceMiles?: number | null;
}

export function RunCompanionView({
  timezone,
  timeContext,
  workouts,
  monthMiles,
  yearMiles,
  whiteboardEntries,
}: {
  timezone: string;
  timeContext: TimeContext;
  workouts: SerializedWorkout[];
  monthMiles: number;
  yearMiles: number;
  whiteboardEntries: WhiteboardEntry[];
}) {
  const dateLabel = timeContext.dateString.toUpperCase();

  // Pull a couple recent coach notes for the right panel (if present)
  const trainingNotes = whiteboardEntries
    .filter((e) => e.agentId === 'training-coach')
    .slice(0, 2);

  return (
    <main className="min-h-screen bg-[#e3cbc5] text-[#3a2f2a]">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-black/10 bg-gradient-to-b from-[#e3cbc5] to-[#e3cbc5]/70 backdrop-blur">
        <div className="mx-auto max-w-[1700px] px-5 py-5 flex items-center justify-between">
          <div className="text-xl font-normal italic tracking-wide">RUN–COMPANION</div>
          <div className="text-sm font-normal tracking-[0.2em] text-black/60">
            {dateLabel}
          </div>
        </div>
      </header>

      {/* 3-column layout */}
      <div className="mx-auto max-w-[1700px] px-5 py-6">
        <div className="grid grid-cols-12 gap-5">
          {/* Left: schedule rail */}
          <section className="col-span-12 lg:col-span-4">
            <RunCompanionScheduleRail workouts={workouts} />
          </section>

          {/* Middle: chat panel */}
          <section className="col-span-12 lg:col-span-4">
            <RunCompanionChatPanel timezone={timezone} />
          </section>

          {/* Right: metrics panel (v1: only miles, placeholders for gaps) */}
          <section className="col-span-12 lg:col-span-4">
            <div className="rounded-xl border border-black/10 bg-transparent overflow-hidden h-[calc(100vh-140px)] flex flex-col">
              <div className="p-5">
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-[11px] font-normal tracking-widest text-black/50">MILES RUN</div>
                  <div className="mt-2 text-5xl font-normal tracking-tight text-[#ff5a2f]">
                    {Math.round(yearMiles).toLocaleString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] tracking-widest text-black/50">MONTH</div>
                  <div className="text-3xl font-normal text-[#ff5a2f]">{Math.round(monthMiles)}</div>
                  <div className="mt-2 text-[11px] tracking-widest text-black/50">YEAR</div>
                  <div className="text-3xl font-normal text-[#ff5a2f]">{Math.round(yearMiles)}</div>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-black/10 bg-[#f3efec] p-4 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div className="text-[11px] font-normal tracking-widest text-black/50">
                      RUNNING LACTATE THRESHOLD
                    </div>
                    <span className="text-[10px] font-semibold bg-green-200 text-green-900 px-2 py-0.5 rounded">
                      ↑ IMPROVING
                    </span>
                  </div>
                  <div className="mt-2 flex items-end gap-2">
                    <div className="text-4xl font-normal text-black/70">170</div>
                    <div className="pb-1 text-[11px] font-normal text-black/50">BPM</div>
                    <div className="ml-auto text-sm font-normal text-black/60">6:17</div>
                    <div className="pb-1 text-[11px] font-normal text-black/50">min</div>
                  </div>
                  <div className="text-xs font-light text-black/50">Placeholder — needs RLT/Rhythm metrics</div>
                </div>

                <div className="rounded-lg border border-black/10 bg-[#f3efec] p-4 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div className="text-[11px] font-normal tracking-widest text-black/50">
                      VO2MAX
                    </div>
                    <span className="text-[10px] font-semibold bg-green-200 text-green-900 px-2 py-0.5 rounded">
                      ELITE
                    </span>
                  </div>
                  <div className="mt-2 flex items-end gap-2">
                    <div className="text-4xl font-normal text-black/70">60</div>
                    <div className="pb-1 text-[11px] font-normal text-black/50">VO2</div>
                  </div>
                  <div className="text-xs font-light text-black/50">Placeholder — needs Garmin VO2Max</div>
                </div>

                <div className="rounded-lg border border-black/10 bg-[#f3efec] p-4 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div className="text-[11px] font-normal tracking-widest text-black/50">
                      TRAINING READINESS
                    </div>
                    <span className="text-[10px] font-semibold bg-green-200 text-green-900 px-2 py-0.5 rounded">
                      GREAT
                    </span>
                  </div>
                  <div className="mt-2 flex items-end gap-2">
                    <div className="text-4xl font-normal text-black/70">83</div>
                    <div className="pb-1 text-[11px] font-normal text-black/50">VO2</div>
                  </div>
                  <div className="text-xs font-light text-black/50">Placeholder — needs readiness composite</div>
                </div>

                <div className="rounded-lg border border-black/10 bg-[#f3efec] p-4 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div className="text-[11px] font-normal tracking-widest text-black/50">
                      LOAD FOCUS
                    </div>
                    <span className="text-[10px] font-semibold bg-amber-200 text-amber-900 px-2 py-0.5 rounded">
                      ANAEROBIC SHORTAGE
                    </span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {[
                      { label: 'Anaerobic', value: 53, max: 200 },
                      { label: 'High Aerobic', value: 911, max: 1200 },
                      { label: 'Low Aerobic', value: 1193, max: 1600 },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center gap-2">
                        <div className="w-20 text-[10px] text-black/50">{row.label}</div>
                        <div className="flex-1 h-2 rounded bg-black/10 overflow-hidden">
                          <div
                            className="h-full rounded bg-green-500"
                            style={{ width: `${Math.min(100, (row.value / row.max) * 100)}%` }}
                          />
                        </div>
                        <div className="w-10 text-[10px] text-black/50 text-right">{row.value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-xs font-light text-black/50">Placeholder — needs Garmin load focus</div>
                </div>
              </div>

              {/* Shoe rotation (placeholder) */}
              <div className="mt-6">
                <div className="text-[11px] font-normal tracking-widest text-black/50 mb-2">SHOE ROTATION</div>
                <div className="space-y-2">
                  {[
                    { miles: 39, label: 'Long Run', shoe: 'ASICS Gel Nimbus', tone: 'ELITE' },
                    { miles: 97, label: 'Daily Trainer', shoe: 'Adidas Adizero Evo SL', tone: 'FRESH' },
                    { miles: 280, label: 'Race Shoe', shoe: 'Adidas Adizero Pro', tone: 'ELITE' },
                  ].map((s) => (
                    <div key={s.shoe} className="rounded-lg border border-black/10 bg-[#f3efec] px-4 py-3 flex items-center gap-3 shadow-sm">
                      <div className="text-3xl font-normal text-[#ff5a2f] w-16 text-right">{s.miles}</div>
                      <div className="text-[10px] text-black/50 w-10">MILES</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-normal text-black/70 truncate">{s.label}</div>
                        <div className="text-xs font-light text-black/45 truncate">{s.shoe}</div>
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${s.tone === 'FRESH' ? 'bg-green-200 text-green-900' : 'bg-black/10 text-black/60'}`}>
                        {s.tone}
                      </span>
                    </div>
                  ))}
                  <div className="rounded-lg border border-black/10 bg-[#f3efec] px-4 py-3 text-center text-black/30 shadow-sm">
                    +
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <div className="text-[11px] font-normal tracking-widest text-black/50 mb-2">
                  COACH NOTES
                </div>
                <Link
                  href="/workout"
                  className="inline-flex items-center justify-center rounded-md border border-black/15 px-4 py-3 text-sm font-normal text-black/70 hover:bg-black/5 transition-colors"
                >
                  Open coach notes →
                </Link>
                {trainingNotes.length === 0 && (
                  <div className="mt-2 text-xs font-light text-black/45">
                    (No recent notes loaded yet.)
                  </div>
                )}
              </div>
              </div>
              <div className="h-px bg-black/10" />
              <div className="flex-1 overflow-auto p-5" />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}



