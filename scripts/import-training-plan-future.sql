-- ============================================
-- Marathon Training Plan Import - FUTURE/PLANNED WORKOUTS
-- Weeks 10 (Sun) through Week 16
-- ============================================

DO $$
DECLARE
    v_user_id UUID := '00000000-0000-0000-0000-000000000001';
    v_plan_id UUID;
    v_phase_specificity UUID;
BEGIN

SELECT id INTO v_plan_id FROM training_plans WHERE user_id = v_user_id AND name LIKE '%LA Marathon%' LIMIT 1;
SELECT id INTO v_phase_specificity FROM training_phases WHERE plan_id = v_plan_id AND phase_type = 'peak' LIMIT 1;

-- ============================================
-- WEEK 10 - Remaining (Sun)
-- ============================================

-- Week 10 - Sun: 16 mi Long (last 2 mi @ 6:30/mi)
INSERT INTO workouts (
    user_id, plan_id, phase_id, title, workout_type, scheduled_date, status,
    prescribed_distance_miles, prescribed_pace_per_mile, prescribed_description,
    week_number, day_of_week
) VALUES (
    v_user_id, v_plan_id, v_phase_specificity,
    'Week 10 — Sun: 16 mi Long (last 2 mi @ 6:30/mi)',
    'run', '2025-12-07', 'planned',
    16, '7:45-8:00/mi',
    '16 mi: 14 mi easy @ 7:45-8:00/mi + last 2 mi @ 6:30-6:35/mi (marathon pace). Peak long run, simulates miles 20-22.',
    10, 7
);

-- ============================================
-- WEEK 11 
-- ============================================

-- Week 11 - Mon: 35 min Threshold
INSERT INTO workouts (
    user_id, plan_id, phase_id, title, workout_type, scheduled_date, status,
    prescribed_distance_miles, prescribed_pace_per_mile, prescribed_hr_zone, prescribed_description,
    week_number, day_of_week
) VALUES (
    v_user_id, v_plan_id, v_phase_specificity,
    'Week 11 — Mon: 35 min Threshold @ 6:12/mi',
    'run', '2025-12-08', 'planned',
    7, '6:10-6:15/mi', '172-180 bpm',
    '2 mi WU → 35 min @ 6:10-6:15/mi (true threshold) → 1 mi CD. Peak threshold workout, raises your ceiling. HR 172-180 bpm.',
    11, 1
);

-- Week 11 - Wed: 6 mi easy
INSERT INTO workouts (
    user_id, plan_id, phase_id, title, workout_type, scheduled_date, status,
    prescribed_distance_miles, prescribed_pace_per_mile, prescribed_description,
    week_number, day_of_week
) VALUES (
    v_user_id, v_plan_id, v_phase_specificity,
    'Week 11 — Wed: 6 mi easy',
    'run', '2025-12-10', 'planned',
    6, '8:00-8:15/mi', 'Easy',
    11, 3
);

-- Week 11 - Fri: 4 mi easy
INSERT INTO workouts (
    user_id, plan_id, phase_id, title, workout_type, scheduled_date, status,
    prescribed_distance_miles, prescribed_pace_per_mile, prescribed_description,
    week_number, day_of_week
) VALUES (
    v_user_id, v_plan_id, v_phase_specificity,
    'Week 11 — Fri: 4 mi easy',
    'run', '2025-12-12', 'planned',
    4, '8:00-8:15/mi', 'Easy',
    11, 5
);

-- Week 11 - Sat: 15 mi long run
INSERT INTO workouts (
    user_id, plan_id, phase_id, title, workout_type, scheduled_date, status,
    prescribed_distance_miles, prescribed_pace_per_mile, prescribed_description,
    week_number, day_of_week
) VALUES (
    v_user_id, v_plan_id, v_phase_specificity,
    'Week 11 — Sat: 15 mi long run steady @ 8:00/mi',
    'run', '2025-12-13', 'planned',
    15, '8:00/mi', 'Steady long run @ 8:00/mi',
    11, 6
);

-- ============================================
-- WEEK 12
-- ============================================

-- Week 12 - Mon: 6 mi Progression
INSERT INTO workouts (
    user_id, plan_id, phase_id, title, workout_type, scheduled_date, status,
    prescribed_distance_miles, prescribed_pace_per_mile, prescribed_description,
    week_number, day_of_week
) VALUES (
    v_user_id, v_plan_id, v_phase_specificity,
    'Week 12 — Mon: 6 mi Progression (last 2 mi @ 6:30/mi)',
    'run', '2025-12-15', 'planned',
    6, '8:00 → 6:30/mi',
    '6 mi progression: Start @ 8:00/mi, last 2 mi @ 6:30/mi (marathon pace). Simulates late-race effort.',
    12, 1
);

