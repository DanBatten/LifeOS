import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createLLMClient } from '@lifeos/llm';
import { runChatFlow, type ConversationMessage } from '@lifeos/workflows';
import { getSupabase, getSupabaseService, insertRecord } from '@/lib/supabase';
import { getEnv } from '@/lib/env';
import { getUserSettings } from '@/lib/user-settings';
import { syncGarminMetrics, syncLatestActivity } from '@lifeos/skills';
import {
  createGarminClient,
  createGarminSyncService,
  mapActivityType,
  metersToMiles,
  type GarminActivity,
} from '@lifeos/garmin';

/**
 * Context types that determine data loading and routing behavior:
 * - default: Broad context, all agents available, balanced data loading
 * - post-run: Training focused, syncs Garmin, routes to training-coach
 * - health: Health/recovery focused, routes to health-agent
 * - planning: Tasks/whiteboard focused, balanced routing
 */
const ChatRequestSchema = z.object({
  message: z.string().min(1),
  sessionId: z.string().uuid().nullish(),
  context: z.enum(['default', 'training', 'post-run', 'health', 'planning']).optional(),
});

type ChatCommandResult = {
  response: string;
  agentId?: string;
  dataUpdated?: boolean;
  actions?: Array<{
    label: string;
    command: string;
    variant?: 'primary' | 'secondary' | 'danger';
  }>;
};

type GarminImportProposal = {
  kind: 'garmin_import_proposal';
  createdAt: string;
  sessionId: string;
  window: { startDate: string; endDate: string };
  matches: Array<{
    plannedWorkoutId: string;
    plannedDate: string;
    plannedTitle: string;
    prescribedDistanceMiles: number | null;
    garminActivityId: string;
    garminTitle: string;
    garminDate: string;
    garminDistanceMiles: number;
    confidence: 'high' | 'medium';
  }>;
  extras: Array<{
    garminActivityId: string;
    garminTitle: string;
    garminDate: string;
    garminDistanceMiles: number;
  }>;
  missingPlanned: Array<{
    plannedWorkoutId: string;
    plannedDate: string;
    plannedTitle: string;
    prescribedDistanceMiles: number | null;
  }>;
};

function dateStringInTz(date: Date, timezone: string): string {
  return date.toLocaleDateString('en-CA', { timeZone: timezone });
}

