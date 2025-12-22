import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createGarminSyncService } from '@lifeos/garmin';
import { HealthRepository } from '@lifeos/database';
import { getSupabaseService } from '@/lib/supabase';
import { getEnv } from '@/lib/env';

export const runtime = 'nodejs';
export const maxDuration = 120; // Garmin sync can take longer

/**
 * Garmin Sync Cron Endpoint
 *
 * Sync types:
 * - morning: Quick morning sync (yesterday + today) at 6:05 AM
 * - retry: Only syncs if today's data is missing (7:05 AM fallback)
 * - scheduled: Regular sync
 * - backfill: Backfill multiple days (?days=7)
 * - manual: User-triggered sync from the UI
 */
export async function GET(request: NextRequest) {
  const headersList = await headers();
  const authHeader = headersList.get('authorization');
  const env = getEnv();

  // Verify cron secret in production (skip in development for easier testing)
  const isDev = process.env.NODE_ENV === 'development';
  if (!isDev && env.CRON_SECRET && authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check for Garmin credentials
  if (!env.GARMIN_EMAIL && !env.GARMIN_EMAIL_FILE) {
    return NextResponse.json(
      { error: 'Garmin credentials not configured' },
      { status: 500 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const syncType = searchParams.get('type') || 'scheduled';
  const daysBack = parseInt(searchParams.get('days') || '1', 10);

  const startTime = Date.now();
  const supabase = getSupabaseService();

  // For retry type, check if we already have today's data
  if (syncType === 'retry') {
    const healthRepo = new HealthRepository(supabase, env.TIMEZONE);
    const todayData = await healthRepo.findByDate(env.USER_ID, new Date());

    // If we have today's data with actual values, skip the sync
    if (todayData && (todayData.sleepHours || todayData.hrv || todayData.restingHr)) {
      return NextResponse.json({
        success: true,
        message: 'Today\'s data already exists, skipping retry sync',
        syncType: 'retry',
        skipped: true,
      });
    }
  }

  try {
    // Create sync log entry
    const { data: syncLog } = await supabase
      .from('garmin_sync_log')
      .insert({
        user_id: env.USER_ID,
        sync_type: syncType,
        sync_start: new Date().toISOString(),
        date_range_start: new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        date_range_end: new Date().toISOString().split('T')[0],
        status: 'running',
      })
      .select()
      .single();

    // Create sync service
    const syncService = createGarminSyncService(supabase, env.USER_ID, {
      email: env.GARMIN_EMAIL,
      password: env.GARMIN_PASSWORD,
      emailFile: env.GARMIN_EMAIL_FILE,
      passwordFile: env.GARMIN_PASSWORD_FILE,
    });

    // Run appropriate sync type
    let result;
    if (syncType === 'morning') {
      result = await syncService.syncMorningData();
    } else if (syncType === 'backfill') {
      result = await syncService.backfill(daysBack);
    } else {
      result = await syncService.sync({
        syncActivities: true,
        syncSleep: true,
        syncDailySummary: true,
        syncBodyComposition: false,
        daysBack,
      });
    }

    const duration = Date.now() - startTime;

    // Update sync log
    if (syncLog) {
      await supabase
        .from('garmin_sync_log')
        .update({
          sync_end: new Date().toISOString(),
          activities_synced: result.activitiesSynced,
          health_snapshots_synced: result.healthSnapshotsSynced,
          status: result.errors.length > 0 ? 'partial' : 'completed',
          error_message: result.errors.length > 0 ? result.errors[0] : null,
          error_details: result.errors.length > 0 ? { errors: result.errors } : null,
          duration_ms: duration,
        })
        .eq('id', syncLog.id);
    }

    // Post to whiteboard if there were errors
    if (result.errors.length > 0) {
      await supabase.from('whiteboard_entries').insert({
        user_id: env.USER_ID,
        agent_id: 'garmin-sync',
        entry_type: 'alert',
        title: 'Garmin Sync Partial Failure',
        content: `Garmin sync completed with ${result.errors.length} error(s):\n${result.errors.join('\n')}`,
        priority: 60,
        requires_response: false,
        context_date: new Date().toISOString().split('T')[0],
        visibility: 'all',
        tags: ['garmin', 'sync', 'error'],
        metadata: {},
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Garmin sync completed',
      syncType,
      activitiesSynced: result.activitiesSynced,
      healthSnapshotsSynced: result.healthSnapshotsSynced,
      errors: result.errors,
      duration,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error('Garmin sync error:', error);

    // Log the failure
    await supabase.from('garmin_sync_log').insert({
      user_id: env.USER_ID,
      sync_type: syncType,
      sync_start: new Date(startTime).toISOString(),
      sync_end: new Date().toISOString(),
      status: 'failed',
      error_message: errorMessage,
      duration_ms: duration,
    });

    // Post alert to whiteboard
    await supabase.from('whiteboard_entries').insert({
      user_id: env.USER_ID,
      agent_id: 'garmin-sync',
      entry_type: 'alert',
      title: 'Garmin Sync Failed',
      content: `Garmin sync failed: ${errorMessage}`,
      priority: 80,
      requires_response: true,
      context_date: new Date().toISOString().split('T')[0],
      visibility: 'all',
      tags: ['garmin', 'sync', 'error', 'critical'],
      metadata: {},
    });

    return NextResponse.json(
      {
        error: 'Garmin sync failed',
        details: errorMessage,
        duration,
      },
      { status: 500 }
    );
  }
}

/**
 * Manual trigger endpoint for POST requests
 */
export async function POST(request: NextRequest) {
  return GET(request);
}





