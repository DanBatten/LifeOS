/**
 * Time Context Framework
 *
 * Provides time-of-day awareness for contextual UI personalization.
 * This is the foundation for:
 * - Dynamic greetings and copy
 * - Module prioritization based on time
 * - Context-aware insights
 * - Future: custom time blocks, user preferences
 */

export type TimePeriod = 'early_morning' | 'morning' | 'midday' | 'afternoon' | 'evening' | 'night';

export interface TimeContext {
  // Current time info
  period: TimePeriod;
  hour: number;
  minute: number;

  // Formatted strings
  greeting: string;
  timeOfDay: string; // "morning", "afternoon", "evening"
  dateString: string;

  // Contextual flags
  isWorkHours: boolean;
  isPreWorkout: boolean; // Based on typical workout time
  isPostWorkout: boolean;
  isMealTime: boolean;
  isWindingDown: boolean;

  // For components to use
  timezone: string;
}

export interface TimeContextConfig {
  timezone: string;
  userName?: string;

  // Customizable time boundaries (future: user preferences)
  periods?: {
    earlyMorning?: { start: number; end: number }; // default 4-6
    morning?: { start: number; end: number };       // default 6-12
    midday?: { start: number; end: number };        // default 12-14
    afternoon?: { start: number; end: number };     // default 14-17
    evening?: { start: number; end: number };       // default 17-21
    night?: { start: number; end: number };         // default 21-4
  };

  // User's typical schedule (future: learned from data)
  typicalWorkoutTime?: string; // "06:30"
  workHoursStart?: number;     // 9
  workHoursEnd?: number;       // 17
}

type Periods = {
  earlyMorning: { start: number; end: number };
  morning: { start: number; end: number };
  midday: { start: number; end: number };
  afternoon: { start: number; end: number };
  evening: { start: number; end: number };
  night: { start: number; end: number };
};

const DEFAULT_PERIODS: Periods = {
  earlyMorning: { start: 4, end: 6 },
  morning: { start: 6, end: 12 },
  midday: { start: 12, end: 14 },
  afternoon: { start: 14, end: 17 },
  evening: { start: 17, end: 21 },
  night: { start: 21, end: 4 },
};

/**
 * Determine the time period based on hour
 */
function getTimePeriod(hour: number, periods = DEFAULT_PERIODS): TimePeriod {
  if (hour >= periods.earlyMorning.start && hour < periods.earlyMorning.end) {
    return 'early_morning';
  }
  if (hour >= periods.morning.start && hour < periods.morning.end) {
    return 'morning';
  }
  if (hour >= periods.midday.start && hour < periods.midday.end) {
    return 'midday';
  }
  if (hour >= periods.afternoon.start && hour < periods.afternoon.end) {
    return 'afternoon';
  }
  if (hour >= periods.evening.start && hour < periods.evening.end) {
    return 'evening';
  }
  return 'night';
}

/**
 * Get a contextual greeting based on time of day
 */
function getGreeting(period: TimePeriod, userName?: string): string {
  const name = userName ? `, ${userName}` : '';

  switch (period) {
    case 'early_morning':
      return `Early start${name}`;
    case 'morning':
      return `Good morning${name}`;
    case 'midday':
      return `Good afternoon${name}`;
    case 'afternoon':
      return `Good afternoon${name}`;
    case 'evening':
      return `Good evening${name}`;
    case 'night':
      return `Good evening${name}`;
    default:
      return `Hello${name}`;
  }
}

/**
 * Get simple time of day string
 */
function getTimeOfDay(period: TimePeriod): string {
  switch (period) {
    case 'early_morning':
    case 'morning':
      return 'morning';
    case 'midday':
    case 'afternoon':
      return 'afternoon';
    case 'evening':
    case 'night':
      return 'evening';
    default:
      return 'day';
  }
}

/**
 * Check if current time is near a workout time
 */
function checkWorkoutProximity(
  hour: number,
  minute: number,
  workoutTime?: string
): { isPreWorkout: boolean; isPostWorkout: boolean } {
  if (!workoutTime) {
    // Default assumption: morning workout around 6:30 AM
    const defaultWorkoutHour = 6;
    const defaultWorkoutMinute = 30;
    const currentMinutes = hour * 60 + minute;
    const workoutMinutes = defaultWorkoutHour * 60 + defaultWorkoutMinute;

    // Pre-workout: 1-2 hours before
    const isPreWorkout = currentMinutes >= workoutMinutes - 120 && currentMinutes < workoutMinutes;
    // Post-workout: up to 2 hours after
    const isPostWorkout = currentMinutes >= workoutMinutes && currentMinutes < workoutMinutes + 120;

    return { isPreWorkout, isPostWorkout };
  }

  const [workoutHour, workoutMinute] = workoutTime.split(':').map(Number);
  const currentMinutes = hour * 60 + minute;
  const workoutMinutes = workoutHour * 60 + workoutMinute;

  const isPreWorkout = currentMinutes >= workoutMinutes - 120 && currentMinutes < workoutMinutes;
  const isPostWorkout = currentMinutes >= workoutMinutes && currentMinutes < workoutMinutes + 120;

  return { isPreWorkout, isPostWorkout };
}

