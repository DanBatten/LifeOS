-- ============================================
-- Fix Truncated Workout Descriptions and Paces
-- Based on original training plan from Notion
-- ============================================

-- Week 15 — Mon: 7 mi Marathon Pace @ 6:30/mi (Jan 6, 2026)
UPDATE workouts 
SET 
    prescribed_pace_per_mile = '6:30-6:35/mi',
    prescribed_description = '2 mi WU → 7 mi @ 6:30-6:35/mi (MARATHON PACE) → 1 mi CD. Peak MP volume, proves you can hold goal pace deep into marathon. HR 165-172 bpm.',
    prescribed_hr_zone = '165-172 bpm'
WHERE scheduled_date = '2026-01-06' 
AND user_id = '00000000-0000-0000-0000-000000000001'
AND title LIKE '%7 mi Marathon Pace%';

-- Week 15 — Wed: 6 mi easy (Jan 8, 2026) - already OK

-- Week 15 — Fri: 5 mi easy (Jan 9, 2026) - already OK

-- Week 15 — Sat: 16 mi Long (10 easy + 5 @ MP + 1 easy) (Jan 11, 2026)
UPDATE workouts 
SET 
    prescribed_pace_per_mile = '7:45-8:00/mi → 6:30-6:35/mi',
    prescribed_description = '16 mi: 10 mi easy @ 7:45-8:00/mi + 5 mi @ 6:30-6:35/mi (marathon pace) + 1 mi easy. MONSTER WORKOUT. If you nail this, you''re ready for 2:52-2:55.'
WHERE scheduled_date = '2026-01-11' 
AND user_id = '00000000-0000-0000-0000-000000000001'
AND title LIKE '%16 mi Long%';

-- Week 16 — Mon: 6 mi Progression (last 2 mi @ 6:30/mi) (Jan 13, 2026)
UPDATE workouts 
SET 
    prescribed_pace_per_mile = '8:00/mi → 6:30/mi',
    prescribed_description = '6 mi progression: Start @ 8:00/mi, last 2 mi @ 6:30/mi (marathon pace). Taper week sharpener, keeps legs fresh.'
WHERE scheduled_date = '2026-01-13' 
AND user_id = '00000000-0000-0000-0000-000000000001'
AND title LIKE '%Progression%';

-- Week 16 — Sun: 12 mi long run @ 8:10/mi (Jan 18, 2026)
UPDATE workouts 
SET 
    prescribed_pace_per_mile = '8:10/mi',
    prescribed_description = 'Long run @ 8:10/mi - Final long run before race week taper.'
WHERE scheduled_date = '2026-01-18' 
AND user_id = '00000000-0000-0000-0000-000000000001'
AND title LIKE '%12 mi long run%';

-- Verify fixes
SELECT 
    scheduled_date,
    title,
    prescribed_pace_per_mile,
    prescribed_description
FROM workouts 
WHERE user_id = '00000000-0000-0000-0000-000000000001'
AND scheduled_date >= '2026-01-06'
ORDER BY scheduled_date;

