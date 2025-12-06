-- ============================================
-- Marathon Training Plan Import (CORRECTED)
-- Run this in Supabase SQL Editor
-- ============================================

DO $$
DECLARE
    v_user_id UUID := '00000000-0000-0000-0000-000000000001';
    v_plan_id UUID;
    v_phase_base UUID;
    v_phase_endurance UUID;
    v_phase_specificity UUID;
    v_phase_marathon UUID;
BEGIN

-- ============================================
-- 1. CREATE TRAINING PLAN
-- ============================================
INSERT INTO training_plans (
    user_id, name, description, sport, goal_event, 
    goal_time_seconds, goal_pace_per_mile_seconds,
    start_date, end_date, total_weeks, status
) VALUES (
    v_user_id,
    'LA Marathon 2026 - Sub 2:55',
    'Build aerobic base, develop marathon-specific endurance, peak with race-pace confidence',
    'running',
    'LA Marathon 2026',
    10500,  -- 2:55:00 in seconds
    400,    -- 6:40/mi in seconds
    '2025-09-29',
    '2026-01-18',
    16,
    'active'
) RETURNING id INTO v_plan_id;

RAISE NOTICE 'Created training plan: %', v_plan_id;

-- ============================================
-- 2. CREATE PHASES
-- ============================================
INSERT INTO training_phases (plan_id, name, description, phase_type, start_week, end_week, start_date, end_date, focus_areas, weekly_volume_target_miles)
VALUES (v_plan_id, 'October – Base Build', 'Build aerobic foundation', 'base', 1, 4, '2025-09-29', '2025-10-26', ARRAY['aerobic_base'], 25)
RETURNING id INTO v_phase_base;

INSERT INTO training_phases (plan_id, name, description, phase_type, start_week, end_week, start_date, end_date, focus_areas, weekly_volume_target_miles)
VALUES (v_plan_id, 'November – Endurance Build', 'Increase long run distance, tempo work', 'build', 5, 8, '2025-10-27', '2025-11-23', ARRAY['endurance'], 30)
RETURNING id INTO v_phase_endurance;

INSERT INTO training_phases (plan_id, name, description, phase_type, start_week, end_week, start_date, end_date, focus_areas, weekly_volume_target_miles)
VALUES (v_plan_id, 'December – Pre-Marathon Specificity', 'Marathon pace work, peak long runs', 'peak', 9, 12, '2025-11-24', '2025-12-21', ARRAY['marathon_pace'], 35)
RETURNING id INTO v_phase_specificity;

INSERT INTO training_phases (plan_id, name, description, phase_type, start_week, end_week, start_date, end_date, focus_areas, weekly_volume_target_miles)
VALUES (v_plan_id, 'January – Transition to Marathon Block', 'Taper and sharpen', 'taper', 13, 16, '2025-12-22', '2026-01-18', ARRAY['taper'], 30)
RETURNING id INTO v_phase_marathon;

-- ============================================
-- WEEK 1
-- ============================================

-- Week 1 - Mon: 20 min tempo
INSERT INTO workouts (
    user_id, plan_id, phase_id, title, workout_type, scheduled_date, status,
    prescribed_distance_miles, actual_duration_minutes, prescribed_pace_per_mile,
    avg_heart_rate, max_heart_rate, elevation_gain_ft,
    prescribed_description, coach_notes,
    splits, week_number, day_of_week
) VALUES (
    v_user_id, v_plan_id, v_phase_base,
    'Week 1 — Mon: 20 min tempo @ 6:35/mi',
    'run', '2025-09-29', 'completed',
    5.27, 38, '7:15/mi', 145, 157, 233,
    '2 mi WU → 20 min @ 6:30-6:35/mi (marathon pace) → 1 mi CD. HR 165-172 bpm.',
    'What a way to kick off Week 1! This tempo run was supposed to be marathon pace work (6:30-6:35/mi), but you executed it more like a true threshold workout—and crushed it. Your tempo segment (miles 3-5) averaged 6:31/mi with a beautiful negative split: 6:48, 6:29, 6:17. That final mile at 6:17/mi while coming down the hill shows you''ve got serious leg speed and control.

Here''s what''s impressive: You hit this pace with an average HR of just 145 bpm during the tempo portion (peaking at 157 on mile 3). For context, your prescribed marathon pace HR zone is 165-172 bpm, which means you were running 4-5 seconds per mile faster than goal marathon pace while staying 15-20 bpm BELOW the target HR zone. This tells me two things: (1) Your aerobic fitness is very strong, and (2) 6:30-6:35/mi is likely conservative for your marathon capability.

The workout structure was smart: 2-mile warmup (8:25, 7:52) got your HR gradually climbing, then you settled into the tempo work. The elevation profile (+233 ft total) added challenge, but you handled it with confidence.

The fact that you felt strong throughout and finished faster than you started is exactly what we want to see. Your body is responding well to structured training right from the start of this 16-week block.',
    '[{"mile": 1, "pace": "8:25/mi", "elevation": "+60 ft", "avg_hr": 132},
      {"mile": 2, "pace": "7:52/mi", "elevation": "-21 ft", "avg_hr": 142},
      {"mile": 3, "pace": "6:48/mi", "elevation": "+61 ft", "avg_hr": 157},
      {"mile": 4, "pace": "6:29/mi", "elevation": "-38 ft", "avg_hr": 154},
      {"mile": 5, "pace": "6:17/mi", "elevation": "-87 ft", "avg_hr": 147}]'::jsonb,
    1, 1
);

