const { GarminConnect } = require('garmin-connect');
const fs = require('fs');
const path = require('path');

// Load cached tokens from garminconnect directory
const oauth1Path = path.join(process.env.HOME, '.garminconnect', 'oauth1_token.json');
const oauth2Path = path.join(process.env.HOME, '.garminconnect', 'oauth2_token.json');

const oauth1 = JSON.parse(fs.readFileSync(oauth1Path, 'utf8'));
const oauth2 = JSON.parse(fs.readFileSync(oauth2Path, 'utf8'));

console.log('Loading cached tokens...');
console.log('OAuth1 token:', oauth1.oauth_token ? 'present' : 'missing');
console.log('OAuth2 access_token:', oauth2.access_token ? 'present' : 'missing');

// Need to pass dummy credentials for constructor (won't be used with tokens)
const client = new GarminConnect({ username: 'dummy', password: 'dummy' });
client.loadToken(oauth1, oauth2);

console.log('\nTesting connection...');

client.getActivities(0, 3).then(activities => {
  console.log('\nSUCCESS! Found', activities.length, 'activities:');
  activities.forEach((a, i) => {
    console.log('  ' + (i+1) + '.', a.activityName, '(' + a.startTimeLocal.split('T')[0] + ')');
  });

  console.log('\n=== TOKENS FOR VERCEL ===');
  console.log('\nGARMIN_OAUTH1_TOKEN:');
  console.log(JSON.stringify({oauth_token: oauth1.oauth_token, oauth_token_secret: oauth1.oauth_token_secret}));
  console.log('\nGARMIN_OAUTH2_TOKEN:');
  console.log(JSON.stringify(oauth2));

}).catch(err => {
  console.error('\nFailed:', err.message);
});
