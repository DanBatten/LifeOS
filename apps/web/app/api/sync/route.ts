import { NextRequest, NextResponse } from 'next/server';
import { createGarminSyncService } from '@lifeos/garmin';
import { HealthRepository } from '@lifeos/database';
import { getSupabaseService } from '@/lib/supabase';
import { getEnv } from '@/lib/env';

export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * Manual Sync Endpoint
 *
 * Called by user from the UI to trigger a Garmin sync.
 * Returns sync status and whether today's data is available.
 */
export async function POST(request: NextRequest) {
  const env = getEnv();
  const supabase = getSupabaseService();
  const startTime = Date.now();

  // Check for Garmin credentials
  if (!env.GARMIN_EMAIL && !env.GARMIN_EMAIL_FILE) {
    return NextResponse.json(
      { error: 'Garmin credentials not configured' },
      { status: 500 }
    );
  }

  try {
    // Create sync service
    const syncService = createGarminSyncService(supabase, env.USER_ID, {
      email: env.GARMIN_EMAIL,
      password: env.GARMIN_PASSWORD,
      emailFile: env.GARMIN_EMAIL_FILE,
      passwordFile: env.GARMIN_PASSWORD_FILE,
    });

    // Run morning sync (yesterday + today)
    const result = await syncService.syncMorningData();
    const duration = Date.now() - startTime;

    // Log the sync
    await supabase.from('garmin_sync_log').insert({
      user_id: env.USER_ID,
      sync_type: 'manual',
      sync_start: new Date(startTime).toISOString(),
      sync_end: new Date().toISOString(),
      activities_synced: result.activitiesSynced,
      health_snapshots_synced: result.healthSnapshotsSynced,
      status: result.errors.length > 0 ? 'partial' : 'completed',
      error_message: result.errors.length > 0 ? result.errors[0] : null,
      duration_ms: duration,
    });

    // Check if we now have today's data
    const healthRepo = new HealthRepository(supabase, env.TIMEZONE);
    const todayData = await healthRepo.findByDate(env.USER_ID, new Date());
    const hasTodayData = !!(todayData && (todayData.sleepHours || todayData.hrv || todayData.restingHr));

    return NextResponse.json({
      success: true,
      activitiesSynced: result.activitiesSynced,
      healthSnapshotsSynced: result.healthSnapshotsSynced,
      hasTodayData,
      todayData: hasTodayData ? {
        sleepHours: todayData?.sleepHours,
        hrv: todayData?.hrv,
        restingHr: todayData?.restingHr,
      } : null,
      errors: result.errors,
      duration,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error('Manual sync error:', error);

    // Log the failure
    await supabase.from('garmin_sync_log').insert({
      user_id: env.USER_ID,
      sync_type: 'manual',
      sync_start: new Date(startTime).toISOString(),
      sync_end: new Date().toISOString(),
      status: 'failed',
      error_message: errorMessage,
      duration_ms: duration,
    });

    return NextResponse.json(
      {
        error: 'Sync failed',
        details: errorMessage,
        duration,
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check sync status without triggering a sync
 */
export async function GET() {
  const env = getEnv();
  const supabase = getSupabaseService();

  const healthRepo = new HealthRepository(supabase, env.TIMEZONE);

  // Check today's data
  const todayData = await healthRepo.findByDate(env.USER_ID, new Date());
  const hasTodayData = !!(todayData && (todayData.sleepHours || todayData.hrv || todayData.restingHr));

  // Get most recent data if today isn't available
  const latestData = hasTodayData ? todayData : await healthRepo.getMostRecentWithData(env.USER_ID);

  // Get last sync time
  const { data: lastSync } = await supabase
    .from('garmin_sync_log')
    .select('sync_end, status')
    .eq('user_id', env.USER_ID)
    .order('sync_end', { ascending: false })
    .limit(1)
    .single();

  return NextResponse.json({
    hasTodayData,
    latestDataDate: latestData?.snapshotDate || null,
    lastSyncTime: lastSync?.sync_end || null,
    lastSyncStatus: lastSync?.status || null,
  });
}
