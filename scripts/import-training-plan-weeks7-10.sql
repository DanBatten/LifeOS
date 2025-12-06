-- ============================================
-- Marathon Training Plan Import - WEEKS 7-10
-- ============================================

DO $$
DECLARE
    v_user_id UUID := '00000000-0000-0000-0000-000000000001';
    v_plan_id UUID;
    v_phase_endurance UUID;
    v_phase_specificity UUID;
BEGIN

SELECT id INTO v_plan_id FROM training_plans WHERE user_id = v_user_id AND name LIKE '%LA Marathon%' LIMIT 1;
SELECT id INTO v_phase_endurance FROM training_phases WHERE plan_id = v_plan_id AND phase_type = 'build' LIMIT 1;
SELECT id INTO v_phase_specificity FROM training_phases WHERE plan_id = v_plan_id AND phase_type = 'peak' LIMIT 1;

-- ============================================
-- WEEK 7 (Illness Week)
-- ============================================

-- Week 7 - Mon: Intervals (Skipped - illness)
INSERT INTO workouts (
    user_id, plan_id, phase_id, title, workout_type, scheduled_date, status,
    prescribed_distance_miles, prescribed_description,
    week_number, day_of_week
) VALUES (
    v_user_id, v_plan_id, v_phase_endurance,
    'Week 7 — Mon: 3×10 min Intervals @ 6:15/mi',
    'run', '2025-11-10', 'skipped',
    7, '2 mi WU → 3×10 min @ 6:10-6:20/mi w/ 3 min jog → 1 mi CD. Threshold intervals. HR 175-185 bpm.',
    7, 1
);

-- Week 7 - Wed: Skipped (illness)
INSERT INTO workouts (
    user_id, plan_id, phase_id, title, workout_type, scheduled_date, status,
    prescribed_distance_miles, prescribed_description,
    week_number, day_of_week
) VALUES (
    v_user_id, v_plan_id, v_phase_endurance,
    'Week 7 — Wed: 6 mi easy',
    'run', '2025-11-12', 'skipped',
    6, 'Easy',
    7, 3
);

-- Week 7 - Sat: Comeback run
INSERT INTO workouts (
    user_id, plan_id, phase_id, title, workout_type, scheduled_date, status,
    prescribed_distance_miles, actual_duration_minutes, prescribed_pace_per_mile,
    avg_heart_rate, max_heart_rate, elevation_gain_ft, pre_workout_resting_hr,
    training_load, training_effect_aerobic, cadence_avg, avg_power_watts,
    prescribed_description, coach_notes,
    splits, week_number, day_of_week
) VALUES (
    v_user_id, v_plan_id, v_phase_endurance,
    'Week 7 — Sat: 5-6 mi easy comeback run',
    'run', '2025-11-15', 'completed',
    5.26, 43, '8:12/mi', 145, 163, 82, 53, 125.8, 3.5, 167, 320,
    '5-6 mi easy @ 8:15-8:30/mi - Comeback run post-illness. Start conservative, HR must stay 135-150 bpm. Abort if any symptoms return.',
    'Clean comeback execution. You ran 5.26 miles at 8:12 pace with 145 bpm HR - hitting all targets perfectly on your first run back from illness. The prescription was 5-6 miles easy at 8:15-8:30 pace with HR 135-150 bpm. You delivered exactly what was needed.

Pacing discipline was excellent. Started at 8:18 pace (134 bpm), built gradually through miles 2-3 (8:21→8:12, HR 143→154), then naturally found rhythm in the second half with miles 4-6 averaging 7:58 pace at 149 bpm. Zero fade despite wet conditions and lingering congestion.

The HR data confirms appropriate effort: 145 bpm average with 3.5 training effect and 125.8 training load. You stayed completely aerobic - no anaerobic contribution. This is exactly what a comeback run should look like.

Resting HR at 53 bpm (5 above baseline) shows you''re still carrying mild post-illness elevation, but the smooth execution proves your system is ready for training.

Week 7 status: You missed Monday''s intervals and Wednesday''s easy run due to illness. Today''s successful comeback restarts your training cycle.',
    '[{"mile": 1, "pace": "8:18/mi", "avg_hr": 134},
      {"mile": 2, "pace": "8:21/mi", "avg_hr": 143},
      {"mile": 3, "pace": "8:12/mi", "avg_hr": 154},
      {"mile": 4, "pace": "7:59/mi", "avg_hr": 147},
      {"mile": 5, "pace": "8:10/mi", "avg_hr": 146}]'::jsonb,
    7, 6
);

