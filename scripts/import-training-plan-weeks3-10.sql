-- ============================================
-- Marathon Training Plan Import - WEEKS 3-10
-- Run this AFTER the initial import
-- ============================================

-- Get the plan and phase IDs
DO $$
DECLARE
    v_user_id UUID := '00000000-0000-0000-0000-000000000001';
    v_plan_id UUID;
    v_phase_base UUID;
    v_phase_endurance UUID;
    v_phase_specificity UUID;
BEGIN

-- Get existing plan ID
SELECT id INTO v_plan_id FROM training_plans WHERE user_id = v_user_id AND name LIKE '%LA Marathon%' LIMIT 1;
SELECT id INTO v_phase_base FROM training_phases WHERE plan_id = v_plan_id AND phase_type = 'base' LIMIT 1;
SELECT id INTO v_phase_endurance FROM training_phases WHERE plan_id = v_plan_id AND phase_type = 'build' LIMIT 1;
SELECT id INTO v_phase_specificity FROM training_phases WHERE plan_id = v_plan_id AND phase_type = 'peak' LIMIT 1;

RAISE NOTICE 'Using plan: %, base phase: %, endurance phase: %', v_plan_id, v_phase_base, v_phase_endurance;

-- ============================================
-- WEEK 3
-- ============================================

-- Week 3 - Mon: Intervals
INSERT INTO workouts (
    user_id, plan_id, phase_id, title, workout_type, scheduled_date, status,
    prescribed_distance_miles, actual_duration_minutes, prescribed_pace_per_mile,
    avg_heart_rate, max_heart_rate, elevation_gain_ft, training_load, training_effect_aerobic,
    prescribed_description, personal_notes, coach_notes,
    splits, week_number, day_of_week
) VALUES (
    v_user_id, v_plan_id, v_phase_base,
    'Week 3 — Mon: 3×8 min @ 6:10-6:20/mi (7 mi)',
    'run', '2025-10-13', 'completed',
    6.95, 52, '7:25/mi', 151, 170, 120, 176, 4.0,
    '2 mi WU → 3×8 min @ 6:10-6:20/mi w/ 3 min jog recovery → 1 mi CD. Threshold intervals. HR 175-185 bpm.',
    'Wearing Garmin HRM but HR didn''t match what I felt. First 2 intervals were uphill and felt hard (165-178 bpm felt). 3rd one felt great on downhill. Wish I had taken a gel.',
    'Solid execution of your first structured threshold interval session. You ran 3×8min at 6:15-6:20 pace, right in the prescribed 6:10-6:20 range.

The HR discrepancy you felt is real. The first two intervals were uphill, so your perceived exertion (165-178 bpm) was likely more accurate than what the chest strap recorded. Uphill running at threshold pace pushes you into VO2max territory.

The terrain made this workout harder than needed. Threshold intervals work best on flat ground. The uphill surges likely pushed you above true threshold into VO2max work, which costs more recovery.

You''re right that you should have fueled this workout. 52 minutes with 120ft elevation gain and three hard efforts is glycogen-demanding work. Take a gel 15-20 minutes before threshold sessions.

Good work getting it done. Your pacing discipline was solid.',
    '[{"mile": 1, "pace": "7:04/mi", "elevation": "+32 ft", "avg_hr": 136, "note": "warmup"},
      {"mile": 2, "pace": "7:39/mi", "elevation": "+9 ft", "avg_hr": 151, "note": "warmup"},
      {"mile": 3, "pace": "6:21/mi", "elevation": "+27 ft", "avg_hr": 154, "note": "interval 1"},
      {"mile": 4, "pace": "7:43/mi", "elevation": "+23 ft", "avg_hr": 161, "note": "recovery"},
      {"mile": 5, "pace": "6:51/mi", "elevation": "-37 ft", "avg_hr": 155, "note": "interval 2"}]'::jsonb,
    3, 1
);

