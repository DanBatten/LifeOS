/**
 * Date utility functions for LifeOS
 */

/**
 * Get today's date in ISO format (YYYY-MM-DD)
 */
export function getTodayISO(timezone?: string): string {
  const now = new Date();
  if (timezone) {
    return now.toLocaleDateString('en-CA', { timeZone: timezone });
  }
  return now.toISOString().split('T')[0];
}

/**
 * Get the start of day for a given date
 */
export function startOfDay(date: Date, timezone?: string): Date {
  const d = new Date(date);
  if (timezone) {
    const dateStr = d.toLocaleDateString('en-CA', { timeZone: timezone });
    return new Date(`${dateStr}T00:00:00`);
  }
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get the end of day for a given date
 */
export function endOfDay(date: Date, timezone?: string): Date {
  const d = new Date(date);
  if (timezone) {
    const dateStr = d.toLocaleDateString('en-CA', { timeZone: timezone });
    return new Date(`${dateStr}T23:59:59.999`);
  }
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Add days to a date
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Subtract days from a date
 */
export function subtractDays(date: Date, days: number): Date {
  return addDays(date, -days);
}

/**
 * Get the day of week (1 = Monday, 7 = Sunday)
 */
export function getDayOfWeek(date: Date): number {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

/**
 * Check if a date is today
 */
export function isToday(date: Date, timezone?: string): boolean {
  const today = getTodayISO(timezone);
  const dateStr = timezone
    ? date.toLocaleDateString('en-CA', { timeZone: timezone })
    : date.toISOString().split('T')[0];
  return today === dateStr;
}

/**
 * Check if a date is in the past
 */
export function isPast(date: Date): boolean {
  return date < new Date();
}

/**
 * Check if a date is in the future
 */
export function isFuture(date: Date): boolean {
  return date > new Date();
}

/**
 * Get the start of the week (Monday)
 */
export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get the end of the week (Sunday)
 */
export function endOfWeek(date: Date): Date {
  const start = startOfWeek(date);
  return addDays(start, 6);
}

/**
 * Format a date as a human-readable string
 */
export function formatDate(date: Date, options?: Intl.DateTimeFormatOptions): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...options,
  });
}

/**
 * Format a time as a human-readable string
 */
export function formatTime(date: Date, options?: Intl.DateTimeFormatOptions): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    ...options,
  });
}

/**
 * Format a date and time as a human-readable string
 */
export function formatDateTime(date: Date, options?: Intl.DateTimeFormatOptions): string {
  return date.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    ...options,
  });
}

/**
 * Calculate duration between two dates in minutes
 */
export function durationInMinutes(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60));
}

/**
 * Calculate duration between two dates in hours
 */
export function durationInHours(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60) * 10) / 10;
}

/**
 * Format duration in minutes as human-readable string
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${remainingMinutes}min`;
}

/**
 * Parse a time string (HH:MM) into hours and minutes
 */
export function parseTimeString(time: string): { hours: number; minutes: number } {
  const [hours, minutes] = time.split(':').map(Number);
  return { hours, minutes };
}

/**
 * Combine a date with a time string
 */
export function combineDateAndTime(date: Date, time: string): Date {
  const { hours, minutes } = parseTimeString(time);
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

/**
 * Get dates for the last N days
 */
export function getLastNDays(n: number, includeToday = true): Date[] {
  const dates: Date[] = [];
  const start = includeToday ? 0 : 1;
  for (let i = start; i < n + start; i++) {
    dates.push(subtractDays(new Date(), i));
  }
  return dates;
}

/**
 * Check if two date ranges overlap
 */
export function doRangesOverlap(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date
): boolean {
  return start1 < end2 && start2 < end1;
}