-- ============================================
-- WEEK 8 (Return to Training)
-- ============================================

-- Week 8 - Mon: REST
INSERT INTO workouts (
    user_id, plan_id, phase_id, title, workout_type, scheduled_date, status,
    prescribed_description,
    week_number, day_of_week
) VALUES (
    v_user_id, v_plan_id, v_phase_endurance,
    'Week 8 — Mon: REST',
    'other', '2025-11-17', 'completed',
    'REST DAY - Full recovery from illness week.',
    8, 1
);

-- Week 8 - Tue: 4-5 mi easy
INSERT INTO workouts (
    user_id, plan_id, phase_id, title, workout_type, scheduled_date, status,
    prescribed_distance_miles, actual_duration_minutes, prescribed_pace_per_mile,
    avg_heart_rate, max_heart_rate, elevation_gain_ft, pre_workout_resting_hr,
    training_load, training_effect_aerobic, cadence_avg,
    prescribed_description, coach_notes,
    splits, week_number, day_of_week
) VALUES (
    v_user_id, v_plan_id, v_phase_endurance,
    'Week 8 — Tue: 4-5 mi easy',
    'run', '2025-11-18', 'completed',
    4.01, 33, '8:15/mi', 149, 168, 53, 46, 110, 3.4, 167,
    '4-5 mi easy @ 8:15/mi - First run back after rest days. Keep HR 135-150 bpm. Monitor for any symptom return.',
    'Solid return to training. You ran 4.01 miles at 8:15 pace with 149 bpm HR - hitting all targets perfectly for your first run back after illness and poor sleep.

The pacing was controlled and steady. Mile splits held remarkably consistent: 8:28, 8:14, 8:07, 8:12 pace with HR climbing gradually from 141 to 157 bpm. Zero fade. The slight acceleration in mile 3 shows your aerobic system is functioning well.

HR data confirms appropriate effort: 149 bpm average puts you right in the prescribed 135-150 range. The Training Effect of 3.4 shows you got meaningful stimulus without excessive fatigue.

Your actual 46 bpm resting HR this morning is only 2 bpm below your baseline of 48, which is excellent.

Week 8 context: This is your first quality session after missing Monday''s scheduled run. You''re in a rebuild phase after Week 7''s illness disruption.',
    '[{"mile": 1, "pace": "8:28/mi", "avg_hr": 141},
      {"mile": 2, "pace": "8:14/mi", "avg_hr": 149},
      {"mile": 3, "pace": "8:07/mi", "avg_hr": 154},
      {"mile": 4, "pace": "8:12/mi", "avg_hr": 152}]'::jsonb,
    8, 2
);