-- Week 1 - Wed: 5 mi easy
INSERT INTO workouts (
    user_id, plan_id, phase_id, title, workout_type, scheduled_date, status,
    prescribed_distance_miles, actual_duration_minutes, prescribed_pace_per_mile,
    avg_heart_rate, max_heart_rate, elevation_gain_ft,
    prescribed_description, coach_notes,
    splits, week_number, day_of_week
) VALUES (
    v_user_id, v_plan_id, v_phase_base,
    'Week 1 — Wed: 5 mi easy @ 8:00/mi',
    'run', '2025-10-01', 'completed',
    5.24, 42, '7:59/mi', 147, 158, 259,
    'Easy @ 8:00/mi',
    'Textbook easy run—this is exactly what recovery days should look like. You ran 5.24 miles at 7:59/mi average with +259 ft of elevation gain, and your HR stayed beautifully controlled at 147 bpm average.

What stands out is the contrast with Monday''s tempo. On Monday, you averaged 145 bpm while running 6:31/mi. Today, you averaged 147 bpm while running 7:59/mi—nearly 90 seconds per mile slower. That''s exactly the HR-to-pace control we want. You''re genuinely recovering and letting your aerobic system adapt.

Two days into Week 1, you''re showing excellent training discipline: hard efforts on hard days, truly easy efforts on easy days.',
    '[{"mile": 1, "pace": "8:21/mi", "elevation": "+54 ft", "avg_hr": 135},
      {"mile": 2, "pace": "7:56/mi", "elevation": "-14 ft", "avg_hr": 148},
      {"mile": 3, "pace": "7:50/mi", "elevation": "+53 ft", "avg_hr": 158},
      {"mile": 4, "pace": "7:39/mi", "elevation": "-30 ft", "avg_hr": 149},
      {"mile": 5, "pace": "7:51/mi", "elevation": "-91 ft", "avg_hr": 144}]'::jsonb,
    1, 3
);

-- Week 1 - Fri: 4 mi easy + strides
INSERT INTO workouts (
    user_id, plan_id, phase_id, title, workout_type, scheduled_date, status,
    prescribed_distance_miles, actual_duration_minutes, prescribed_pace_per_mile,
    avg_heart_rate,
    prescribed_description, personal_notes, coach_notes,
    splits, week_number, day_of_week
) VALUES (
    v_user_id, v_plan_id, v_phase_base,
    'Week 1 — Fri: 4 mi easy + strides',
    'run', '2025-10-03', 'completed',
    4.68, 36, '7:45/mi', 150,
    '4 mi easy + 6×20s strides',
    'Bad sleep so felt a little sluggish. I generally have a hard time running around 8min or slower. Going into strides at the end I felt better',
    'Good job getting the run in despite poor sleep. Your splits show you managed steady effort, with the last 0.7 mi picking up nicely (6:52 pace). The fact you felt better going into strides suggests you warmed up properly. Keep monitoring sleep quality - it''s crucial for recovery and adaptation.',
    '[{"mile": 1, "pace": "8:05/mi", "elevation": "+88 ft", "avg_hr": 134},
      {"mile": 2, "pace": "7:46/mi", "elevation": "+28 ft", "avg_hr": 156},
      {"mile": 3, "pace": "7:42/mi", "elevation": "-30 ft", "avg_hr": 155},
      {"mile": 4, "pace": "7:40/mi", "elevation": "-61 ft", "avg_hr": 152}]'::jsonb,
    1, 5
);