/**
 * Check if it's a typical meal time
 */
function checkMealTime(hour: number): boolean {
  // Breakfast: 6-9, Lunch: 11-14, Dinner: 17-20
  return (hour >= 6 && hour < 9) || (hour >= 11 && hour < 14) || (hour >= 17 && hour < 20);
}

/**
 * Create a TimeContext object for the current time
 */
export function createTimeContext(config: TimeContextConfig): TimeContext {
  const { timezone, userName, typicalWorkoutTime, workHoursStart = 9, workHoursEnd = 17 } = config;

  // Get current time in the specified timezone
  const now = new Date();
  const timeString = now.toLocaleTimeString('en-US', {
    timeZone: timezone,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  });
  const [hour, minute] = timeString.split(':').map(Number);

  // Merge custom periods with defaults
  const periods: Periods = {
    ...DEFAULT_PERIODS,
    ...config.periods,
  };
  const period = getTimePeriod(hour, periods);
  const { isPreWorkout, isPostWorkout } = checkWorkoutProximity(hour, minute, typicalWorkoutTime);

  const dateString = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: timezone,
  });

  return {
    period,
    hour,
    minute,
    greeting: getGreeting(period, userName),
    timeOfDay: getTimeOfDay(period),
    dateString,
    isWorkHours: hour >= workHoursStart && hour < workHoursEnd,
    isPreWorkout,
    isPostWorkout,
    isMealTime: checkMealTime(hour),
    isWindingDown: hour >= 20 || hour < 4,
    timezone,
  };
}

/**
 * Get module priorities based on time context
 * Returns modules in order of relevance for current time
 */
export function getModulePriorities(context: TimeContext): string[] {
  const { period, isPreWorkout, isPostWorkout, isMealTime } = context;

  // Default order
  const modules = ['health', 'training', 'nutrition', 'planning'];

  // Adjust based on context
  if (period === 'early_morning' || period === 'morning') {
    // Morning: health first (check recovery), then training
    if (isPreWorkout) {
      return ['nutrition', 'health', 'training', 'planning'];
    }
    return ['health', 'training', 'nutrition', 'planning'];
  }

  if (isPostWorkout) {
    // Post-workout: nutrition for recovery, then training to log
    return ['nutrition', 'training', 'health', 'planning'];
  }

  if (isMealTime) {
    return ['nutrition', 'health', 'training', 'planning'];
  }

  if (period === 'evening' || period === 'night') {
    // Evening: planning for tomorrow, review training
    return ['planning', 'training', 'health', 'nutrition'];
  }

  // Afternoon default
  return ['training', 'planning', 'health', 'nutrition'];
}

/**
 * Get contextual copy/messaging based on time
 */
export function getContextualCopy(context: TimeContext): {
  healthSubtitle: string;
  trainingSubtitle: string;
  nutritionSubtitle: string;
  planningSubtitle: string;
} {
  const { period, isPreWorkout, isPostWorkout } = context;

  let healthSubtitle = 'Your vitals';
  let trainingSubtitle = 'This week';
  let nutritionSubtitle = 'Fuel your day';
  let planningSubtitle = 'Your focus';

  if (period === 'early_morning' || period === 'morning') {
    healthSubtitle = 'How you recovered';
    trainingSubtitle = isPreWorkout ? 'Ready for your run' : 'Today\'s training';
    nutritionSubtitle = isPreWorkout ? 'Pre-run fuel' : 'Start your day right';
    planningSubtitle = 'Today\'s priorities';
  }

  if (isPostWorkout) {
    healthSubtitle = 'Post-workout recovery';
    trainingSubtitle = 'Great effort';
    nutritionSubtitle = 'Recovery nutrition';
  }

  if (period === 'midday') {
    healthSubtitle = 'Midday check-in';
    nutritionSubtitle = 'Lunch time';
  }

  if (period === 'afternoon') {
    trainingSubtitle = 'Training progress';
    nutritionSubtitle = 'Afternoon energy';
    planningSubtitle = 'Remaining tasks';
  }

  if (period === 'evening') {
    healthSubtitle = 'Today\'s summary';
    trainingSubtitle = 'Today\'s activity';
    nutritionSubtitle = 'Evening nutrition';
    planningSubtitle = 'Tomorrow\'s prep';
  }

  if (period === 'night') {
    healthSubtitle = 'Wind down';
    planningSubtitle = 'Set up tomorrow';
  }

  return { healthSubtitle, trainingSubtitle, nutritionSubtitle, planningSubtitle };
}