-- Week 8 - Thu: 5 mi easy
INSERT INTO workouts (
    user_id, plan_id, phase_id, title, workout_type, scheduled_date, status,
    prescribed_distance_miles, actual_duration_minutes, prescribed_pace_per_mile,
    avg_heart_rate, max_heart_rate, elevation_gain_ft, pre_workout_resting_hr,
    training_load, training_effect_aerobic, cadence_avg, avg_power_watts,
    prescribed_description, personal_notes, coach_notes,
    splits, week_number, day_of_week
) VALUES (
    v_user_id, v_plan_id, v_phase_endurance,
    'Week 8 — Thu: 5 mi easy',
    'run', '2025-11-20', 'completed',
    5.17, 41, '8:00/mi', 144, 172, 82, 52, 123, 3.5, 167, 329,
    '5 mi easy @ 8:15/mi - Continue volume rebuild. HR 135-150 bpm. Should feel comfortable and controlled.',
    'Easy pace, slept well, still a little congested so breathing rhythm was a little off. But overall fine.',
    'Solid easy run execution. You ran 5.17 miles at 8:00/mi with 144 bpm average HR - hitting the prescribed 8:15/mi easy pace target while staying right in the target HR zone (135-150 bpm).

Pacing was consistent throughout. You started conservatively at 8:17 (129 bpm), settled into rhythm by mile 2 (7:56, 134 bpm), then held 8:00-8:02 pace for miles 3-4 before naturally picking up slightly to 7:43 on mile 5. The natural acceleration shows you had energy in reserve.

HR control was excellent. Average 144 bpm with only brief spikes. The congestion you mentioned affected breathing rhythm but didn''t compromise cardiovascular response.

Resting HR at 52 bpm (4 above baseline) continues the mild post-illness elevation pattern. The fact that you felt "overall fine" despite congestion proves your body is handling the training stimulus appropriately.

Week 8 status: This is your second run back after illness. You''re systematically rebuilding volume.',
    '[{"mile": 1, "pace": "8:17/mi", "avg_hr": 129},
      {"mile": 2, "pace": "7:56/mi", "avg_hr": 134},
      {"mile": 3, "pace": "8:02/mi", "avg_hr": 156},
      {"mile": 4, "pace": "8:00/mi", "avg_hr": 149},
      {"mile": 5, "pace": "7:43/mi", "avg_hr": 149}]'::jsonb,
    8, 4
);

-- Week 8 - Sun: 12 mi easy long run
INSERT INTO workouts (
    user_id, plan_id, phase_id, title, workout_type, scheduled_date, status,
    prescribed_distance_miles, actual_duration_minutes, prescribed_pace_per_mile,
    avg_heart_rate, max_heart_rate, elevation_gain_ft, pre_workout_resting_hr,
    training_load, training_effect_aerobic, cadence_avg, avg_power_watts,
    prescribed_description, personal_notes, coach_notes,
    fueling_pre, fueling_during,
    splits, week_number, day_of_week
) VALUES (
    v_user_id, v_plan_id, v_phase_endurance,
    'Week 8 — Sun: 12 mi easy long run',
    'run', '2025-11-23', 'completed',
    12.06, 94, '7:46/mi', 154, 172, 114, 52, 279.2, 5.0, 168, 331,
    '12 mi easy @ 8:00-8:15/mi - NO TEMPO/THRESHOLD work. Just steady aerobic running. Replaces missed Week 7 long run. If HR drifts above 160 consistently, slow down.',
    'Huma gel before, Cadence Fuel Gel at 6 miles. Felt really good - easy and effortless, felt like I could keep running for much longer.',
    'Strong long run execution - and a clear signal you''re fully back from illness. You ran 12.06 miles at 7:46 pace with 154 bpm HR, running 14-29 seconds per mile faster than the prescribed 8:00-8:15/mi target while maintaining controlled effort. The prescription said slow down if HR drifts above 160 consistently. It did briefly touch that range in the back half, but given your fitness level and conditions, this was appropriate.

Pacing discipline was excellent. You started at 7:58 pace with 120 bpm - conservative and patient despite feeling good. HR climbed steadily through miles 2-6 (141→156 bpm) as you held sub-8:00 pace. Miles 7-9 saw HR peak in the 160s as expected at this point in a long run. Then you accelerated in the final miles (7:45, 7:40, 7:43) despite accumulated fatigue. Textbook negative split execution.

Your comment about feeling "easy and effortless, like I could keep running much longer" is exactly what we want to hear.

Week 8 completes: 21.24 miles across 3 runs. This is your return-to-training week after Week 7''s illness disruption. You''ve systematically rebuilt volume. The fact you crushed this long run confirms you''re ready to resume normal training intensity.

Week 9 starts Monday. You''re cleared for the scheduled tempo work.',
    '{"gel": "Huma regular"}'::jsonb,
    '{"gels": ["Cadence Fuel Gel at mile 6"]}'::jsonb,
    '[{"mile": 1, "pace": "7:58/mi", "avg_hr": 120},
      {"mile": 2, "pace": "7:52/mi", "avg_hr": 141},
      {"mile": 3, "pace": "7:37/mi", "avg_hr": 148},
      {"mile": 4, "pace": "7:48/mi", "avg_hr": 150},
      {"mile": 5, "pace": "7:50/mi", "avg_hr": 152},
      {"mile": 6, "pace": "7:50/mi", "avg_hr": 156},
      {"mile": 7, "pace": "7:49/mi", "avg_hr": 160},
      {"mile": 8, "pace": "7:59/mi", "avg_hr": 166},
      {"mile": 9, "pace": "8:02/mi", "avg_hr": 161},
      {"mile": 10, "pace": "7:45/mi", "avg_hr": 164},
      {"mile": 11, "pace": "7:40/mi", "avg_hr": 161},
      {"mile": 12, "pace": "7:43/mi", "avg_hr": 167}]'::jsonb,
    8, 7
);