-- Week 1 - Sat: 10 mi long run
INSERT INTO workouts (
    user_id, plan_id, phase_id, title, workout_type, scheduled_date, status,
    prescribed_distance_miles, actual_duration_minutes, prescribed_pace_per_mile,
    avg_heart_rate, max_heart_rate, elevation_gain_ft,
    prescribed_description, personal_notes, coach_notes,
    fueling_pre, fueling_during,
    splits, week_number, day_of_week
) VALUES (
    v_user_id, v_plan_id, v_phase_base,
    'Week 1 — Sat: 10 mi long run @ 8:00/mi',
    'run', '2025-10-04', 'completed',
    10.01, 77, '7:40/mi', 155, 167, 545,
    'Long run @ 8:00/mi',
    'Huma gel prior, Huma 24mg caffeine mile 4, Huma 24mg caffeine mile 7. Struggle to feel comfortable at a slower pace. Feel much better at 7:30 and that feels easy. Second half felt much better than the first half. Legs feel strong',
    'Excellent Week 1 long run! You ran 10.01 miles at 7:40/mi avg (20 sec/mi faster than target) with +545 ft of climbing. Your avg HR of 155 bpm put you right in the aerobic sweet spot (Zone 2-3).

Your negative split execution was textbook. You started conservatively (8:13 first mile, HR 138) and progressively found your rhythm. Miles 6-10 averaged 7:29/mi—that''s where your natural comfortable pace lives.

Your personal notes are gold: You''re right that 7:30-7:40/mi feels more natural than forcing 8:00/mi. At your fitness level (6:14/mi LT), trying to run "slow" at 8:00/mi actually requires MORE effort because you''re fighting your natural stride rhythm.

Week 1 complete: 19+ miles in the bank with a strong tempo run and this quality long run. You''re off to a great start.',
    '{"gel": "Huma regular"}'::jsonb,
    '{"gels": ["Huma 24mg caffeine at mile 4", "Huma 24mg caffeine at mile 7"]}'::jsonb,
    '[{"mile": 1, "pace": "8:13/mi", "elevation": "+67 ft", "avg_hr": 138},
      {"mile": 2, "pace": "7:52/mi", "elevation": "-14 ft", "avg_hr": 140},
      {"mile": 3, "pace": "7:36/mi", "elevation": "+27 ft", "avg_hr": 153},
      {"mile": 4, "pace": "7:47/mi", "elevation": "+132 ft", "avg_hr": 164},
      {"mile": 5, "pace": "7:38/mi", "elevation": "-63 ft", "avg_hr": 161},
      {"mile": 6, "pace": "7:21/mi", "elevation": "-101 ft", "avg_hr": 149},
      {"mile": 7, "pace": "7:33/mi", "elevation": "+3 ft", "avg_hr": 160},
      {"mile": 8, "pace": "7:27/mi", "elevation": "-39 ft", "avg_hr": 159},
      {"mile": 9, "pace": "7:28/mi", "elevation": "-52 ft", "avg_hr": 155},
      {"mile": 10, "pace": "7:35/mi", "elevation": "+9 ft", "avg_hr": 167}]'::jsonb,
    1, 6
);

-- ============================================
-- WEEK 2
-- ============================================

