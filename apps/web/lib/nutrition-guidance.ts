/**
 * Dynamic nutrition guidance based on workout characteristics
 * 
 * Provides personalized pre-run nutrition, during-run fueling, and hydration
 * recommendations based on workout type, distance, and intensity.
 */

export interface WorkoutNutritionInput {
  workoutType: string; // 'run', 'strength', etc.
  title: string; // Full title like "Week 15 — Tue: 7 mi Marathon Pace @ 6:30"
  prescribedDistanceMiles: number | null;
  prescribedDescription: string | null;
  prescribedPacePerMile: string | null;
  plannedDurationMinutes: number | null;
}

export interface NutritionGuidance {
  preRun: {
    title: string;
    description: string;
    calories: string;
    timing: string;
  };
  duringRun: {
    title: string;
    description: string;
    needed: boolean;
  };
  hydration: {
    title: string;
    preRun: string;
    duringRun: string;
    postRun: string;
  };
}

type WorkoutIntensity = 'easy' | 'moderate' | 'hard' | 'very_hard';
type WorkoutCategory = 'easy' | 'tempo' | 'threshold' | 'intervals' | 'long' | 'marathon_pace' | 'race';

/**
 * Determine workout category from title and description
 */
function categorizeWorkout(input: WorkoutNutritionInput): WorkoutCategory {
  const title = (input.title || '').toLowerCase();
  const desc = (input.prescribedDescription || '').toLowerCase();
  const combined = `${title} ${desc}`;
  
  // Check for specific workout types
  if (/marathon\s*pace|mp\s*run|mp\s*@/i.test(combined)) return 'marathon_pace';
  if (/interval|repeat|×|x\d+/i.test(combined)) return 'intervals';
  if (/threshold|lt\s*run|lactate/i.test(combined)) return 'threshold';
  if (/tempo/i.test(combined)) return 'tempo';
  if (/long\s*run|progressive.*long/i.test(combined)) return 'long';
  if (/race|5k|10k|half|marathon/i.test(combined) && /race|goal/i.test(combined)) return 'race';
  
  // Default based on distance
  const distance = input.prescribedDistanceMiles || 0;
  if (distance >= 12) return 'long';
  if (distance >= 8) return 'moderate' as unknown as WorkoutCategory; // Will be treated as easy with longer distance
  
  return 'easy';
}

/**
 * Determine intensity level
 */
function getIntensity(category: WorkoutCategory): WorkoutIntensity {
  switch (category) {
    case 'easy': return 'easy';
    case 'long': return 'moderate';
    case 'tempo':
    case 'threshold':
    case 'marathon_pace': return 'hard';
    case 'intervals':
    case 'race': return 'very_hard';
    default: return 'easy';
  }
}

/**
 * Generate nutrition guidance based on workout characteristics
 */
export function generateNutritionGuidance(input: WorkoutNutritionInput): NutritionGuidance {
  const category = categorizeWorkout(input);
  const intensity = getIntensity(category);
  const distance = input.prescribedDistanceMiles || 0;
  const duration = input.plannedDurationMinutes || (distance * 8); // Estimate ~8 min/mile if not specified
  
  // Pre-run nutrition varies by intensity and distance
  const preRun = getPreRunGuidance(category, intensity, distance, duration);
  
  // During-run fueling needed for longer/harder efforts
  const duringRun = getDuringRunGuidance(category, distance, duration);
  
  // Hydration based on duration and intensity
  const hydration = getHydrationGuidance(intensity, duration);
  
  return { preRun, duringRun, hydration };
}

function getPreRunGuidance(
  category: WorkoutCategory, 
  intensity: WorkoutIntensity, 
  distance: number,
  duration: number
): NutritionGuidance['preRun'] {
  
  // Very hard efforts (intervals, races)
  if (intensity === 'very_hard') {
    return {
      title: 'Pre-Run Nutrition',
      description: 'Easily digestible carbs 2-3 hours before. Avoid high fiber/fat. Consider a small snack (banana, gel) 30 min before if needed.',
      calories: '400-500 calories',
      timing: '2-3 hours before, small top-up 30 min before',
    };
  }
  
  // Hard efforts (tempo, threshold, MP)
  if (intensity === 'hard') {
    if (category === 'marathon_pace') {
      return {
        title: 'Pre-Run Nutrition',
        description: 'This is a quality session at goal race pace. Fuel like a mini race-day rehearsal: oatmeal, banana, honey, or toast with jam. Keep it familiar.',
        calories: '350-450 calories',
        timing: '2-2.5 hours before',
      };
    }
    return {
      title: 'Pre-Run Nutrition',
      description: 'Moderate carb meal to fuel this quality session. Oatmeal with banana, toast with honey, or a bagel with light peanut butter.',
      calories: '350-400 calories', 
      timing: '2 hours before',
    };
  }
  
  // Moderate (long runs)
  if (category === 'long' || distance >= 12) {
    return {
      title: 'Pre-Run Nutrition',
      description: 'Substantial but familiar breakfast. Oatmeal with banana and honey, or toast with peanut butter and jam. This is your fuel for a big effort.',
      calories: '400-500 calories',
      timing: '2-3 hours before',
    };
  }
  
  // Moderate distance (8-12 miles)
  if (distance >= 8) {
    return {
      title: 'Pre-Run Nutrition',
      description: 'Light to moderate breakfast. Oatmeal with banana, or toast with peanut butter. Enough to sustain the effort without feeling heavy.',
      calories: '300-400 calories',
      timing: '1.5-2 hours before',
    };
  }
  
  // Easy/short runs
  return {
    title: 'Pre-Run Nutrition',
    description: 'Light snack or small breakfast. Banana, toast with honey, or a small bowl of oatmeal. Nothing heavy needed for an easy effort.',
    calories: '200-300 calories',
    timing: '1-1.5 hours before (or fasted if preferred)',
  };
}

