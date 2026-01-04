'use client';

import { useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { getNutritionSummary } from '@/lib/nutrition-guidance';

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
  actualPace?: string | null;
}

function chip({ label, tone }: { label: string; tone: 'green' | 'gray' | 'orange' | 'brown' }) {
  const tones = {
    green: 'bg-green-500 text-white',
    gray: 'bg-black/10 text-black/60',
    orange: 'bg-[#ff5a2f] text-white',
    brown: 'bg-[#4b2a24] text-white',
  } as const;

  return (
    <span className={`text-[10px] font-normal px-2 py-0.5 rounded ${tones[tone]}`}>
      {label}
    </span>
  );
}

function shortTitle(title: string) {
  return title.replace(/^Week \d+\s*[—-]\s*\w+:\s*/i, '').trim();
}

/**
 * Extract just the pace from various formats:
 * - Simple: "6:30/mi" → "6:30"
 * - Range: "6:30-6:35/mi" → "6:30-6:35"
 * - Structured: "2 mi WU → 6 mi @ 6:30-6:35/mi → 1 mi CD" → "6:30-6:35"
 * - Without suffix: "2 mi WU → 6 mi @ 6:30" → "6:30"
 * - Single digit: "@ 6" → "6:00" (assumes minutes)
 */
function formatPace(pace?: string | null) {
  if (!pace) return null;
  
  // If it looks like a structured workout (contains arrows or @), extract the pace portion
  if (pace.includes('→') || pace.includes('@')) {
    // Look for patterns like "@ 6:30-6:35/mi" or "@ 6:30/mi" (with /mi suffix)
    const atMatchWithSuffix = pace.match(/@\s*(\d+:\d+(?:-\d+:\d+)?)\s*\/mi/i);
    if (atMatchWithSuffix) {
      return atMatchWithSuffix[1];
    }
    // Look for patterns like "@ 6:30-6:35" or "@ 6:30" (without /mi suffix)
    const atMatch = pace.match(/@\s*(\d+:\d+(?:-\d+:\d+)?)/);
    if (atMatch) {
      return atMatch[1];
    }
    // Look for single digit pace like "@ 6" or "@ 7" (assumes X:00 format)
    const atMatchSingleDigit = pace.match(/@\s*(\d)(?:\s|$)/);
    if (atMatchSingleDigit) {
      return `${atMatchSingleDigit[1]}:00`;
    }
    // Fallback: look for any pace pattern like "6:30-6:35/mi" or "6:30/mi"
    const paceMatchWithSuffix = pace.match(/(\d+:\d+(?:-\d+:\d+)?)\s*\/mi/i);
    if (paceMatchWithSuffix) {
      return paceMatchWithSuffix[1];
    }
    // Last resort: find any X:XX or X:XX-X:XX pattern (likely the pace)
    const paceMatch = pace.match(/(\d+:\d+(?:-\d+:\d+)?)/);
    if (paceMatch) {
      return paceMatch[1];
    }
    // If no pace found in structured workout, return null
    return null;
  }
  
  // Simple pace format - just strip the /mi suffix
  return pace.replace('/mi', '').replace('/mile', '').trim();
}

function formatPaceRange(pace?: string | null) {
  const cleaned = formatPace(pace);
  if (!cleaned) return null;
  // If a single pace exists, show it as a small range (placeholder behavior until we store ranges)
  return cleaned.includes('-') ? cleaned : `${cleaned}-${cleaned}`;
}

function computePaceFromDistanceAndDuration(distanceMiles?: number | null, durationMinutes?: number | null): string | null {
  if (!distanceMiles || !durationMinutes || distanceMiles <= 0 || durationMinutes <= 0) return null;
  const minutesPerMile = durationMinutes / distanceMiles;
  const whole = Math.floor(minutesPerMile);
  const seconds = Math.round((minutesPerMile - whole) * 60);
  return `${whole}:${String(seconds).padStart(2, '0')}`;
}