-- Week 12 - Wed: 5 mi easy
INSERT INTO workouts (
    user_id, plan_id, phase_id, title, workout_type, scheduled_date, status,
    prescribed_distance_miles, prescribed_pace_per_mile, prescribed_description,
    week_number, day_of_week
) VALUES (
    v_user_id, v_plan_id, v_phase_specificity,
    'Week 12 — Wed: 5 mi easy',
    'run', '2025-12-17', 'planned',
    5, '8:00-8:15/mi', 'Easy',
    12, 3
);

-- Week 12 - Fri: 3 mi easy
INSERT INTO workouts (
    user_id, plan_id, phase_id, title, workout_type, scheduled_date, status,
    prescribed_distance_miles, prescribed_pace_per_mile, prescribed_description,
    week_number, day_of_week
) VALUES (
    v_user_id, v_plan_id, v_phase_specificity,
    'Week 12 — Fri: 3 mi easy',
    'run', '2025-12-19', 'planned',
    3, '8:00-8:15/mi', 'Easy',
    12, 5
);

-- Week 12 - Sun: 12 mi long run
INSERT INTO workouts (
    user_id, plan_id, phase_id, title, workout_type, scheduled_date, status,
    prescribed_distance_miles, prescribed_pace_per_mile, prescribed_description,
    week_number, day_of_week
) VALUES (
    v_user_id, v_plan_id, v_phase_specificity,
    'Week 12 — Sun: 12 mi long run @ 8:10/mi',
    'run', '2025-12-21', 'planned',
    12, '8:10/mi', 'Long run @ 8:10/mi',
    12, 7
);

-- ============================================
-- WEEK 13 (Transition Phase)
-- ============================================

-- Week 13 - Mon: 6 mi Marathon Pace
INSERT INTO workouts (
    user_id, plan_id, phase_id, title, workout_type, scheduled_date, status,
    prescribed_distance_miles, prescribed_pace_per_mile, prescribed_hr_zone, prescribed_description,
    week_number, day_of_week
) VALUES (
    v_user_id, v_plan_id, v_phase_specificity,
    'Week 13 — Mon: 6 mi Marathon Pace @ 6:30/mi',
    'run', '2025-12-22', 'planned',
    6, '6:30-6:35/mi', '165-172 bpm',
    '2 mi WU → 6 mi @ 6:30-6:35/mi (MARATHON PACE) → 1 mi CD. 6-mile MP effort, simulates mid-race rhythm. HR 165-172 bpm.',
    13, 1
);

-- Week 13 - Tue: 6 mi easy
INSERT INTO workouts (
    user_id, plan_id, phase_id, title, workout_type, scheduled_date, status,
    prescribed_distance_miles, prescribed_pace_per_mile, prescribed_description,
    week_number, day_of_week
) VALUES (
    v_user_id, v_plan_id, v_phase_specificity,
    'Week 13 — Tue: 6 mi easy',
    'run', '2025-12-23', 'planned',
    6, '8:00-8:15/mi', 
    '6 mi easy run at conversational pace. Recovery from yesterday''s tempo effort. HR 130-145 bpm.',
    13, 2
);

-- Week 13 - Wed: 6 mi easy
INSERT INTO workouts (
    user_id, plan_id, phase_id, title, workout_type, scheduled_date, status,
    prescribed_distance_miles, prescribed_pace_per_mile, prescribed_description,
    week_number, day_of_week
) VALUES (
    v_user_id, v_plan_id, v_phase_specificity,
    'Week 13 — Wed: 6 mi easy',
    'run', '2025-12-24', 'planned',
    6, '8:00-8:15/mi', 'Easy',
    13, 3
);

-- Week 13 - Fri: 5 mi easy + strides
INSERT INTO workouts (
    user_id, plan_id, phase_id, title, workout_type, scheduled_date, status,
    prescribed_distance_miles, prescribed_pace_per_mile, prescribed_description,
    week_number, day_of_week
) VALUES (
    v_user_id, v_plan_id, v_phase_specificity,
    'Week 13 — Fri: 5 mi easy + strides',
    'run', '2025-12-26', 'planned',
    5, '8:00-8:15/mi', '5 mi easy + strides',
    13, 5
);

