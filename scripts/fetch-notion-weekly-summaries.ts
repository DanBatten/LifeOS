/**
 * Fetch Weekly Summaries from Notion
 *
 * Run: npx tsx scripts/fetch-notion-weekly-summaries.ts
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
const USER_ID = getEnvVar('USER_ID') || '00000000-0000-0000-0000-000000000001';

if (!NOTION_API_KEY) {
  console.error('Missing NOTION_API_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface NotionPage {
  id: string;
  properties: Record<string, unknown>;
}

// First, let's explore the database to see all entry types
async function exploreDatabase(): Promise<void> {
  console.log('🔍 Exploring Notion database structure...\n');

  const response = await fetch(`https://api.notion.com/v1/databases/${NOTION_DATABASE_ID}/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${NOTION_API_KEY}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28'
    },
    body: JSON.stringify({
      page_size: 100
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Notion API error: ${response.status} - ${error}`);
  }

  const data = await response.json();

  // Collect all unique Type values
  const types = new Set<string>();
  const entriesByType = new Map<string, NotionPage[]>();

  for (const page of data.results) {
    const typeSelect = (page.properties as Record<string, { select?: { name: string } }>).Type?.select?.name || 'Unknown';
    types.add(typeSelect);

    const existing = entriesByType.get(typeSelect) || [];
    existing.push(page);
    entriesByType.set(typeSelect, existing);
  }

  console.log('📋 Entry Types Found:');
  for (const [type, pages] of entriesByType.entries()) {
    console.log(`   - ${type}: ${pages.length} entries`);
  }

  // Look for weekly summary entries
  console.log('\n🔎 Looking for Weekly Summary entries...\n');

  for (const [type, pages] of entriesByType.entries()) {
    if (type.toLowerCase().includes('week') || type.toLowerCase().includes('summary')) {
      console.log(`\n=== ${type} ===`);
      for (const page of pages.slice(0, 3)) {
        console.log('\nPage ID:', page.id);
        console.log('Properties:', JSON.stringify(page.properties, null, 2).substring(0, 1000));
      }
    }
  }

  // Also check for entries that might be weekly summaries based on title
  console.log('\n🔎 Checking entries with "Week" in title...\n');

  for (const page of data.results) {
    const props = page.properties as Record<string, unknown>;
    const titleProp = props.Event as { title?: Array<{ plain_text: string }> };
    const title = titleProp?.title?.[0]?.plain_text || '';

    if (title.toLowerCase().includes('week') && title.toLowerCase().includes('summary')) {
      const typeProp = props.Type as { select?: { name: string } };
      console.log(`Found: "${title}" (Type: ${typeProp?.select?.name || 'Unknown'})`);

      // Show the full properties for this entry
      const coachNotes = props['Coach Notes'] as { rich_text?: Array<{ plain_text: string }> };
      if (coachNotes?.rich_text?.[0]?.plain_text) {
        console.log('Coach Notes (first 500 chars):', coachNotes.rich_text[0].plain_text.substring(0, 500));
      }
      console.log('---');
    }
  }
}

async function main() {
  console.log('\n📚 Notion Weekly Summaries Explorer\n');
  console.log('='.repeat(50) + '\n');

  try {
    await exploreDatabase();
    console.log('\n✨ Exploration complete!\n');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