function WorkoutCard({
  workout,
  variant,
}: {
  workout: SerializedWorkout;
  variant?: 'today' | 'compact' | 'completed';
}) {
  const type = workout.workoutType?.toLowerCase?.() || '';
  const status = workout.status;

  const titleAndDesc = `${workout.title || ''} ${workout.prescribedDescription || ''}`;
  const isRest = /rest/i.test(workout.title) || type === 'rest';
  const isLong = /long/i.test(workout.title);
  const isThreshold = /threshold/i.test(workout.title);
  const isTempo = /tempo/i.test(workout.title);
  const isMarathonPace = /marathon\s*pace|MP\s*run|\bMP\b/i.test(titleAndDesc);
  const isInterval = /interval/i.test(workout.title);
  const isEasy = /easy/i.test(workout.title) || (type === 'run' && !isLong && !isTempo && !isThreshold && !isMarathonPace && !isInterval);

  // Determine the run category label based on workout type
  const runCategoryLabel = isRest ? 'Rest Day'
    : isMarathonPace ? 'MP Run'
    : isLong ? 'Long Run' 
    : isThreshold ? 'Threshold Run' 
    : isTempo ? 'Tempo Run' 
    : isInterval ? 'Interval Run'
    : isEasy ? 'Easy Run' 
    : 'Run';
  
  // Check if this workout is actually scheduled for today
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const scheduledDateStr = workout.scheduledDate?.split('T')[0] || '';
  const isActuallyToday = scheduledDateStr === todayStr;

  const distance =
    workout.actualDistanceMiles != null
      ? workout.actualDistanceMiles
      : workout.prescribedDistanceMiles != null
        ? workout.prescribedDistanceMiles
        : null;

  // --- COMPLETED RUN CARD (detail density like screenshot, reskinned) ---
  if (variant === 'completed') {
    const pace = formatPace(workout.actualPace || null) || computePaceFromDistanceAndDuration(distance, workout.actualDurationMinutes);
    const duration = workout.actualDurationMinutes != null ? `${Math.round(workout.actualDurationMinutes)} min` : null;
    const hr = workout.avgHeartRate != null ? `${Math.round(workout.avgHeartRate)} bpm` : null;

    return (
      <Link
        href={`/workout/${workout.id}`}
        className="block rounded-lg border border-black/15 bg-[#f3efec] px-4 py-3 shadow-sm hover:bg-[#f8f4f2] transition-colors"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[12px] font-normal tracking-widest text-[#4b2a24]/80">
              {runCategoryLabel.toUpperCase()}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-green-500 px-3 py-1.5 text-sm font-normal text-white shadow-sm">
              Done
            </span>
          </div>
        </div>

        <div className="flex items-end gap-3">
          <div className="text-[50px] leading-[0.9] font-black text-[#ff5a2f]">
            {distance != null ? distance.toFixed(1) : '—'}
          </div>
          <div className="text-xl font-normal text-[#4b2a24]/70">mi</div>
        </div>

        <div className="flex items-center gap-6 text-[#4b2a24]/70">
          {pace && (
            <div className="flex items-baseline gap-2">
              <span className="text-base font-normal">{pace}</span>
              <span className="text-base font-light">/mi</span>
            </div>
          )}
          {hr && (
            <div className="flex items-baseline gap-2">
              <span className="text-base font-normal">{hr}</span>
            </div>
          )}
        </div>

        <div className="mt-4 border-t border-black/15 pt-2.5 flex items-center justify-between text-[#4b2a24]/70">
          <div className="text-sm font-normal">View details →</div>
          {duration && <div className="text-sm font-light">{duration}</div>}
        </div>
      </Link>
    );
  }

  // --- TODAY CARD (matches screenshot layout, placeholder data where needed) ---
  if (variant === 'today') {
    // Try prescribedPacePerMile first, then extract from prescribedDescription, then fallback
    const extractedPace = formatPaceRange(workout.prescribedPacePerMile || null) 
      || formatPaceRange(workout.prescribedDescription || null)
      || '8-8:15';
    const paceRange = extractedPace;
    // Default to daily trainer - in future, fetch from workout.shoe_id or recommend based on type
    const shoeLabel = isLong ? 'Long Run' : 'Daily Trainer';
    const shoeName = isLong ? 'ASICS Gel Nimbus 26' : 'Adidas Adizero Evo SL';
    const shoeImage = isLong ? '/shoes/asics-gel-nimbus.png' : '/shoes/adidas-adizero-evo-sl.png';
    // Build label: "TODAY'S" prefix only if actually today, then the run category
    const prefix = isActuallyToday ? "TODAY'S " : '';
    const categoryUpper = runCategoryLabel.toUpperCase();
    const cardLabel = `${prefix}${categoryUpper}`;

    return (
      <div className="rounded-lg border border-black/10 bg-[#ff5a2f] p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="text-[18px] font-normal tracking-wide text-[#4b2a24]">{cardLabel}</div>
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-normal px-3 py-1 rounded bg-white/60 text-[#4b2a24]">Week 11</span>
            <span className="text-[12px] font-normal px-3 py-1 rounded bg-white/60 text-[#4b2a24]">
              LA Marathon Plan
            </span>
          </div>
        </div>

        <div className="mt-6 flex gap-5">
          {/* Left: distance + wake/run times */}
          <div className="w-[150px] shrink-0">
            <div>
              <div className="text-[150px] leading-[0.85] font-normal tracking-[-15.7px] text-[#4b2a24]">
                {distance != null ? Math.round(distance) : 6}
              </div>
              <div className="mt-1 text-2xl font-normal text-[#4b2a24]/80">miles</div>
            </div>

            <div className="mt-5 space-y-3">
              <div className="rounded-md bg-white/60 px-4 py-1.5 text-[#4b2a24]">
                <div className="text-[10px] font-extrabold opacity-80">Wake Up:</div>
                <div className="text-[20px] leading-[22px] font-normal">5:50am</div>
              </div>
              <div className="rounded-md bg-white/60 px-4 py-1.5 text-[#4b2a24]">
                <div className="text-[10px] font-extrabold opacity-80">Run:</div>
                <div className="text-[20px] leading-[22px] font-normal">6:30am</div>
              </div>
            </div>
          </div>

          {/* Right: pace, description, shoe, guidance */}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 text-[#4b2a24]">
              <div className="text-5xl leading-[1] font-normal tracking-tight whitespace-nowrap">
                {paceRange}
              </div>
              <div className="text-xl font-normal opacity-80 whitespace-nowrap">/mile</div>
            </div>

            <div className="mt-3 text-[13px] leading-relaxed font-light text-[#4b2a24]/85">
              {workout.prescribedDescription ||
                'Easy run at conversational pace. If breathing becomes labored, reduce pace.'}
            </div>

            <div className="mt-4 rounded-md border border-black/10 bg-white/70 p-4 flex items-center gap-4">
              <div className="relative h-14 w-20 shrink-0">
                <Image 
                  src={shoeImage} 
                  alt={shoeName} 
                  width={160}
                  height={112}
                  className="object-contain absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" 
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-lg font-normal text-[#4b2a24]">{shoeLabel}</div>
                <div className="text-sm font-light text-[#4b2a24]/70">{shoeName}</div>
              </div>
            </div>

            {(() => {
              const nutrition = getNutritionSummary({
                workoutType: workout.workoutType,
                title: workout.title,
                prescribedDistanceMiles: workout.prescribedDistanceMiles ?? null,
                prescribedDescription: workout.prescribedDescription ?? null,
                prescribedPacePerMile: workout.prescribedPacePerMile ?? null,
                plannedDurationMinutes: workout.plannedDurationMinutes ?? null,
              });
              return (
                <div className="mt-4 space-y-4 text-[13px] leading-relaxed font-light text-[#4b2a24]/85">
                  <div>
                    <div className="font-normal">Pre-Run Nutrition</div>
                    <div>{nutrition.preRun}</div>
                  </div>
                  <div>
                    <div className="font-normal">Run Fueling</div>
                    <div>{nutrition.duringRun}</div>
                  </div>
                  <div>
                    <div className="font-normal">Hydration</div>
                    <div>{nutrition.hydration}</div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    );
  }

  // --- COMPACT CARD (tempo/long/etc) ---
  if (isRest) {
    return (
      <div className="rounded-md bg-[#4b2a24] px-4 py-3 text-white/90">
        <div className="text-sm font-normal tracking-wide">REST DAY</div>
      </div>
    );
  }

  const bg = 'bg-[#f3efec]';
  const labelTop = isTempo ? 'TEMPO RUN' : isLong ? 'LONG RUN' : 'RUN';
  const pace = formatPace(workout.prescribedPacePerMile || null);

  return (
    <div className={`rounded-md border border-black/10 ${bg} px-4 py-3 shadow-sm`}>
      <div className="flex items-start justify-between gap-3">
        <div className="text-[13px] font-normal tracking-wide text-[#4b2a24]">{labelTop}</div>
        {status === 'completed'
          ? chip({ label: 'COMPLETE', tone: 'green' })
          : status === 'skipped'
          ? chip({ label: 'SKIPPED', tone: 'gray' })
          : chip({ label: 'PLANNED', tone: 'gray' })}
      </div>

      {variant !== 'compact' && (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[12px] font-normal px-3 py-1 rounded bg-black/5 text-[#4b2a24]/80">Week 11</span>
          <span className="text-[12px] font-normal px-3 py-1 rounded bg-black/5 text-[#4b2a24]/80">LA Marathon Plan</span>
        </div>
      )}

      <div className="mt-3 text-[14px] font-light text-[#4b2a24]/80">
        {shortTitle(workout.title)}
        {pace ? <span className="font-normal text-[#4b2a24]/80"> • {pace}/mile</span> : null}
      </div>
    </div>
  );
}

// Copied from ScheduleView.tsx (kept in sync intentionally)
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

function isPast(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

function toLocalDateString(dateValue: Date | string): string {
  if (typeof dateValue === 'string') return dateValue.split('T')[0];
  return `${dateValue.getFullYear()}-${String(dateValue.getMonth() + 1).padStart(2, '0')}-${String(dateValue.getDate()).padStart(2, '0')}`;
}

function groupWorkoutsByDate(workouts: SerializedWorkout[]): Map<string, SerializedWorkout[]> {
  const grouped = new Map<string, SerializedWorkout[]>();
  for (const workout of workouts) {
    if (!workout.scheduledDate) continue;
    const dateKey = toLocalDateString(workout.scheduledDate);
    const existing = grouped.get(dateKey) || [];
    existing.push(workout);
    grouped.set(dateKey, existing);
  }
  return grouped;
}

export function RunCompanionScheduleRail({ workouts }: { workouts: SerializedWorkout[] }) {
  const todayRef = useRef<HTMLDivElement>(null);
  const workoutsByDate = useMemo(() => groupWorkoutsByDate(workouts), [workouts]);

  const nextPlanned = useMemo(() => {
    // IMPORTANT: avoid `new Date('YYYY-MM-DD')` comparisons (UTC parsing causes off-by-one in local time).
    // Compare using YYYY-MM-DD strings instead.
    const todayKey = toLocalDateString(new Date());
    const sorted = [...workouts]
      .filter((w) => w.scheduledDate)
      .sort((a, b) => toLocalDateString(a.scheduledDate || '').localeCompare(toLocalDateString(b.scheduledDate || '')));
    return (
      sorted.find((w) => w.scheduledDate && toLocalDateString(w.scheduledDate) >= todayKey && w.status === 'planned') ||
      null
    );
  }, [workouts]);

  // Scroll to today on mount
  useEffect(() => {
    if (todayRef.current) {
      setTimeout(() => {
        todayRef.current?.scrollIntoView({ behavior: 'instant', block: 'center' });
      }, 100);
    }
  }, []);

  // Generate list of weeks to display (-2..+2) like /schedule
  const weeks = useMemo(() => {
    const weekStart = getWeekStart(new Date());
    const out: { start: Date; end: Date; label: string }[] = [];
    for (let i = -2; i <= 2; i++) {
      const start = addDays(weekStart, i * 7);
      const end = addDays(start, 6);
      const label = i === 0 ? 'This Week' : i === -1 ? 'Last Week' : i === 1 ? 'Next Week' : formatDate(start);
      out.push({ start, end, label });
    }
    return out;
  }, []);

  return (
    <div className="rounded-xl border border-black/10 bg-transparent overflow-hidden h-[calc(100vh-140px)] flex flex-col">
      <div className="px-5 py-4 border-b border-black/10 bg-transparent">
        <div className="text-[11px] font-normal tracking-widest text-black/50">CALENDAR</div>
      </div>

      <div className="p-5 flex-1 overflow-auto pr-2 space-y-8">
        {/* Full schedule rail: past + future (scrolls) */}
          {weeks.map((week, weekIndex) => {
            const isCurrentWeek = week.label === 'This Week';

            return (
              <section key={weekIndex}>
                <div className="flex items-center justify-between mb-3">
                  <div className={`text-sm font-normal ${isCurrentWeek ? 'text-[#ff5a2f]' : 'text-black/60'}`}>
                    {week.label}
                  </div>
                  <div className="text-xs text-black/35">
                    {formatDate(week.start)} – {formatDate(week.end)}
                  </div>
                </div>

                <div className="space-y-3">
                  {Array.from({ length: 7 }, (_, dayIndex) => {
                    const date = addDays(week.start, dayIndex);
                    const dateKey = toLocalDateString(date);
                    const dayWorkouts = workoutsByDate.get(dateKey) || [];
                    const today = isToday(date);
                    const past = isPast(date) && !today;

                    // Skip empty past days (same behavior as /schedule)
                    if (dayWorkouts.length === 0 && past) return null;

                    const dateLabel = date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

                    return (
                      <div key={dayIndex} ref={today ? todayRef : undefined}>
                        <div className="flex items-center gap-4 mb-3">
                          <div className="text-lg font-normal text-black/70">{dateLabel}</div>
                          <div className={`flex-1 border-t ${today ? 'border-black/40' : 'border-black/25'}`} />
                        </div>

                        {dayWorkouts.length > 0 ? (
                          <div className="space-y-2">
                            {dayWorkouts.map((w) => {
                              const isNextUpcoming = nextPlanned?.id === w.id;
                              const isBigPlannedRun =
                                isNextUpcoming &&
                                w.status === 'planned' &&
                                (w.workoutType?.toLowerCase?.() === 'run' || /run|easy|tempo|long/i.test(w.title));

                              const isCompletedRun =
                                w.status === 'completed' &&
                                (w.workoutType?.toLowerCase?.() === 'run' || /run|tempo|long/i.test(w.title));

                              return (
                                <WorkoutCard
                                  key={w.id}
                                  workout={w}
                                  variant={isBigPlannedRun ? 'today' : isCompletedRun ? 'completed' : 'compact'}
                                />
                              );
                            })}
                          </div>
                        ) : (
                          <WorkoutCard workout={{ id: `rest-${dateKey}`, title: 'Rest Day', workoutType: 'rest', status: 'planned', scheduledDate: dateKey }} variant="compact" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
      </div>
    </div>
  );
}



