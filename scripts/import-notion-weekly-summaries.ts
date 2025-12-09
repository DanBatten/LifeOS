/**
 * Import Weekly Summaries from Notion to Supabase
 *
 * Run: npx tsx scripts/import-notion-weekly-summaries.ts
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Load env manually
const envContent = readFileSync('.env.local', 'utf8');
function getEnvVar(name: string): string {
  const match = envContent.match(new RegExp(`^${name}=(.+)$`, 'm'));
  return match ? match[1].trim() : '';
}

const NOTION_API_KEY = getEnvVar('NOTION_API_KEY');
const NOTION_DATABASE_ID = '6057e16c12e34889aaf4b341b56e4638';
const SUPABASE_URL = getEnvVar('SUPABASE_URL');
const SUPABASE_SERVICE_KEY = getEnvVar('SUPABASE_SERVICE_KEY');

if (!NOTION_API_KEY) {
  console.error('Missing NOTION_API_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface WeeklySummary {
  weekNumber: number;
  title: string;
  coachNotes: string;
  notionPageId: string;
}

async function fetchWeeklySummaries(): Promise<WeeklySummary[]> {
  console.log('📥 Fetching weekly summaries from Notion...\n');

  const summaries: WeeklySummary[] = [];
  let hasMore = true;
  let startCursor: string | undefined;

  while (hasMore) {
    const body: Record<string, unknown> = {
      filter: {
        property: 'Type',
        select: {
          equals: 'Summary'
        }
      },
      page_size: 100
    };

    if (startCursor) {
      body.start_cursor = startCursor;
    }

    const response = await fetch(`https://api.notion.com/v1/databases/${NOTION_DATABASE_ID}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_API_KEY}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Notion API error: ${response.status} - ${error}`);
    }

    const data = await response.json();

    for (const page of data.results) {
      const props = page.properties as Record<string, unknown>;

      // Get title (Event property)
      const titleProp = props.Event as { title?: Array<{ plain_text: string }> };
      const title = titleProp?.title?.[0]?.plain_text || '';

      // Extract week number from title (e.g., "Week 5 Summary" -> 5)
      const weekMatch = title.match(/Week\s+(\d+)/i);
      const weekNumber = weekMatch ? parseInt(weekMatch[1], 10) : 0;

      // Get coach notes (full text, may be multiple blocks)
      const coachNotesProp = props['Coach Notes'] as { rich_text?: Array<{ plain_text: string }> };
      let coachNotes = '';
      if (coachNotesProp?.rich_text) {
        coachNotes = coachNotesProp.rich_text.map(block => block.plain_text).join('');
      }

      if (weekNumber > 0) {
        summaries.push({
          weekNumber,
          title,
          coachNotes,
          notionPageId: page.id
        });
      }
    }

    hasMore = data.has_more;
    startCursor = data.next_cursor || undefined;
  }

  // Sort by week number
  summaries.sort((a, b) => a.weekNumber - b.weekNumber);

  console.log(`   Found ${summaries.length} weekly summaries in Notion\n`);
  return summaries;
}

async function importSummaries(summaries: WeeklySummary[]) {
  console.log('📤 Importing summaries to Supabase...\n');

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const summary of summaries) {
    // Find the training week by week number
    const { data: week, error: findError } = await supabase
      .from('training_weeks')
      .select('id, week_summary')
      .eq('week_number', summary.weekNumber)
      .single();

    if (findError || !week) {
      console.log(`   ⚠️  Week ${summary.weekNumber}: No matching training_week found`);
      skipped++;
      continue;
    }

    // Check if we have content to update
    if (!summary.coachNotes || summary.coachNotes.trim().length === 0) {
      console.log(`   ⏭️  Week ${summary.weekNumber}: No coach notes in Notion`);
      skipped++;
      continue;
    }

    // Update the week_summary field
    const { error: updateError } = await supabase
      .from('training_weeks')
      .update({
        week_summary: summary.coachNotes,
        metadata: {
          notion_page_id: summary.notionPageId,
          notion_synced_at: new Date().toISOString()
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', week.id);

    if (updateError) {
      console.log(`   ❌ Week ${summary.weekNumber}: ${updateError.message}`);
      errors++;
    } else {
      const noteLength = summary.coachNotes.length;
      const preview = summary.coachNotes.substring(0, 60).replace(/\n/g, ' ');
      console.log(`   ✅ Week ${summary.weekNumber}: Updated (${noteLength} chars) - "${preview}..."`);
      updated++;
    }
  }

  console.log('\n📊 Summary:');
  console.log(`   ✅ Updated: ${updated}`);
  console.log(`   ⏭️  Skipped: ${skipped}`);
  if (errors > 0) {
    console.log(`   ❌ Errors: ${errors}`);
  }
}

async function main() {
  console.log('\n📚 Notion → Supabase Weekly Summaries Import\n');
  console.log('='.repeat(50) + '\n');

  try {
    const summaries = await fetchWeeklySummaries();

    // Show what we found
    console.log('📋 Weekly Summaries Found:\n');
    for (const s of summaries) {
      const hasNotes = s.coachNotes.length > 0;
      console.log(`   Week ${s.weekNumber}: ${hasNotes ? `${s.coachNotes.length} chars` : 'No notes'}`);
    }
    console.log('');

    await importSummaries(summaries);

    console.log('\n✨ Import complete!\n');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
