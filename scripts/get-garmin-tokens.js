const { GarminConnect } = require('garmin-connect');
require('dotenv').config({ path: 'apps/web/.env.local' });

async function main() {
  const email = process.env.GARMIN_EMAIL;
  const password = process.env.GARMIN_PASSWORD;

  if (!email || !password) {
    console.error('Missing GARMIN_EMAIL or GARMIN_PASSWORD');
    process.exit(1);
  }

  console.log('Logging into Garmin Connect...');
  console.log('Email:', email);

  const client = new GarminConnect({ username: email, password: password });

  try {
    await client.login();
    console.log('SUCCESS: Logged in!');

    const tokens = client.exportToken();
    console.log('\n=== GARMIN_OAUTH1_TOKEN ===');
    console.log(JSON.stringify(tokens.oauth1));
    console.log('\n=== GARMIN_OAUTH2_TOKEN ===');
    console.log(JSON.stringify(tokens.oauth2));

    // Verify with a quick API call
    console.log('\nVerifying by fetching activities...');
    const activities = await client.getActivities(0, 2);
    console.log('Found', activities.length, 'recent activities');

    console.log('\nDone! Copy the tokens above to Vercel.');

  } catch (err) {
    console.error('LOGIN FAILED:', err.message);
    process.exit(1);
  }
}
main();