function addDays(dateStr: string, days: number): string {
  // dateStr is yyyy-mm-dd
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function parseCommand(message: string): { cmd: string; args: string[]; flags: Set<string> } {
  const parts = message.trim().split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const args: string[] = [];
  const flags = new Set<string>();
  for (let i = 1; i < parts.length; i++) {
    const p = parts[i];
    if (p.startsWith('--')) flags.add(p.slice(2));
    else args.push(p);
  }
  return { cmd, args, flags };
}

async function handleChatCommand(
  message: string,
  {
    userId,
    sessionId,
    timezone,
    supabaseService,
    llmClient,
    supabaseAnon,
  }: {
    userId: string;
    sessionId: string;
    timezone: string;
    supabaseService: ReturnType<typeof getSupabaseService>;
    llmClient: ReturnType<typeof createLLMClient>;
    supabaseAnon: ReturnType<typeof getSupabase>;
  }
): Promise<ChatCommandResult | null> {
  if (!message.trim().startsWith('/')) return null;

  const { cmd, args, flags } = parseCommand(message);

  if (cmd === '/help') {
    return {
      agentId: 'system',
      response:
        [
          '### Commands',
          '- **`/add-run`**: Pull your most recent Garmin run(s) and propose safe schedule updates (no writes until confirmed).',
          '- **`/sync-garmin`**: Manually pull the latest Garmin health metrics (sleep/HRV/resting HR/etc.) and refresh the UI.',
          '- **`/confirm <proposalId>`**: Apply the proposal created by `/add-run`.',
          '- **`/confirm <proposalId> --skip-missing`**: Also mark unmatched planned runs in the window as skipped.',
          '- **`/cancel <proposalId>`**: Mark a proposal as cancelled (no-op).',
        ].join('\n'),
    };
  }

  if (cmd === '/sync-garmin') {
    const daysBack = Number(args[0] || (flags.has('days') ? NaN : 1));
    const effectiveDaysBack = Number.isFinite(daysBack) && daysBack > 0 ? Math.min(daysBack, 14) : 1;

    // quick env sanity checks
    const envUrl = process.env.SUPABASE_URL;
    void envUrl; // supabaseService already constructed; keep for future diagnostics

    // Garmin credentials are required for the sync service
    const envEmail = process.env.GARMIN_EMAIL || process.env.GARMIN_EMAIL_FILE;
    if (!envEmail) {
      return {
        agentId: 'system',
        response:
          `I can’t run a Garmin sync right now because Garmin credentials aren’t configured in this environment.\n\n` +
          `Set \`GARMIN_EMAIL\`/\`GARMIN_PASSWORD\` (or the *_FILE variants) and try again.`,
      };
    }

    // Create a sync log (best-effort; helps debug cron failures)
    let syncLogId: string | null = null;
    try {
      const { data: syncLog } = await supabaseService
        .from('garmin_sync_log')
        .insert({
          user_id: userId,
          sync_type: 'manual',
          sync_start: new Date().toISOString(),
          date_range_start: addDays(dateStringInTz(new Date(), timezone), -(effectiveDaysBack - 1)),
          date_range_end: dateStringInTz(new Date(), timezone),
          status: 'running',
        })
        .select('id')
        .single();
      syncLogId = (syncLog?.id as string) || null;
    } catch {
      // ignore
    }

    try {
      const syncService = createGarminSyncService(supabaseService, userId, {
        email: process.env.GARMIN_EMAIL,
        password: process.env.GARMIN_PASSWORD,
        emailFile: process.env.GARMIN_EMAIL_FILE,
        passwordFile: process.env.GARMIN_PASSWORD_FILE,
      });

      const result = await syncService.sync({
        // User asked for health metrics; keep activities on too (harmless, and keeps DB consistent)
        syncActivities: true,
        syncSleep: true,
        syncDailySummary: true,
        syncBodyComposition: false,
        daysBack: effectiveDaysBack,
      });

      if (syncLogId) {
        await supabaseService
          .from('garmin_sync_log')
          .update({
            sync_end: new Date().toISOString(),
            activities_synced: result.activitiesSynced,
            health_snapshots_synced: result.healthSnapshotsSynced,
            status: result.errors.length > 0 ? 'partial' : 'completed',
            error_message: result.errors.length > 0 ? result.errors[0] : null,
            error_details: result.errors.length > 0 ? { errors: result.errors } : null,
          })
          .eq('id', syncLogId);
      }

      const lines: string[] = [];
      lines.push(`Okay — I just pulled fresh Garmin data for the last **${effectiveDaysBack}** day${effectiveDaysBack === 1 ? '' : 's'}.`);
      lines.push('');
      lines.push(`- Health metrics updated: **${result.healthSnapshotsSynced}** day${result.healthSnapshotsSynced === 1 ? '' : 's'}`);
      lines.push(`- Activities synced: **${result.activitiesSynced}**`);
      if (result.errors.length > 0) {
        lines.push('');
        lines.push(`I hit a small issue during the sync:`);
        lines.push(`- ${result.errors[0]}`);
      }
      lines.push('');
      lines.push(`Refresh should happen automatically — if not, refresh the page once.`);

      return {
        agentId: 'system',
        dataUpdated: true,
        response: lines.join('\n'),
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (syncLogId) {
        await supabaseService
          .from('garmin_sync_log')
          .update({
            sync_end: new Date().toISOString(),
            status: 'failed',
            error_message: msg,
          })
          .eq('id', syncLogId);
      }
      return {
        agentId: 'system',
        response: `Garmin sync failed: ${msg}`,
      };
    }
  }

  if (cmd === '/add-run') {
    const today = dateStringInTz(new Date(), timezone);
    const startDate = addDays(today, -3);
    const endDate = today;
    const wantsDetails = flags.has('details') || flags.has('verbose');

    // 1) Load planned runs in window
    const { data: plannedRows, error: plannedErr } = await supabaseService
      .from('workouts')
      .select('id, title, workout_type, status, scheduled_date, prescribed_distance_miles')
      .eq('user_id', userId)
      .eq('workout_type', 'run')
      .eq('status', 'planned')
      .gte('scheduled_date', startDate)
      .lte('scheduled_date', endDate);

    if (plannedErr) {
      return { agentId: 'system', response: `Failed to load planned runs: ${plannedErr.message}` };
    }

    const planned = (plannedRows || []).map((w) => ({
      id: w.id as string,
      title: w.title as string,
      date: w.scheduled_date as string,
      prescribedDistanceMiles: (w.prescribed_distance_miles as number | null) ?? null,
    }));

    // 2) Load recent Garmin activities (read-only)
    const client = createGarminClient();
    let recentActivities: GarminActivity[] = [];
    try {
      await client.connect();
      recentActivities = await client.listActivities(30);
    } catch (e) {
      return {
        agentId: 'system',
        response:
          `I couldn’t connect to Garmin to pull activities.\n\n` +
          `- If you’re running locally, confirm Garmin auth/tokens are set.\n` +
          `- If you’re on Vercel, Garmin access may be unavailable in that environment.\n\n` +
          `Error: ${e instanceof Error ? e.message : String(e)}`,
      };
    } finally {
      client.disconnect();
    }

    const garminRuns = recentActivities
      .filter((a) => mapActivityType(a.activityType?.typeKey || 'other') === 'run')
      .map((a) => {
        const date = (a.startTimeLocal || '').split('T')[0].split(' ')[0];
        return {
          id: String(a.activityId),
          title: a.activityName,
          date,
          distanceMiles: Math.round(metersToMiles(a.distance) * 100) / 100,
        };
      })
      .filter((a) => a.date >= startDate && a.date <= endDate);

    // 3) Match Garmin runs to planned runs (same date; closest distance)
    const plannedByDate = new Map<string, typeof planned>();
    for (const p of planned) plannedByDate.set(p.date, [...(plannedByDate.get(p.date) || []), p]);

    const matchedPlannedIds = new Set<string>();
    const matches: GarminImportProposal['matches'] = [];
    const extras: GarminImportProposal['extras'] = [];

    for (const g of garminRuns) {
      const candidates = plannedByDate.get(g.date) || [];
      if (candidates.length === 0) {
        extras.push({
          garminActivityId: g.id,
          garminTitle: g.title,
          garminDate: g.date,
          garminDistanceMiles: g.distanceMiles,
        });
        continue;
      }

      // choose best candidate by distance diff (or first if no prescribed)
      let best = candidates[0];
      let bestDiff = Number.POSITIVE_INFINITY;

      for (const c of candidates) {
        if (c.prescribedDistanceMiles == null) {
          best = c;
          bestDiff = 0.5; // neutral
          break;
        }
        const diff = Math.abs(c.prescribedDistanceMiles - g.distanceMiles);
        if (diff < bestDiff) {
          best = c;
          bestDiff = diff;
        }
      }

      const confidence: 'high' | 'medium' =
        best.prescribedDistanceMiles == null
          ? 'medium'
          : bestDiff <= 0.75
            ? 'high'
            : 'medium';

      matchedPlannedIds.add(best.id);
      matches.push({
        plannedWorkoutId: best.id,
        plannedDate: best.date,
        plannedTitle: best.title,
        prescribedDistanceMiles: best.prescribedDistanceMiles,
        garminActivityId: g.id,
        garminTitle: g.title,
        garminDate: g.date,
        garminDistanceMiles: g.distanceMiles,
        confidence,
      });
    }

    const missingPlanned: GarminImportProposal['missingPlanned'] = planned
      .filter((p) => !matchedPlannedIds.has(p.id))
      .map((p) => ({
        plannedWorkoutId: p.id,
        plannedDate: p.date,
        plannedTitle: p.title,
        prescribedDistanceMiles: p.prescribedDistanceMiles,
      }));

    const proposal: GarminImportProposal = {
      kind: 'garmin_import_proposal',
      createdAt: new Date().toISOString(),
      sessionId,
      window: { startDate, endDate },
      matches,
      extras,
      missingPlanned,
    };

    // 4) Persist proposal for confirmation
    const { data: entry, error: entryErr } = await supabaseService
      .from('whiteboard_entries')
      .insert({
        user_id: userId,
        agent_id: 'system',
        entry_type: 'question',
        visibility: 'all',
        title: 'Garmin import proposal',
        content: 'Pending Garmin import proposal created via /add-run',
        structured_data: proposal,
        requires_response: true,
        // expire quickly so stale proposals don’t surprise you later
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        tags: ['chat-command', 'proposal', 'garmin-import'],
        metadata: { sessionId },
      })
      .select('id')
      .single();

    if (entryErr || !entry) {
      return { agentId: 'system', response: `Failed to store proposal: ${entryErr?.message || 'unknown error'}` };
    }

    const proposalId = entry.id as string;

    const lines: string[] = [];

    // Conversational, compact default
    lines.push(`Got it — I pulled your recent Garmin activity and checked it against your plan (**${startDate} → ${endDate}**).`);

    if (matches.length === 0 && extras.length === 0) {
      lines.push('');
      lines.push(`I didn’t find any Garmin runs in that window. If you ran today, make sure your watch has synced to Garmin Connect, then try again.`);
      lines.push('');
      lines.push(`Tip: you can also run \`/add-run --details\` to see exactly what I’m seeing.`);
    } else {
      const parts: string[] = [];
      if (matches.length > 0) parts.push(`**${matches.length}** match${matches.length === 1 ? '' : 'es'} to planned runs`);
      if (extras.length > 0) parts.push(`**${extras.length}** run${extras.length === 1 ? '' : 's'} that look unscheduled (rest day)`);
      if (missingPlanned.length > 0) parts.push(`**${missingPlanned.length}** planned run${missingPlanned.length === 1 ? '' : 's'} with no Garmin match`);

      lines.push('');
      lines.push(`Here’s what I found: ${parts.join(', ')}.`);

      // Show a tiny bit of helpful context without becoming a dump
      if (extras.length > 0) {
        const e = extras[0];
        lines.push('');
        lines.push(`For example: I see an extra run on **${e.garminDate}** (${e.garminDistanceMiles}mi — “${e.garminTitle}”).`);
      } else if (matches.length > 0) {
        const m = matches[0];
        lines.push('');
        lines.push(`For example: **${m.plannedDate}** looks like a match (${m.garminDistanceMiles}mi on Garmin).`);
      }

      if (missingPlanned.length > 0) {
        lines.push('');
        lines.push(`If you skipped the unmatched planned runs, you can choose the option that marks them **skipped** too.`);
      }

      if (wantsDetails) {
        lines.push('');
        lines.push('### Details');

        if (matches.length > 0) {
          lines.push('**Matches**');
          for (const m of matches) {
            const plannedDist = m.prescribedDistanceMiles != null ? `${m.prescribedDistanceMiles}mi planned` : 'planned distance unknown';
            lines.push(
              `- ${m.plannedDate}: **${m.plannedTitle}** ← Garmin **${m.garminDistanceMiles}mi** (${plannedDist}, confidence: **${m.confidence}**)`
            );
          }
          lines.push('');
        }

        if (extras.length > 0) {
          lines.push('**Extra Garmin runs (rest day / unscheduled)**');
          for (const e of extras) {
            lines.push(`- ${e.garminDate}: **${e.garminDistanceMiles}mi** — “${e.garminTitle}”`);
          }
          lines.push('');
        }

        if (missingPlanned.length > 0) {
          lines.push('**Planned runs with no Garmin match**');
          for (const p of missingPlanned) {
            const dist = p.prescribedDistanceMiles != null ? `${p.prescribedDistanceMiles}mi` : '';
            lines.push(`- ${p.plannedDate}: **${p.plannedTitle}** ${dist}`.trim());
          }
          lines.push('');
        }
      }

      lines.push('');
      lines.push('What do you want me to do?');
    }

    return {
      agentId: 'system',
      response: lines.join('\n'),
      actions: [
        { label: 'Apply import', command: `/confirm ${proposalId}`, variant: 'primary' },
        { label: 'Apply + mark missed as skipped', command: `/confirm ${proposalId} --skip-missing`, variant: 'secondary' },
        { label: 'Cancel', command: `/cancel ${proposalId}`, variant: 'danger' },
      ],
    };
  }

  if (cmd === '/cancel') {
    const proposalId = args[0];
    if (!proposalId) return { agentId: 'system', response: 'Usage: `/cancel <proposalId>`' };

    await supabaseService
      .from('whiteboard_entries')
      .update({ is_actioned: true, actioned_at: new Date().toISOString(), metadata: { cancelled: true, sessionId } })
      .eq('id', proposalId)
      .eq('user_id', userId);

    return { agentId: 'system', response: `Cancelled proposal \`${proposalId}\`.` };
  }

  if (cmd === '/confirm') {
    const proposalId = args[0];
    if (!proposalId) return { agentId: 'system', response: 'Usage: `/confirm <proposalId> [--skip-missing]`' };

    const { data: entry, error: loadErr } = await supabaseService
      .from('whiteboard_entries')
      .select('id, structured_data, is_actioned, expires_at')
      .eq('id', proposalId)
      .eq('user_id', userId)
      .maybeSingle();

    if (loadErr || !entry) {
      return { agentId: 'system', response: `Could not load proposal \`${proposalId}\`.` };
    }

    if (entry.is_actioned) {
      return { agentId: 'system', response: `Proposal \`${proposalId}\` is already actioned (or cancelled).` };
    }
    if (entry.expires_at && new Date(entry.expires_at as string).getTime() < Date.now()) {
      return { agentId: 'system', response: `Proposal \`${proposalId}\` has expired. Run \`/add-run\` again.` };
    }

    const proposal = entry.structured_data as GarminImportProposal;
    if (!proposal || proposal.kind !== 'garmin_import_proposal') {
      return { agentId: 'system', response: `Proposal \`${proposalId}\` is not a Garmin import proposal.` };
    }

    // Connect to Garmin and fetch full details for all referenced activities
    const client = createGarminClient();
    const neededIds = new Set<string>([
      ...proposal.matches.map((m) => m.garminActivityId),
      ...proposal.extras.map((e) => e.garminActivityId),
    ]);

    const activityById = new Map<string, { detail: any; splits: unknown[] }>();
    try {
      await client.connect();
      for (const id of neededIds) {
        const numericId = Number(id);
        const detail = await client.getActivity(numericId);
        const splits = await client.getActivitySplits(numericId);
        activityById.set(id, { detail, splits });
      }
    } catch (e) {
      return { agentId: 'system', response: `Failed to fetch activity details from Garmin: ${e instanceof Error ? e.message : String(e)}` };
    } finally {
      client.disconnect();
    }

    // Helper: only update columns that exist on the current row; avoid schema drift issues.
    function pickExisting(update: Record<string, unknown>, row: Record<string, unknown>) {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(update)) if (k in row) out[k] = v;
      return out;
    }

    const applied: string[] = [];
    let lastWorkoutIdForAnalysis: string | null = null;

    // 1) Apply matches (update planned -> completed)
    for (const m of proposal.matches) {
      const { data: row, error: rowErr } = await supabaseService
        .from('workouts')
        .select('*')
        .eq('id', m.plannedWorkoutId)
        .eq('user_id', userId)
        .maybeSingle();

      if (rowErr || !row) continue;

      const bundle = activityById.get(m.garminActivityId);
      if (!bundle) continue;

      const startTimeLocal = (bundle.detail.startTimeLocal || '').split('T')[0].split(' ')[0];
      // Safety: only apply if date matches
      if (startTimeLocal !== m.plannedDate) continue;

      const durationMin = bundle.detail.duration ? Math.round(bundle.detail.duration / 60) : null;
      const completedAt = bundle.detail.duration
        ? new Date(new Date(bundle.detail.startTimeLocal).getTime() + bundle.detail.duration * 1000).toISOString()
        : new Date().toISOString();

      const mergedMetadata = {
        ...(row.metadata && typeof row.metadata === 'object' ? (row.metadata as Record<string, unknown>) : {}),
        garmin: bundle.detail,
        garmin_activity_id: m.garminActivityId,
        actual_distance_miles: Math.round(metersToMiles(bundle.detail.distance || 0) * 100) / 100,
        laps: bundle.splits,
        syncedAt: new Date().toISOString(),
      };

      const desiredUpdate: Record<string, unknown> = {
        status: 'completed',
        completed_at: completedAt,
        actual_duration_minutes: durationMin,
        avg_heart_rate: bundle.detail.averageHR ?? null,
        max_heart_rate: bundle.detail.maxHR ?? null,
        calories_burned: bundle.detail.calories ?? null,
        external_id: String(m.garminActivityId),
        source: 'garmin',
        metadata: mergedMetadata,
        updated_at: new Date().toISOString(),
      };

      const safeUpdate = pickExisting(desiredUpdate, row as Record<string, unknown>);

      // Retry-drop for "column does not exist" cache drift
      let payload = { ...safeUpdate };
      for (let attempt = 0; attempt < 10; attempt++) {
        const { error } = await supabaseService
          .from('workouts')
          .update(payload)
          .eq('id', m.plannedWorkoutId)
          .eq('user_id', userId);

        if (!error) break;
        const msg = (error as { message?: string; code?: string }).message || '';
        const code = (error as { code?: string }).code;
        const mm = msg.match(/column\s+workouts\.([a-zA-Z0-9_]+)\s+does not exist/);
        const missing = mm?.[1];
        if (code === '42703' && missing && missing in payload) {
          delete (payload as Record<string, unknown>)[missing];
          continue;
        }
        break;
      }

      applied.push(`- Updated planned run **${m.plannedDate}** → completed (workoutId \`${m.plannedWorkoutId}\`)`);
      lastWorkoutIdForAnalysis = m.plannedWorkoutId;
    }

    // 2) Apply extras (insert completed run on rest day)
    for (const e of proposal.extras) {
      const bundle = activityById.get(e.garminActivityId);
      if (!bundle) continue;

      const activityDate = (bundle.detail.startTimeLocal || '').split('T')[0].split(' ')[0];

      const durationMin = bundle.detail.duration ? Math.round(bundle.detail.duration / 60) : null;
      const completedAt = bundle.detail.duration
        ? new Date(new Date(bundle.detail.startTimeLocal).getTime() + bundle.detail.duration * 1000).toISOString()
        : new Date().toISOString();

      const insertData: Record<string, unknown> = {
        user_id: userId,
        title: bundle.detail.activityName || `${activityDate} Run`,
        workout_type: 'run',
        status: 'completed',
        scheduled_date: activityDate,
        completed_at: completedAt,
        actual_duration_minutes: durationMin,
        avg_heart_rate: bundle.detail.averageHR ?? null,
        max_heart_rate: bundle.detail.maxHR ?? null,
        calories_burned: bundle.detail.calories ?? null,
        external_id: String(e.garminActivityId),
        source: 'garmin',
        metadata: {
          garmin: bundle.detail,
          garmin_activity_id: e.garminActivityId,
          actual_distance_miles: Math.round(metersToMiles(bundle.detail.distance || 0) * 100) / 100,
          laps: bundle.splits,
          syncedAt: new Date().toISOString(),
        },
      };

      // Insert only base columns to avoid migration mismatch
      const minimalInsert = {
        user_id: insertData.user_id,
        title: insertData.title,
        workout_type: insertData.workout_type,
        status: insertData.status,
        scheduled_date: insertData.scheduled_date,
        completed_at: insertData.completed_at,
        actual_duration_minutes: insertData.actual_duration_minutes,
        avg_heart_rate: insertData.avg_heart_rate,
        max_heart_rate: insertData.max_heart_rate,
        calories_burned: insertData.calories_burned,
        external_id: insertData.external_id,
        source: insertData.source,
        metadata: insertData.metadata,
      };

      const { data: created, error: insertErr } = await supabaseService
        .from('workouts')
        .insert(minimalInsert)
        .select('id')
        .single();

      if (!insertErr && created?.id) {
        applied.push(`- Added completed run on **${activityDate}** (workoutId \`${created.id}\`)`);
        lastWorkoutIdForAnalysis = created.id as string;
      }
    }

    // 3) Optionally mark missing planned as skipped
    if (flags.has('skip-missing')) {
      for (const p of proposal.missingPlanned) {
        await supabaseService
          .from('workouts')
          .update({ status: 'skipped', updated_at: new Date().toISOString() })
          .eq('id', p.plannedWorkoutId)
          .eq('user_id', userId);
        applied.push(`- Marked planned run **${p.plannedDate}** as skipped (workoutId \`${p.plannedWorkoutId}\`)`);
      }
    }

    // Mark proposal as actioned
    await supabaseService
      .from('whiteboard_entries')
      .update({ is_actioned: true, actioned_at: new Date().toISOString(), metadata: { sessionId, applied: true } })
      .eq('id', proposalId)
      .eq('user_id', userId);

    // Optionally: generate coach notes for the last affected workout (keeps experience “chat-first”)
    let coachNotesBlock = '';
    if (lastWorkoutIdForAnalysis) {
      try {
        const { data: workoutRow } = await supabaseService
          .from('workouts')
          .select('*')
          .eq('id', lastWorkoutIdForAnalysis)
          .single();

        if (workoutRow) {
          const metadata = (workoutRow.metadata || {}) as Record<string, unknown>;
          const syncedWorkout = {
            id: workoutRow.id,
            title: workoutRow.title,
            workoutType: workoutRow.workout_type,
            scheduledDate: workoutRow.scheduled_date,
            status: workoutRow.status,
            prescribedDistanceMiles: workoutRow.prescribed_distance_miles ?? null,
            prescribedPacePerMile: workoutRow.prescribed_pace_per_mile ?? null,
            prescribedDescription: workoutRow.prescribed_description ?? null,
            actualDurationMinutes: workoutRow.actual_duration_minutes ?? null,
            actualDistanceMiles: (metadata.actual_distance_miles as number | null) ?? null,
            actualPacePerMile: (metadata.actual_pace as string | null) ?? null,
            avgHeartRate: workoutRow.avg_heart_rate ?? null,
            maxHeartRate: workoutRow.max_heart_rate ?? null,
            calories: workoutRow.calories_burned ?? null,
            elevationGainFt: (metadata.elevation_gain_ft as number | null) ?? null,
            cadenceAvg: (metadata.cadence_avg as number | null) ?? null,
            splits: (metadata.laps as unknown[]) || [],
            coachNotes: workoutRow.coach_notes ?? null,
            athleteFeedback: workoutRow.athlete_feedback ?? null,
            perceivedExertion: workoutRow.perceived_exertion ?? null,
            matchedToPlannedWorkout: !!(workoutRow.plan_id || workoutRow.week_number),
            garminActivityId: workoutRow.external_id ?? null,
          };

          const analysis = await runChatFlow(
            supabaseAnon,
            llmClient,
            userId,
            'Analyze the imported run and write concise coach notes (2-3 short paragraphs + 3 bullet “Next time” tips).',
            timezone,
            { context: 'post-run', syncedWorkout }
          );

          await supabaseService
            .from('workouts')
            .update({ coach_notes: analysis.response, updated_at: new Date().toISOString() })
            .eq('id', lastWorkoutIdForAnalysis)
            .eq('user_id', userId);

          coachNotesBlock = `\n\n### Coach notes\n${analysis.response}`;
        }
      } catch {
        // Best-effort; don’t fail the command.
      }
    }

    return {
      agentId: 'system',
      dataUpdated: true,
      response: [
        `All set — I pulled the Garmin run${neededIds.size === 1 ? '' : 's'} and updated your schedule.`,
        '',
        applied.length
          ? `Here’s what I changed:`
          : `I didn’t end up making any changes (nothing matched safely).`,
        ...(applied.length ? applied.slice(0, 5) : []),
        applied.length > 5 ? `- …and ${applied.length - 5} more` : null,
      ]
        .filter(Boolean)
        .join('\n') + coachNotesBlock,
    };
  }

  // Unknown command - let the LLM handle it
  return null;
}

/**
 * Detect if the user wants to log/sync a run from Garmin
 */
function detectRunLoggingIntent(message: string): boolean {
  const lowerMessage = message.toLowerCase();

  const runLoggingPatterns = [
    /\b(log|sync|record|add|import)\s+(my|a|the|today'?s?)?\s*(run|workout|activity)/i,
    /\b(just|finished|completed|did)\s+(my|a|the)?\s*(run|workout|training)/i,
    /\bpull\s+(in|from)\s+(my\s+)?(run|garmin|workout)/i,
    /\bget\s+(my\s+)?(run|workout)\s+(from\s+)?garmin/i,
    /\bsync\s+(from\s+)?garmin/i,
    /\b(how was|analyze)\s+my\s+(run|workout)/i,
  ];

  return runLoggingPatterns.some(pattern => pattern.test(lowerMessage));
}

/**
 * Chat Endpoint
 * 
 * Handles user chat messages using the ChatFlow workflow.
 * Features:
 * - Smart LLM-based routing to correct agent
 * - Conversation context for better routing decisions
 * - Fast responses (<10s) with pre-loaded data
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { message, sessionId, context } = ChatRequestSchema.parse(body);

    const env = getEnv();
    const supabase = getSupabase();
    const supabaseService = getSupabaseService();
    const llmClient = createLLMClient();

    // Get user settings from database (timezone, name, etc.)
    const userSettings = await getUserSettings(env.USER_ID);
    const timezone = userSettings.timezone;

    // Get or create session ID
    const currentSessionId = sessionId || crypto.randomUUID();

    // Handle deterministic slash commands before any agent logic.
    const commandResult = await handleChatCommand(message, {
      userId: env.USER_ID,
      sessionId: currentSessionId,
      timezone,
      supabaseService,
      llmClient,
      supabaseAnon: supabase,
    });

    if (commandResult) {
      // Save chat messages to database
      await insertRecord('chat_messages', {
        user_id: env.USER_ID,
        session_id: currentSessionId,
        role: 'user',
        content: message,
      });

      await insertRecord('chat_messages', {
        user_id: env.USER_ID,
        session_id: currentSessionId,
        role: 'assistant',
        content: commandResult.response,
        responding_agent_id: commandResult.agentId || 'system',
      });

      return NextResponse.json({
        success: true,
        sessionId: currentSessionId,
        response: commandResult.response,
        agentId: commandResult.agentId || 'system',
        duration: Date.now() - startTime,
        dataUpdated: commandResult.dataUpdated || false,
        actions: commandResult.actions || [],
      });
    }

    // Detect if user wants to log/sync a run (auto-upgrade to post-run context)
    const wantsToLogRun = detectRunLoggingIntent(message);
    const effectiveContext = wantsToLogRun ? 'post-run' : (context || 'default');

    if (wantsToLogRun) {
      console.log('[Chat] Detected run-logging intent, switching to post-run context');
    }

    // For post-run context (explicit or detected), try to sync/load the latest workout
    let activitySyncResult = null;
    if (effectiveContext === 'post-run') {
      console.log('[Chat] Post-run context detected, attempting to sync/load workout...');

      // First try to sync from Garmin (this may fail on Vercel due to uvx requirement)
      try {
        activitySyncResult = await syncLatestActivity(supabaseService, env.USER_ID, {
          date: new Date().toISOString().split('T')[0],
          forceResync: false,
        });
        console.log('[Chat] Activity sync result:', {
          success: activitySyncResult.success,
          action: activitySyncResult.action,
          workout: activitySyncResult.workout?.title,
        });
      } catch (syncError) {
        console.error('[Chat] Garmin sync failed (expected on Vercel):', syncError);
      }

      // If no workout from sync, try to load today's most recent completed workout from DB
      if (!activitySyncResult?.workout) {
        console.log('[Chat] No synced workout, checking database for today\'s workout...');
        try {
          const todayDate = new Date().toLocaleDateString('en-CA', { timeZone: timezone });
          const { data: todayWorkout } = await supabaseService
            .from('workouts')
            .select('*')
            .eq('user_id', env.USER_ID)
            .eq('scheduled_date', todayDate)
            .eq('status', 'completed')
            .order('completed_at', { ascending: false })
            .limit(1)
            .single();

          if (todayWorkout) {
            console.log('[Chat] Found today\'s workout in DB:', todayWorkout.title);
            // Transform to SyncedWorkout format
            const metadata = (todayWorkout.metadata || {}) as Record<string, unknown>;
            activitySyncResult = {
              success: true,
              action: 'already_synced' as const,
              workout: {
                id: todayWorkout.id,
                title: todayWorkout.title,
                workoutType: todayWorkout.workout_type,
                scheduledDate: todayWorkout.scheduled_date,
                status: todayWorkout.status,
                prescribedDistanceMiles: todayWorkout.prescribed_distance_miles,
                prescribedPacePerMile: todayWorkout.prescribed_pace_per_mile,
                prescribedDescription: todayWorkout.prescribed_description,
                actualDurationMinutes: todayWorkout.actual_duration_minutes,
                actualDistanceMiles: metadata.actual_distance_miles as number | null,
                actualPacePerMile: metadata.actual_pace as string | null,
                avgHeartRate: todayWorkout.avg_heart_rate,
                maxHeartRate: todayWorkout.max_heart_rate,
                calories: todayWorkout.calories_burned,
                elevationGainFt: metadata.elevation_gain_ft as number | null,
                cadenceAvg: metadata.cadence_avg as number | null,
                splits: (metadata.laps as unknown[]) || [],
                coachNotes: todayWorkout.coach_notes,
                athleteFeedback: todayWorkout.athlete_feedback,
                perceivedExertion: todayWorkout.perceived_exertion,
                matchedToPlannedWorkout: !!todayWorkout.plan_id,
                garminActivityId: todayWorkout.external_id,
              },
            };
          }
        } catch (dbError) {
          console.error('[Chat] Failed to load workout from DB:', dbError);
        }
      }

      // Background health sync (may fail on Vercel)
      syncGarminMetrics(supabaseService, env.USER_ID, {
        date: new Date().toISOString().split('T')[0],
      }).catch(err => console.log('[Chat] Background health sync skipped:', err.message));
    }

    // Fetch recent conversation history for context-aware routing
    let conversationHistory: ConversationMessage[] = [];
    if (sessionId) {
      const { data: messages } = await supabase
        .from('chat_messages')
        .select('role, content, responding_agent_id')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(6); // Last 6 messages for context

      if (messages && messages.length > 0) {
        conversationHistory = messages
          .reverse()
          .map((m: { role: string; content: string; responding_agent_id: string | null }) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
            agentId: m.responding_agent_id || undefined,
          }));
      }
    }

    // Run the chat workflow with conversation context
    const result = await runChatFlow(
      supabase,
      llmClient,
      env.USER_ID,
      message,
      timezone,
      {
        conversationHistory,
        context: effectiveContext,
        syncedWorkout: activitySyncResult?.workout || undefined,
      }
    );

    // Save chat messages to database
    const { error: userMsgError } = await insertRecord('chat_messages', {
      user_id: env.USER_ID,
      session_id: currentSessionId,
      role: 'user',
      content: message,
    });

    if (userMsgError) {
      console.error('Failed to save user message:', userMsgError);
    }

    const { error: assistantMsgError } = await insertRecord('chat_messages', {
      user_id: env.USER_ID,
      session_id: currentSessionId,
      role: 'assistant',
      content: result.response,
      responding_agent_id: result.agentId,
      prompt_tokens: result.tokenUsage.prompt,
      completion_tokens: result.tokenUsage.completion,
    });

    if (assistantMsgError) {
      console.error('Failed to save assistant message:', assistantMsgError);
    }

    // For post-run context (explicit or detected), save the coach analysis and athlete feedback to the workout
    // This happens regardless of sync action (created, updated, or already_synced)
    if (effectiveContext === 'post-run') {
      const workoutId = activitySyncResult?.workout?.id;
      console.log('[Chat] Post-run context - attempting to save notes. WorkoutId:', workoutId, 'SyncAction:', activitySyncResult?.action);

      if (workoutId) {
        try {
          const { error: workoutUpdateError } = await supabaseService
            .from('workouts')
            .update({
              coach_notes: result.response,
              personal_notes: message, // The user's message about their run
              updated_at: new Date().toISOString(),
            })
            .eq('id', workoutId);

          if (workoutUpdateError) {
            console.error('[Chat] Failed to save coach notes:', workoutUpdateError);
          } else {
            console.log('[Chat] Successfully saved coach notes to workout', workoutId);
          }
        } catch (saveError) {
          console.error('[Chat] Error saving coach notes:', saveError);
        }
      } else {
        console.warn('[Chat] Post-run context but no workout ID available. SyncResult:', {
          success: activitySyncResult?.success,
          action: activitySyncResult?.action,
          error: activitySyncResult?.error,
        });
      }
    }

    return NextResponse.json({
      success: true,
      sessionId: currentSessionId,
      response: result.response,
      agentId: result.agentId,
      routing: result.routing,
      duration: result.duration,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('Chat error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
        duration,
      },
      { status: 500 }
    );
  }
}