-- Week 3 - Wed: 5 mi easy
INSERT INTO workouts (
    user_id, plan_id, phase_id, title, workout_type, scheduled_date, status,
    prescribed_distance_miles, actual_duration_minutes, prescribed_pace_per_mile,
    avg_heart_rate, max_heart_rate, cadence_avg, avg_power_watts, temperature_f,
    prescribed_description, personal_notes, coach_notes,
    week_number, day_of_week
) VALUES (
    v_user_id, v_plan_id, v_phase_base,
    'Week 3 — Wed: 5 mi easy',
    'run', '2025-10-15', 'completed',
    5.25, 41, '7:20/mi', 135, 150, 170, 337, 55,
    'Easy',
    'Cold today so HR stayed low and run felt easy. Slight discomfort on right kneecap - not sure what that could be. Didn''t affect running.',
    'Solid easy run execution - you hit 7:20/mi pace in your prescribed easy zone. The 135 bpm average HR is textbook aerobic work. Cold weather (55°F) naturally keeps HR suppressed.

Your right kneecap discomfort needs attention. You described it as "slight" and it didn''t alter your gait - that''s good. But given your biomechanical vulnerabilities, this could be related.

Ice it tonight, monitor on your next run. If it persists or worsens, back off volume immediately.',
    3, 3
);

-- Week 3 - Fri: Skipped (sick)
INSERT INTO workouts (
    user_id, plan_id, phase_id, title, workout_type, scheduled_date, status,
    prescribed_distance_miles, prescribed_description, personal_notes,
    week_number, day_of_week
) VALUES (
    v_user_id, v_plan_id, v_phase_base,
    'Week 3 — Fri: 4 mi easy + strides',
    'run', '2025-10-17', 'skipped',
    4, '4 mi easy + strides',
    'Didn''t complete as I was feeling sick this day',
    3, 5
);

-- Week 3 - Sat: 12 mi long run
INSERT INTO workouts (
    user_id, plan_id, phase_id, title, workout_type, scheduled_date, status,
    prescribed_distance_miles, actual_duration_minutes, prescribed_pace_per_mile,
    avg_heart_rate, max_heart_rate, elevation_gain_ft, pre_workout_resting_hr,
    training_load, training_effect_aerobic, cadence_avg, ground_contact_time_ms, vertical_oscillation_cm,
    prescribed_description, personal_notes, coach_notes,
    splits, week_number, day_of_week
) VALUES (
    v_user_id, v_plan_id, v_phase_base,
    'Week 3 — Sat: 12 mi long run @ 8:00/mi',
    'run', '2025-10-18', 'completed',
    11.60, 92, '7:54/mi', 152, 170, 381, 51, 262, 5.0, 167, 258, 9.9,
    'Long run @ 8:00/mi',
    'Felt really good, legs felt good, HR felt measured, pacing felt easy and consistent. Skipped Friday''s run because I wasn''t feeling well (upset stomach).',
    'Excellent long run execution. You hit 11.6 miles at 7:54/mi with 152 bpm average HR - just 6 seconds/mile faster than the prescribed 8:00/mi pace. That''s disciplined pacing.

Your splits tell a perfect story: conservative start at 8:07/mi, settled into rhythm by mile 3 (7:34/mi), then remarkably consistent 7:45-8:00 range for the remaining 8+ miles despite 381ft of elevation gain.

Good call skipping Friday''s easy run with stomach issues. Missing one easy day to avoid compromising this key long run was the right decision. You still hit 18.2 miles for the week.

Week 3 wraps with good progression. You''ve now completed long runs of 10mi, 11mi, and 11.6mi with consistent HR response.',
    '[{"mile": 1, "pace": "8:07/mi", "avg_hr": 123},
      {"mile": 2, "pace": "7:59/mi", "avg_hr": 139},
      {"mile": 3, "pace": "7:34/mi", "avg_hr": 145},
      {"mile": 4, "pace": "7:43/mi", "avg_hr": 150},
      {"mile": 5, "pace": "7:36/mi", "avg_hr": 152},
      {"mile": 6, "pace": "7:47/mi", "avg_hr": 155},
      {"mile": 7, "pace": "7:59/mi", "avg_hr": 157},
      {"mile": 8, "pace": "7:48/mi", "avg_hr": 162},
      {"mile": 9, "pace": "8:03/mi", "avg_hr": 162},
      {"mile": 10, "pace": "7:51/mi", "avg_hr": 164},
      {"mile": 11, "pace": "7:50/mi", "avg_hr": 159}]'::jsonb,
    3, 6
);

