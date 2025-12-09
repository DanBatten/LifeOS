import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const workoutId = '2fca4ca0-b2da-4333-a021-7e96f2f1259a';

async function main() {
  const { data, error } = await supabase
    .from('workouts')
    .select('*')
    .eq('id', workoutId)
    .single();

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('=== WORKOUT DATA ===');
  console.log(`Title: ${data.title}`);
  console.log(`Status: ${data.status}`);
  console.log(`Prescribed Description: ${data.prescribed_description}`);
  console.log(`Prescribed Distance: ${data.prescribed_distance_miles} miles`);
  console.log(`Prescribed Pace: ${data.prescribed_pace_per_mile}`);
  console.log('');
  console.log(`Actual Duration: ${data.actual_duration_minutes} min`);
  console.log(`Avg HR: ${data.avg_heart_rate}`);
  console.log(`Max HR: ${data.max_heart_rate}`);
  console.log('');

  const metadata = data.metadata as Record<string, unknown>;
  console.log(`Actual Distance: ${metadata?.actual_distance_miles} miles`);
  console.log(`Actual Pace: ${metadata?.actual_pace}`);
  console.log(`Elevation Gain: ${metadata?.elevation_gain_ft} ft`);
  console.log('');

  const laps = metadata?.laps as Array<{
    lapNumber: number;
    distanceMiles: number;
    durationSeconds: number;
    pacePerMile: string | null;
    avgHeartRate?: number;
    elevationGainFt?: number;
  }>;

  if (laps && laps.length > 0) {
    console.log('=== LAP DATA ===');
    console.log('| Lap | Distance | Duration | Pace | Avg HR | Elevation |');
    console.log('|-----|----------|----------|------|--------|-----------|');
    for (const lap of laps) {
      const mins = Math.floor(lap.durationSeconds / 60);
      const secs = lap.durationSeconds % 60;
      console.log(`| ${lap.lapNumber} | ${lap.distanceMiles.toFixed(2)} mi | ${mins}:${String(Math.round(secs)).padStart(2, '0')} | ${lap.pacePerMile || 'N/A'} | ${lap.avgHeartRate || 'N/A'} | +${lap.elevationGainFt || 0} ft |`);
    }

    // Calculate totals
    const totalDist = laps.reduce((sum, l) => sum + l.distanceMiles, 0);
    const totalTime = laps.reduce((sum, l) => sum + l.durationSeconds, 0);
    console.log('');
    console.log(`Total from laps: ${totalDist.toFixed(2)} miles in ${Math.floor(totalTime / 60)}:${String(Math.round(totalTime % 60)).padStart(2, '0')}`);
  } else {
    console.log('No lap data found!');
  }
}

main();