-- ============================================
-- WEEK 9 (Pre-Marathon Specificity Phase)
-- ============================================

-- Week 9 - Tue: Marathon Pace
INSERT INTO workouts (
    user_id, plan_id, phase_id, title, workout_type, scheduled_date, status,
    prescribed_distance_miles, actual_duration_minutes, prescribed_pace_per_mile,
    avg_heart_rate, max_heart_rate, elevation_gain_ft, pre_workout_resting_hr,
    temperature_f,
    prescribed_description, personal_notes, coach_notes,
    splits, week_number, day_of_week
) VALUES (
    v_user_id, v_plan_id, v_phase_specificity,
    'Week 9 — Tue: 5 mi Marathon Pace @ 6:30/mi',
    'run', '2025-11-24', 'completed',
    7.22, 51, '7:07/mi', 142, 158, 367, 52, 55,
    '2 mi WU → 5 mi @ 6:30-6:35/mi (MARATHON PACE) → 1 mi CD. First sustained MP run, controlled and sustainable. HR 165-172 bpm.',
    'Nice cold morning so HR stayed low. Although I think my HRM may have slightly been underplaying my HR? Felt like it was more in the 150s/160s effort wise. But overall a pretty good run and MP felt good!',
    'Strong first marathon pace workout. You ran 7.22 miles at 7:07 average pace with 142 bpm HR on a cold morning that helped keep heart rate suppressed. The workout called for 2 mi WU → 5 mi @ 6:30-6:35/mi → 1 mi CD. You delivered solid execution with some fade in the back half.

Miles 3-5 were right on target: 6:36, 6:35, 6:38. That''s the core MP work, and you nailed it. HR stayed in the low 140s during these miles - notably lower than the prescribed 165-172 bpm. The cold conditions and your excellent aerobic fitness are suppressing HR response. Miles 6-7 drifted to 6:49 and 6:51 as elevation climbed, putting you 14-16 seconds off target. That fade, plus your perception that effort felt like 150s-160s despite 142 bpm data, suggests either HRM underreporting or running more conservatively than realized.

You shortened the run slightly (7.22 vs 8 mi prescribed) but still got 5 quality miles of MP work. Resting HR at 52 bpm (4 above baseline) continues the pattern from Week 8.

This is Week 9''s key workout done. Tomorrow is 6 mi easy - HR under 145, pace 8:00-8:15.',
    '[{"mile": 1, "pace": "8:13/mi", "avg_hr": 133, "note": "warmup"},
      {"mile": 2, "pace": "7:48/mi", "avg_hr": 139, "note": "transition"},
      {"mile": 3, "pace": "6:36/mi", "avg_hr": 144, "note": "MP"},
      {"mile": 4, "pace": "6:35/mi", "avg_hr": 141, "note": "MP"},
      {"mile": 5, "pace": "6:38/mi", "avg_hr": 143, "note": "MP"},
      {"mile": 6, "pace": "6:49/mi", "avg_hr": 145},
      {"mile": 7, "pace": "6:51/mi", "avg_hr": 146}]'::jsonb,
    9, 2
);