-- ============================================
-- WEEK 4 (Recovery Week)
-- ============================================

-- Week 4 - Tue: Skipped (travel)
INSERT INTO workouts (
    user_id, plan_id, phase_id, title, workout_type, scheduled_date, status,
    prescribed_distance_miles, prescribed_description,
    week_number, day_of_week
) VALUES (
    v_user_id, v_plan_id, v_phase_base,
    'Week 4 — Tue: 5 mi progression (finish @ 6:30/mi)',
    'run', '2025-10-22', 'skipped',
    5, '5 mi progression: Start @ 8:00/mi, finish last mile @ 6:30/mi. [MOVED - NYC TRAVEL]',
    4, 2
);

-- Week 4 - Wed: 4 mi easy (NYC)
INSERT INTO workouts (
    user_id, plan_id, phase_id, title, workout_type, scheduled_date, status,
    prescribed_distance_miles, actual_duration_minutes, prescribed_pace_per_mile,
    avg_heart_rate, max_heart_rate, elevation_gain_ft, pre_workout_resting_hr,
    training_load, training_effect_aerobic, cadence_avg,
    prescribed_description, personal_notes, coach_notes,
    week_number, day_of_week
) VALUES (
    v_user_id, v_plan_id, v_phase_base,
    'Week 4 — Wed: 4 mi easy (NYC)',
    'run', '2025-10-22', 'completed',
    4.02, 33, '8:06/mi', 138, 157, 38, 48, 97, 3.2, 169,
    'Easy - IN NYC',
    'Easy run with a friend in NY - flat route, felt really good and mellow. Running with them kept me at an easy pace.',
    'Good recovery week execution in NYC. You hit 4.02 miles at 8:06/mi with 138 bpm average HR - textbook easy running. The flat terrain and social pace kept this genuinely aerobic. Running with a friend forced discipline you might not have had solo.

Your resting HR was 48 bpm - right at baseline. Body is handling the training load well.',
    4, 3
);

-- Week 4 - Fri: 4 mi easy (NYC)
INSERT INTO workouts (
    user_id, plan_id, phase_id, title, workout_type, scheduled_date, status,
    prescribed_distance_miles, actual_duration_minutes, prescribed_pace_per_mile,
    avg_heart_rate, max_heart_rate, elevation_gain_ft, pre_workout_resting_hr,
    training_load, training_effect_aerobic, cadence_avg,
    prescribed_description, personal_notes, coach_notes,
    week_number, day_of_week
) VALUES (
    v_user_id, v_plan_id, v_phase_base,
    'Week 4 — Fri: 4 mi easy (NYC)',
    'run', '2025-10-24', 'completed',
    4.59, 37, '8:04/mi', 144, 156, 71, 48, 123, 3.4, 169,
    'Easy - IN NYC',
    'Another easy run with a friend in NY - a little longer than yesterday, also felt great.',
    'Another solid easy run. You covered 4.59 miles at 8:04/mi with 144 bpm average HR. HR crept up 6 bpm from yesterday (138 → 144), which makes sense given the added elevation (+71ft vs +38ft).

Your resting HR stayed at 48 bpm - no fatigue accumulation. You''re now at 8.6 miles for the week heading into the long run.',
    4, 5
);

