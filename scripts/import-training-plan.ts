/**
 * Import Marathon Training Plan from Notion CSV Export
 *
 * Run: npx tsx scripts/import-training-plan.ts
 *
 * This script:
 * 1. Creates the training plan
 * 2. Creates training phases (Base Build, Endurance Build, etc.)
 * 3. Creates training weeks with summaries
 * 4. Imports all workouts with rich Garmin data parsing
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import * as path from 'path';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const USER_ID = process.env.USER_ID || '00000000-0000-0000-0000-000000000001';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// CSV path - the "all" version has richer data
const CSV_PATH = '/Users/danielbatten/Downloads/ExportBlock-61483298-d851-4b81-bfad-6a39daffce20-Part-1/Marathon Base-to-Block Plan 6057e16c12e34889aaf4b341b56e4638_all.csv';

// ============================================
// TYPE DEFINITIONS
// ============================================
interface CsvRow {
  Event: string;
  'Coach Notes': string;
  'Completed Run': string;
  Date: string;
  'Distance (mi)': string;
  'Pace/Notes': string;
  'Personal Notes': string;
  Phase: string;
  State: string;
  Type: string;
  Week: string;
  'Workout Type': string;
}

interface ParsedSplit {
  mile: number;
  pace: string;
  pace_seconds?: number;
  elevation_ft?: number;
  hr_avg?: number;
  hr_max?: number;
  power?: number;
}

interface ParsedBiometrics {
  resting_hr?: number;
  max_hr?: number;
  training_effect_aerobic?: number;
  training_effect_anaerobic?: number;
  training_load?: number;
  cadence?: number;
  ground_contact_time_ms?: number;
  vertical_oscillation_cm?: number;
  avg_power?: number;
  body_battery_drop?: number;
  recovery_hr?: number;
}

interface ParsedWorkout {
  distance_miles?: number;
  duration_minutes?: number;
  avg_pace?: string;
  avg_pace_seconds?: number;
  elevation_ft?: number;
  avg_hr?: number;
  max_hr?: number;
  splits: ParsedSplit[];
  biometrics: ParsedBiometrics;
  fueling?: {
    pre?: string;
    during?: string;
  };
  conditions?: string;
  raw_text: string;
}

// ============================================
// PARSING FUNCTIONS
// ============================================

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  // Format: "October 6, 2025 6:00 AM (PDT) → 7:30 AM"
  // Or: "September 29, 2025 6:00 AM (PDT) → 7:30 AM"
  const match = dateStr.match(/^(\w+)\s+(\d+),\s+(\d{4})/);
  if (!match) return null;

  const monthNames: Record<string, number> = {
    January: 0, February: 1, March: 2, April: 3, May: 4, June: 5,
    July: 6, August: 7, September: 8, October: 9, November: 10, December: 11
  };

  const month = monthNames[match[1]];
  const day = parseInt(match[2]);
  const year = parseInt(match[3]);

  if (month === undefined) return null;
  return new Date(year, month, day);
}

function parsePaceToSeconds(pace: string): number | undefined {
  // "8:05/mi" -> 485 seconds
  const match = pace.match(/(\d+):(\d+)/);
  if (!match) return undefined;
  return parseInt(match[1]) * 60 + parseInt(match[2]);
}

function parseDuration(timeStr: string): number | undefined {
  // "1:33:35" -> 93.58 minutes
  // "46:48" -> 46.8 minutes
  const parts = timeStr.split(':').map(Number);
  if (parts.length === 3) {
    return parts[0] * 60 + parts[1] + parts[2] / 60;
  } else if (parts.length === 2) {
    return parts[0] + parts[1] / 60;
  }
  return undefined;
}

function parseCompletedRun(text: string): ParsedWorkout {
  const result: ParsedWorkout = {
    splits: [],
    biometrics: {},
    raw_text: text
  };

  if (!text || text.trim() === '') return result;

  // Parse distance: "Distance: 6.01 mi" or "6.01 mi in"
  const distanceMatch = text.match(/Distance:\s*([\d.]+)\s*mi/i) ||
                        text.match(/([\d.]+)\s*mi\s+in/i);
  if (distanceMatch) {
    result.distance_miles = parseFloat(distanceMatch[1]);
  }

  // Parse time: "Time: 46:48" or "in 46:48"
  const timeMatch = text.match(/Time:\s*(\d+:\d+(?::\d+)?)/i) ||
                    text.match(/in\s+(\d+:\d+(?::\d+)?)\s*\(/i);
  if (timeMatch) {
    result.duration_minutes = parseDuration(timeMatch[1]);
  }

  // Parse avg pace: "Avg Pace: 7:47/mi" or "Pace: 7:47/mi" or "(7:47/mi avg)"
  const paceMatch = text.match(/(?:Avg\s+)?Pace:\s*([\d:]+)\/mi/i) ||
                    text.match(/\(([\d:]+)\/mi\s+avg\)/i);
  if (paceMatch) {
    result.avg_pace = paceMatch[1] + '/mi';
    result.avg_pace_seconds = parsePaceToSeconds(paceMatch[1]);
  }

  // Parse elevation: "Elev: +92 ft" or "Elevation: +127 ft" or "+545 ft"
  const elevMatch = text.match(/Elev(?:ation)?:\s*\+?(\d+)\s*ft/i) ||
                    text.match(/\+(\d+)\s*ft\s*\|/i);
  if (elevMatch) {
    result.elevation_ft = parseInt(elevMatch[1]);
  }

  // Parse avg HR: "Avg HR: 154 bpm" or "| HR 154 |"
  const avgHrMatch = text.match(/Avg\s+HR:\s*(\d+)/i) ||
                     text.match(/\|\s*(?:Avg\s+)?HR\s+(\d+)/i);
  if (avgHrMatch) {
    result.avg_hr = parseInt(avgHrMatch[1]);
  }

  // Parse max HR
  const maxHrMatch = text.match(/Max\s+HR:\s*(\d+)/i);
  if (maxHrMatch) {
    result.biometrics.max_hr = parseInt(maxHrMatch[1]);
  }

  // Parse resting HR: "Resting HR: 52 bpm"
  const restingHrMatch = text.match(/Resting\s+HR:\s*(\d+)/i);
  if (restingHrMatch) {
    result.biometrics.resting_hr = parseInt(restingHrMatch[1]);
  }

  // Parse training effect: "Training Effect: 4.0" or "Training Effect: 5.0 (Overreaching)"
  const teMatch = text.match(/Training\s+Effect:\s*([\d.]+)/i);
  if (teMatch) {
    result.biometrics.training_effect_aerobic = parseFloat(teMatch[1]);
  }

  // Parse anaerobic TE: "Anaerobic TE: 2.6"
  const ateMatch = text.match(/Anaerobic\s+TE:\s*([\d.]+)/i);
  if (ateMatch) {
    result.biometrics.training_effect_anaerobic = parseFloat(ateMatch[1]);
  }

  // Parse training load: "Training Load: 168"
  const loadMatch = text.match(/Training\s+Load:\s*([\d.]+)/i);
  if (loadMatch) {
    result.biometrics.training_load = parseFloat(loadMatch[1]);
  }

  // Parse cadence: "Cadence: 169 spm"
  const cadenceMatch = text.match(/Cadence:\s*(\d+)/i);
  if (cadenceMatch) {
    result.biometrics.cadence = parseInt(cadenceMatch[1]);
  }

  // Parse ground contact time: "Ground Contact Time: 258 ms"
  const gctMatch = text.match(/Ground\s+Contact\s+Time:\s*(\d+)/i);
  if (gctMatch) {
    result.biometrics.ground_contact_time_ms = parseInt(gctMatch[1]);
  }

  // Parse vertical oscillation: "Vertical Oscillation: 9.9 cm"
  const voMatch = text.match(/Vertical\s+Oscillation:\s*([\d.]+)/i);
  if (voMatch) {
    result.biometrics.vertical_oscillation_cm = parseFloat(voMatch[1]);
  }

  // Parse power: "Avg Power: 327W" or "337W avg power"
  const powerMatch = text.match(/(?:Avg\s+)?Power:\s*(\d+)/i) ||
                     text.match(/(\d+)W\s+avg\s+power/i);
  if (powerMatch) {
    result.biometrics.avg_power = parseInt(powerMatch[1]);
  }

  // Parse body battery drop: "Body Battery Drop: -17"
  const bbMatch = text.match(/Body\s+Battery\s+Drop:\s*-?(\d+)/i);
  if (bbMatch) {
    result.biometrics.body_battery_drop = parseInt(bbMatch[1]);
  }

  // Parse recovery HR: "Recovery Heart Rate: 42 bpm"
  const recoveryHrMatch = text.match(/Recovery\s+(?:Heart\s+Rate|HR):\s*(\d+)/i);
  if (recoveryHrMatch) {
    result.biometrics.recovery_hr = parseInt(recoveryHrMatch[1]);
  }

  // Parse splits - multiple formats
  // Format 1: "Mile 1: 8:25/mi (+1 ft) | HR 122 bpm"
  // Format 2: "1     8:13/mi  +67 ft   138"
  // Format 3: "Mile 1: 8:51 (136 bpm)"
  const splitPatterns = [
    // Pattern: "Mile 1: 8:25/mi (+1 ft) | HR 122 bpm"
    /Mile\s+(\d+):\s*([\d:]+)(?:\/mi)?\s*(?:\(?\+?(-?\d+)\s*(?:ft|m)\)?)?\s*(?:\|\s*HR\s*(\d+))?/gi,
    // Pattern: "1     8:13/mi  +67 ft   138"
    /^(\d+)\s+([\d:]+)\/mi\s+[+\-]?(\d+)\s*ft\s+(\d+)/gm,
    // Pattern: "Mile 1: 8:51 (136 bpm)" or "Mile 1: 8:51/mi @ 136 bpm"
    /Mile\s+(\d+):\s*([\d:]+)(?:\/mi)?\s*(?:@\s*)?(?:\()?(\d+)\s*(?:bpm)?\)?/gi
  ];

  // Try each pattern
  for (const pattern of splitPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const split: ParsedSplit = {
        mile: parseInt(match[1]),
        pace: match[2].includes(':') ? match[2] : match[2] + '/mi',
        pace_seconds: parsePaceToSeconds(match[2])
      };

      if (match[3]) {
        // Could be elevation or HR depending on pattern
        const val = parseInt(match[3]);
        if (val > 50 && val < 250) {
          split.hr_avg = val;
        } else {
          split.elevation_ft = val;
        }
      }

      if (match[4]) {
        const val = parseInt(match[4]);
        if (val > 50 && val < 250) {
          split.hr_avg = val;
        }
      }

      // Avoid duplicates
      if (!result.splits.find(s => s.mile === split.mile)) {
        result.splits.push(split);
      }
    }
  }

  // Sort splits by mile
  result.splits.sort((a, b) => a.mile - b.mile);

  // Parse fueling: "Huma gel pre-run, Cadence Fuel Gel at 6 miles"
  const fuelingMatch = text.match(/Fueling:\s*([^\n]+)/i);
  if (fuelingMatch) {
    result.fueling = { pre: fuelingMatch[1].trim() };
  }

  // Parse conditions: "Conditions: Cold morning (55°F)"
  const conditionsMatch = text.match(/Conditions?:\s*([^\n]+)/i);
  if (conditionsMatch) {
    result.conditions = conditionsMatch[1].trim();
  }

  return result;
}

function getWorkoutType(typeStr: string): string {
  const type = typeStr?.toLowerCase() || 'easy';
  if (type.includes('tempo')) return 'tempo';
  if (type.includes('interval')) return 'intervals';
  if (type.includes('long')) return 'long_run';
  if (type.includes('progression')) return 'progression';
  if (type.includes('easy')) return 'easy';
  if (type.includes('recovery')) return 'recovery';
  return 'easy';
}

function getWorkoutStatus(state: string): string {
  const s = state?.toLowerCase() || '';
  if (s.includes('done') || s.includes('completed')) return 'completed';
  if (s.includes('did not') || s.includes('skipped')) return 'skipped';
  return 'planned';
}

function getDayOfWeek(date: Date): number {
  // Convert Sunday=0 to Monday=1 format
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

function getPhaseType(phaseName: string): string {
  const name = phaseName?.toLowerCase() || '';
  if (name.includes('base')) return 'base';
  if (name.includes('build') || name.includes('endurance')) return 'build';
  if (name.includes('peak') || name.includes('specificity')) return 'peak';
  if (name.includes('taper')) return 'taper';
  if (name.includes('transition')) return 'transition';
  if (name.includes('recovery')) return 'recovery';
  return 'build';
}

// ============================================
// MAIN IMPORT FUNCTION
// ============================================
async function importTrainingPlan() {
  console.log('\n🏃 Importing Marathon Training Plan...\n');

  // Read CSV
  const csvContent = readFileSync(CSV_PATH, 'utf-8');
  const records: CsvRow[] = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    bom: true
  });

  console.log(`📊 Found ${records.length} rows in CSV\n`);

  // Separate workouts and summaries
  const workouts = records.filter(r => r.Type === 'Workout' && r.Week);
  const summaries = records.filter(r => r.Type === 'Summary');

  console.log(`   Workouts: ${workouts.length}`);
  console.log(`   Summaries: ${summaries.length}\n`);

  // ============================================
  // 1. CREATE TRAINING PLAN
  // ============================================
  console.log('📋 Creating training plan...');

  // Calculate date range from workouts
  const dates = workouts
    .map(w => parseDate(w.Date))
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime());

  const startDate = dates[0] || new Date('2025-09-29');
  const endDate = dates[dates.length - 1] || new Date('2026-01-18');

  // Delete existing plan if present
  await supabase
    .from('training_plans')
    .delete()
    .eq('name', 'Marathon Base-to-Block Plan');

  const { data: plan, error: planError } = await supabase
    .from('training_plans')
    .insert({
      user_id: USER_ID,
      name: 'Marathon Base-to-Block Plan',
      description: '16-week marathon preparation plan targeting LA Marathon 2026 with sub-2:55 goal',
      sport: 'running',
      goal_event: 'LA Marathon 2026',
      goal_time_seconds: 10500, // 2:55:00
      goal_pace_per_mile_seconds: 400, // 6:40/mi
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
      total_weeks: 16,
      status: 'active',
      current_week: 10, // Based on current progress
      config: {
        training_philosophy: 'polarized',
        weekly_structure: {
          monday: 'quality',
          tuesday: 'easy',
          wednesday: 'easy',
          thursday: 'easy',
          friday: 'easy',
          saturday: 'long_run',
          sunday: 'rest'
        },
        intensity_distribution: {
          easy: 80,
          tempo: 10,
          intervals: 10
        }
      },
      coaching_style: 'analytical',
      adaptation_aggressiveness: 'moderate',
      tags: ['marathon', '2025-2026', 'la-marathon'],
      metadata: {
        imported_from: 'notion',
        imported_at: new Date().toISOString(),
        source_file: path.basename(CSV_PATH)
      }
    })
    .select()
    .single();

  if (planError) {
    console.error('❌ Failed to create plan:', planError.message);
    return;
  }

  console.log(`   ✅ Created plan: ${plan.name} (${plan.id})\n`);

  // ============================================
  // 2. CREATE TRAINING PHASES
  // ============================================
  console.log('📊 Creating training phases...');

  const phases = [
    {
      name: 'October – Base Build',
      phase_type: 'base',
      start_week: 1,
      end_week: 4,
      focus_areas: ['aerobic_base', 'running_economy', 'form'],
      weekly_volume_target_miles: 25
    },
    {
      name: 'November – Endurance Build',
      phase_type: 'build',
      start_week: 5,
      end_week: 8,
      focus_areas: ['endurance', 'threshold_work', 'long_run_progression'],
      weekly_volume_target_miles: 30
    },
    {
      name: 'December – Pre-Marathon Specificity',
      phase_type: 'peak',
      start_week: 9,
      end_week: 12,
      focus_areas: ['marathon_pace', 'race_simulation', 'mental_toughness'],
      weekly_volume_target_miles: 35
    },
    {
      name: 'January – Transition to Marathon Block',
      phase_type: 'transition',
      start_week: 13,
      end_week: 16,
      focus_areas: ['peak_fitness', 'race_readiness', 'taper'],
      weekly_volume_target_miles: 30
    }
  ];

  const phaseMap = new Map<string, string>(); // phase name -> phase id

  for (const phase of phases) {
    const { data: phaseData, error: phaseError } = await supabase
      .from('training_phases')
      .insert({
        plan_id: plan.id,
        ...phase
      })
      .select()
      .single();

    if (phaseError) {
      console.error(`   ❌ Failed to create phase ${phase.name}:`, phaseError.message);
    } else {
      phaseMap.set(phase.name, phaseData.id);
      console.log(`   ✅ ${phase.name} (weeks ${phase.start_week}-${phase.end_week})`);
    }
  }

  console.log('');

  // ============================================
  // 3. CREATE TRAINING WEEKS
  // ============================================
  console.log('📅 Creating training weeks...');

  const weekMap = new Map<number, string>(); // week number -> week id

  for (let week = 1; week <= 16; week++) {
    // Find phase for this week
    const phase = phases.find(p => week >= p.start_week && week <= p.end_week);
    const phaseId = phase ? phaseMap.get(phase.name) : null;

    // Calculate week dates
    const weekStartDate = new Date(startDate);
    weekStartDate.setDate(weekStartDate.getDate() + (week - 1) * 7);
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekEndDate.getDate() + 6);

    // Find summary for this week
    const summary = summaries.find(s => parseInt(s.Week) === week);
    const weekSummaryText = summary?.['Coach Notes'] || null;

    // Calculate actual stats from workouts
    const weekWorkouts = workouts.filter(w => parseInt(w.Week) === week);
    const completedWorkouts = weekWorkouts.filter(w => getWorkoutStatus(w.State) === 'completed');
    const skippedWorkouts = weekWorkouts.filter(w => getWorkoutStatus(w.State) === 'skipped');

    let totalMiles = 0;
    let totalLoad = 0;

    for (const wo of completedWorkouts) {
      const parsed = parseCompletedRun(wo['Completed Run']);
      if (parsed.distance_miles) totalMiles += parsed.distance_miles;
      if (parsed.biometrics.training_load) totalLoad += parsed.biometrics.training_load;
    }

    const { data: weekData, error: weekError } = await supabase
      .from('training_weeks')
      .insert({
        plan_id: plan.id,
        phase_id: phaseId,
        user_id: USER_ID,
        week_number: week,
        start_date: weekStartDate.toISOString().split('T')[0],
        end_date: weekEndDate.toISOString().split('T')[0],
        planned_volume_miles: phase?.weekly_volume_target_miles,
        planned_workouts: weekWorkouts.length,
        actual_volume_miles: totalMiles > 0 ? totalMiles : null,
        actual_workouts_completed: completedWorkouts.length,
        actual_workouts_skipped: skippedWorkouts.length,
        total_training_load: totalLoad > 0 ? totalLoad : null,
        week_summary: weekSummaryText,
        status: completedWorkouts.length > 0 ? 'completed' : 'planned'
      })
      .select()
      .single();

    if (weekError) {
      console.error(`   ❌ Week ${week}:`, weekError.message);
    } else {
      weekMap.set(week, weekData.id);
      const status = weekData.status === 'completed' ? '✅' : '⏳';
      console.log(`   ${status} Week ${week}: ${totalMiles.toFixed(1)} mi, ${completedWorkouts.length}/${weekWorkouts.length} workouts`);
    }
  }

  console.log('');

  // ============================================
  // 4. IMPORT WORKOUTS
  // ============================================
  console.log('💪 Importing workouts...');

  let imported = 0;
  let failed = 0;

  for (const row of workouts) {
    const workoutDate = parseDate(row.Date);
    if (!workoutDate) {
      console.warn(`   ⚠️ Skipping workout with invalid date: ${row.Event}`);
      failed++;
      continue;
    }

    const weekNum = parseInt(row.Week);
    const weekId = weekMap.get(weekNum);
    const phase = phases.find(p => weekNum >= p.start_week && weekNum <= p.end_week);
    const phaseId = phase ? phaseMap.get(phase.name) : null;

    // Parse completed run data
    const parsed = parseCompletedRun(row['Completed Run']);

    // Parse prescribed distance from the column
    const prescribedDistance = row['Distance (mi)']
      ? parseFloat(row['Distance (mi)'])
      : undefined;

    // Store biometric data in metrics JSONB (works with base schema)
    const metrics = {
      avg_hr: parsed.avg_hr || null,
      max_hr: parsed.biometrics.max_hr || null,
      resting_hr: parsed.biometrics.resting_hr || null,
      training_load: parsed.biometrics.training_load || null,
      training_effect_aerobic: parsed.biometrics.training_effect_aerobic || null,
      training_effect_anaerobic: parsed.biometrics.training_effect_anaerobic || null,
      cadence: parsed.biometrics.cadence || null,
      ground_contact_time_ms: parsed.biometrics.ground_contact_time_ms || null,
      vertical_oscillation_cm: parsed.biometrics.vertical_oscillation_cm || null,
      avg_power_watts: parsed.biometrics.avg_power || null,
      body_battery_drop: parsed.biometrics.body_battery_drop || null,
      recovery_hr: parsed.biometrics.recovery_hr || null,
      splits: parsed.splits.length > 0 ? parsed.splits : null,
      fueling: parsed.fueling || null,
      conditions: parsed.conditions || null,
      raw_garmin_export: parsed.raw_text || null
    };

    const workoutData = {
      user_id: USER_ID,
      
      // Basic info (base schema columns)
      title: row.Event,
      type: getWorkoutType(row['Workout Type']),
      date: workoutDate.toISOString().split('T')[0],
      status: getWorkoutStatus(row.State),

      // Execution - actual data (base schema columns)
      distance_miles: parsed.distance_miles || null,
      duration_minutes: parsed.duration_minutes
        ? Math.round(parsed.duration_minutes)
        : null,
      pace_per_mile: parsed.avg_pace || null,
      elevation_ft: parsed.elevation_ft || null,

      // Notes (base schema)
      notes: [
        row['Personal Notes'] ? `Personal: ${row['Personal Notes']}` : '',
        row['Pace/Notes'] ? `Prescribed: ${row['Pace/Notes']}` : ''
      ].filter(Boolean).join('\n\n') || null,

      // Metrics JSONB - all biometric data
      metrics: metrics,

      // Metadata
      metadata: {
        imported_from: 'notion',
        imported_at: new Date().toISOString(),
        original_phase: row.Phase,
        week_number: weekNum,
        coach_notes: row['Coach Notes'] || null,
        prescribed_distance_miles: prescribedDistance || null
      }
    };

    const { error: workoutError } = await supabase
      .from('workouts')
      .insert(workoutData);

    if (workoutError) {
      console.error(`   ❌ ${row.Event}:`, workoutError.message);
      failed++;
    } else {
      imported++;
    }
  }

  console.log(`\n   ✅ Imported: ${imported} workouts`);
  if (failed > 0) {
    console.log(`   ❌ Failed: ${failed} workouts`);
  }

  // ============================================
  // 5. SUMMARY
  // ============================================
  console.log('\n' + '='.repeat(50));
  console.log('✨ Import complete!\n');

  // Query final stats
  const { count: workoutCount } = await supabase
    .from('workouts')
    .select('*', { count: 'exact', head: true })
    .eq('plan_id', plan.id);

  const { count: completedCount } = await supabase
    .from('workouts')
    .select('*', { count: 'exact', head: true })
    .eq('plan_id', plan.id)
    .eq('status', 'completed');

  console.log('📊 Final Statistics:');
  console.log(`   Plan: ${plan.name}`);
  console.log(`   Phases: ${phases.length}`);
  console.log(`   Weeks: 16`);
  console.log(`   Total Workouts: ${workoutCount}`);
  console.log(`   Completed: ${completedCount}`);
  console.log(`   Completion Rate: ${((completedCount || 0) / (workoutCount || 1) * 100).toFixed(1)}%`);
}

// Run
importTrainingPlan().catch(console.error);

