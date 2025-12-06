/**
 * Seed Database with Essential Data
 * 
 * Run: npx tsx scripts/seed-database.ts
 * 
 * Seeds:
 * 1. Default user (Dan)
 * 2. All biomarker definitions (60+ existing + 35 new)
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ============================================
// DEFAULT USER
// ============================================
const defaultUser = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'dan@lifeos.local',
  name: 'Dan',
  timezone: 'America/Los_Angeles',
  preferences: {
    morningDigestTime: '07:00',
    eveningDigestTime: '21:00',
    workingHours: { start: '09:00', end: '18:00' },
    defaultLLMProvider: 'anthropic',
  },
};

// ============================================
// BIOMARKER DEFINITIONS
// ============================================
interface BiomarkerDef {
  code: string;
  name: string;
  category: string;
  subcategory?: string;
  default_unit: string;
  default_range_low?: number;
  default_range_high?: number;
  optimal_range_low?: number;
  optimal_range_high?: number;
  description?: string;
  athlete_considerations?: string;
}

const biomarkerDefinitions: BiomarkerDef[] = [
  // ==========================================
  // LIPID PANEL
  // ==========================================
  { code: 'TOTAL_CHOLESTEROL', name: 'Total Cholesterol', category: 'lipid_panel', subcategory: 'cholesterol', default_unit: 'mg/dL', default_range_low: 0, default_range_high: 200, optimal_range_low: 150, optimal_range_high: 180, description: 'Total amount of cholesterol in blood', athlete_considerations: 'Athletes may have higher HDL raising total' },
  { code: 'HDL', name: 'HDL Cholesterol', category: 'lipid_panel', subcategory: 'cholesterol', default_unit: 'mg/dL', default_range_low: 40, default_range_high: 999, optimal_range_low: 60, optimal_range_high: 100, description: 'Good cholesterol - higher is better', athlete_considerations: 'Endurance athletes often have elevated HDL' },
  { code: 'LDL', name: 'LDL Cholesterol', category: 'lipid_panel', subcategory: 'cholesterol', default_unit: 'mg/dL', default_range_low: 0, default_range_high: 100, optimal_range_low: 0, optimal_range_high: 70, description: 'Bad cholesterol - lower is better' },
  { code: 'VLDL', name: 'VLDL Cholesterol', category: 'lipid_panel', subcategory: 'cholesterol', default_unit: 'mg/dL', default_range_low: 2, default_range_high: 30, optimal_range_low: 5, optimal_range_high: 20, description: 'Very low density lipoprotein' },
  { code: 'TRIGLYCERIDES', name: 'Triglycerides', category: 'lipid_panel', subcategory: 'cholesterol', default_unit: 'mg/dL', default_range_low: 0, default_range_high: 150, optimal_range_low: 0, optimal_range_high: 100, description: 'Fat in the blood', athlete_considerations: 'Elevated after high-carb intake' },
  { code: 'CHOL_HDL_RATIO', name: 'Cholesterol/HDL Ratio', category: 'lipid_panel', subcategory: 'cholesterol', default_unit: 'ratio', default_range_low: 0, default_range_high: 5, optimal_range_low: 0, optimal_range_high: 3.5, description: 'Risk ratio' },
  { code: 'LDL_HDL_RATIO', name: 'LDL/HDL Ratio', category: 'lipid_panel', subcategory: 'cholesterol', default_unit: 'ratio', default_range_low: 0, default_range_high: 3.5, optimal_range_low: 0, optimal_range_high: 2.5, description: 'Risk ratio' },
  { code: 'NON_HDL_CHOLESTEROL', name: 'Non-HDL Cholesterol', category: 'lipid_panel', subcategory: 'cholesterol', default_unit: 'mg/dL', default_range_low: 0, default_range_high: 130, optimal_range_low: 0, optimal_range_high: 100, description: 'Total cholesterol minus HDL - atherogenic particles' },

  // ==========================================
  // METABOLIC PANEL
  // ==========================================
  { code: 'GLUCOSE', name: 'Glucose (Fasting)', category: 'metabolic', subcategory: 'glucose', default_unit: 'mg/dL', default_range_low: 65, default_range_high: 99, optimal_range_low: 70, optimal_range_high: 85, description: 'Blood sugar level', athlete_considerations: 'Can be lower in trained athletes' },
  { code: 'HBA1C', name: 'Hemoglobin A1c', category: 'metabolic', subcategory: 'glucose', default_unit: '%', default_range_low: 0, default_range_high: 5.7, optimal_range_low: 4.5, optimal_range_high: 5.3, description: '3-month average blood sugar' },
  { code: 'INSULIN', name: 'Insulin (Fasting)', category: 'metabolic', subcategory: 'glucose', default_unit: 'uIU/mL', default_range_low: 2, default_range_high: 25, optimal_range_low: 2, optimal_range_high: 8, description: 'Fasting insulin level', athlete_considerations: 'Lower is generally better for metabolic health' },
  { code: 'C_PEPTIDE', name: 'C-Peptide', category: 'metabolic', subcategory: 'glucose', default_unit: 'ng/mL', default_range_low: 0.68, default_range_high: 2.16, optimal_range_low: 0.8, optimal_range_high: 2.0, description: 'Insulin production marker' },
  { code: 'INSULIN_RESISTANCE_SCORE', name: 'Insulin Resistance Score', category: 'metabolic', subcategory: 'glucose', default_unit: 'score', default_range_low: 0, default_range_high: 66, optimal_range_low: 0, optimal_range_high: 33, description: 'Calculated insulin resistance index' },
  { code: 'BUN', name: 'Blood Urea Nitrogen', category: 'metabolic', subcategory: 'kidney', default_unit: 'mg/dL', default_range_low: 6, default_range_high: 24, optimal_range_low: 10, optimal_range_high: 20, description: 'Kidney function marker', athlete_considerations: 'Can elevate with high protein intake' },
  { code: 'CREATININE', name: 'Creatinine', category: 'metabolic', subcategory: 'kidney', default_unit: 'mg/dL', default_range_low: 0.76, default_range_high: 1.27, optimal_range_low: 0.8, optimal_range_high: 1.2, description: 'Kidney function marker', athlete_considerations: 'Higher in muscular individuals' },
  { code: 'EGFR', name: 'eGFR', category: 'metabolic', subcategory: 'kidney', default_unit: 'mL/min/1.73m2', default_range_low: 90, default_range_high: 999, optimal_range_low: 90, optimal_range_high: 120, description: 'Estimated kidney filtration rate', athlete_considerations: 'May be falsely low in muscular athletes' },
  { code: 'CYSTATIN_C', name: 'Cystatin C', category: 'metabolic', subcategory: 'kidney', default_unit: 'mg/L', default_range_low: 0.52, default_range_high: 1.31, optimal_range_low: 0.6, optimal_range_high: 1.0, description: 'Kidney function marker - more accurate than creatinine', athlete_considerations: 'Not affected by muscle mass' },
  { code: 'BUN_CREAT_RATIO', name: 'BUN/Creatinine Ratio', category: 'metabolic', subcategory: 'kidney', default_unit: 'ratio', default_range_low: 9, default_range_high: 23, optimal_range_low: 10, optimal_range_high: 20, description: 'Kidney function indicator' },
  { code: 'SODIUM', name: 'Sodium', category: 'metabolic', subcategory: 'electrolytes', default_unit: 'mmol/L', default_range_low: 134, default_range_high: 144, optimal_range_low: 137, optimal_range_high: 142, description: 'Electrolyte balance', athlete_considerations: 'Watch for hyponatremia in endurance' },
  { code: 'POTASSIUM', name: 'Potassium', category: 'metabolic', subcategory: 'electrolytes', default_unit: 'mmol/L', default_range_low: 3.5, default_range_high: 5.2, optimal_range_low: 4.0, optimal_range_high: 4.8, description: 'Electrolyte balance', athlete_considerations: 'Critical for muscle function' },
  { code: 'CHLORIDE', name: 'Chloride', category: 'metabolic', subcategory: 'electrolytes', default_unit: 'mmol/L', default_range_low: 96, default_range_high: 106, optimal_range_low: 98, optimal_range_high: 104, description: 'Electrolyte balance' },
  { code: 'CO2', name: 'Carbon Dioxide', category: 'metabolic', subcategory: 'electrolytes', default_unit: 'mmol/L', default_range_low: 18, default_range_high: 29, optimal_range_low: 22, optimal_range_high: 28, description: 'Acid-base balance' },
  { code: 'CALCIUM', name: 'Calcium', category: 'metabolic', subcategory: 'minerals', default_unit: 'mg/dL', default_range_low: 8.7, default_range_high: 10.2, optimal_range_low: 9.0, optimal_range_high: 10.0, description: 'Bone and muscle function', athlete_considerations: 'Important for bone health' },
  { code: 'MAGNESIUM', name: 'Magnesium (Serum)', category: 'metabolic', subcategory: 'minerals', default_unit: 'mg/dL', default_range_low: 1.6, default_range_high: 2.6, optimal_range_low: 2.0, optimal_range_high: 2.5, description: 'Muscle and nerve function', athlete_considerations: 'Often low in athletes' },
  { code: 'MAGNESIUM_RBC', name: 'Magnesium (RBC)', category: 'metabolic', subcategory: 'minerals', default_unit: 'mg/dL', default_range_low: 4.0, default_range_high: 6.4, optimal_range_low: 5.0, optimal_range_high: 6.0, description: 'Intracellular magnesium - more accurate than serum', athlete_considerations: 'Better indicator of true magnesium status' },
  { code: 'ZINC', name: 'Zinc', category: 'metabolic', subcategory: 'minerals', default_unit: 'mcg/dL', default_range_low: 60, default_range_high: 130, optimal_range_low: 80, optimal_range_high: 120, description: 'Immune function and testosterone production', athlete_considerations: 'Lost in sweat, may need supplementation' },
  { code: 'PHOSPHORUS', name: 'Phosphorus', category: 'metabolic', subcategory: 'minerals', default_unit: 'mg/dL', default_range_low: 2.5, default_range_high: 4.5, optimal_range_low: 3.0, optimal_range_high: 4.0, description: 'Bone and energy metabolism' },
  { code: 'URIC_ACID', name: 'Uric Acid', category: 'metabolic', subcategory: 'metabolic', default_unit: 'mg/dL', default_range_low: 3.7, default_range_high: 8.6, optimal_range_low: 4, optimal_range_high: 6, description: 'Purine metabolism', athlete_considerations: 'Can elevate with intense training' },

  // ==========================================
  // LIVER PANEL
  // ==========================================
  { code: 'ALT', name: 'ALT (SGPT)', category: 'liver', subcategory: 'enzymes', default_unit: 'U/L', default_range_low: 0, default_range_high: 44, optimal_range_low: 0, optimal_range_high: 30, description: 'Liver enzyme', athlete_considerations: 'Can elevate after intense exercise' },
  { code: 'AST', name: 'AST (SGOT)', category: 'liver', subcategory: 'enzymes', default_unit: 'U/L', default_range_low: 0, default_range_high: 40, optimal_range_low: 0, optimal_range_high: 30, description: 'Liver/muscle enzyme', athlete_considerations: 'Often elevated in athletes - muscle breakdown' },
  { code: 'ALP', name: 'Alkaline Phosphatase', category: 'liver', subcategory: 'enzymes', default_unit: 'U/L', default_range_low: 39, default_range_high: 117, optimal_range_low: 40, optimal_range_high: 100, description: 'Bone/liver enzyme' },
  { code: 'GGT', name: 'GGT', category: 'liver', subcategory: 'enzymes', default_unit: 'U/L', default_range_low: 0, default_range_high: 65, optimal_range_low: 0, optimal_range_high: 30, description: 'Liver enzyme', athlete_considerations: 'Sensitive to alcohol' },
  { code: 'BILIRUBIN_TOTAL', name: 'Bilirubin (Total)', category: 'liver', subcategory: 'bilirubin', default_unit: 'mg/dL', default_range_low: 0, default_range_high: 1.2, optimal_range_low: 0.2, optimal_range_high: 0.9, description: 'Liver processing marker' },
  { code: 'BILIRUBIN_DIRECT', name: 'Bilirubin (Direct)', category: 'liver', subcategory: 'bilirubin', default_unit: 'mg/dL', default_range_low: 0, default_range_high: 0.4, optimal_range_low: 0, optimal_range_high: 0.3, description: 'Conjugated bilirubin' },
  { code: 'ALBUMIN', name: 'Albumin', category: 'liver', subcategory: 'proteins', default_unit: 'g/dL', default_range_low: 3.5, default_range_high: 5.5, optimal_range_low: 4.0, optimal_range_high: 5.0, description: 'Liver protein synthesis' },
  { code: 'TOTAL_PROTEIN', name: 'Total Protein', category: 'liver', subcategory: 'proteins', default_unit: 'g/dL', default_range_low: 6.0, default_range_high: 8.5, optimal_range_low: 6.5, optimal_range_high: 8.0, description: 'Total blood protein' },
  { code: 'GLOBULIN', name: 'Globulin', category: 'liver', subcategory: 'proteins', default_unit: 'g/dL', default_range_low: 1.5, default_range_high: 4.5, optimal_range_low: 2.0, optimal_range_high: 3.5, description: 'Immune proteins' },
  { code: 'AG_RATIO', name: 'A/G Ratio', category: 'liver', subcategory: 'proteins', default_unit: 'ratio', default_range_low: 1.1, default_range_high: 2.5, optimal_range_low: 1.3, optimal_range_high: 2.0, description: 'Albumin to globulin ratio' },
  { code: 'AMYLASE', name: 'Amylase', category: 'liver', subcategory: 'digestive', default_unit: 'U/L', default_range_low: 21, default_range_high: 101, optimal_range_low: 30, optimal_range_high: 90, description: 'Pancreatic enzyme' },
  { code: 'LIPASE', name: 'Lipase', category: 'liver', subcategory: 'digestive', default_unit: 'U/L', default_range_low: 7, default_range_high: 60, optimal_range_low: 10, optimal_range_high: 50, description: 'Pancreatic enzyme' },

  // ==========================================
  // IRON/ANEMIA PANEL
  // ==========================================
  { code: 'IRON', name: 'Iron', category: 'iron', subcategory: 'iron_status', default_unit: 'mcg/dL', default_range_low: 38, default_range_high: 169, optimal_range_low: 80, optimal_range_high: 150, description: 'Serum iron level', athlete_considerations: 'Critical for oxygen transport' },
  { code: 'FERRITIN', name: 'Ferritin', category: 'iron', subcategory: 'iron_status', default_unit: 'ng/mL', default_range_low: 30, default_range_high: 400, optimal_range_low: 50, optimal_range_high: 150, description: 'Iron storage', athlete_considerations: 'Athletes need higher levels (50+)' },
  { code: 'TIBC', name: 'TIBC', category: 'iron', subcategory: 'iron_status', default_unit: 'mcg/dL', default_range_low: 250, default_range_high: 370, optimal_range_low: 260, optimal_range_high: 350, description: 'Total iron binding capacity' },
  { code: 'TRANSFERRIN_SAT', name: 'Transferrin Saturation', category: 'iron', subcategory: 'iron_status', default_unit: '%', default_range_low: 15, default_range_high: 55, optimal_range_low: 25, optimal_range_high: 45, description: 'Iron transport saturation' },
  { code: 'TRANSFERRIN', name: 'Transferrin', category: 'iron', subcategory: 'iron_status', default_unit: 'mg/dL', default_range_low: 200, default_range_high: 360, optimal_range_low: 220, optimal_range_high: 340, description: 'Iron transport protein' },

  // ==========================================
  // COMPLETE BLOOD COUNT
  // ==========================================
  { code: 'WBC', name: 'White Blood Cell Count', category: 'cbc', subcategory: 'white_cells', default_unit: 'K/uL', default_range_low: 3.4, default_range_high: 10.8, optimal_range_low: 4.5, optimal_range_high: 8.0, description: 'Immune cell count', athlete_considerations: 'Can drop with overtraining' },
  { code: 'RBC', name: 'Red Blood Cell Count', category: 'cbc', subcategory: 'red_cells', default_unit: 'M/uL', default_range_low: 4.14, default_range_high: 5.80, optimal_range_low: 4.5, optimal_range_high: 5.5, description: 'Oxygen carrying cells', athlete_considerations: 'Endurance training increases RBC' },
  { code: 'HEMOGLOBIN', name: 'Hemoglobin', category: 'cbc', subcategory: 'red_cells', default_unit: 'g/dL', default_range_low: 12.6, default_range_high: 17.7, optimal_range_low: 14, optimal_range_high: 16, description: 'Oxygen carrying protein', athlete_considerations: 'Critical for endurance performance' },
  { code: 'HEMATOCRIT', name: 'Hematocrit', category: 'cbc', subcategory: 'red_cells', default_unit: '%', default_range_low: 37.5, default_range_high: 51.0, optimal_range_low: 42, optimal_range_high: 48, description: 'Red blood cell volume', athlete_considerations: 'Dehydration falsely elevates' },
  { code: 'MCV', name: 'MCV', category: 'cbc', subcategory: 'red_cell_indices', default_unit: 'fL', default_range_low: 79, default_range_high: 97, optimal_range_low: 82, optimal_range_high: 94, description: 'Red cell size' },
  { code: 'MCH', name: 'MCH', category: 'cbc', subcategory: 'red_cell_indices', default_unit: 'pg', default_range_low: 26.6, default_range_high: 33.0, optimal_range_low: 28, optimal_range_high: 32, description: 'Hemoglobin per cell' },
  { code: 'MCHC', name: 'MCHC', category: 'cbc', subcategory: 'red_cell_indices', default_unit: 'g/dL', default_range_low: 31.5, default_range_high: 35.7, optimal_range_low: 32, optimal_range_high: 35, description: 'Hemoglobin concentration' },
  { code: 'RDW', name: 'RDW', category: 'cbc', subcategory: 'red_cell_indices', default_unit: '%', default_range_low: 11.7, default_range_high: 15.4, optimal_range_low: 12, optimal_range_high: 14, description: 'Red cell size variation' },
  { code: 'PLATELETS', name: 'Platelet Count', category: 'cbc', subcategory: 'platelets', default_unit: 'K/uL', default_range_low: 150, default_range_high: 379, optimal_range_low: 175, optimal_range_high: 325, description: 'Blood clotting cells' },
  { code: 'MPV', name: 'Mean Platelet Volume', category: 'cbc', subcategory: 'platelets', default_unit: 'fL', default_range_low: 7.4, default_range_high: 10.4, optimal_range_low: 8, optimal_range_high: 10, description: 'Platelet size' },
  
  // CBC DIFFERENTIAL
  { code: 'NEUTROPHILS_ABS', name: 'Absolute Neutrophils', category: 'cbc', subcategory: 'differential', default_unit: 'cells/uL', default_range_low: 1500, default_range_high: 7800, optimal_range_low: 2000, optimal_range_high: 6000, description: 'Primary immune defense cells' },
  { code: 'LYMPHOCYTES_ABS', name: 'Absolute Lymphocytes', category: 'cbc', subcategory: 'differential', default_unit: 'cells/uL', default_range_low: 850, default_range_high: 3900, optimal_range_low: 1000, optimal_range_high: 3500, description: 'Adaptive immune cells' },
  { code: 'MONOCYTES_ABS', name: 'Absolute Monocytes', category: 'cbc', subcategory: 'differential', default_unit: 'cells/uL', default_range_low: 200, default_range_high: 950, optimal_range_low: 200, optimal_range_high: 800, description: 'Phagocytic immune cells' },
  { code: 'EOSINOPHILS_ABS', name: 'Absolute Eosinophils', category: 'cbc', subcategory: 'differential', default_unit: 'cells/uL', default_range_low: 15, default_range_high: 500, optimal_range_low: 50, optimal_range_high: 400, description: 'Allergy/parasite response cells' },
  { code: 'BASOPHILS_ABS', name: 'Absolute Basophils', category: 'cbc', subcategory: 'differential', default_unit: 'cells/uL', default_range_low: 0, default_range_high: 200, optimal_range_low: 0, optimal_range_high: 150, description: 'Allergic response cells' },
  { code: 'NEUTROPHILS_PCT', name: 'Neutrophils %', category: 'cbc', subcategory: 'differential', default_unit: '%', default_range_low: 40, default_range_high: 70, optimal_range_low: 45, optimal_range_high: 65, description: 'Neutrophil percentage' },
  { code: 'LYMPHOCYTES_PCT', name: 'Lymphocytes %', category: 'cbc', subcategory: 'differential', default_unit: '%', default_range_low: 20, default_range_high: 50, optimal_range_low: 25, optimal_range_high: 45, description: 'Lymphocyte percentage' },
  { code: 'MONOCYTES_PCT', name: 'Monocytes %', category: 'cbc', subcategory: 'differential', default_unit: '%', default_range_low: 2, default_range_high: 10, optimal_range_low: 3, optimal_range_high: 8, description: 'Monocyte percentage' },
  { code: 'EOSINOPHILS_PCT', name: 'Eosinophils %', category: 'cbc', subcategory: 'differential', default_unit: '%', default_range_low: 0, default_range_high: 6, optimal_range_low: 0, optimal_range_high: 4, description: 'Eosinophil percentage' },
  { code: 'BASOPHILS_PCT', name: 'Basophils %', category: 'cbc', subcategory: 'differential', default_unit: '%', default_range_low: 0, default_range_high: 2, optimal_range_low: 0, optimal_range_high: 1, description: 'Basophil percentage' },

  // ==========================================
  // THYROID PANEL
  // ==========================================
  { code: 'TSH', name: 'TSH', category: 'thyroid', subcategory: 'thyroid', default_unit: 'mIU/L', default_range_low: 0.45, default_range_high: 4.5, optimal_range_low: 1.0, optimal_range_high: 2.5, description: 'Thyroid stimulating hormone', athlete_considerations: 'Overtraining can affect thyroid' },
  { code: 'FREE_T4', name: 'Free T4', category: 'thyroid', subcategory: 'thyroid', default_unit: 'ng/dL', default_range_low: 0.82, default_range_high: 1.77, optimal_range_low: 1.0, optimal_range_high: 1.5, description: 'Active thyroid hormone' },
  { code: 'FREE_T3', name: 'Free T3', category: 'thyroid', subcategory: 'thyroid', default_unit: 'pg/mL', default_range_low: 2.0, default_range_high: 4.4, optimal_range_low: 2.5, optimal_range_high: 4.0, description: 'Most active thyroid hormone', athlete_considerations: 'Can decrease with caloric restriction' },
  { code: 'REVERSE_T3', name: 'Reverse T3', category: 'thyroid', subcategory: 'thyroid', default_unit: 'ng/dL', default_range_low: 9.2, default_range_high: 24.1, optimal_range_low: 10, optimal_range_high: 20, description: 'Inactive T3', athlete_considerations: 'Elevated with overtraining/stress' },
  { code: 'THYROGLOBULIN_AB', name: 'Thyroglobulin Antibodies', category: 'thyroid', subcategory: 'autoimmune', default_unit: 'IU/mL', default_range_low: 0, default_range_high: 1, optimal_range_low: 0, optimal_range_high: 1, description: 'Autoimmune thyroid marker' },
  { code: 'TPO_AB', name: 'TPO Antibodies', category: 'thyroid', subcategory: 'autoimmune', default_unit: 'IU/mL', default_range_low: 0, default_range_high: 9, optimal_range_low: 0, optimal_range_high: 5, description: 'Autoimmune thyroid marker' },

  // ==========================================
  // HORMONES
  // ==========================================
  { code: 'TESTOSTERONE_TOTAL', name: 'Total Testosterone', category: 'hormones', subcategory: 'androgens', default_unit: 'ng/dL', default_range_low: 264, default_range_high: 916, optimal_range_low: 500, optimal_range_high: 900, description: 'Primary male hormone', athlete_considerations: 'Can decrease with overtraining' },
  { code: 'TESTOSTERONE_FREE', name: 'Free Testosterone', category: 'hormones', subcategory: 'androgens', default_unit: 'pg/mL', default_range_low: 6.8, default_range_high: 21.5, optimal_range_low: 15, optimal_range_high: 25, description: 'Bioavailable testosterone' },
  { code: 'SHBG', name: 'SHBG', category: 'hormones', subcategory: 'binding', default_unit: 'nmol/L', default_range_low: 16.5, default_range_high: 55.9, optimal_range_low: 20, optimal_range_high: 45, description: 'Sex hormone binding globulin', athlete_considerations: 'Affects free testosterone' },
  { code: 'ESTRADIOL', name: 'Estradiol', category: 'hormones', subcategory: 'estrogens', default_unit: 'pg/mL', default_range_low: 7.6, default_range_high: 42.6, optimal_range_low: 15, optimal_range_high: 30, description: 'Estrogen', athlete_considerations: 'Balance with testosterone important' },
  { code: 'DHEA_S', name: 'DHEA-S', category: 'hormones', subcategory: 'adrenal', default_unit: 'mcg/dL', default_range_low: 102, default_range_high: 416, optimal_range_low: 200, optimal_range_high: 400, description: 'Adrenal androgen precursor', athlete_considerations: 'Stress/overtraining can deplete' },
  { code: 'CORTISOL', name: 'Cortisol (AM)', category: 'hormones', subcategory: 'adrenal', default_unit: 'mcg/dL', default_range_low: 6.2, default_range_high: 19.4, optimal_range_low: 10, optimal_range_high: 18, description: 'Stress hormone', athlete_considerations: 'Chronically elevated = overtraining' },
  { code: 'IGF1', name: 'IGF-1', category: 'hormones', subcategory: 'growth', default_unit: 'ng/mL', default_range_low: 98, default_range_high: 282, optimal_range_low: 150, optimal_range_high: 250, description: 'Growth factor', athlete_considerations: 'Drops with caloric deficit' },
  { code: 'PROLACTIN', name: 'Prolactin', category: 'hormones', subcategory: 'pituitary', default_unit: 'ng/mL', default_range_low: 4.0, default_range_high: 15.2, optimal_range_low: 5, optimal_range_high: 12, description: 'Pituitary hormone' },
  { code: 'FSH', name: 'FSH', category: 'hormones', subcategory: 'pituitary', default_unit: 'mIU/mL', default_range_low: 1.5, default_range_high: 12.4, optimal_range_low: 2, optimal_range_high: 8, description: 'Follicle stimulating hormone' },
  { code: 'LH', name: 'LH', category: 'hormones', subcategory: 'pituitary', default_unit: 'mIU/mL', default_range_low: 1.7, default_range_high: 8.6, optimal_range_low: 3, optimal_range_high: 7, description: 'Luteinizing hormone' },
  { code: 'LEPTIN', name: 'Leptin', category: 'hormones', subcategory: 'metabolic', default_unit: 'ng/mL', default_range_low: 0.5, default_range_high: 15, optimal_range_low: 1, optimal_range_high: 8, description: 'Satiety hormone', athlete_considerations: 'Low in lean individuals' },
  { code: 'ADIPONECTIN', name: 'Adiponectin', category: 'hormones', subcategory: 'metabolic', default_unit: 'ug/mL', default_range_low: 5, default_range_high: 30, optimal_range_low: 10, optimal_range_high: 25, description: 'Anti-inflammatory adipokine', athlete_considerations: 'Higher is generally better' },

  // ==========================================
  // PROSTATE (MALE)
  // ==========================================
  { code: 'PSA_TOTAL', name: 'PSA Total', category: 'prostate', subcategory: 'psa', default_unit: 'ng/mL', default_range_low: 0, default_range_high: 4.0, optimal_range_low: 0, optimal_range_high: 2.0, description: 'Prostate specific antigen' },
  { code: 'PSA_FREE', name: 'PSA Free', category: 'prostate', subcategory: 'psa', default_unit: 'ng/mL', default_range_low: 0, default_range_high: 4, description: 'Free PSA fraction' },
  { code: 'PSA_FREE_PCT', name: 'PSA % Free', category: 'prostate', subcategory: 'psa', default_unit: '%', default_range_low: 25, default_range_high: 100, optimal_range_low: 25, optimal_range_high: 100, description: 'Percentage of free PSA - higher is better' },

  // ==========================================
  // INFLAMMATORY MARKERS
  // ==========================================
  { code: 'HSCRP', name: 'hs-CRP', category: 'inflammatory', subcategory: 'acute_phase', default_unit: 'mg/L', default_range_low: 0, default_range_high: 3.0, optimal_range_low: 0, optimal_range_high: 1.0, description: 'High-sensitivity C-reactive protein', athlete_considerations: 'Elevates post-workout for 24-48h' },
  { code: 'ESR', name: 'ESR', category: 'inflammatory', subcategory: 'acute_phase', default_unit: 'mm/hr', default_range_low: 0, default_range_high: 22, optimal_range_low: 0, optimal_range_high: 10, description: 'Erythrocyte sedimentation rate' },
  { code: 'HOMOCYSTEINE', name: 'Homocysteine', category: 'inflammatory', subcategory: 'cardiovascular', default_unit: 'umol/L', default_range_low: 0, default_range_high: 15, optimal_range_low: 5, optimal_range_high: 10, description: 'Cardiovascular risk marker' },
  { code: 'FIBRINOGEN', name: 'Fibrinogen', category: 'inflammatory', subcategory: 'coagulation', default_unit: 'mg/dL', default_range_low: 193, default_range_high: 507, optimal_range_low: 200, optimal_range_high: 400, description: 'Clotting factor' },
  { code: 'RHEUMATOID_FACTOR', name: 'Rheumatoid Factor', category: 'inflammatory', subcategory: 'autoimmune', default_unit: 'IU/mL', default_range_low: 0, default_range_high: 14, optimal_range_low: 0, optimal_range_high: 10, description: 'Autoimmune marker' },

  // ==========================================
  // VITAMINS
  // ==========================================
  { code: 'VITAMIN_D', name: 'Vitamin D (25-OH)', category: 'vitamins', subcategory: 'fat_soluble', default_unit: 'ng/mL', default_range_low: 30, default_range_high: 100, optimal_range_low: 50, optimal_range_high: 80, description: '25-hydroxyvitamin D', athlete_considerations: 'Athletes should target 50+ ng/mL' },
  { code: 'VITAMIN_B12', name: 'Vitamin B12', category: 'vitamins', subcategory: 'b_vitamins', default_unit: 'pg/mL', default_range_low: 232, default_range_high: 1245, optimal_range_low: 500, optimal_range_high: 1000, description: 'Cobalamin', athlete_considerations: 'Important for energy metabolism' },
  { code: 'FOLATE', name: 'Folate', category: 'vitamins', subcategory: 'b_vitamins', default_unit: 'ng/mL', default_range_low: 2.5, default_range_high: 20, optimal_range_low: 10, optimal_range_high: 20, description: 'Folic acid' },
  { code: 'MMA', name: 'Methylmalonic Acid', category: 'vitamins', subcategory: 'b_vitamins', default_unit: 'nmol/L', default_range_low: 55, default_range_high: 335, optimal_range_low: 70, optimal_range_high: 250, description: 'Functional B12 marker', athlete_considerations: 'Elevated = B12 deficiency even with normal B12' },

  // ==========================================
  // CARDIAC/ADVANCED LIPIDS
  // ==========================================
  { code: 'LP_A', name: 'Lipoprotein(a)', category: 'cardiac', subcategory: 'lipoproteins', default_unit: 'nmol/L', default_range_low: 0, default_range_high: 75, optimal_range_low: 0, optimal_range_high: 30, description: 'Genetic cardiovascular risk', athlete_considerations: 'Largely genetic, hard to modify' },
  { code: 'APOB', name: 'Apolipoprotein B', category: 'cardiac', subcategory: 'lipoproteins', default_unit: 'mg/dL', default_range_low: 60, default_range_high: 117, optimal_range_low: 60, optimal_range_high: 90, description: 'Atherogenic particle count', athlete_considerations: 'Better predictor than LDL' },
  { code: 'APOA1', name: 'Apolipoprotein A1', category: 'cardiac', subcategory: 'lipoproteins', default_unit: 'mg/dL', default_range_low: 100, default_range_high: 200, optimal_range_low: 140, optimal_range_high: 200, description: 'HDL protein - cardioprotective' },
  { code: 'LDL_P', name: 'LDL Particle Number', category: 'cardiac', subcategory: 'advanced_lipid', default_unit: 'nmol/L', default_range_low: 0, default_range_high: 1000, optimal_range_low: 0, optimal_range_high: 700, description: 'LDL particle count', athlete_considerations: 'More predictive than LDL-C' },
  { code: 'SMALL_LDL_P', name: 'Small LDL-P', category: 'cardiac', subcategory: 'advanced_lipid', default_unit: 'nmol/L', default_range_low: 0, default_range_high: 600, optimal_range_low: 0, optimal_range_high: 300, description: 'Small dense LDL particles - atherogenic' },
  { code: 'LDL_MEDIUM', name: 'LDL Medium', category: 'cardiac', subcategory: 'advanced_lipid', default_unit: 'nmol/L', default_range_low: 0, default_range_high: 215, optimal_range_low: 0, optimal_range_high: 150, description: 'Medium LDL particles' },
  { code: 'HDL_LARGE', name: 'HDL Large', category: 'cardiac', subcategory: 'advanced_lipid', default_unit: 'nmol/L', default_range_low: 6729, default_range_high: 99999, optimal_range_low: 7000, optimal_range_high: 99999, description: 'Large HDL particles - cardioprotective' },
  { code: 'LDL_PEAK_SIZE', name: 'LDL Peak Size', category: 'cardiac', subcategory: 'advanced_lipid', default_unit: 'Angstrom', default_range_low: 222.9, default_range_high: 300, optimal_range_low: 225, optimal_range_high: 300, description: 'LDL particle size - larger is better' },
  { code: 'OXLDL', name: 'Oxidized LDL', category: 'cardiac', subcategory: 'advanced_lipid', default_unit: 'U/L', default_range_low: 0, default_range_high: 60, optimal_range_low: 0, optimal_range_high: 50, description: 'Oxidized LDL - atherogenic' },
  { code: 'MYELOPEROXIDASE', name: 'Myeloperoxidase', category: 'cardiac', subcategory: 'vascular', default_unit: 'pmol/L', default_range_low: 0, default_range_high: 470, optimal_range_low: 0, optimal_range_high: 350, description: 'Vascular inflammation marker' },
  { code: 'LP_PLA2', name: 'Lp-PLA2 Activity', category: 'cardiac', subcategory: 'vascular', default_unit: 'nmol/min/mL', default_range_low: 0, default_range_high: 123, optimal_range_low: 0, optimal_range_high: 100, description: 'Arterial inflammation marker' },
  { code: 'TMAO', name: 'TMAO', category: 'cardiac', subcategory: 'metabolic', default_unit: 'uM', default_range_low: 0, default_range_high: 6.2, optimal_range_low: 0, optimal_range_high: 5, description: 'Trimethylamine N-oxide - gut/CV risk marker' },

  // ==========================================
  // OMEGA/FATTY ACIDS
  // ==========================================
  { code: 'OMEGA3_INDEX', name: 'Omega-3 Index', category: 'fatty_acids', subcategory: 'essential', default_unit: '%', default_range_low: 4, default_range_high: 999, optimal_range_low: 8, optimal_range_high: 12, description: 'EPA+DHA in red blood cells', athlete_considerations: 'Critical for inflammation control' },
  { code: 'EPA', name: 'EPA', category: 'fatty_acids', subcategory: 'omega3', default_unit: '%', default_range_low: 0.2, default_range_high: 2.3, optimal_range_low: 0.8, optimal_range_high: 2.0, description: 'Eicosapentaenoic acid' },
  { code: 'DPA', name: 'DPA', category: 'fatty_acids', subcategory: 'omega3', default_unit: '%', default_range_low: 0.8, default_range_high: 1.8, optimal_range_low: 1.0, optimal_range_high: 1.6, description: 'Docosapentaenoic acid' },
  { code: 'DHA', name: 'DHA', category: 'fatty_acids', subcategory: 'omega3', default_unit: '%', default_range_low: 1.4, default_range_high: 5.1, optimal_range_low: 2.5, optimal_range_high: 5.0, description: 'Docosahexaenoic acid' },
  { code: 'OMEGA3_TOTAL', name: 'Omega-3 Total', category: 'fatty_acids', subcategory: 'omega3', default_unit: '%', default_range_low: 3, default_range_high: 10, optimal_range_low: 5, optimal_range_high: 10, description: 'Total omega-3 fatty acids' },
  { code: 'OMEGA6_TOTAL', name: 'Omega-6 Total', category: 'fatty_acids', subcategory: 'omega6', default_unit: '%', default_range_low: 25, default_range_high: 50, optimal_range_low: 30, optimal_range_high: 45, description: 'Total omega-6 fatty acids' },
  { code: 'AA_EPA_RATIO', name: 'AA/EPA Ratio', category: 'fatty_acids', subcategory: 'inflammatory', default_unit: 'ratio', default_range_low: 0, default_range_high: 15, optimal_range_low: 1.5, optimal_range_high: 5, description: 'Inflammatory balance ratio', athlete_considerations: 'Lower is better for athletes' },
  { code: 'OMEGA6_OMEGA3_RATIO', name: 'Omega-6/Omega-3 Ratio', category: 'fatty_acids', subcategory: 'inflammatory', default_unit: 'ratio', default_range_low: 1, default_range_high: 15, optimal_range_low: 2, optimal_range_high: 5, description: 'Inflammatory balance' },
  { code: 'ARACHIDONIC_ACID', name: 'Arachidonic Acid', category: 'fatty_acids', subcategory: 'omega6', default_unit: '%', default_range_low: 8.6, default_range_high: 15.6, optimal_range_low: 9, optimal_range_high: 14, description: 'Pro-inflammatory omega-6' },
  { code: 'LINOLEIC_ACID', name: 'Linoleic Acid', category: 'fatty_acids', subcategory: 'omega6', default_unit: '%', default_range_low: 18.6, default_range_high: 29.5, optimal_range_low: 20, optimal_range_high: 28, description: 'Essential omega-6' },

  // ==========================================
  // HEAVY METALS
  // ==========================================
  { code: 'MERCURY', name: 'Mercury (Blood)', category: 'heavy_metals', subcategory: 'toxic', default_unit: 'mcg/L', default_range_low: 0, default_range_high: 10, optimal_range_low: 0, optimal_range_high: 5, description: 'Blood mercury level', athlete_considerations: 'Fish consumption can elevate' },
  { code: 'LEAD', name: 'Lead (Blood)', category: 'heavy_metals', subcategory: 'toxic', default_unit: 'mcg/dL', default_range_low: 0, default_range_high: 3.5, optimal_range_low: 0, optimal_range_high: 2, description: 'Blood lead level' },
];

// ============================================
// SEED FUNCTIONS
// ============================================

async function seedUser() {
  console.log('👤 Seeding default user...');
  
  const { data, error } = await supabase
    .from('users')
    .upsert(defaultUser, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    console.error('  ❌ Failed to seed user:', error.message);
    return false;
  }

  console.log(`  ✅ User seeded: ${data.name} (${data.email})`);
  return true;
}

async function seedBiomarkerDefinitions() {
  console.log('\n🧬 Seeding biomarker definitions...');
  
  let inserted = 0;
  let updated = 0;
  let failed = 0;

  for (const biomarker of biomarkerDefinitions) {
    const { error } = await supabase
      .from('biomarker_definitions')
      .upsert(biomarker, { onConflict: 'code' });

    if (error) {
      console.error(`  ❌ Failed: ${biomarker.code} - ${error.message}`);
      failed++;
    } else {
      inserted++;
    }
  }

  console.log(`  ✅ Seeded ${inserted} biomarker definitions`);
  if (failed > 0) {
    console.log(`  ⚠️  ${failed} failed`);
  }
  
  return failed === 0;
}

async function verifySchema() {
  console.log('\n🔍 Verifying schema...');
  
  // Check biomarker count
  const { count } = await supabase
    .from('biomarker_definitions')
    .select('*', { count: 'exact', head: true });
  
  console.log(`  📊 Biomarker definitions: ${count}`);
  
  // Check user
  const { data: user } = await supabase
    .from('users')
    .select('name, email')
    .eq('id', defaultUser.id)
    .single();
  
  if (user) {
    console.log(`  👤 Default user: ${user.name}`);
  }
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log('🌱 LifeOS Database Seeder\n');
  console.log('='.repeat(50));

  await seedUser();
  await seedBiomarkerDefinitions();
  await verifySchema();

  console.log('\n' + '='.repeat(50));
  console.log('✨ Seeding complete!\n');
}

main().catch(console.error);