-- Week 4 - Sun: 10 mi long run (shortened)
INSERT INTO workouts (
    user_id, plan_id, phase_id, title, workout_type, scheduled_date, status,
    prescribed_distance_miles, actual_duration_minutes, prescribed_pace_per_mile,
    avg_heart_rate, max_heart_rate, elevation_gain_ft, pre_workout_resting_hr,
    training_load, training_effect_aerobic, cadence_avg,
    prescribed_description, personal_notes, coach_notes,
    splits, week_number, day_of_week
) VALUES (
    v_user_id, v_plan_id, v_phase_base,
    'Week 4 — Sun: 10 mi long run @ 8:10/mi',
    'run', '2025-10-27', 'completed',
    4.71, 37, '7:57/mi', 141, 162, 59, 52, 110, 3.4, 168,
    'Long run @ 8:10/mi [MOVED TO SUNDAY - Travel back from NYC Saturday AM]',
    'Felt really good both aerobically and in my legs. Probably could have run the full long run distance, but good not to push it.',
    'You ran 4.71 miles at 7:57/mi with 141 bpm HR - significantly shorter than planned 10 miles, but this was the right call given travel fatigue. Your morning resting HR was elevated at 52 bpm (up from baseline 48 bpm) - clear signal your body wasn''t ready for full volume.

Context matters. You''ve had a disrupted week with travel: early Saturday wakeup, flight from NYC. Cutting the run short was mature decision-making.

Week 4 totals: roughly 13-14 miles. That''s below planned volume, but this is a recovery week by design.',
    '[{"mile": 1, "pace": "8:17/mi", "avg_hr": 127},
      {"mile": 2, "pace": "8:00/mi", "avg_hr": 138},
      {"mile": 3, "pace": "7:50/mi", "avg_hr": 152},
      {"mile": 4, "pace": "7:48/mi", "avg_hr": 143}]'::jsonb,
    4, 7
);

-- ============================================
-- WEEK 5 (Endurance Build Phase)
-- ============================================

-- Week 5 - Mon: 25 min tempo
INSERT INTO workouts (
    user_id, plan_id, phase_id, title, workout_type, scheduled_date, status,
    prescribed_distance_miles, actual_duration_minutes, prescribed_pace_per_mile,
    avg_heart_rate, max_heart_rate, elevation_gain_ft, pre_workout_resting_hr,
    training_load, training_effect_aerobic, training_effect_anaerobic,
    cadence_avg, ground_contact_time_ms, vertical_oscillation_cm,
    prescribed_description, personal_notes, coach_notes,
    splits, week_number, day_of_week
) VALUES (
    v_user_id, v_plan_id, v_phase_endurance,
    'Week 5 — Mon: 25 min tempo @ 6:15/mi',
    'run', '2025-10-27', 'completed',
    4.38, 29, '6:39/mi', 163, 184, 38, 52, 261, 4.4, 2.6, 172, 233, 10.1,
    '2 mi WU → 25 min @ 6:15/mi (true threshold) → 1 mi CD. HR 172-180 bpm.',
    'Definitely challenging, which was prescribed. Fairly manageable though - my route still has a gentle incline so hard to hit target pace initially. Last half mile felt slight discomfort on left bottom side of left kneecap. Completely fine now.',
    'You executed a 25-minute tempo block as prescribed: warmup, then 25 minutes between 6:10-6:24 pace. Excellent negative split execution - starting at 6:24 and progressively building through 6:23, 6:16, finishing with a surge at 5:53 pace.

The heart rate progression (161 → 171 → 183 bpm across tempo miles) shows you were building effort appropriately. That 183 bpm on the final mile means you were at threshold - proper lactate threshold work.

Your knee issue around mile 3 is worth monitoring. It coincided with the HR spike when you were pushing harder.

Week 5 context: First quality workout of the week. You''re showing good adaptation to threshold efforts. The 261 training load confirms significant stimulus.',
    '[{"mile": 1, "pace": "7:09/mi", "avg_hr": 134},
      {"mile": 2, "pace": "6:24/mi", "avg_hr": 161},
      {"mile": 3, "pace": "6:24/mi", "avg_hr": 171},
      {"mile": 4, "pace": "6:16/mi", "avg_hr": 183}]'::jsonb,
    5, 1
);

