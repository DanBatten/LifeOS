-- Fix the Tuesday Dec 23 workout with correct data
UPDATE workouts 
SET 
    prescribed_pace_per_mile = '8:00-8:15/mi',
    prescribed_description = '6 mi easy run at conversational pace. Recovery from yesterday''s tempo effort. HR 130-145 bpm.'
WHERE scheduled_date = '2025-12-23'
  AND workout_type = 'run';

-- Also ensure Monday Dec 22 has the correct marathon pace workout data
UPDATE workouts 
SET 
    prescribed_pace_per_mile = '6:30-6:35/mi',
    prescribed_description = '2 mi WU → 6 mi @ 6:30-6:35/mi (MARATHON PACE) → 1 mi CD. 6-mile MP effort, simulates mid-race rhythm. HR 165-172 bpm.'
WHERE scheduled_date = '2025-12-22'
  AND workout_type = 'run';