-- Week 9 - Thu: 6 mi easy
INSERT INTO workouts (
    user_id, plan_id, phase_id, title, workout_type, scheduled_date, status,
    prescribed_distance_miles, actual_duration_minutes, prescribed_pace_per_mile,
    avg_heart_rate, max_heart_rate, elevation_gain_ft, pre_workout_resting_hr,
    cadence_avg,
    prescribed_description, coach_notes,
    splits, week_number, day_of_week
) VALUES (
    v_user_id, v_plan_id, v_phase_specificity,
    'Week 9 — Thurs: 6 mi easy',
    'run', '2025-11-27', 'completed',
    5.18, 43, '8:12/mi', 149, 163, 292, 55, 169,
    'Easy',
    'Smart adjustment on a recovery-compromised day. You ran 5.18 miles at 8:12 pace with 149 bpm HR when 6 miles easy was scheduled. The decision to cut one mile was correct given your biometric signals and life stress.

Resting HR at 55 bpm is the key signal - that''s 7 bpm above your 48 baseline and 4 bpm above your 7-day average. This is your highest RHR since Week 7 illness. Combined with work stress and being up until 1am, your body needed lighter stimulus. You recognized that and shortened the run.

The pacing pattern shows classic negative split execution: 8:41 → 8:20 → 8:21 → 8:01 → 7:44 for miles 1-5. HR peaked at 157 on mile 3, then decreased to 148-152 on miles 4-5 despite faster pace. Your cardiovascular fitness is intact; early sluggishness was recovery/stress related, not fitness.

Week 9 context: This is your second easy run after Tuesday''s Marathon Pace workout. Elevated RHR was your body asking for lighter load.',
    '[{"mile": 1, "pace": "8:41/mi", "avg_hr": 139},
      {"mile": 2, "pace": "8:20/mi", "avg_hr": 149},
      {"mile": 3, "pace": "8:21/mi", "avg_hr": 157},
      {"mile": 4, "pace": "8:01/mi", "avg_hr": 152},
      {"mile": 5, "pace": "7:44/mi", "avg_hr": 148}]'::jsonb,
    9, 4
);

-- Week 9 - Sat: 4 mi easy
INSERT INTO workouts (
    user_id, plan_id, phase_id, title, workout_type, scheduled_date, status,
    prescribed_distance_miles, actual_duration_minutes, prescribed_pace_per_mile,
    avg_heart_rate, elevation_gain_ft, temperature_f, cadence_avg,
    prescribed_description, personal_notes, coach_notes,
    splits, week_number, day_of_week
) VALUES (
    v_user_id, v_plan_id, v_phase_specificity,
    'Week 9 — Sat: 4 mi easy',
    'run', '2025-11-29', 'completed',
    3.72, 29, '7:46/mi', 136, 63, 59, 171,
    'Easy',
    'Easy run up in the desert. Felt good and easy.',
    'Solid easy run in Twentynine Palms with excellent pacing control. You ran 3.72 miles at 7:46 average pace with 136 bpm average HR, which sits right in your easy Zone 2 range. The negative split pattern (7:54→7:53→7:40→7:34) shows proper warm-up discipline and natural acceleration as you found your rhythm.

This run demonstrates good awareness of appropriate easy effort - HR stayed controlled throughout with individual mile HRs of 135-141 bpm, never creeping into tempo territory. The desert elevation and cool temps (59°F) provided ideal recovery conditions.

You''re maintaining consistency at the tail end of Week 9, keeping legs fresh before tomorrow''s 14-mile effort.',
    '[{"mile": 1, "pace": "7:54/mi", "avg_hr": 135},
      {"mile": 2, "pace": "7:53/mi", "avg_hr": 136},
      {"mile": 3, "pace": "7:40/mi", "avg_hr": 138},
      {"mile": 4, "pace": "7:34/mi", "avg_hr": 141}]'::jsonb,
    9, 6
);