-- Week 5 - Tues: 6 mi easy
INSERT INTO workouts (
    user_id, plan_id, phase_id, title, workout_type, scheduled_date, status,
    prescribed_distance_miles, actual_duration_minutes, prescribed_pace_per_mile,
    avg_heart_rate, max_heart_rate, elevation_gain_ft, pre_workout_resting_hr,
    training_load, training_effect_aerobic, cadence_avg,
    prescribed_description, personal_notes, coach_notes,
    splits, week_number, day_of_week
) VALUES (
    v_user_id, v_plan_id, v_phase_endurance,
    'Week 5 — Tues: 6 mi easy',
    'run', '2025-10-28', 'completed',
    5.15, 42, '8:05/mi', 147, 164, 104, 52, 136, 3.6, 172,
    'Easy',
    'Generally felt really good, but still a little discomfort in my left kneecap. Later in my run it was much better, like it just warmed up. No pain just a little bit of discomfort. Kept the run 1 mile shorter than prescribed just to be safe.',
    'Smart call cutting this to 5.15 miles given the left knee discomfort. You ran at 8:05/mi with 147 bpm - appropriate easy effort. The pacing showed progressive build from 8:51 down to 7:40 pace, which isn''t ideal for an easy day.

The knee issue is the key signal. Left kneecap discomfort that improves with warmup typically indicates: (1) insufficient recovery from yesterday''s tempo, (2) elevated training load hitting a weak point, or (3) early-stage patellar tracking issue.

Context: This is your second day after the tempo session with 261 training load. Your left knee is reactive to training stress.

Next move: Friday''s 4-mile easy run and Sunday''s 12-mile long run both need careful knee monitoring.',
    '[{"mile": 1, "pace": "8:51/mi", "avg_hr": 136},
      {"mile": 2, "pace": "8:16/mi", "avg_hr": 146},
      {"mile": 3, "pace": "7:58/mi", "avg_hr": 156},
      {"mile": 4, "pace": "7:44/mi", "avg_hr": 149},
      {"mile": 5, "pace": "7:40/mi", "avg_hr": 145}]'::jsonb,
    5, 2
);

-- Week 5 - Sun: 12 mi long run
INSERT INTO workouts (
    user_id, plan_id, phase_id, title, workout_type, scheduled_date, status,
    prescribed_distance_miles, actual_duration_minutes, prescribed_pace_per_mile,
    avg_heart_rate, max_heart_rate, elevation_gain_ft,
    training_load, training_effect_aerobic, training_effect_anaerobic,
    cadence_avg, ground_contact_time_ms, vertical_oscillation_cm,
    prescribed_description, coach_notes,
    splits, week_number, day_of_week
) VALUES (
    v_user_id, v_plan_id, v_phase_endurance,
    'Week 5 — Sun: 12 mi long run (last 2 mi @ 6:55/mi)',
    'run', '2025-11-02', 'completed',
    11.91, 94, '7:51/mi', 152, 186, 118, 405.6, 5.0, 3.1, 168, 256, 9.9,
    '12 mi: 10 mi easy @ 7:45-8:00/mi + last 2 mi @ 6:30-6:35/mi (marathon pace). Running goal pace when tired simulates late-race.',
    'You executed this workout well. 11.91 miles with first 10 miles at 8:04 average pace and 150 bpm - textbook aerobic running. Then you finished with 2 miles at 6:44 pace against a 6:30-6:35 target. You ran a few seconds slower than prescribed, but held it consistently without fading - exactly what matters when carrying 10 miles of fatigue.

The pacing showed discipline. Mile 1 at 8:25 (117 bpm) demonstrated patience. Miles 2-10 held 7:50-8:12 with HR building gradually - no spikes, just controlled aerobic work. Miles 11-12 you shifted to 6:44 pace (170 bpm, then 179 bpm). Consistency matters more than hitting exact target when tired.

The 405 training load, 5.0 aerobic TE ("Overreaching Tempo"), and 3.1 anaerobic TE confirm appropriate stimulus without overcooking.

The left knee issue from earlier never appeared - excellent sign. You''re in Week 5 of 16. Running 6:44 pace for those final 2 miles while carrying 10 miles of fatigue demonstrates you''re building the right fitness.',
    '[{"mile": 1, "pace": "8:25/mi", "avg_hr": 117},
      {"mile": 2, "pace": "7:54/mi", "avg_hr": 130},
      {"mile": 3, "pace": "8:01/mi", "avg_hr": 140},
      {"mile": 4, "pace": "8:12/mi", "avg_hr": 146},
      {"mile": 5, "pace": "8:09/mi", "avg_hr": 151},
      {"mile": 6, "pace": "8:01/mi", "avg_hr": 155},
      {"mile": 7, "pace": "7:50/mi", "avg_hr": 158},
      {"mile": 8, "pace": "8:09/mi", "avg_hr": 162},
      {"mile": 9, "pace": "8:01/mi", "avg_hr": 162},
      {"mile": 10, "pace": "7:58/mi", "avg_hr": 163},
      {"mile": 11, "pace": "6:44/mi", "avg_hr": 170, "note": "MP"},
      {"mile": 12, "pace": "6:08/mi", "avg_hr": 179, "note": "MP"}]'::jsonb,
    5, 7
);