-- Week 2 - Mon: 6 mi progression
INSERT INTO workouts (
    user_id, plan_id, phase_id, title, workout_type, scheduled_date, status,
    prescribed_distance_miles, actual_duration_minutes, prescribed_pace_per_mile,
    avg_heart_rate, elevation_gain_ft,
    prescribed_description, personal_notes, coach_notes,
    splits, week_number, day_of_week
) VALUES (
    v_user_id, v_plan_id, v_phase_base,
    'Week 2 — Mon: 6 mi progression (finish @ 6:30/mi)',
    'run', '2025-10-06', 'completed',
    6.22, 44, '7:06/mi', 145, 90,
    '6 mi progression: Start @ 8:00/mi, build to last 2 miles @ 6:30/mi (marathon pace).',
    'Had a good sleep which I think helped. First mile sluggish but then got into a really good rhythm. HR felt really controlled. Paced a little faster for the MP miles but was feeling really comfortable.',
    'This was a well-executed progression run. You nailed the structure: started conservative at 8:10/mi, built smoothly, and finished with miles 5-6 averaging 6:27/mi — slightly faster than the 6:30/mi target.

Your HR control was excellent. Average of 145 bpm for a 7:06/mi average pace indicates strong aerobic efficiency. The fact that your final two MP miles (6:23, 6:30) came at HR 141-140 is impressive — that''s 4-5 bpm LOWER than your mid-run HR despite running 60-70 seconds/mile faster. You''re hitting MP effort well within your aerobic capacity.',
    '[{"mile": 1, "pace": "8:10/mi", "elevation": "+35 ft", "avg_hr": 142},
      {"mile": 2, "pace": "8:03/mi", "elevation": "-17 ft", "avg_hr": 143},
      {"mile": 3, "pace": "7:40/mi", "elevation": "+21 ft", "avg_hr": 152},
      {"mile": 4, "pace": "7:08/mi", "elevation": "+7 ft", "avg_hr": 148},
      {"mile": 5, "pace": "6:23/mi", "elevation": "-25 ft", "avg_hr": 141},
      {"mile": 6, "pace": "6:30/mi", "elevation": "-13 ft", "avg_hr": 140}]'::jsonb,
    2, 1
);

-- Week 2 - Wed: 6 mi easy
INSERT INTO workouts (
    user_id, plan_id, phase_id, title, workout_type, scheduled_date, status,
    prescribed_distance_miles, actual_duration_minutes, prescribed_pace_per_mile,
    avg_heart_rate, max_heart_rate, elevation_gain_ft, pre_workout_resting_hr,
    prescribed_description, personal_notes, coach_notes,
    splits, week_number, day_of_week
) VALUES (
    v_user_id, v_plan_id, v_phase_base,
    'Week 2 — Wed: 6 mi easy',
    'run', '2025-10-08', 'completed',
    6.01, 47, '7:47/mi', 154, 176, 92, 53,
    'Easy',
    'Slept well but felt sluggish. Struggled to regulate HR and didn''t get into a good rhythm until the last few miles. Still struggling with slower paces.',
    'This run reveals why you felt sluggish — your average HR of 154 bpm at 7:47/mi pace is 9 bpm higher than Monday''s progression run where you averaged 145 bpm at 7:06/mi. Classic fatigue signature.

Your resting HR was 53 bpm vs baseline 48 bpm. That''s a 5 bpm elevation signaling your autonomic nervous system is still processing Monday''s workout.

Recovery isn''t optional — it''s where fitness is built.',
    '[{"mile": 1, "pace": "8:23/mi", "elevation": "+36 ft", "avg_hr": 132},
      {"mile": 2, "pace": "8:02/mi", "elevation": "-4 ft", "avg_hr": 148},
      {"mile": 3, "pace": "7:41/mi", "elevation": "+25 ft", "avg_hr": 170},
      {"mile": 4, "pace": "7:38/mi", "elevation": "+1 ft", "avg_hr": 158},
      {"mile": 5, "pace": "7:28/mi", "elevation": "-19 ft", "avg_hr": 157},
      {"mile": 6, "pace": "7:31/mi", "elevation": "-13 ft", "avg_hr": 164}]'::jsonb,
    2, 3
);

-- Week 2 - Fri: 4 mi easy
INSERT INTO workouts (
    user_id, plan_id, phase_id, title, workout_type, scheduled_date, status,
    prescribed_distance_miles, actual_duration_minutes, prescribed_pace_per_mile,
    avg_heart_rate, max_heart_rate, elevation_gain_ft, pre_workout_resting_hr,
    training_load, training_effect_aerobic,
    prescribed_description, personal_notes, coach_notes,
    splits, week_number, day_of_week
) VALUES (
    v_user_id, v_plan_id, v_phase_base,
    'Week 2 — Fri: 4 mi easy',
    'run', '2025-10-10', 'completed',
    4.15, 33, '8:01/mi', 147, 169, 67, 49, 116, 3.4,
    'Easy',
    'Run felt really good and easy, legs felt great, cardio felt great. Pacing and HR stayed pretty consistent',
    'Perfect easy recovery run. You ran 4.15 miles at 8:01/mi with HR 147 bpm — textbook Zone 2 aerobic work.

Key comparison to Wednesday: you averaged 154 bpm at 7:47/mi pace and felt sluggish. Today, you ran slightly slower (8:01/mi) with 7 bpm lower HR (147 vs 154) and felt great. 48-hour recovery makes all the difference.

Resting HR at 49 bpm is just 1 bpm above baseline (much better than Wednesday''s 53 bpm). Sunday''s 11-mile long run is set up for success.',
    '[{"mile": 1, "pace": "8:13/mi", "elevation": "+35 ft", "avg_hr": 137},
      {"mile": 2, "pace": "7:58/mi", "elevation": "+17 ft", "avg_hr": 150},
      {"mile": 3, "pace": "7:53/mi", "elevation": "-28 ft", "avg_hr": 146},
      {"mile": 4, "pace": "7:56/mi", "elevation": "+8 ft", "avg_hr": 153}]'::jsonb,
    2, 5
);