-- Week 9 - Sun: 14 mi long run
INSERT INTO workouts (
    user_id, plan_id, phase_id, title, workout_type, scheduled_date, status,
    prescribed_distance_miles, actual_duration_minutes, prescribed_pace_per_mile,
    avg_heart_rate, elevation_gain_ft, temperature_f,
    prescribed_description, personal_notes, coach_notes,
    splits, week_number, day_of_week
) VALUES (
    v_user_id, v_plan_id, v_phase_specificity,
    'Week 9 — Sun: 14 mi long run @ 8:00/mi',
    'run', '2025-11-30', 'completed',
    14.01, 107, '7:40/mi', 140, 121, 68,
    'Long run @ 8:00/mi',
    'Have been sleeping well the past few nights, and felt fantastic on this long run. Pace, breathing felt absolutely effortless. I listened to my body for the first half of the run and then dialed up the pace for the second half as my breathing and HR were super measured. Completed the 14 miles feeling like I could keep going and at no point felt out of breath or like it was difficult, it just felt natural.',
    'Exceptional long run execution - textbook negative split progression that demonstrates elite-level pacing discipline and aerobic control. You completed 14.01 miles at 7:40 average pace with 140 bpm average HR, running 42 seconds per mile faster than the prescribed 8:00 target. More importantly, you did this while running the second half 42 seconds faster than the first half (8:01 vs 7:19), showing you had the fitness to push harder but chose patient early pacing.

The mile-by-mile progression is masterclass: opened conservatively at 8:12 (HR 119), gradually warmed through miles 2-5 (8:02, 7:54, 8:03, 7:58 with HR 125-148), then systematically accelerated over the back half. Miles 11-14 averaged 7:21 pace at 140-145 bpm - this is tempo-adjacent work done at the end of a long run with complete HR control. The fact that your final mile (7:21) had the same HR as mile 5 (7:58) is a clear marker of aerobic efficiency improvement.

This performance validates your current fitness level is ahead of the training plan prescription. You''re running controlled long run pace 20+ seconds faster than target while maintaining lower HR than expected. Your natural tendency to negative split combined with excellent body awareness means you''re ready for more aggressive targets. The 2:55 marathon goal looks conservative at this trajectory.

You completed this feeling like you could keep going with no difficulty breathing - that''s exactly where long runs should finish. Week 9 closes with peak volume executed flawlessly.',
    '[{"mile": 1, "pace": "8:12/mi", "avg_hr": 119},
      {"mile": 2, "pace": "8:02/mi", "avg_hr": 125},
      {"mile": 3, "pace": "7:54/mi", "avg_hr": 132},
      {"mile": 4, "pace": "8:03/mi", "avg_hr": 140},
      {"mile": 5, "pace": "7:58/mi", "avg_hr": 148},
      {"mile": 6, "pace": "7:48/mi", "avg_hr": 145},
      {"mile": 7, "pace": "7:41/mi", "avg_hr": 142},
      {"mile": 8, "pace": "7:35/mi", "avg_hr": 140},
      {"mile": 9, "pace": "7:28/mi", "avg_hr": 138},
      {"mile": 10, "pace": "7:24/mi", "avg_hr": 139},
      {"mile": 11, "pace": "7:22/mi", "avg_hr": 140},
      {"mile": 12, "pace": "7:20/mi", "avg_hr": 142},
      {"mile": 13, "pace": "7:21/mi", "avg_hr": 144},
      {"mile": 14, "pace": "7:18/mi", "avg_hr": 145}]'::jsonb,
    9, 7
);

