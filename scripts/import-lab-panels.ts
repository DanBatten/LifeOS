/**
 * Import Lab Panels from Quest Diagnostics CSV Export
 * 
 * Run: npx tsx scripts/import-lab-panels.ts /path/to/biomarkers.csv
 * 
 * This script:
 * 1. Parses the CSV with lab results
 * 2. Creates lab_panels for each unique date
 * 3. Imports biomarker_results with proper mapping
 * 4. Handles the messy PDF-to-CSV export format
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;
const USER_ID = process.env.USER_ID || '00000000-0000-0000-0000-000000000001';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ============================================
// BIOMARKER NAME MAPPING
// Maps CSV test names to our standardized codes
// ============================================
const biomarkerMapping: Record<string, string> = {
  // Lipid Panel
  'CHOLESTEROL, TOTAL': 'TOTAL_CHOLESTEROL',
  'HDL CHOLESTEROL': 'HDL',
  'LDL-CHOLESTEROL': 'LDL',
  'TRIGLYCERIDES': 'TRIGLYCERIDES',
  'CHOL/HDLC RATIO': 'CHOL_HDL_RATIO',
  'NON HDL CHOLESTEROL': 'NON_HDL_CHOLESTEROL',
  'LIPOPROTEIN (a)': 'LP_A',
  'APOLIPOPROTEIN B': 'APOB',
  'APOLIPOPROTEIN A1': 'APOA1',
  
  // Advanced Lipids
  'LDL PARTICLE NUMBER': 'LDL_P',
  'LDL SMALL': 'SMALL_LDL_P',
  'LDL MEDIUM': 'LDL_MEDIUM',
  'HDL LARGE': 'HDL_LARGE',
  'LDL PEAK SIZE': 'LDL_PEAK_SIZE',
  'OxLDL': 'OXLDL',
  
  // Metabolic Panel
  'GLUCOSE': 'GLUCOSE',
  'HEMOGLOBIN A1c': 'HBA1C',
  'INSULIN': 'INSULIN',
  'C-PEPTIDE, LC/MS/MS': 'C_PEPTIDE',
  'INSULIN RESISTANCE SCORE': 'INSULIN_RESISTANCE_SCORE',
  'UREA NITROGEN (BUN)': 'BUN',
  'CREATININE': 'CREATININE',
  'EGFR': 'EGFR',
  'CYSTATIN C': 'CYSTATIN_C',
  'SODIUM': 'SODIUM',
  'POTASSIUM': 'POTASSIUM',
  'CHLORIDE': 'CHLORIDE',
  'CARBON DIOXIDE': 'CO2',
  'CALCIUM': 'CALCIUM',
  'MAGNESIUM, RBC': 'MAGNESIUM_RBC',
  'ZINC': 'ZINC',
  'PHOSPHORUS': 'PHOSPHORUS',
  'URIC ACID': 'URIC_ACID',
  
  // Iron Panel
  'IRON, TOTAL': 'IRON',
  'FERRITIN': 'FERRITIN',
  'IRON BINDING CAPACITY': 'TIBC',
  '% SATURATION': 'TRANSFERRIN_SAT',
  
  // Liver Panel
  'PROTEIN, TOTAL': 'TOTAL_PROTEIN',
  'ALBUMIN': 'ALBUMIN',
  'GLOBULIN': 'GLOBULIN',
  'ALBUMIN/GLOBULIN RATIO': 'AG_RATIO',
  'BILIRUBIN, TOTAL': 'BILIRUBIN_TOTAL',
  'ALKALINE PHOSPHATASE': 'ALP',
  'AST': 'AST',
  'ALT': 'ALT',
  'GGT': 'GGT',
  'AMYLASE': 'AMYLASE',
  'LIPASE': 'LIPASE',
  
  // CBC
  'WHITE BLOOD CELL COUNT': 'WBC',
  'RED BLOOD CELL COUNT': 'RBC',
  'HEMOGLOBIN': 'HEMOGLOBIN',
  'HEMATOCRIT': 'HEMATOCRIT',
  'MCV': 'MCV',
  'MCH': 'MCH',
  'MCHC': 'MCHC',
  'RDW': 'RDW',
  'PLATELET COUNT': 'PLATELETS',
  'MPV': 'MPV',
  
  // CBC Differential
  'ABSOLUTE NEUTROPHILS': 'NEUTROPHILS_ABS',
  'ABSOLUTE LYMPHOCYTES': 'LYMPHOCYTES_ABS',
  'ABSOLUTE MONOCYTES': 'MONOCYTES_ABS',
  'ABSOLUTE EOSINOPHILS': 'EOSINOPHILS_ABS',
  'ABSOLUTE BASOPHILS': 'BASOPHILS_ABS',
  'NEUTROPHILS': 'NEUTROPHILS_PCT',
  'LYMPHOCYTES': 'LYMPHOCYTES_PCT',
  'MONOCYTES': 'MONOCYTES_PCT',
  'EOSINOPHILS': 'EOSINOPHILS_PCT',
  'BASOPHILS': 'BASOPHILS_PCT',
  
  // Thyroid
  'TSH': 'TSH',
  'T4, FREE': 'FREE_T4',
  'T3, FREE': 'FREE_T3',
  'THYROGLOBULIN ANTIBODIES': 'THYROGLOBULIN_AB',
  
  // Hormones
  'TESTOSTERONE, TOTAL, MS': 'TESTOSTERONE_TOTAL',
  'TESTOSTERONE, FREE': 'TESTOSTERONE_FREE',
  'DHEA SULFATE': 'DHEA_S',
  'ESTRADIOL': 'ESTRADIOL',
  'CORTISOL, TOTAL, LC/MS': 'CORTISOL',
  'FSH': 'FSH',
  'LH': 'LH',
  'PROLACTIN': 'PROLACTIN',
  'LEPTIN': 'LEPTIN',
  'ADIPONECTIN': 'ADIPONECTIN',
  
  // Prostate
  'PSA, TOTAL': 'PSA_TOTAL',
  'PSA, FREE': 'PSA_FREE',
  'PSA, % FREE': 'PSA_FREE_PCT',
  
  // Inflammatory
  'HS CRP': 'HSCRP',
  'HOMOCYSTEINE': 'HOMOCYSTEINE',
  'MYELOPEROXIDASE': 'MYELOPEROXIDASE',
  'LP PLA2 ACTIVITY': 'LP_PLA2',
  'RHEUMATOID FACTOR': 'RHEUMATOID_FACTOR',
  
  // Vitamins
  'VITAMIN D,25-OH,TOTAL,IA': 'VITAMIN_D',
  'METHYLMALONIC ACID': 'MMA',
  
  // Fatty Acids
  'OMEGA-3 TOTAL': 'OMEGA3_TOTAL',
  'EPA': 'EPA',
  'DPA': 'DPA',
  'DHA': 'DHA',
  'OMEGA-6 TOTAL': 'OMEGA6_TOTAL',
  'OMEGA-6/OMEGA-3 RATIO': 'OMEGA6_OMEGA3_RATIO',
  'ARACHIDONIC ACID/EPA RATIO': 'AA_EPA_RATIO',
  'ARACHIDONIC ACID': 'ARACHIDONIC_ACID',
  'LINOLEIC ACID': 'LINOLEIC_ACID',
  'EPA+DPA+DHA': 'OMEGA3_INDEX',
  
  // Cardiovascular
  'TMAO (TRIMETHYLAMINE  N OXIDE)': 'TMAO',
  
  // Heavy Metals
  'MERCURY, BLOOD': 'MERCURY',
  'LEAD (VENOUS)': 'LEAD',
};

// Skip these non-biomarker rows
const skipPatterns = [
  'PAGE',
  'GENERAL GUIDANCE',
  'AMDQUEST',
  'EZQUEST',
  'Z4MCLEVELAND',
  'Z99QUEST',
  'P89QUEST',
  'For ages',
  'Consider retesting',
  'Desirable range',
  'For patients with',
  'factor,',
  '(LDL-C of',
  'risk factors',
  'Handelsman',
  'code',
  'CLASS',
  'option',
  'Peak',
  'established in',
  'presence of',
  'daily dosage',
  'circulating triglycerides',
  'to arrange',
  'A score below',
  'BINDING GLOBULIN',
  'defines a population',
  'relative to those',
  'at moderate',
  'treating to',
  'ENQUEST',
];

interface CsvRow {
  date: string;
  test_name: string;
  result: string;
  unit: string;
  flag: string;
  reference_range: string;
  source: string;
}

interface ParsedResult {
  date: string;
  testName: string;
  biomarkerCode: string | null;
  value: number | null;
  valueText: string | null;
  unit: string;
  flag: string | null;
  refLow: number | null;
  refHigh: number | null;
}

function shouldSkip(testName: string): boolean {
  return skipPatterns.some(pattern => 
    testName.toUpperCase().includes(pattern.toUpperCase())
  );
}

function parseValue(result: string): { value: number | null; valueText: string | null } {
  if (!result || result.trim() === '') {
    return { value: null, valueText: null };
  }

  // Handle "<X" or ">X" values
  const ltMatch = result.match(/^<\s*([\d.]+)/);
  if (ltMatch) {
    return { value: parseFloat(ltMatch[1]), valueText: result };
  }

  const gtMatch = result.match(/^>\s*([\d.]+)/);
  if (gtMatch) {
    return { value: parseFloat(gtMatch[1]), valueText: result };
  }

  // Handle regular numeric values
  const numMatch = result.match(/^([\d.]+)/);
  if (numMatch) {
    return { value: parseFloat(numMatch[1]), valueText: null };
  }

  return { value: null, valueText: result };
}

function parseReferenceRange(range: string): { low: number | null; high: number | null } {
  if (!range) return { low: null, high: null };

  // Handle "X-Y" format
  const rangeMatch = range.match(/([\d.]+)\s*-\s*([\d.]+)/);
  if (rangeMatch) {
    return {
      low: parseFloat(rangeMatch[1]),
      high: parseFloat(rangeMatch[2]),
    };
  }

  // Handle "<X" format (upper limit only)
  const ltMatch = range.match(/<\s*([\d.]+)/);
  if (ltMatch) {
    return { low: null, high: parseFloat(ltMatch[1]) };
  }

  // Handle ">X" or ">= X" format (lower limit only)
  const gtMatch = range.match(/>\s*(?:OR\s*=\s*)?([\d.]+)/);
  if (gtMatch) {
    return { low: parseFloat(gtMatch[1]), high: null };
  }

  return { low: null, high: null };
}

function mapFlag(flag: string): string | null {
  if (!flag || flag.trim() === '') return 'normal';
  const f = flag.toUpperCase().trim();
  if (f === 'H' || f.includes('HIGH')) return 'high';
  if (f === 'L' || f.includes('LOW')) return 'low';
  return 'normal';
}

function parseRow(row: CsvRow): ParsedResult | null {
  const testName = row.test_name?.trim();
  
  if (!testName || shouldSkip(testName)) {
    return null;
  }

  // Look up the biomarker code
  const biomarkerCode = biomarkerMapping[testName] || null;
  
  if (!biomarkerCode) {
    // Check if it's a partial match
    for (const [name, code] of Object.entries(biomarkerMapping)) {
      if (testName.toUpperCase().includes(name.toUpperCase()) ||
          name.toUpperCase().includes(testName.toUpperCase())) {
        const { value, valueText } = parseValue(row.result);
        const { low, high } = parseReferenceRange(row.reference_range);
        
        if (value === null && valueText === null) return null;
        
        return {
          date: row.date,
          testName,
          biomarkerCode: code,
          value,
          valueText,
          unit: row.unit || '',
          flag: mapFlag(row.flag),
          refLow: low,
          refHigh: high,
        };
      }
    }
    return null; // Unknown biomarker
  }

  const { value, valueText } = parseValue(row.result);
  const { low, high } = parseReferenceRange(row.reference_range);

  if (value === null && valueText === null) return null;

  return {
    date: row.date,
    testName,
    biomarkerCode,
    value,
    valueText,
    unit: row.unit || '',
    flag: mapFlag(row.flag),
    refLow: low,
    refHigh: high,
  };
}

async function importLabPanels(csvPath: string) {
  console.log(`\n📂 Reading CSV from: ${csvPath}\n`);

  const csvContent = readFileSync(csvPath, 'utf-8');
  const records: CsvRow[] = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    bom: true,
  });

  console.log(`📊 Found ${records.length} rows\n`);

  // Parse all results
  const results: ParsedResult[] = [];
  const unmapped = new Set<string>();

  for (const row of records) {
    const parsed = parseRow(row);
    if (parsed) {
      results.push(parsed);
    } else if (row.test_name && !shouldSkip(row.test_name)) {
      unmapped.add(row.test_name);
    }
  }

  console.log(`✅ Parsed ${results.length} biomarker results`);
  
  if (unmapped.size > 0) {
    console.log(`\n⚠️  Unmapped test names (${unmapped.size}):`);
    [...unmapped].slice(0, 20).forEach(name => console.log(`   - ${name}`));
    if (unmapped.size > 20) {
      console.log(`   ... and ${unmapped.size - 20} more`);
    }
  }

  // Group by date
  const byDate = new Map<string, ParsedResult[]>();
  for (const result of results) {
    const existing = byDate.get(result.date) || [];
    // Deduplicate by biomarker code
    if (!existing.find(r => r.biomarkerCode === result.biomarkerCode)) {
      existing.push(result);
      byDate.set(result.date, existing);
    }
  }

  console.log(`\n📅 Found ${byDate.size} unique panel dates:`);
  for (const [date, dateResults] of byDate) {
    console.log(`   - ${date}: ${dateResults.length} results`);
  }

  // Create lab panels and results
  console.log('\n💾 Importing to database...\n');

  let panelsCreated = 0;
  let resultsCreated = 0;

  for (const [date, dateResults] of byDate) {
    // Create lab panel
    const { data: panel, error: panelError } = await supabase
      .from('lab_panels')
      .insert({
        user_id: USER_ID,
        panel_date: date,
        panel_name: 'Comprehensive Panel',
        lab_provider: 'Quest Diagnostics',
        panel_type: 'comprehensive',
        fasting: true,
        source_document_type: 'csv',
        metadata: {
          imported_at: new Date().toISOString(),
          source_file: csvPath,
        },
      })
      .select()
      .single();

    if (panelError) {
      console.error(`  ❌ Failed to create panel for ${date}:`, panelError.message);
      continue;
    }

    panelsCreated++;
    console.log(`  ✅ Created panel: ${date} (${panel.id})`);

    // Create biomarker results
    for (const result of dateResults) {
      const { error: resultError } = await supabase
        .from('biomarker_results')
        .insert({
          user_id: USER_ID,
          panel_id: panel.id,
          biomarker_code: result.biomarkerCode,
          biomarker_name: result.testName,
          value: result.value,
          value_text: result.valueText,
          unit: result.unit,
          reference_low: result.refLow,
          reference_high: result.refHigh,
          flag: result.flag,
        });

      if (resultError) {
        console.error(`    ❌ Failed: ${result.testName} - ${resultError.message}`);
      } else {
        resultsCreated++;
      }
    }
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`✨ Import complete!`);
  console.log(`   Panels created: ${panelsCreated}`);
  console.log(`   Results created: ${resultsCreated}`);
}

// Run
const csvPath = process.argv[2];
if (!csvPath) {
  console.error('Usage: npx tsx scripts/import-lab-panels.ts <csv-path>');
  process.exit(1);
}

importLabPanels(csvPath).catch(console.error);