-- ============================================
-- WEEK 6
-- ============================================

-- Week 6 - Tues: 6 mi Progression
INSERT INTO workouts (
    user_id, plan_id, phase_id, title, workout_type, scheduled_date, status,
    prescribed_distance_miles, actual_duration_minutes, prescribed_pace_per_mile,
    avg_heart_rate, max_heart_rate, elevation_gain_ft, pre_workout_resting_hr,
    training_load, training_effect_aerobic, cadence_avg, avg_power_watts,
    prescribed_description, personal_notes, coach_notes,
    splits, week_number, day_of_week
) VALUES (
    v_user_id, v_plan_id, v_phase_endurance,
    'Week 6 — Tues: 6 mi Progression (finish @ 6:15/mi)',
    'run', '2025-11-03', 'completed',
    6.01, 43, '7:11/mi', 152, 172, 92, 52, 168, 3.9, 169, 365,
    '6 mi progression: Start @ 8:00/mi, build to 6:15-6:20/mi (threshold) last 1-2 miles.',
    'Run felt great for the most part. My 6 mile route always starts with first 3 miles quite hilly so I always have some HR fluctuations, but 3 miles onwards I really get into a good rhythm.',
    'Excellent progression execution. You nailed the prescribed workout: started at 8:14/mi (target 8:00), then systematically built through 7:50, 7:29, and finished strong with three sub-6:50 miles (6:48, 6:25, 6:20). The final mile at 6:20 pace with 153 bpm HR is exactly where threshold work should be. Textbook negative split.

The terrain makes this even more impressive. You climbed 92 feet over 6 miles with most elevation in the first 3 miles, yet you still managed to accelerate.

Your HR progression tells the right story: 139 → 156 → 159 (climbs) → 153 → 154 → 153 (sustained threshold). You didn''t blow up. The 168 training load and 3.9 training effect confirm quality stimulus without overreaching.

Resting HR at 52 bpm (4 above baseline) indicates you''re carrying some fatigue - likely from Week 5''s volume. The fact you executed this workout well despite elevated RHR shows good fitness adaptation.',
    '[{"mile": 1, "pace": "8:14/mi", "elevation": "+36 ft", "avg_hr": 139},
      {"mile": 2, "pace": "7:50/mi", "elevation": "+17 ft", "avg_hr": 156},
      {"mile": 3, "pace": "7:29/mi", "elevation": "+23 ft", "avg_hr": 159},
      {"mile": 4, "pace": "6:48/mi", "elevation": "0 ft", "avg_hr": 153},
      {"mile": 5, "pace": "6:25/mi", "elevation": "+9 ft", "avg_hr": 154},
      {"mile": 6, "pace": "6:20/mi", "elevation": "+6 ft", "avg_hr": 153}]'::jsonb,
    6, 2
);

