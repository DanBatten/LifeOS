#!/usr/bin/env npx tsx
/**
 * Test Garmin MCP Connection
 * 
 * Quick test to verify the Garmin MCP server can connect and fetch data.
 * 
 * Usage:
 *   npx tsx scripts/test-garmin-mcp.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local (apps/web) and root .env
config({ path: resolve(process.cwd(), 'apps/web/.env.local') });
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

import { 
  createGarminClient, 
  getTodayString, 
  getYesterdayString,
  metersToMiles,
  formatPace,
} from '@lifeos/garmin';

async function main() {
  console.log('🧪 Testing Garmin MCP Connection\n');
  console.log('='.repeat(50));

  // Check credentials
  if (!process.env.GARMIN_EMAIL || !process.env.GARMIN_PASSWORD) {
    console.error('❌ Missing GARMIN_EMAIL or GARMIN_PASSWORD environment variables');
    process.exit(1);
  }

  console.log(`\n📧 Using Garmin account: ${process.env.GARMIN_EMAIL}`);
  
  const client = createGarminClient();
  const today = getTodayString();
  const yesterday = getYesterdayString();

  try {
    // Test 1: Connect
    console.log('\n━━━ Test 1: Connection ━━━');
    console.log('Connecting to Garmin MCP server...');
    await client.connect();
    console.log('✅ Connected successfully!');
    
    // List available tools
    console.log('\n━━━ Available MCP Tools ━━━');
    try {
      const tools = await (client as any).sendRequest('tools/list', {});
      if (tools?.tools) {
        console.log('Tools available:');
        for (const tool of tools.tools) {
          console.log(`   • ${tool.name}: ${tool.description?.substring(0, 60) || 'No description'}...`);
        }
      }
    } catch (e) {
      console.log('Could not list tools:', e);
    }
    console.log('');

    // Test 2: Daily Stats
    console.log('━━━ Test 2: Daily Stats ━━━');
    console.log(`Fetching stats for ${today}...`);
    try {
      const stats = await client.getDailySummary(today) as Record<string, unknown>;
      if (stats && typeof stats === 'object') {
        console.log('✅ Stats received');
        // Try to extract key fields regardless of naming
        const s = stats as any;
        console.log(`   Steps: ${s.totalSteps || s.steps || 'N/A'}`);
        console.log(`   Calories: ${s.totalKilocalories || s.activeKilocalories || 'N/A'}`);
        console.log(`   Raw keys: ${Object.keys(stats).slice(0, 15).join(', ')}...`);
      } else {
        console.log('⚠️  Stats returned:', stats);
      }
    } catch (error) {
      console.log(`⚠️  Could not fetch stats: ${error instanceof Error ? error.message : error}`);
    }

    // Test 3: Sleep Data
    console.log('\n━━━ Test 3: Sleep Data ━━━');
    console.log(`Fetching sleep data for ${yesterday}...`);
    try {
      const sleep = await client.getSleepData(yesterday) as any;
      if (sleep) {
        const sleepHours = sleep.sleepTimeSeconds ? (sleep.sleepTimeSeconds / 3600).toFixed(1) : 'N/A';
        console.log('✅ Sleep data received:');
        console.log(`   Total Sleep: ${sleepHours} hours`);
        console.log(`   Deep: ${sleep.deepSleepSeconds ? Math.round(sleep.deepSleepSeconds / 60) : 'N/A'} min`);
        console.log(`   REM: ${sleep.remSleepSeconds ? Math.round(sleep.remSleepSeconds / 60) : 'N/A'} min`);
        console.log(`   Light: ${sleep.lightSleepSeconds ? Math.round(sleep.lightSleepSeconds / 60) : 'N/A'} min`);
        console.log(`   HRV (overnight): ${sleep.avgOvernightHrv?.toFixed(0) || 'N/A'} ms`);
        console.log(`   HRV Status: ${sleep.hrvStatus || 'N/A'}`);
        console.log(`   Body Battery Change: ${sleep.bodyBatteryChange || 'N/A'}`);
        console.log(`   Resting HR: ${sleep.restingHeartRate || 'N/A'} bpm`);
      }
    } catch (error) {
      console.log(`⚠️  Could not fetch sleep: ${error instanceof Error ? error.message : error}`);
    }

    // Test 4: Body Battery
    console.log('\n━━━ Test 4: Body Battery ━━━');
    try {
      const bb = await client.getBodyBattery(today) as any;
      if (bb && Array.isArray(bb)) {
        const latest = bb[bb.length - 1];
        console.log('✅ Body Battery received:');
        console.log(`   Latest: ${latest?.bodyBatteryValue || 'N/A'}`);
        console.log(`   Data points today: ${bb.length}`);
      } else {
        console.log('   Raw:', JSON.stringify(bb, null, 2).substring(0, 300));
      }
    } catch (error) {
      console.log(`⚠️  Could not fetch body battery: ${error instanceof Error ? error.message : error}`);
    }

    // Test 5: Training Readiness
    console.log('\n━━━ Test 5: Training Readiness ━━━');
    try {
      const readiness = await client.getTrainingReadiness(today) as any;
      if (readiness) {
        console.log('✅ Training Readiness received:');
        console.log(`   Score: ${readiness.score || readiness.trainingReadinessScore || 'N/A'}`);
        console.log(`   Raw keys: ${Object.keys(readiness).join(', ')}`);
      }
    } catch (error) {
      console.log(`⚠️  Could not fetch readiness: ${error instanceof Error ? error.message : error}`);
    }

    // Test 6: Recent Activities (by date range)
    console.log('\n━━━ Test 6: Recent Activities ━━━');
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    console.log(`Fetching activities from ${sevenDaysAgo} to ${today}...`);
    try {
      const response = await client.getActivitiesForDateRange(sevenDaysAgo, today) as any;
      
      // Handle different response formats
      const activities = Array.isArray(response) ? response : [response];
      
      if (activities.length > 0 && activities[0]?.activityId) {
        console.log(`✅ Found ${activities.length} activities:\n`);
        for (const activity of activities.slice(0, 5)) {
          const distance = activity.distance ? metersToMiles(activity.distance) : 0;
          const duration = activity.duration ? Math.round(activity.duration / 60) : 0;
          const pace = distance > 0 ? formatPace(duration / distance) : 'N/A';
          
          console.log(`   📍 ${activity.activityName || 'Activity'}`);
          console.log(`      ID: ${activity.activityId}`);
          console.log(`      Date: ${activity.startTimeLocal || 'N/A'}`);
          console.log(`      Type: ${activity.activityType?.typeKey || 'N/A'}`);
          console.log(`      Distance: ${distance.toFixed(2)} mi | Duration: ${duration} min | Pace: ${pace}`);
          console.log(`      HR: ${activity.averageHR || 'N/A'} avg / ${activity.maxHR || 'N/A'} max`);
          console.log(`      Training Load: ${activity.activityTrainingLoad || 'N/A'}`);
          console.log(`      VO2Max: ${activity.vO2MaxValue || 'N/A'}`);
          console.log('');
        }
      } else {
        console.log('   Response type:', typeof response);
        console.log('   Keys:', Object.keys(response || {}).slice(0, 10).join(', '));
      }
    } catch (error) {
      console.log(`⚠️  Could not fetch activities: ${error instanceof Error ? error.message : error}`);
    }

    console.log('='.repeat(50));
    console.log('✅ Garmin MCP connection test complete!');
    console.log('='.repeat(50));

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  } finally {
    client.disconnect();
    console.log('\n📡 Disconnected from Garmin MCP');
  }
}

main().catch(console.error);

