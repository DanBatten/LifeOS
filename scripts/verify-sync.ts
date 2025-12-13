import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function check() {
  const { data } = await supabase
    .from('health_snapshots')
    .select('snapshot_date, sleep_hours, hrv, resting_hr')
    .order('snapshot_date', { ascending: false })
    .limit(3);

  console.log('Latest health data:');
  data?.forEach(d => {
    console.log(`  ${d.snapshot_date}: sleep=${d.sleep_hours}h, HRV=${d.hrv}ms, RHR=${d.resting_hr}bpm`);
  });
}
check();