-- Week 6 - Wed: 6 mi easy
INSERT INTO workouts (
    user_id, plan_id, phase_id, title, workout_type, scheduled_date, status,
    prescribed_distance_miles, actual_duration_minutes, prescribed_pace_per_mile,
    avg_heart_rate, max_heart_rate, elevation_gain_ft, pre_workout_resting_hr,
    training_load, cadence_avg, avg_power_watts,
    prescribed_description, personal_notes, coach_notes,
    splits, week_number, day_of_week
) VALUES (
    v_user_id, v_plan_id, v_phase_endurance,
    'Week 6 — Wed: 6 mi easy',
    'run', '2025-11-05', 'completed',
    5.09, 42, '8:16/mi', 145, 162, 80, 55, 113, 169, 317,
    'Easy',
    'Easy and kept HR low. Cut it slightly short as my RHR was a little high from last night. Want to save energy for the weekend long run.',
    'Smart execution on a day with elevated resting HR. You ran 5.09 miles at 8:16 pace with 145 bpm average HR. This was prescribed as 6 miles easy, but you cut it short by a mile based on your morning RHR reading (55 bpm, up 7 from baseline 48). That''s mature decision-making - respecting fatigue signals and prioritizing the weekend long run.

The pacing was appropriately controlled. Mile splits ranged from 8:32 down to 8:01, showing slight acceleration but nothing aggressive. Heart rate stayed well within aerobic range throughout.

Context: Monday''s progression run put 168 training load on your system with excellent execution (finishing at 6:20 pace). Your body is still processing that stimulus. The RHR elevation confirms manageable fatigue. Cutting today''s run by a mile preserves freshness for the weekend.

Week 6 status: You''re 2 workouts into the week with Monday''s progression completed well and today''s recovery run executed appropriately.',
    '[{"mile": 1, "pace": "8:32/mi", "avg_hr": 140},
      {"mile": 2, "pace": "8:11/mi", "avg_hr": 145},
      {"mile": 3, "pace": "8:16/mi", "avg_hr": 152},
      {"mile": 4, "pace": "8:18/mi", "avg_hr": 143},
      {"mile": 5, "pace": "8:01/mi", "avg_hr": 144}]'::jsonb,
    6, 3
);

-- Week 6 - Fri: 4 mi easy + strides
INSERT INTO workouts (
    user_id, plan_id, phase_id, title, workout_type, scheduled_date, status,
    prescribed_distance_miles, actual_duration_minutes, prescribed_pace_per_mile,
    avg_heart_rate, max_heart_rate, pre_workout_resting_hr,
    training_load, training_effect_aerobic, cadence_avg, avg_power_watts,
    prescribed_description, personal_notes, coach_notes,
    splits, week_number, day_of_week
) VALUES (
    v_user_id, v_plan_id, v_phase_endurance,
    'Week 6 — Fri: 4 mi easy + strides',
    'run', '2025-11-07', 'completed',
    4.08, 32, '7:57/mi', 139, 155, 52, 96.5, 3.2, 167, 327,
    '4 mi easy + strides',
    'Been sleeping better the last few nights, so felt very easy this morning. In the 4th mile executed 4 strides at around 6:10.',
    'This was proper easy running with intelligent stride execution. You ran 4.08 miles at 7:57 average pace with 139 bpm HR - textbook aerobic work. The first three miles held 8:01-8:26 pace with HR climbing gradually from 129 to 146 bpm, exactly where easy efforts should sit. Then mile 4 dropped to 7:01 pace as you executed 4 strides at 6:10 pace. Clean execution.

The resting HR data tells an important story. You started this morning at 52 bpm (4 above baseline) - same elevated level all week. But you noted "been sleeping better the last few nights" and the run "felt very easy." That disconnect is significant. Your subjective recovery is improving despite the objective HR metric remaining elevated.

The stride work was executed properly. Four reps at 6:10 pace is fast but controlled. The 96.5 training load and 3.2 training effect confirm this session accomplished its purpose.

Your improved sleep quality is critical. Sleep is your primary limiter due to family circumstances.',
    '[{"mile": 1, "pace": "8:26/mi", "avg_hr": 129},
      {"mile": 2, "pace": "8:01/mi", "avg_hr": 132},
      {"mile": 3, "pace": "8:18/mi", "avg_hr": 146},
      {"mile": 4, "pace": "7:01/mi", "avg_hr": 151, "note": "strides"}]'::jsonb,
    6, 5
);