-- Week 2 - Sun: 11 mi long run
INSERT INTO workouts (
    user_id, plan_id, phase_id, title, workout_type, scheduled_date, status,
    prescribed_distance_miles, actual_duration_minutes, prescribed_pace_per_mile,
    avg_heart_rate, max_heart_rate, elevation_gain_ft, pre_workout_resting_hr,
    training_load, training_effect_aerobic,
    prescribed_description, personal_notes, coach_notes,
    fueling_pre, fueling_during,
    splits, week_number, day_of_week
) VALUES (
    v_user_id, v_plan_id, v_phase_base,
    'Week 2 — Sun: 11 mi long run @ 7:30-7:50/mi',
    'run', '2025-10-12', 'completed',
    11.00, 85, '7:46/mi', 153, 173, 127, 52, 265, 4.9,
    'Long run @ 7:30-7:50/mi. Should feel comfortable and conversational.',
    'Felt great - bit of tightness in right calf and left thigh from hypervolt the night before. Huma gel before and double electrolyte 25mg caffeine at halfway. Best in second half after mile 5/6 - really get into gear. Could run much longer.',
    'Outstanding long run. 11 miles at 7:46/mi with 153 bpm HR is textbook aerobic development.

Your negative split execution was beautiful. Started at 8:04/mi (HR 124) and settled into 7:36-7:42/mi for miles 7-9. The fact that you felt stronger in the second half is a massive green flag — your aerobic system is robust.

HR data: average 153 bpm is 2 bpm lower than Week 1''s 10-miler (155 bpm) despite adding a mile. That''s measurable fitness adaptation in just 8 days.

Week 2 complete: 27 total miles with strong execution.',
    '{"gel": "Huma regular"}'::jsonb,
    '{"gels": ["Double electrolyte 25mg caffeine at halfway"]}'::jsonb,
    '[{"mile": 1, "pace": "8:04/mi", "elevation": "-21 ft", "avg_hr": 124},
      {"mile": 2, "pace": "7:51/mi", "elevation": "-16 ft", "avg_hr": 145},
      {"mile": 3, "pace": "7:38/mi", "elevation": "-11 ft", "avg_hr": 144},
      {"mile": 4, "pace": "7:38/mi", "elevation": "+2 ft", "avg_hr": 153},
      {"mile": 5, "pace": "7:41/mi", "elevation": "+16 ft", "avg_hr": 158},
      {"mile": 6, "pace": "7:46/mi", "elevation": "+19 ft", "avg_hr": 163},
      {"mile": 7, "pace": "7:42/mi", "elevation": "+1 ft", "avg_hr": 158},
      {"mile": 8, "pace": "7:39/mi", "elevation": "-18 ft", "avg_hr": 155},
      {"mile": 9, "pace": "7:36/mi", "elevation": "+0 ft", "avg_hr": 156},
      {"mile": 10, "pace": "7:50/mi", "elevation": "+19 ft", "avg_hr": 162},
      {"mile": 11, "pace": "7:53/mi", "elevation": "+20 ft", "avg_hr": 164}]'::jsonb,
    2, 7
);

RAISE NOTICE 'Weeks 1-2 imported! Plan ID: %', v_plan_id;

END $$;

-- Verify the import
SELECT 'Plan' as type, name, status FROM training_plans WHERE user_id = '00000000-0000-0000-0000-000000000001'
UNION ALL
SELECT 'Phase', name, phase_type FROM training_phases LIMIT 4;

SELECT COUNT(*) as workout_count FROM workouts WHERE user_id = '00000000-0000-0000-0000-000000000001';
