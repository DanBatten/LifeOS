/**
 * Import Marathon Training Plan from Notion CSV Export
 *
 * Usage:
 *   npx tsx scripts/import-marathon-plan.ts /path/to/export.csv
 *
 * This script:
 * 1. Creates the training plan
 * 2. Creates training phases
 * 3. Creates training weeks
 * 4. Imports all workouts with full data
 * 5. Parses the rich "Completed Run" data into structured fields
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const USER_ID = process.env.USER_ID || '00000000-0000-0000-0000-000000000001';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Types
interface NotionRow {
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

interface ParsedBiometrics {
  distance_miles?: number;
  duration_minutes?: number;
  avg_pace?: string;
  elevation_ft?: number;
  avg_hr?: number;
  max_hr?: number;
  resting_hr?: number;
  training_effect_aerobic?: number;
  training_effect_anaerobic?: number;
  training_load?: number;
  cadence?: number;
  ground_contact_time_ms?: number;
  vertical_oscillation_cm?: number;
  avg_power_watts?: number;
  body_battery_drop?: number;
  splits?: Array<{
    mile: number;
    pace: string;
    elevation: string;
    hr: number;
  }>;
}

// Parse the "Completed Run" field which contains rich Garmin data
function parseCompletedRun(raw: string): ParsedBiometrics {
  if (!raw || raw.trim() === '') return {};

  const result: ParsedBiometrics = {};

  // Distance
  const distMatch = raw.match(/Distance:\s*([\d.]+)\s*mi/i);
  if (distMatch) result.distance_miles = parseFloat(distMatch[1]);

  // Time/Duration - handle formats like "1:33:35" or "46:48"
  const timeMatch = raw.match(/Time:\s*(\d+:?\d*:\d+)/i);
  if (timeMatch) {
    const parts = timeMatch[1].split(':').map(Number);
    if (parts.length === 3) {
      result.duration_minutes = parts[0] * 60 + parts[1] + parts[2] / 60;
    } else if (parts.length === 2) {
      result.duration_minutes = parts[0] + parts[1] / 60;
    }
  }

  // Average Pace
  const paceMatch = raw.match(/(?:Avg\s*)?Pace:\s*([\d:]+\/mi)/i);
  if (paceMatch) result.avg_pace = paceMatch[1];

  // Elevation
  const elevMatch = raw.match(/Elev(?:ation)?:\s*\+?(\d+)\s*ft/i);
  if (elevMatch) result.elevation_ft = parseInt(elevMatch[1]);

  // Heart Rate
  const avgHrMatch = raw.match(/Avg\s*HR:\s*(\d+)\s*bpm/i);
  if (avgHrMatch) result.avg_hr = parseInt(avgHrMatch[1]);

  const maxHrMatch = raw.match(/Max\s*HR:\s*(\d+)\s*bpm/i);
  if (maxHrMatch) result.max_hr = parseInt(maxHrMatch[1]);

  const restingHrMatch = raw.match(/Resting\s*HR:\s*(\d+)\s*bpm/i);
  if (restingHrMatch) result.resting_hr = parseInt(restingHrMatch[1]);

  // Training Effect
  const teAerobicMatch = raw.match(/Training\s*Effect:\s*([\d.]+)/i);
  if (teAerobicMatch) result.training_effect_aerobic = parseFloat(teAerobicMatch[1]);

  const teAnaerobicMatch = raw.match(/Anaerobic\s*TE:\s*([\d.]+)/i);
  if (teAnaerobicMatch) result.training_effect_anaerobic = parseFloat(teAnaerobicMatch[1]);

  // Training Load
  const loadMatch = raw.match(/Training\s*Load:\s*([\d.]+)/i);
  if (loadMatch) result.training_load = parseFloat(loadMatch[1]);

  // Cadence
  const cadenceMatch = raw.match(/Cadence:\s*(\d+)\s*spm/i);
  if (cadenceMatch) result.cadence = parseInt(cadenceMatch[1]);

  // Ground Contact Time
  const gctMatch = raw.match(/Ground\s*Contact\s*Time:\s*(\d+)\s*ms/i);
  if (gctMatch) result.ground_contact_time_ms = parseInt(gctMatch[1]);

  // Vertical Oscillation
  const voMatch = raw.match(/Vertical\s*Oscillation:\s*([\d.]+)\s*cm/i);
  if (voMatch) result.vertical_oscillation_cm = parseFloat(voMatch[1]);

  // Power
  const powerMatch = raw.match(/(?:Avg\s*)?Power:\s*(\d+)\s*W/i);
  if (powerMatch) result.avg_power_watts = parseInt(powerMatch[1]);

  // Body Battery
  const bbMatch = raw.match(/Body\s*Battery\s*Drop:\s*-?(\d+)/i);
  if (bbMatch) result.body_battery_drop = parseInt(bbMatch[1]);

  // Parse splits
  const splits: ParsedBiometrics['splits'] = [];
  const splitPattern = /Mile\s*(\d+):\s*([\d:]+\/mi)\s*\(?\+?([-\d]+)\s*ft\)?\s*\|?\s*(?:HR\s*)?(\d+)\s*bpm/gi;
  let match;
  while ((match = splitPattern.exec(raw)) !== null) {
    splits.push({
      mile: parseInt(match[1]),
      pace: match[2],
      elevation: match[3],
      hr: parseInt(match[4]),
    });
  }

  // Also try alternate split format
  const altSplitPattern = /(\d+)\s+([\d:]+\/mi)\s+([+-]?\d+)\s*ft\s+(\d+)/g;
  while ((match = altSplitPattern.exec(raw)) !== null) {
    if (!splits.find(s => s.mile === parseInt(match[1]))) {
      splits.push({
        mile: parseInt(match[1]),
        pace: match[2],
        elevation: match[3],
        hr: parseInt(match[4]),
      });
    }
  }

  if (splits.length > 0) {
    result.splits = splits.sort((a, b) => a.mile - b.mile);
  }

  return result;
}

// Parse date from Notion format: "November 5, 2025 6:00 AM (PST) → 7:30 AM"
function parseNotionDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  // Extract just the start date/time
  const match = dateStr.match(/^([A-Za-z]+ \d+, \d{4})\s+(\d+:\d+ [AP]M)/);
  if (!match) return null;

  const [, datePart, timePart] = match;
  const parsed = new Date(`${datePart} ${timePart}`);

  return isNaN(parsed.getTime()) ? null : parsed;
}

// Map Phase to phase_type
function mapPhaseType(phase: string): string {
  const lower = phase.toLowerCase();
  if (lower.includes('base')) return 'base';
  if (lower.includes('build') || lower.includes('endurance')) return 'build';
  if (lower.includes('specificity') || lower.includes('peak')) return 'peak';
  if (lower.includes('taper')) return 'taper';
  if (lower.includes('transition')) return 'transition';
  if (lower.includes('recovery')) return 'recovery';
  return 'build';
}

// Map workout type
function mapWorkoutType(type: string): string {
  const lower = (type || '').toLowerCase();
  if (lower.includes('easy')) return 'easy';
  if (lower.includes('long')) return 'run'; // Will use workout_type field
  if (lower.includes('tempo')) return 'run';
  if (lower.includes('interval')) return 'run';
  if (lower.includes('progression')) return 'run';
  if (lower.includes('recovery')) return 'easy';
  return 'run';
}

// Map status
function mapStatus(state: string): string {
  const lower = (state || '').toLowerCase();
  if (lower === 'done') return 'completed';
  if (lower.includes('did not') || lower.includes('skip')) return 'skipped';
  return 'planned';
}

async function importPlan(csvPath: string) {
  console.log(`\n📂 Reading CSV from: ${csvPath}\n`);

  const csvContent = readFileSync(csvPath, 'utf-8');
  const records: NotionRow[] = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    bom: true,
  });

  console.log(`📊 Found ${records.length} rows\n`);

  // Filter to actual workouts (not summary rows)
  const workouts = records.filter(r =>
    r.Type === 'Workout' &&
    r.Week &&
    r.Event &&
    !r.Event.toLowerCase().includes('summary')
  );

  console.log(`🏃 Found ${workouts.length} workout entries\n`);

  // Extract unique phases
  const phases = [...new Set(workouts.map(w => w.Phase).filter(Boolean))];
  console.log(`📅 Phases: ${phases.join(', ')}\n`);

  // 1. Create Training Plan
  console.log('Creating training plan...');
  const { data: plan, error: planError } = await supabase
    .from('training_plans')
    .insert({
      user_id: USER_ID,
      name: 'Marathon Base-to-Block Plan',
      description: '16-week marathon training plan targeting sub-2:55 finish',
      sport: 'running',
      goal_event: 'Target Marathon',
      goal_time_seconds: 10500, // 2:55:00
      goal_pace_per_mile_seconds: 400, // 6:40/mi
      start_date: '2025-09-29',
      end_date: '2026-01-18',
      total_weeks: 16,
      status: 'active',
      current_week: 10,
      config: {
        imported_from: 'notion',
        import_date: new Date().toISOString(),
        original_file: csvPath,
      },
      coaching_style: 'analytical',
      adaptation_aggressiveness: 'moderate',
    })
    .select()
    .single();

  if (planError) {
    console.error('Failed to create plan:', planError);
    return;
  }

  console.log(`✅ Created plan: ${plan.id}\n`);

  // 2. Create Training Phases
  console.log('Creating training phases...');
  const phaseMap: Record<string, string> = {};

  const phaseConfigs = [
    { name: 'October – Base Build', type: 'base', startWeek: 1, endWeek: 4 },
    { name: 'November – Endurance Build', type: 'build', startWeek: 5, endWeek: 8 },
    { name: 'December – Pre-Marathon Specificity', type: 'peak', startWeek: 9, endWeek: 12 },
    { name: 'January – Transition to Marathon Block', type: 'transition', startWeek: 13, endWeek: 16 },
  ];

  for (const pc of phaseConfigs) {
    const { data: phase, error: phaseError } = await supabase
      .from('training_phases')
      .insert({
        plan_id: plan.id,
        name: pc.name,
        phase_type: pc.type,
        start_week: pc.startWeek,
        end_week: pc.endWeek,
        focus_areas: pc.type === 'base' ? ['aerobic_base', 'consistency']
          : pc.type === 'build' ? ['endurance', 'long_run']
          : pc.type === 'peak' ? ['marathon_pace', 'race_simulation']
          : ['sharpening', 'freshness'],
      })
      .select()
      .single();

    if (phaseError) {
      console.error(`Failed to create phase ${pc.name}:`, phaseError);
    } else {
      phaseMap[pc.name] = phase.id;
      console.log(`  ✅ Created phase: ${pc.name}`);
    }
  }

  // 3. Import Workouts
  console.log('\nImporting workouts...');
  let imported = 0;
  let skipped = 0;

  for (const row of workouts) {
    const weekNum = parseInt(row.Week);
    if (isNaN(weekNum)) {
      skipped++;
      continue;
    }

    const scheduledDate = parseNotionDate(row.Date);
    const status = mapStatus(row.State);
    const biometrics = parseCompletedRun(row['Completed Run']);

    // Determine workout type for the enum
    const workoutTypeRaw = (row['Workout Type'] || 'easy').toLowerCase();
    let workoutType: string;
    if (workoutTypeRaw.includes('long')) workoutType = 'run';
    else if (workoutTypeRaw.includes('tempo')) workoutType = 'run';
    else if (workoutTypeRaw.includes('interval')) workoutType = 'hiit';
    else if (workoutTypeRaw.includes('progression')) workoutType = 'run';
    else if (workoutTypeRaw.includes('easy')) workoutType = 'run';
    else workoutType = 'run';

    const workoutData = {
      user_id: USER_ID,
      plan_id: plan.id,
      phase_id: phaseMap[row.Phase] || null,
      week_number: weekNum,

      // Basic info
      title: row.Event,
      workout_type: workoutType,
      status: status,
      scheduled_date: scheduledDate?.toISOString().split('T')[0] || null,

      // Prescription
      prescribed_description: row['Pace/Notes'],
      prescribed_distance_miles: parseFloat(row['Distance (mi)']) || null,
      planned_duration_minutes: biometrics.duration_minutes || null,

      // Execution
      actual_duration_minutes: biometrics.duration_minutes
        ? Math.round(biometrics.duration_minutes)
        : null,

      // Biometrics
      avg_heart_rate: biometrics.avg_hr || null,
      max_heart_rate: biometrics.max_hr || null,
      pre_workout_resting_hr: biometrics.resting_hr || null,
      training_load: biometrics.training_load || null,
      training_effect_aerobic: biometrics.training_effect_aerobic || null,
      training_effect_anaerobic: biometrics.training_effect_anaerobic || null,
      cadence_avg: biometrics.cadence || null,
      ground_contact_time_ms: biometrics.ground_contact_time_ms || null,
      vertical_oscillation_cm: biometrics.vertical_oscillation_cm || null,
      avg_power_watts: biometrics.avg_power_watts || null,
      elevation_gain_ft: biometrics.elevation_ft || null,

      // Splits
      splits: biometrics.splits ? JSON.stringify(biometrics.splits) : null,

      // Device data (raw)
      device_data: row['Completed Run']
        ? { raw_garmin_text: row['Completed Run'] }
        : null,

      // User feedback
      personal_notes: row['Personal Notes'] || null,

      // AI coaching
      coach_notes: row['Coach Notes'] || null,

      // Metadata
      source: 'notion_import',
      tags: [row['Workout Type']?.toLowerCase() || 'workout', 'marathon_plan'],
      metadata: {
        notion_event: row.Event,
        workout_category: row['Workout Type'],
        import_date: new Date().toISOString(),
      },
    };

    const { error: workoutError } = await supabase
      .from('workouts')
      .insert(workoutData as never);

    if (workoutError) {
      console.error(`  ❌ Failed to import: ${row.Event}`, workoutError.message);
      skipped++;
    } else {
      imported++;
      if (imported % 10 === 0) {
        console.log(`  📝 Imported ${imported} workouts...`);
      }
    }
  }

  console.log(`\n✅ Import complete!`);
  console.log(`   Imported: ${imported} workouts`);
  console.log(`   Skipped: ${skipped} rows`);
  console.log(`   Plan ID: ${plan.id}`);
}

// Run
const csvPath = process.argv[2];
if (!csvPath) {
  console.error('Usage: npx tsx scripts/import-marathon-plan.ts <csv-path>');
  process.exit(1);
}

importPlan(csvPath).catch(console.error);