-- ============================================
-- WEEK 10
-- ============================================

-- Week 10 - Tue: Intervals
INSERT INTO workouts (
    user_id, plan_id, phase_id, title, workout_type, scheduled_date, status,
    prescribed_distance_miles, actual_duration_minutes, prescribed_pace_per_mile,
    avg_heart_rate, max_heart_rate, training_load, training_effect_aerobic,
    temperature_f,
    prescribed_description, personal_notes, coach_notes,
    week_number, day_of_week
) VALUES (
    v_user_id, v_plan_id, v_phase_specificity,
    'Week 10 — Tues: 8×3 min Intervals @ 6:05/mi',
    'run', '2025-12-02', 'completed',
    6.48, 47, '7:12/mi', 147, 167, 162.4, 3.8, 55,
    '2 mi WU → 8×3 min @ 6:00-6:10/mi w/ 90s jog → 1 mi CD. True VO2max intervals, hard but controlled. HR 180-190 bpm.',
    'Felt good throughout - cold morning so HR stayed low. Would say it felt more like 170s during second half of intervals. HRM should be accurate, but cold was suppressing slightly. Overall challenging but not too crazy.',
    'Solid interval execution that reveals your prescribed HR targets are set too high for your current fitness. You ran 8×800m at 6:03/mi average (right in the 6:00-6:10 window) with excellent consistency: 6:02, 6:01, 6:03, 6:06, 6:00, 6:05, 6:00, 6:05. Only 6 seconds of variation across 8 hard efforts.

The HR disconnect is significant. Average 147 bpm with intervals ranging 143-162 bpm, max 167. Prescribed: 180-190 bpm. You''re running 20-30 bpm below target. Your subjective "felt like 170s" matches interval 5 (HR 162, max 167). The Training Effect of 3.8 (Improving Lactate Threshold) confirms this wasn''t VO2 max work - it was high-end threshold stimulus.

What this means: Your aerobic efficiency has improved dramatically. You''re completing prescribed VO2 max pace at lactate threshold heart rates. Cold weather played a role, but this pattern is consistent with Week 9''s long run (14 mi @ 7:40, 140 bpm, 20 seconds faster than target). Your fitness is ahead of the plan''s conservative estimates.

Recoveries were perfect: 1:31-1:36 average, right at the prescribed 90 seconds.

Bottom line: Effective training that hit prescribed pace targets. The HR gap confirms your fitness is ahead of plan.',
    10, 2
);

