#!/usr/bin/env npx ts-node --esm
/**
 * Test script for Garmin MCP Connection
 *
 * Usage:
 *   GARMIN_EMAIL=your@email.com GARMIN_PASSWORD=yourpassword npx ts-node scripts/test-garmin-connection.ts
 *
 * Or with file-based credentials:
 *   GARMIN_EMAIL_FILE=~/.garmin_email GARMIN_PASSWORD_FILE=~/.garmin_password npx ts-node scripts/test-garmin-connection.ts
 *
 * First-time setup with MFA:
 *   If you have MFA enabled, you'll need to authenticate via the CLI first:
 *   GARMIN_EMAIL_FILE=~/.garmin_email GARMIN_PASSWORD_FILE=~/.garmin_password uvx --python 3.12 --from git+https://github.com/Taxuspt/garmin_mcp garmin-mcp
 */

import { createGarminClient, getTodayString, getYesterdayString, metersToMiles } from '../packages/integrations/garmin/src/index.js';

async function main() {
  console.log('🏃 Testing Garmin MCP Connection...\n');

  // Check for credentials
  if (!process.env.GARMIN_EMAIL && !process.env.GARMIN_EMAIL_FILE) {
    console.error('❌ Missing Garmin credentials.');
    console.log('\nPlease set one of the following:');
    console.log('  - GARMIN_EMAIL and GARMIN_PASSWORD environment variables');
    console.log('  - GARMIN_EMAIL_FILE and GARMIN_PASSWORD_FILE pointing to files with credentials');
    process.exit(1);
  }

  const client = createGarminClient();

  try {
    console.log('📡 Connecting to Garmin MCP server...');
    await client.connect();
    console.log('✅ Connected successfully!\n');

    // Test 1: Get daily summary
    console.log('📊 Fetching today\'s daily summary...');
    const today = getTodayString();
    try {
      const summary = await client.getDailySummary(today);
      console.log(`  Date: ${today}`);
      console.log(`  Steps: ${summary.totalSteps || 'N/A'} / ${summary.dailyStepGoal || 'N/A'} goal`);
      console.log(`  Resting HR: ${summary.restingHeartRate || 'N/A'} bpm`);
      console.log(`  Body Battery: ${summary.bodyBatteryMostRecentValue || 'N/A'}`);
      console.log(`  Stress: ${summary.averageStressLevel || 'N/A'} avg`);
      console.log('');
    } catch (error) {
      console.log(`  ⚠️ Could not fetch daily summary: ${error instanceof Error ? error.message : error}`);
      console.log('');
    }

    // Test 2: Get sleep data
    console.log('😴 Fetching last night\'s sleep data...');
    const yesterday = getYesterdayString();
    try {
      const sleep = await client.getSleepData(yesterday);
      const sleepHours = sleep.sleepTimeSeconds
        ? Math.round((sleep.sleepTimeSeconds / 3600) * 10) / 10
        : 'N/A';
      console.log(`  Date: ${yesterday}`);
      console.log(`  Total Sleep: ${sleepHours} hours`);
      console.log(`  Sleep Score: ${sleep.sleepScores?.totalScore || 'N/A'}`);
      console.log(`  Deep Sleep: ${sleep.deepSleepSeconds ? Math.round(sleep.deepSleepSeconds / 60) : 'N/A'} min`);
      console.log(`  REM Sleep: ${sleep.remSleepSeconds ? Math.round(sleep.remSleepSeconds / 60) : 'N/A'} min`);
      console.log(`  HRV: ${sleep.avgOvernightHrv || 'N/A'}`);
      console.log('');
    } catch (error) {
      console.log(`  ⚠️ Could not fetch sleep data: ${error instanceof Error ? error.message : error}`);
      console.log('');
    }

    // Test 3: Get recent activities
    console.log('🏃 Fetching recent activities...');
    try {
      const activities = await client.listActivities(5);
      console.log(`  Found ${activities.length} recent activities:`);
      for (const activity of activities) {
        const distance = metersToMiles(activity.distance);
        const duration = Math.round(activity.duration / 60);
        console.log(`  - ${activity.activityName} (${activity.activityType.typeKey})`);
        console.log(`    ${activity.startTimeLocal.split('T')[0]} | ${distance.toFixed(2)} mi | ${duration} min | Load: ${activity.activityTrainingLoad || 'N/A'}`);
      }
      console.log('');
    } catch (error) {
      console.log(`  ⚠️ Could not fetch activities: ${error instanceof Error ? error.message : error}`);
      console.log('');
    }

    // Test 4: Get HRV data
    console.log('💓 Fetching HRV data...');
    try {
      const hrv = await client.getHRVData(yesterday);
      console.log(`  Last Night Avg: ${hrv.lastNightAvg || 'N/A'}`);
      console.log(`  Weekly Avg: ${hrv.weeklyAvg || 'N/A'}`);
      console.log(`  Status: ${hrv.status || 'N/A'}`);
      console.log(`  Feedback: ${hrv.feedbackPhrase || 'N/A'}`);
      console.log('');
    } catch (error) {
      console.log(`  ⚠️ Could not fetch HRV data: ${error instanceof Error ? error.message : error}`);
      console.log('');
    }

    console.log('✅ All tests completed!');
    console.log('\nYour Garmin MCP connection is working correctly.');
    console.log('You can now use the Garmin integration in LifeOS.');

  } catch (error) {
    console.error('❌ Connection failed:', error instanceof Error ? error.message : error);
    console.log('\nTroubleshooting:');
    console.log('1. Make sure uvx is installed (pip install uvx or uv tool install uvx)');
    console.log('2. Verify your Garmin credentials are correct');
    console.log('3. If you have MFA enabled, run the garmin-mcp manually first to authenticate');
    console.log('4. Check the Garmin Connect website to ensure your account is in good standing');
    process.exit(1);
  } finally {
    client.disconnect();
  }
}

main();