-- Week 13 - Sat: 15 mi Long (last 3 mi @ 6:30/mi)
INSERT INTO workouts (
    user_id, plan_id, phase_id, title, workout_type, scheduled_date, status,
    prescribed_distance_miles, prescribed_pace_per_mile, prescribed_description,
    week_number, day_of_week
) VALUES (
    v_user_id, v_plan_id, v_phase_specificity,
    'Week 13 — Sat: 15 mi Long (last 3 mi @ 6:30/mi)',
    'run', '2025-12-27', 'planned',
    15, '7:45-8:00/mi → 6:30-6:35/mi',
    '15 mi: 12 mi easy @ 7:45-8:00/mi + last 3 mi @ 6:30-6:35/mi (marathon pace). Important race-specific workout.',
    13, 6
);

-- ============================================
-- WEEK 14
-- ============================================

-- Week 14 - Mon: 3×12 min Intervals
INSERT INTO workouts (
    user_id, plan_id, phase_id, title, workout_type, scheduled_date, status,
    prescribed_distance_miles, prescribed_pace_per_mile, prescribed_hr_zone, prescribed_description,
    week_number, day_of_week
) VALUES (
    v_user_id, v_plan_id, v_phase_specificity,
    'Week 14 — Mon: 3×12 min Intervals @ 6:12/mi',
    'run', '2025-12-29', 'planned',
    8, '6:10-6:15/mi', '172-180 bpm',
    '2 mi WU → 3×12 min @ 6:10-6:15/mi w/ 3 min jog → 1 mi CD. Long threshold intervals, marathon-specific endurance. HR 172-180 bpm.',
    14, 1
);

-- Week 14 - Wed: 6 mi easy
INSERT INTO workouts (
    user_id, plan_id, phase_id, title, workout_type, scheduled_date, status,
    prescribed_distance_miles, prescribed_pace_per_mile, prescribed_description,
    week_number, day_of_week
) VALUES (
    v_user_id, v_plan_id, v_phase_specificity,
    'Week 14 — Wed: 6 mi easy',
    'run', '2025-12-31', 'planned',
    6, '8:00-8:15/mi', 'Easy',
    14, 3
);

-- Week 14 - Fri: 4 mi easy
INSERT INTO workouts (
    user_id, plan_id, phase_id, title, workout_type, scheduled_date, status,
    prescribed_distance_miles, prescribed_pace_per_mile, prescribed_description,
    week_number, day_of_week
) VALUES (
    v_user_id, v_plan_id, v_phase_specificity,
    'Week 14 — Fri: 4 mi easy',
    'run', '2026-01-02', 'planned',
    4, '8:00-8:15/mi', 'Easy',
    14, 5
);

-- Week 14 - Sun: 16 mi long run steady
INSERT INTO workouts (
    user_id, plan_id, phase_id, title, workout_type, scheduled_date, status,
    prescribed_distance_miles, prescribed_pace_per_mile, prescribed_description,
    week_number, day_of_week
) VALUES (
    v_user_id, v_plan_id, v_phase_specificity,
    'Week 14 — Sun: 16 mi long run steady @ 8:00/mi',
    'run', '2026-01-04', 'planned',
    16, '8:00/mi', 'Steady long run @ 8:00/mi',
    14, 7
);

-- ============================================
-- WEEK 15
-- ============================================

-- Week 15 - Mon: 7 mi Marathon Pace
INSERT INTO workouts (
    user_id, plan_id, phase_id, title, workout_type, scheduled_date, status,
    prescribed_distance_miles, prescribed_pace_per_mile, prescribed_hr_zone, prescribed_description,
    week_number, day_of_week
) VALUES (
    v_user_id, v_plan_id, v_phase_specificity,
    'Week 15 — Mon: 7 mi Marathon Pace @ 6:30/mi',
    'run', '2026-01-05', 'planned',
    7, '6:30-6:35/mi', '165-172 bpm',
    '2 mi WU → 7 mi @ 6:30-6:35/mi (MARATHON PACE) → 1 mi CD. Peak MP volume, proves you can hold goal pace deep into marathon.',
    15, 1
);

