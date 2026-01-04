'use client';

import Link from 'next/link';
import Image from 'next/image';
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

interface SerializedShoe {
  id: string;
  brand: string;
  model: string;
  nickname: string | null;
  category: string;
  totalMiles: number;
  maxMiles: number;
  imageUrl: string | null;
  status: string;
}

// Map category to display label
const categoryLabels: Record<string, string> = {
  daily_trainer: 'Daily Trainer',
  tempo: 'Tempo',
  race: 'Race Shoe',
  long_run: 'Long Run',
  trail: 'Trail',
  recovery: 'Recovery',
};

// Get shoe health status based on mileage
function getShoeHealth(totalMiles: number, maxMiles: number): { label: string; tone: 'green' | 'yellow' | 'red' } {
  const pct = totalMiles / maxMiles;
  if (pct < 0.5) return { label: 'FRESH', tone: 'green' };
  if (pct < 0.8) return { label: 'GOOD', tone: 'yellow' };
  return { label: 'RETIRE SOON', tone: 'red' };
}

// Default shoes to show when DB isn't configured
const defaultShoes: SerializedShoe[] = [
  {
    id: 'default-long-run',
    brand: 'ASICS',
    model: 'Gel Nimbus 26',
    nickname: 'Long Run Cushion',
    category: 'long_run',
    totalMiles: 23.4,
    maxMiles: 500,
    imageUrl: '/shoes/asics-gel-nimbus.png',
    status: 'active',
  },
  {
    id: 'default-daily',
    brand: 'Adidas',
    model: 'Adizero Evo SL',
    nickname: 'Daily Trainer',
    category: 'daily_trainer',
    totalMiles: 26.3,
    maxMiles: 400,
    imageUrl: '/shoes/adidas-adizero-evo-sl.png',
    status: 'active',
  },
  {
    id: 'default-race',
    brand: 'Adidas',
    model: 'Adios Pro 4',
    nickname: 'Race Day',
    category: 'race',
    totalMiles: 75.8,
    maxMiles: 250,
    imageUrl: '/shoes/adidas-adios-pro-4.png',
    status: 'active',
  },
];

export function RunCompanionView({
  timezone,
  timeContext,
  workouts,
  monthMiles,
  yearMiles,
  readiness,
  whiteboardEntries,
  shoes: shoesFromDb = [],
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
  shoes?: SerializedShoe[];
}) {
  const dateLabel = timeContext.dateString.toUpperCase();

  // Use default shoes if none from database
  const shoes = shoesFromDb.length > 0 ? shoesFromDb : defaultShoes;

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
          <div className="flex items-center gap-4">
            <div className="text-sm font-normal tracking-[0.2em] text-black/60">
              {dateLabel}
            </div>
            <Link
              href="/settings"
              className="p-2 text-black/40 hover:text-black/70 hover:bg-black/5 rounded-lg transition-colors"
              title="Settings"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
            </Link>
          </div>
        </div>
      </header>

      {/* 3-column layout */}
      <div className="mx-auto max-w-[1920px] px-5 py-6">
        <div className="grid grid-cols-12 gap-5">
          {/* Left: schedule rail */}
          <section className="col-span-12 lg:col-span-4">
            <RunCompanionScheduleRail 
              workouts={workouts} 
              shoes={shoes}
              onShoeChange={async (workoutId, shoeId) => {
                // Save shoe selection to workout (fire and forget)
                try {
                  await fetch('/api/workout/shoe', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ workoutId, shoeId }),
                  });
                } catch (e) {
                  console.error('Failed to save shoe selection:', e);
                }
              }}
            />
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
                <div className="flex items-start justify-between pr-4">
                  <div className="flex gap-8 pt-0">
                    <div>
                      <div className="text-[64px] leading-[0.9] font-black tracking-tight text-[#ff5a2f]">
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
                    {shoes.map((shoe) => {
                      const health = getShoeHealth(shoe.totalMiles, shoe.maxMiles);
                      const healthBg = health.tone === 'green' ? 'bg-green-200 text-green-900' 
                        : health.tone === 'yellow' ? 'bg-amber-200 text-amber-900' 
                        : 'bg-red-200 text-red-900';
                      
                      return (
                        <div
                          key={shoe.id}
                          className="h-[95px] w-full rounded-xl border border-black/10 bg-[#f3efec] pl-0 pr-2 py-3 shadow-sm"
                        >
                          <div className="flex h-full items-center justify-between">
                            {/* Left cluster: shoe image + miles */}
                            <div className="relative h-full w-[150px]">
                              {shoe.imageUrl && (
                                <div className="absolute left-0 top-1/2 h-20 w-20 -translate-y-1/2 z-20">
                                  <Image 
                                    src={shoe.imageUrl} 
                                    alt={`${shoe.brand} ${shoe.model}`} 
                                    fill 
                                    className="object-contain" 
                                  />
                                </div>
                              )}

                              <div className="absolute left-[58px] top-1/2 -translate-y-[56%] z-10">
                                <div className="text-[40px] leading-[0.9] font-normal text-[#ff5a2f]">
                                  {Math.round(shoe.totalMiles)}
                                </div>
                                <div className="-mt-1 text-[10px] font-bold tracking-normal text-[#ff5a2f]/80">MILES RUN</div>
                              </div>
                            </div>

                            {/* Right cluster: label + shoe name */}
                            <div className="my-2 text-right">
                              <span className={`inline-flex text-[10px] font-semibold px-3 py-1 rounded ${healthBg}`}>
                                {health.label}
                              </span>
                              <div className="mt-1 text-[16px] tracking-normal leading-[1.05] font-normal text-[#4b2a24]">
                                {categoryLabels[shoe.category] || shoe.nickname || shoe.category}
                              </div>
                              <div className="text-[10px] leading-[1.1] text-[#4b2a24]/55">
                                {shoe.brand} {shoe.model}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
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