function getDuringRunGuidance(
  category: WorkoutCategory,
  distance: number,
  duration: number
): NutritionGuidance['duringRun'] {
  
  // Races (except short ones)
  if (category === 'race' && distance > 10) {
    return {
      title: 'Run Fueling',
      description: 'Race fueling protocol: gel or chews every 30-45 min starting at mile 4-5. Practice your race-day nutrition strategy.',
      needed: true,
    };
  }
  
  // Long runs 16+ miles
  if (distance >= 16) {
    return {
      title: 'Run Fueling',
      description: 'Take a gel or chews every 45-60 min (or every 5-6 miles). Start fueling around mile 5-6 before glycogen depletes. This mimics race-day fueling.',
      needed: true,
    };
  }
  
  // Long runs 12-16 miles
  if (distance >= 12) {
    return {
      title: 'Run Fueling',
      description: 'Consider a gel or chews around mile 8-10 if running over 90 minutes. Good opportunity to practice race nutrition.',
      needed: true,
    };
  }
  
  // Marathon pace runs - always recommend practicing race nutrition
  if (category === 'marathon_pace') {
    if (duration >= 50 || distance >= 6) {
      return {
        title: 'Run Fueling',
        description: 'Use this as race-day rehearsal. Take a gel at the midpoint or around 40-45 minutes in. Practice with the same products you\'ll use on race day.',
        needed: true,
      };
    }
    // Shorter MP runs (5mi or less)
    return {
      title: 'Run Fueling',
      description: 'Optional but recommended: practice taking a gel during MP efforts to rehearse race-day nutrition, even if not strictly needed for this distance.',
      needed: false,
    };
  }
  
  // Tempo/threshold runs over 45 min
  if ((category === 'tempo' || category === 'threshold') && duration >= 45) {
    return {
      title: 'Run Fueling',
      description: 'Optional: a gel midway through can help maintain quality in the final segment. Good opportunity to practice fueling under effort.',
      needed: false,
    };
  }
  
  // 8-12 mile moderate runs over 75 min
  if (distance >= 8 && duration >= 75) {
    return {
      title: 'Run Fueling',
      description: 'Optional: a gel or small snack if running over 75 minutes, especially if you didn\'t eat much beforehand.',
      needed: false,
    };
  }
  
  // Everything else
  return {
    title: 'Run Fueling',
    description: 'No fueling needed during this run. Your glycogen stores are sufficient for the duration.',
    needed: false,
  };
}

function getHydrationGuidance(
  intensity: WorkoutIntensity,
  duration: number
): NutritionGuidance['hydration'] {
  
  // Very hard/hard efforts or long duration
  if (intensity === 'very_hard' || duration >= 90) {
    return {
      title: 'Hydration',
      preRun: '16-20oz water in the 2 hours before',
      duringRun: 'Small sips every 15-20 min if carrying water, or plan a hydration stop',
      postRun: '20-24oz with electrolytes within 30 min of finishing',
    };
  }
  
  if (intensity === 'hard' || duration >= 60) {
    return {
      title: 'Hydration',
      preRun: '12-16oz water 1-2 hours before',
      duringRun: 'Water if available, especially in warm conditions',
      postRun: '16-20oz with electrolytes post run',
    };
  }
  
  // Moderate duration (45-60 min)
  if (duration >= 45) {
    return {
      title: 'Hydration',
      preRun: '8-12oz water before heading out',
      duringRun: 'Not required unless hot/humid conditions',
      postRun: '16-20oz water or electrolyte drink',
    };
  }
  
  // Short easy runs
  return {
    title: 'Hydration',
    preRun: '8oz water if desired',
    duringRun: 'Not needed for short easy runs',
    postRun: '12-16oz water to rehydrate',
  };
}

/**
 * Get a concise summary for the today card UI
 */
export function getNutritionSummary(input: WorkoutNutritionInput): {
  preRun: string;
  duringRun: string;
  hydration: string;
} {
  const guidance = generateNutritionGuidance(input);
  
  return {
    preRun: `${guidance.preRun.description} ${guidance.preRun.calories}, ${guidance.preRun.timing}.`,
    duringRun: guidance.duringRun.description,
    hydration: `${guidance.hydration.preRun}. ${guidance.hydration.postRun}.`,
  };
}

