import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function main() {
  // Get one workout and see all its columns
  const { data, error } = await supabase
    .from('workouts')
    .select('*')
    .limit(1)
    .single();

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Workout columns:');
  for (const key of Object.keys(data)) {
    console.log(`  - ${key}: ${typeof data[key]} = ${JSON.stringify(data[key]).substring(0, 50)}`);
  }
}

main();
