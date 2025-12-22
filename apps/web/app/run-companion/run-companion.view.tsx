'use client';

import Link from 'next/link';
import Image from 'next/image';
import type { TimeContext } from '@/lib/time-context';
import type { WhiteboardEntry } from '@lifeos/core';
import { RunCompanionScheduleRail } from './run-companion-schedule-rail';
import { RunCompanionChatPanel } from './run-companion-chat-panel';
import ShoeNimbus from '@/assets/Shoe-Aesics-GelNumbus.png';
import ShoeEvoSl from '@/assets/Shoe-Adidas-Adizero-Evo-SL.png';
import ShoeAdiosPro4 from '@/assets/Shoe-Adidas-AdiosPro4.png';

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
  readiness,
  whiteboardEntries,
}: {
  timezone: string;
  timeContext: TimeContext;
  workouts: SerializedWorkout[];
  monthMiles: number;
  yearMiles: number;
  readiness: {
    score: number;
    stress: string;
    hrv: string;
    sleep: string;
    recovery: string;
    subtitle: string | null;
  };
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
        <div className="mx-auto max-w-[1920px] px-5 py-5 flex items-center justify-between">
          <div className="text-xl font-normal italic tracking-wide">RUN–COMPANION</div>
          <div className="text-sm font-normal tracking-[0.2em] text-black/60">
            {dateLabel}
          </div>
        </div>
      </header>

      {/* 3-column layout */}
      <div className="mx-auto max-w-[1920px] px-5 py-6">
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
              <div className="px-5 py-4 border-b border-black/10 bg-transparent">
                <div className="text-[11px] font-normal tracking-widest text-black/50">STATS</div>
              </div>
              <div className="p-5">
                {/* Header: match type scale/placement from design */}
                <div className="flex items-start justify-between">
                  <div className="flex gap-14 pt-0">
                    <div>
                      <div className="text-[64px] leading-[0.9] font-normal tracking-tight text-[#ff5a2f]">
                        {Math.round(monthMiles)}
                      </div>
                      <div className="text-[12px] tracking-[0.25em] text-[#4b2a24]/45">MONTH</div>
                    </div>
                    <div>
                      <div className="text-[64px] leading-[0.9] font-black tracking-tight text-[#ff5a2f]">
                        {Math.round(yearMiles).toLocaleString()}
                      </div>
                      <div className="text-[12px] tracking-[0.25em] text-[#4b2a24]/45">YEAR</div>
                    </div>
                  </div>
                  <div className="text-right text-[#ff5a2f] font-normal tracking-tight leading-[0.82]">
                    <div className="text-[92px] font-black">MILES</div>
                    <div className="text-[92px] font-black">RUN</div>
                  </div>
                </div>

                {/* Top row: long lactate module + small VO2 module */}
                <div className="mt-6 grid grid-cols-1 md:grid-cols-[65%_32%] gap-[15px]">
                  <div className="h-[130px] rounded-xl border border-black/10 bg-[#f3efec] px-5 py-3 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-[12px] tracking-normal text-[#4b2a24]/60 leading-[1.2]">
                        RUNNIN LACTATE THRESHOLD
                      </div>
                      <span className="text-[10px] font-semibold bg-green-200 text-green-900 px-3 py-1 rounded">
                        ↓ IMPROVING
                      </span>
                    </div>
                    <div className="mt-0 flex items-end justify-between">
                      <div>
                        <div className="text-[60px] leading-[0.9] font-normal text-[#4b2a24]">170</div>
                        <div className="mt-1 text-[14px] tracking-normal text-[#4b2a24]/70">BPM</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[60px] leading-[0.9] font-normal text-[#4b2a24]">6.17</div>
                        <div className="mt-1 text-[14px] tracking-[0.05em] text-[#4b2a24]/70">min miles</div>
                      </div>
                    </div>
                  </div>

                  <div className="h-[130px] rounded-xl border border-black/10 bg-[#f3efec] px-5 py-3 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-[12px] tracking-normal text-[#4b2a24]/60">VO2MAX</div>
                      <span className="text-[10px] font-semibold bg-green-200 text-green-900 px-3 py-1 rounded">
                        ELITE
                      </span>
                    </div>
                    <div className="mt-0">
                      <div className="text-[60px] leading-[0.9] font-normal text-[#4b2a24]">60</div>
                      <div className="mt-1 text-[14px] tracking-normal text-[#4b2a24]/70">VO2</div>
                    </div>
                  </div>
                </div>

                {/* Second row: left column (readiness + load focus), right column (shoes) */}
                <div className="mt-[15px] grid grid-cols-1 md:grid-cols-[55%_42%] gap-[15px]">
                  <div className="space-y-[15px]">
                    <div className="rounded-xl border border-black/10 bg-[#f3efec] px-5 py-3 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-[12px] font-bold tracking-normal text-[#4b2a24]/60">
                          TRAINING READINESS
                        </div>
                        <span className="text-[10px] font-semibold bg-green-200 text-green-900 px-3 py-1 rounded">
                          {readiness.score >= 75 ? 'GREAT' : readiness.score >= 55 ? 'OKAY' : 'EASY'}
                        </span>
                      </div>
                      <div className="mt-0 flex gap-8">
                        <div className="shrink-0">
                          <div className="text-[60px] leading-[0.9] font-normal text-[#4b2a24]">
                            {readiness.score}
                          </div>
                          <div className="mt-1 text-[14px] tracking-normal text-[#4b2a24]/70">VO2</div>
                        </div>
                        <div className="pt-[13px] text-[11px] leading-[1.6] text-[#4b2a24]/70">
                          <div>Stress: {readiness.stress}</div>
                          <div>HRV: {readiness.hrv}</div>
                          <div>Sleep: {readiness.sleep}</div>
                          <div>Recovery: {readiness.recovery}</div>
                        </div>
                      </div>
                      {readiness.subtitle && (
                        <div className="mt-0 text-[14px] font-bold text-[#4b2a24]/55">{readiness.subtitle}</div>
                      )}
                    </div>

                    <div className="rounded-xl border border-black/10 bg-[#f3efec] px-5 py-3 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-[12px] font-bold tracking-normal text-[#4b2a24]/60">LOAD FOCUS</div>
                        <span className="text-[10px] font-semibold bg-amber-200 text-amber-900 px-3 py-1 rounded">
                          ANAEROBIC SHORTAGE
                        </span>
                      </div>
                      <div className="mt-4 space-y-4">
                        {[
                          { label: 'Anaerobic', value: 53, max: 200, bar: 'bg-[#ff5a2f]' },
                          { label: 'High Aerobic', value: 911, max: 1200, bar: 'bg-green-500' },
                          { label: 'Low Aerobic', value: 1193, max: 1600, bar: 'bg-green-500' },
                        ].map((row) => (
                          <div key={row.label} className="grid grid-cols-[70px_50px_1fr] items-center gap-4">
                            <div className="text-[11px] text-[#4b2a24]/60">{row.label}</div>
                            <div className="text-[11px] text-[#4b2a24]/70">{row.value}</div>
                            <div className="h-3 rounded bg-black/10 overflow-hidden">
                              <div
                                className={`h-full rounded ${row.bar}`}
                                style={{ width: `${Math.min(100, (row.value / row.max) * 100)}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-[15px]">
                    {[
                      { miles: 39, label: 'Long Run', shoe: 'Aesics Gel Nimbus', tone: 'ELITE', img: ShoeNimbus },
                      { miles: 97, label: 'Daily Trainer', shoe: 'Adidas Adizero Evo SL', tone: 'FRESH', img: ShoeEvoSl },
                      { miles: 280, label: 'Race Shoe', shoe: 'Adidas Adizero Evo SL', tone: 'ELITE', img: ShoeAdiosPro4 },
                    ].map((s) => (
                      <div
                        key={s.label}
                        className="h-[95px] w-full rounded-xl border border-black/10 bg-[#f3efec] pl-0 pr-2 py-3 shadow-sm"
                      >
                        <div className="flex h-full items-center justify-between">
                          {/* Left cluster: shoe image + miles (miles sits behind shoe) */}
                          <div className="relative h-full w-[150px]">
                            <div className="absolute left-0 top-1/2 h-20 w-20 -translate-y-1/2 z-20">
                              <Image src={s.img} alt={s.shoe} fill className="object-contain" />
                            </div>

                            <div className="absolute left-[58px] top-1/2 -translate-y-[56%] z-10">
                              <div className="text-[40px] leading-[0.9] font-normal text-[#ff5a2f]">
                                {s.miles}
                              </div>
                              <div className="-mt-1 text-[10px] font-bold tracking-normal text-[#ff5a2f]/80">MILES RUN</div>
                            </div>
                          </div>

                          {/* Right cluster: label + shoe */}
                          <div className="my-2 text-right">
                            <span className="inline-flex text-[10px] font-semibold px-3 py-1 rounded bg-green-200 text-green-900">
                              {s.tone}
                            </span>
                            <div className="mt-1 text-[16px] tracking-normal leading-[1.05] font-normal text-[#4b2a24]">
                              {s.label}
                            </div>
                            <div className="text-[10px] leading-[1.1] text-[#4b2a24]/55">{s.shoe}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              <div className="mt-8">
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