-- Week 15 - Wed: 6 mi easy
INSERT INTO workouts (
    user_id, plan_id, phase_id, title, workout_type, scheduled_date, status,
    prescribed_distance_miles, prescribed_pace_per_mile, prescribed_description,
    week_number, day_of_week
) VALUES (
    v_user_id, v_plan_id, v_phase_specificity,
    'Week 15 — Wed: 6 mi easy',
    'run', '2026-01-07', 'planned',
    6, '8:00-8:15/mi', 'Easy',
    15, 3
);

-- Week 15 - Fri: 5 mi easy
INSERT INTO workouts (
    user_id, plan_id, phase_id, title, workout_type, scheduled_date, status,
    prescribed_distance_miles, prescribed_pace_per_mile, prescribed_description,
    week_number, day_of_week
) VALUES (
    v_user_id, v_plan_id, v_phase_specificity,
    'Week 15 — Fri: 5 mi easy',
    'run', '2026-01-09', 'planned',
    5, '8:00-8:15/mi', 'Easy',
    15, 5
);

-- Week 15 - Sat: 16 mi Long (MONSTER WORKOUT)
INSERT INTO workouts (
    user_id, plan_id, phase_id, title, workout_type, scheduled_date, status,
    prescribed_distance_miles, prescribed_pace_per_mile, prescribed_description,
    week_number, day_of_week
) VALUES (
    v_user_id, v_plan_id, v_phase_specificity,
    'Week 15 — Sat: 16 mi Long (10 easy + 5 @ MP + 1 easy)',
    'run', '2026-01-10', 'planned',
    16, '7:45-8:00/mi → 6:30-6:35/mi',
    '16 mi: 10 mi easy @ 7:45-8:00/mi + 5 mi @ 6:30-6:35/mi (marathon pace) + 1 mi easy. MONSTER WORKOUT. If you nail this, you''re ready for 2:52-2:55.',
    15, 6
);

-- ============================================
-- WEEK 16 (Race Week)
-- ============================================

-- Week 16 - Mon: 6 mi Progression
INSERT INTO workouts (
    user_id, plan_id, phase_id, title, workout_type, scheduled_date, status,
    prescribed_distance_miles, prescribed_pace_per_mile, prescribed_description,
    week_number, day_of_week
) VALUES (
    v_user_id, v_plan_id, v_phase_specificity,
    'Week 16 — Mon: 6 mi Progression (last 2 mi @ 6:30/mi)',
    'run', '2026-01-12', 'planned',
    6, '8:00 → 6:30/mi',
    '6 mi progression: Start @ 8:00/mi, last 2 mi @ 6:30/mi (marathon pace). Taper week sharpener, keeps legs fresh.',
    16, 1
);

-- Week 16 - Wed: 5 mi easy
INSERT INTO workouts (
    user_id, plan_id, phase_id, title, workout_type, scheduled_date, status,
    prescribed_distance_miles, prescribed_pace_per_mile, prescribed_description,
    week_number, day_of_week
) VALUES (
    v_user_id, v_plan_id, v_phase_specificity,
    'Week 16 — Wed: 5 mi easy',
    'run', '2026-01-14', 'planned',
    5, '8:00-8:15/mi', 'Easy',
    16, 3
);

-- Week 16 - Fri: 3 mi easy
INSERT INTO workouts (
    user_id, plan_id, phase_id, title, workout_type, scheduled_date, status,
    prescribed_distance_miles, prescribed_pace_per_mile, prescribed_description,
    week_number, day_of_week
) VALUES (
    v_user_id, v_plan_id, v_phase_specificity,
    'Week 16 — Fri: 3 mi easy',
    'run', '2026-01-16', 'planned',
    3, '8:00-8:15/mi', 'Easy',
    16, 5
);

-- Week 16 - Sun: 12 mi long run (FINAL LONG RUN)
INSERT INTO workouts (
    user_id, plan_id, phase_id, title, workout_type, scheduled_date, status,
    prescribed_distance_miles, prescribed_pace_per_mile, prescribed_description,
    week_number, day_of_week
) VALUES (
    v_user_id, v_plan_id, v_phase_specificity,
    'Week 16 — Sun: 12 mi long run @ 8:10/mi',
    'run', '2026-01-18', 'planned',
    12, '8:10/mi', 'Long run @ 8:10/mi - Final long run before race week taper.',
    16, 7
);

RAISE NOTICE 'Future workouts (Weeks 10-16) imported!';

END $$;

-- Verify totals
SELECT 
    status,
    COUNT(*) as count
FROM workouts 
WHERE user_id = '00000000-0000-0000-0000-000000000001'
GROUP BY status;