-- Week 10 - Wed: 6 mi easy
INSERT INTO workouts (
    user_id, plan_id, phase_id, title, workout_type, scheduled_date, status,
    prescribed_distance_miles, actual_duration_minutes, prescribed_pace_per_mile,
    avg_heart_rate, max_heart_rate, elevation_gain_ft, pre_workout_resting_hr,
    training_load, training_effect_aerobic,
    prescribed_description, coach_notes,
    splits, week_number, day_of_week
) VALUES (
    v_user_id, v_plan_id, v_phase_specificity,
    'Week 10 — Wed: 6 mi easy',
    'run', '2025-12-03', 'completed',
    6.01, 47, '7:45/mi', 135, 148, 97, 55, 104, 3.3,
    'Easy',
    'Exceptional aerobic efficiency on display. You ran 6 miles with a progressive negative split (8:26 → 8:21 → 7:58 → 7:33 → 7:08 → 7:02) while maintaining 135 bpm average HR. That''s a 1:24/mile pace increase with HR climbing only 5 bpm from start to finish. Your mile 6 at 7:02 pace (135 bpm) is faster than many runners'' tempo pace - and you''re doing it as "easy" recovery work.

This run confirms the pattern from Week 9''s performances. Your lactate threshold is at 6:14/mi pace and 177 bpm. You''re finishing easy runs at 7:02 pace with 135 bpm - that''s 42 bpm below threshold at a pace only 1:12/mile slower than LT. Most runners see a 15-20 bpm range between easy and threshold efforts; you''re showing a 42 bpm range while running relatively fast easy pace. Your aerobic engine is operating at a level significantly beyond what the training plan''s conservative estimates assumed.

Resting HR at 55 bpm (2-day average: 55.5, baseline 51 bpm) shows 4 bpm elevation from Tuesday''s quality intervals. That''s appropriate post-workout fatigue - not concerning.

Your natural tendency to negative split continues to be an asset. Starting at 8:26 when you could have run 7:30 demonstrates excellent discipline.',
    '[{"mile": 1, "pace": "8:26/mi", "avg_hr": 130},
      {"mile": 2, "pace": "8:21/mi", "avg_hr": 132},
      {"mile": 3, "pace": "7:58/mi", "avg_hr": 135},
      {"mile": 4, "pace": "7:33/mi", "avg_hr": 136},
      {"mile": 5, "pace": "7:08/mi", "avg_hr": 137},
      {"mile": 6, "pace": "7:02/mi", "avg_hr": 135}]'::jsonb,
    10, 3
);

-- Week 10 - Fri: 5 mi easy
INSERT INTO workouts (
    user_id, plan_id, phase_id, title, workout_type, scheduled_date, status,
    prescribed_distance_miles, actual_duration_minutes, prescribed_pace_per_mile,
    avg_heart_rate, max_heart_rate, elevation_gain_ft, pre_workout_resting_hr,
    training_load, temperature_f, cadence_avg,
    prescribed_description, personal_notes, coach_notes,
    splits, week_number, day_of_week
) VALUES (
    v_user_id, v_plan_id, v_phase_specificity,
    'Week 10 — Fri: 5 mi easy',
    'run', '2025-12-05', 'completed',
    5.22, 42, '7:58/mi', 132, 149, 279, 54, 104, 57, 171,
    'Easy',
    'Another easy run. My 5-mile route starts off with some hills, so brings the HR up a bit initially but then mellow through the second half.',
    'Clean easy run execution with textbook negative splits. You ran 5.22 miles at 7:58 average pace with 132 bpm HR. The hilly first half (8:41→8:05, HR 135-136) gave way to a faster, flatter second half (7:40→7:15, HR 124-128). Your final mile at 7:15 pace with only 124 bpm is a clear signal of aerobic efficiency - that''s recovery-level heart rate at tempo-adjacent pace for most runners.

Your observation about the hills is exactly what the data shows. Mile 1 climbed 138 ft net, pushing HR to 136 despite conservative 8:41 pace. As terrain mellowed, you naturally accelerated while HR dropped 12 bpm. This is the pacing intelligence that will serve you well on race day.

Resting HR at 54 bpm shows mild post-interval fatigue from Tuesday - appropriate recovery signal, not concerning.

Sunday''s 16-miler with marathon pace finish is the week''s key session. Saturday is rest. Watch morning RHR - if it drops to 52-53 bpm, you''re primed for a strong effort.',
    '[{"mile": 1, "pace": "8:41/mi", "avg_hr": 136},
      {"mile": 2, "pace": "8:21/mi", "avg_hr": 135},
      {"mile": 3, "pace": "8:05/mi", "avg_hr": 136},
      {"mile": 4, "pace": "7:40/mi", "avg_hr": 128},
      {"mile": 5, "pace": "7:15/mi", "avg_hr": 124}]'::jsonb,
    10, 5
);

RAISE NOTICE 'Weeks 7-10 imported!';

END $$;

-- Verify
SELECT COUNT(*) as total_workouts FROM workouts WHERE user_id = '00000000-0000-0000-0000-000000000001';