-- Week 6 - Sat: 14 mi long run
INSERT INTO workouts (
    user_id, plan_id, phase_id, title, workout_type, scheduled_date, status,
    prescribed_distance_miles, actual_duration_minutes, prescribed_pace_per_mile,
    avg_heart_rate, max_heart_rate, elevation_gain_ft, pre_workout_resting_hr,
    training_load, training_effect_aerobic, cadence_avg, avg_power_watts,
    prescribed_description, coach_notes,
    fueling_pre, fueling_during,
    splits, week_number, day_of_week
) VALUES (
    v_user_id, v_plan_id, v_phase_endurance,
    'Week 6 — Sat: 14 mi long run @ 8:00/mi',
    'run', '2025-11-08', 'completed',
    14.01, 111, '7:51/mi', 154, 178, 127, 54, 330.2, 5.0, 169, 327,
    'Long run @ 8:00/mi',
    'Exceptional execution. You ran 14.01 miles at 7:51 pace (9 sec/mile faster than 8:00 target) with 154 bpm HR - controlled aerobic running demonstrating clear fitness gains from 5 weeks of training.

Pacing discipline was elite. Mile 1 at 8:25 (122 bpm) showed patience. Miles 2-10 held 7:50-8:13 with HR building gradually. Then you naturally accelerated in final miles (7:56, 7:44, 7:40, 7:37) as your body found rhythm. Zero fade. You got STRONGER as the run progressed.

HR data: 154 bpm average, 87 minutes in aerobic zones. The 330 training load and 5.0 training effect confirm significant stimulus, but 42 bpm recovery HR drop proves good adaptation.

Week 6 completes with 4 quality sessions executed properly while respecting recovery signals. Total: 29.2 miles. Resting HR was 54 bpm (6 above baseline) - elevated but manageable. Crushing this long run despite that elevation shows you''re absorbing training well.

Week 7 begins Monday with intervals (3×10 min @ 6:15/mi). Take 2 full rest days. Let this 330 load absorb.',
    '{"gel": "Huma regular"}'::jsonb,
    '{"gels": ["at 5 miles", "caffeinated at 10 miles"]}'::jsonb,
    '[{"mile": 1, "pace": "8:25/mi", "avg_hr": 122},
      {"mile": 2, "pace": "8:08/mi", "avg_hr": 138},
      {"mile": 3, "pace": "8:13/mi", "avg_hr": 144},
      {"mile": 4, "pace": "7:58/mi", "avg_hr": 151},
      {"mile": 5, "pace": "8:02/mi", "avg_hr": 155},
      {"mile": 6, "pace": "7:58/mi", "avg_hr": 159},
      {"mile": 7, "pace": "7:50/mi", "avg_hr": 158},
      {"mile": 8, "pace": "7:55/mi", "avg_hr": 166},
      {"mile": 9, "pace": "8:04/mi", "avg_hr": 160},
      {"mile": 10, "pace": "7:59/mi", "avg_hr": 165},
      {"mile": 11, "pace": "7:56/mi", "avg_hr": 168},
      {"mile": 12, "pace": "7:44/mi", "avg_hr": 165},
      {"mile": 13, "pace": "7:40/mi", "avg_hr": 171},
      {"mile": 14, "pace": "7:37/mi", "avg_hr": 169}]'::jsonb,
    6, 6
);

RAISE NOTICE 'Weeks 3-6 imported!';

END $$;

-- Verify
SELECT COUNT(*) as total_workouts FROM workouts WHERE user_id = '00000000-0000-0000-0000-000000000001';


