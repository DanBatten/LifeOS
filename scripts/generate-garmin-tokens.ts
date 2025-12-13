/**
 * Generate Garmin OAuth Tokens
 *
 * This script logs into Garmin Connect and outputs the OAuth tokens
 * that need to be stored in Vercel environment variables.
 *
 * Usage:
 *   npx ts-node scripts/generate-garmin-tokens.ts
 *
 * Then add the output to Vercel:
 *   - GARMIN_OAUTH1_TOKEN
 *   - GARMIN_OAUTH2_TOKEN
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const { GarminConnect } = require('garmin-connect');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from apps/web/.env.local
dotenv.config({ path: path.resolve(__dirname, '../apps/web/.env.local') });

async function main() {
  const email = process.env.GARMIN_EMAIL;
  const password = process.env.GARMIN_PASSWORD;

  if (!email || !password) {
    console.error('Error: GARMIN_EMAIL and GARMIN_PASSWORD must be set in apps/web/.env.local');
    process.exit(1);
  }

  console.log('Logging into Garmin Connect...');
  console.log(`Email: ${email}`);

  const client = new GarminConnect({
    username: email,
    password: password,
  });

  try {
    await client.login();
    console.log('\n✅ Successfully logged into Garmin Connect!\n');

    // Export the tokens
    const tokens = client.exportToken();

    const oauth1Json = JSON.stringify(tokens.oauth1);
    const oauth2Json = JSON.stringify(tokens.oauth2);

    console.log('='.repeat(60));
    console.log('Add these environment variables to Vercel:');
    console.log('='.repeat(60));
    console.log('\nGARMIN_OAUTH1_TOKEN:');
    console.log(oauth1Json);
    console.log('\nGARMIN_OAUTH2_TOKEN:');
    console.log(oauth2Json);
    console.log('\n' + '='.repeat(60));

    // Also verify we can fetch some data
    console.log('\nVerifying connection by fetching recent activities...');
    const activities = await client.getActivities(0, 3);
    console.log(`✅ Found ${activities.length} recent activities:`);
    activities.forEach((a: { activityName: string; startTimeLocal: string }, i: number) => {
      console.log(`  ${i + 1}. ${a.activityName} (${a.startTimeLocal.split('T')[0]})`);
    });

    console.log('\n🎉 Done! Copy the tokens above to your Vercel environment variables.');

  } catch (error) {
    console.error('\n❌ Failed to login:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
