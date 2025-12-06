-- ============================================
-- LifeOS Database Seed Data
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. SEED DEFAULT USER
-- ============================================
INSERT INTO users (id, email, name, timezone, preferences)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'dan@lifeos.local',
    'Dan',
    'America/Los_Angeles',
    '{
        "morningDigestTime": "07:00",
        "eveningDigestTime": "21:00",
        "workingHours": { "start": "09:00", "end": "18:00" },
        "defaultLLMProvider": "anthropic"
    }'::jsonb
) ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    preferences = EXCLUDED.preferences;

-- ============================================
-- 2. SEED BIOMARKER DEFINITIONS (119 total)
-- ============================================

-- Clear existing and insert fresh
DELETE FROM biomarker_definitions;

INSERT INTO biomarker_definitions (code, name, category, subcategory, default_unit, default_range_low, default_range_high, optimal_range_low, optimal_range_high, description, athlete_considerations) VALUES
-- LIPID PANEL
('TOTAL_CHOLESTEROL', 'Total Cholesterol', 'lipid_panel', 'cholesterol', 'mg/dL', 0, 200, 150, 180, 'Total amount of cholesterol in blood', 'Athletes may have higher HDL raising total'),
('HDL', 'HDL Cholesterol', 'lipid_panel', 'cholesterol', 'mg/dL', 40, 999, 60, 100, 'Good cholesterol - higher is better', 'Endurance athletes often have elevated HDL'),
('LDL', 'LDL Cholesterol', 'lipid_panel', 'cholesterol', 'mg/dL', 0, 100, 0, 70, 'Bad cholesterol - lower is better', NULL),
('VLDL', 'VLDL Cholesterol', 'lipid_panel', 'cholesterol', 'mg/dL', 2, 30, 5, 20, 'Very low density lipoprotein', NULL),
('TRIGLYCERIDES', 'Triglycerides', 'lipid_panel', 'cholesterol', 'mg/dL', 0, 150, 0, 100, 'Fat in the blood', 'Elevated after high-carb intake'),
('CHOL_HDL_RATIO', 'Cholesterol/HDL Ratio', 'lipid_panel', 'cholesterol', 'ratio', 0, 5, 0, 3.5, 'Risk ratio', NULL),
('LDL_HDL_RATIO', 'LDL/HDL Ratio', 'lipid_panel', 'cholesterol', 'ratio', 0, 3.5, 0, 2.5, 'Risk ratio', NULL),
('NON_HDL_CHOLESTEROL', 'Non-HDL Cholesterol', 'lipid_panel', 'cholesterol', 'mg/dL', 0, 130, 0, 100, 'Total cholesterol minus HDL', NULL),

-- METABOLIC PANEL
('GLUCOSE', 'Glucose (Fasting)', 'metabolic', 'glucose', 'mg/dL', 65, 99, 70, 85, 'Blood sugar level', 'Can be lower in trained athletes'),
('HBA1C', 'Hemoglobin A1c', 'metabolic', 'glucose', '%', 0, 5.7, 4.5, 5.3, '3-month average blood sugar', NULL),
('INSULIN', 'Insulin (Fasting)', 'metabolic', 'glucose', 'uIU/mL', 2, 25, 2, 8, 'Fasting insulin level', 'Lower is generally better'),
('C_PEPTIDE', 'C-Peptide', 'metabolic', 'glucose', 'ng/mL', 0.68, 2.16, 0.8, 2.0, 'Insulin production marker', NULL),
('INSULIN_RESISTANCE_SCORE', 'Insulin Resistance Score', 'metabolic', 'glucose', 'score', 0, 66, 0, 33, 'Calculated insulin resistance index', NULL),
('BUN', 'Blood Urea Nitrogen', 'metabolic', 'kidney', 'mg/dL', 6, 24, 10, 20, 'Kidney function marker', 'Can elevate with high protein intake'),
('CREATININE', 'Creatinine', 'metabolic', 'kidney', 'mg/dL', 0.76, 1.27, 0.8, 1.2, 'Kidney function marker', 'Higher in muscular individuals'),
('EGFR', 'eGFR', 'metabolic', 'kidney', 'mL/min/1.73m2', 90, 999, 90, 120, 'Estimated kidney filtration rate', 'May be falsely low in muscular athletes'),
('CYSTATIN_C', 'Cystatin C', 'metabolic', 'kidney', 'mg/L', 0.52, 1.31, 0.6, 1.0, 'Kidney function - more accurate than creatinine', 'Not affected by muscle mass'),
('BUN_CREAT_RATIO', 'BUN/Creatinine Ratio', 'metabolic', 'kidney', 'ratio', 9, 23, 10, 20, 'Kidney function indicator', NULL),
('SODIUM', 'Sodium', 'metabolic', 'electrolytes', 'mmol/L', 134, 144, 137, 142, 'Electrolyte balance', 'Watch for hyponatremia in endurance'),
('POTASSIUM', 'Potassium', 'metabolic', 'electrolytes', 'mmol/L', 3.5, 5.2, 4.0, 4.8, 'Electrolyte balance', 'Critical for muscle function'),
('CHLORIDE', 'Chloride', 'metabolic', 'electrolytes', 'mmol/L', 96, 106, 98, 104, 'Electrolyte balance', NULL),
('CO2', 'Carbon Dioxide', 'metabolic', 'electrolytes', 'mmol/L', 18, 29, 22, 28, 'Acid-base balance', NULL),
('CALCIUM', 'Calcium', 'metabolic', 'minerals', 'mg/dL', 8.7, 10.2, 9.0, 10.0, 'Bone and muscle function', 'Important for bone health'),
('MAGNESIUM', 'Magnesium (Serum)', 'metabolic', 'minerals', 'mg/dL', 1.6, 2.6, 2.0, 2.5, 'Muscle and nerve function', 'Often low in athletes'),
('MAGNESIUM_RBC', 'Magnesium (RBC)', 'metabolic', 'minerals', 'mg/dL', 4.0, 6.4, 5.0, 6.0, 'Intracellular magnesium', 'Better indicator of true status'),
('ZINC', 'Zinc', 'metabolic', 'minerals', 'mcg/dL', 60, 130, 80, 120, 'Immune function and testosterone', 'Lost in sweat'),
('PHOSPHORUS', 'Phosphorus', 'metabolic', 'minerals', 'mg/dL', 2.5, 4.5, 3.0, 4.0, 'Bone and energy metabolism', NULL),
('URIC_ACID', 'Uric Acid', 'metabolic', 'metabolic', 'mg/dL', 3.7, 8.6, 4, 6, 'Purine metabolism', 'Can elevate with intense training'),

-- LIVER PANEL
('ALT', 'ALT (SGPT)', 'liver', 'enzymes', 'U/L', 0, 44, 0, 30, 'Liver enzyme', 'Can elevate after intense exercise'),
('AST', 'AST (SGOT)', 'liver', 'enzymes', 'U/L', 0, 40, 0, 30, 'Liver/muscle enzyme', 'Often elevated in athletes'),
('ALP', 'Alkaline Phosphatase', 'liver', 'enzymes', 'U/L', 39, 117, 40, 100, 'Bone/liver enzyme', NULL),
('GGT', 'GGT', 'liver', 'enzymes', 'U/L', 0, 65, 0, 30, 'Liver enzyme', 'Sensitive to alcohol'),
('BILIRUBIN_TOTAL', 'Bilirubin (Total)', 'liver', 'bilirubin', 'mg/dL', 0, 1.2, 0.2, 0.9, 'Liver processing marker', NULL),
('BILIRUBIN_DIRECT', 'Bilirubin (Direct)', 'liver', 'bilirubin', 'mg/dL', 0, 0.4, 0, 0.3, 'Conjugated bilirubin', NULL),
('ALBUMIN', 'Albumin', 'liver', 'proteins', 'g/dL', 3.5, 5.5, 4.0, 5.0, 'Liver protein synthesis', NULL),
('TOTAL_PROTEIN', 'Total Protein', 'liver', 'proteins', 'g/dL', 6.0, 8.5, 6.5, 8.0, 'Total blood protein', NULL),
('GLOBULIN', 'Globulin', 'liver', 'proteins', 'g/dL', 1.5, 4.5, 2.0, 3.5, 'Immune proteins', NULL),
('AG_RATIO', 'A/G Ratio', 'liver', 'proteins', 'ratio', 1.1, 2.5, 1.3, 2.0, 'Albumin to globulin ratio', NULL),
('AMYLASE', 'Amylase', 'liver', 'digestive', 'U/L', 21, 101, 30, 90, 'Pancreatic enzyme', NULL),
('LIPASE', 'Lipase', 'liver', 'digestive', 'U/L', 7, 60, 10, 50, 'Pancreatic enzyme', NULL),

-- IRON PANEL
('IRON', 'Iron', 'iron', 'iron_status', 'mcg/dL', 38, 169, 80, 150, 'Serum iron level', 'Critical for oxygen transport'),
('FERRITIN', 'Ferritin', 'iron', 'iron_status', 'ng/mL', 30, 400, 50, 150, 'Iron storage', 'Athletes need higher levels (50+)'),
('TIBC', 'TIBC', 'iron', 'iron_status', 'mcg/dL', 250, 370, 260, 350, 'Total iron binding capacity', NULL),
('TRANSFERRIN_SAT', 'Transferrin Saturation', 'iron', 'iron_status', '%', 15, 55, 25, 45, 'Iron transport saturation', NULL),
('TRANSFERRIN', 'Transferrin', 'iron', 'iron_status', 'mg/dL', 200, 360, 220, 340, 'Iron transport protein', NULL),

-- CBC
('WBC', 'White Blood Cell Count', 'cbc', 'white_cells', 'K/uL', 3.4, 10.8, 4.5, 8.0, 'Immune cell count', 'Can drop with overtraining'),
('RBC', 'Red Blood Cell Count', 'cbc', 'red_cells', 'M/uL', 4.14, 5.80, 4.5, 5.5, 'Oxygen carrying cells', 'Endurance training increases RBC'),
('HEMOGLOBIN', 'Hemoglobin', 'cbc', 'red_cells', 'g/dL', 12.6, 17.7, 14, 16, 'Oxygen carrying protein', 'Critical for endurance'),
('HEMATOCRIT', 'Hematocrit', 'cbc', 'red_cells', '%', 37.5, 51.0, 42, 48, 'Red blood cell volume', 'Dehydration falsely elevates'),
('MCV', 'MCV', 'cbc', 'red_cell_indices', 'fL', 79, 97, 82, 94, 'Red cell size', NULL),
('MCH', 'MCH', 'cbc', 'red_cell_indices', 'pg', 26.6, 33.0, 28, 32, 'Hemoglobin per cell', NULL),
('MCHC', 'MCHC', 'cbc', 'red_cell_indices', 'g/dL', 31.5, 35.7, 32, 35, 'Hemoglobin concentration', NULL),
('RDW', 'RDW', 'cbc', 'red_cell_indices', '%', 11.7, 15.4, 12, 14, 'Red cell size variation', NULL),
('PLATELETS', 'Platelet Count', 'cbc', 'platelets', 'K/uL', 150, 379, 175, 325, 'Blood clotting cells', NULL),
('MPV', 'Mean Platelet Volume', 'cbc', 'platelets', 'fL', 7.4, 10.4, 8, 10, 'Platelet size', NULL),

-- CBC DIFFERENTIAL
('NEUTROPHILS_ABS', 'Absolute Neutrophils', 'cbc', 'differential', 'cells/uL', 1500, 7800, 2000, 6000, 'Primary immune defense cells', NULL),
('LYMPHOCYTES_ABS', 'Absolute Lymphocytes', 'cbc', 'differential', 'cells/uL', 850, 3900, 1000, 3500, 'Adaptive immune cells', NULL),
('MONOCYTES_ABS', 'Absolute Monocytes', 'cbc', 'differential', 'cells/uL', 200, 950, 200, 800, 'Phagocytic immune cells', NULL),
('EOSINOPHILS_ABS', 'Absolute Eosinophils', 'cbc', 'differential', 'cells/uL', 15, 500, 50, 400, 'Allergy/parasite response cells', NULL),
('BASOPHILS_ABS', 'Absolute Basophils', 'cbc', 'differential', 'cells/uL', 0, 200, 0, 150, 'Allergic response cells', NULL),
('NEUTROPHILS_PCT', 'Neutrophils %', 'cbc', 'differential', '%', 40, 70, 45, 65, 'Neutrophil percentage', NULL),
('LYMPHOCYTES_PCT', 'Lymphocytes %', 'cbc', 'differential', '%', 20, 50, 25, 45, 'Lymphocyte percentage', NULL),
('MONOCYTES_PCT', 'Monocytes %', 'cbc', 'differential', '%', 2, 10, 3, 8, 'Monocyte percentage', NULL),
('EOSINOPHILS_PCT', 'Eosinophils %', 'cbc', 'differential', '%', 0, 6, 0, 4, 'Eosinophil percentage', NULL),
('BASOPHILS_PCT', 'Basophils %', 'cbc', 'differential', '%', 0, 2, 0, 1, 'Basophil percentage', NULL),

-- THYROID
('TSH', 'TSH', 'thyroid', 'thyroid', 'mIU/L', 0.45, 4.5, 1.0, 2.5, 'Thyroid stimulating hormone', 'Overtraining can affect thyroid'),
('FREE_T4', 'Free T4', 'thyroid', 'thyroid', 'ng/dL', 0.82, 1.77, 1.0, 1.5, 'Active thyroid hormone', NULL),
('FREE_T3', 'Free T3', 'thyroid', 'thyroid', 'pg/mL', 2.0, 4.4, 2.5, 4.0, 'Most active thyroid hormone', 'Can decrease with caloric restriction'),
('REVERSE_T3', 'Reverse T3', 'thyroid', 'thyroid', 'ng/dL', 9.2, 24.1, 10, 20, 'Inactive T3', 'Elevated with overtraining/stress'),
('THYROGLOBULIN_AB', 'Thyroglobulin Antibodies', 'thyroid', 'autoimmune', 'IU/mL', 0, 1, 0, 1, 'Autoimmune thyroid marker', NULL),
('TPO_AB', 'TPO Antibodies', 'thyroid', 'autoimmune', 'IU/mL', 0, 9, 0, 5, 'Autoimmune thyroid marker', NULL),

-- HORMONES
('TESTOSTERONE_TOTAL', 'Total Testosterone', 'hormones', 'androgens', 'ng/dL', 264, 916, 500, 900, 'Primary male hormone', 'Can decrease with overtraining'),
('TESTOSTERONE_FREE', 'Free Testosterone', 'hormones', 'androgens', 'pg/mL', 6.8, 21.5, 15, 25, 'Bioavailable testosterone', NULL),
('SHBG', 'SHBG', 'hormones', 'binding', 'nmol/L', 16.5, 55.9, 20, 45, 'Sex hormone binding globulin', 'Affects free testosterone'),
('ESTRADIOL', 'Estradiol', 'hormones', 'estrogens', 'pg/mL', 7.6, 42.6, 15, 30, 'Estrogen', 'Balance with testosterone important'),
('DHEA_S', 'DHEA-S', 'hormones', 'adrenal', 'mcg/dL', 102, 416, 200, 400, 'Adrenal androgen precursor', 'Stress/overtraining can deplete'),
('CORTISOL', 'Cortisol (AM)', 'hormones', 'adrenal', 'mcg/dL', 6.2, 19.4, 10, 18, 'Stress hormone', 'Chronically elevated = overtraining'),
('IGF1', 'IGF-1', 'hormones', 'growth', 'ng/mL', 98, 282, 150, 250, 'Growth factor', 'Drops with caloric deficit'),
('PROLACTIN', 'Prolactin', 'hormones', 'pituitary', 'ng/mL', 4.0, 15.2, 5, 12, 'Pituitary hormone', NULL),
('FSH', 'FSH', 'hormones', 'pituitary', 'mIU/mL', 1.5, 12.4, 2, 8, 'Follicle stimulating hormone', NULL),
('LH', 'LH', 'hormones', 'pituitary', 'mIU/mL', 1.7, 8.6, 3, 7, 'Luteinizing hormone', NULL),
('LEPTIN', 'Leptin', 'hormones', 'metabolic', 'ng/mL', 0.5, 15, 1, 8, 'Satiety hormone', 'Low in lean individuals'),
('ADIPONECTIN', 'Adiponectin', 'hormones', 'metabolic', 'ug/mL', 5, 30, 10, 25, 'Anti-inflammatory adipokine', 'Higher is generally better'),

-- PROSTATE
('PSA_TOTAL', 'PSA Total', 'prostate', 'psa', 'ng/mL', 0, 4.0, 0, 2.0, 'Prostate specific antigen', NULL),
('PSA_FREE', 'PSA Free', 'prostate', 'psa', 'ng/mL', 0, 4, NULL, NULL, 'Free PSA fraction', NULL),
('PSA_FREE_PCT', 'PSA % Free', 'prostate', 'psa', '%', 25, 100, 25, 100, 'Percentage of free PSA', NULL),

-- INFLAMMATORY
('HSCRP', 'hs-CRP', 'inflammatory', 'acute_phase', 'mg/L', 0, 3.0, 0, 1.0, 'High-sensitivity C-reactive protein', 'Elevates post-workout for 24-48h'),
('ESR', 'ESR', 'inflammatory', 'acute_phase', 'mm/hr', 0, 22, 0, 10, 'Erythrocyte sedimentation rate', NULL),
('HOMOCYSTEINE', 'Homocysteine', 'inflammatory', 'cardiovascular', 'umol/L', 0, 15, 5, 10, 'Cardiovascular risk marker', NULL),
('FIBRINOGEN', 'Fibrinogen', 'inflammatory', 'coagulation', 'mg/dL', 193, 507, 200, 400, 'Clotting factor', NULL),
('RHEUMATOID_FACTOR', 'Rheumatoid Factor', 'inflammatory', 'autoimmune', 'IU/mL', 0, 14, 0, 10, 'Autoimmune marker', NULL),

-- VITAMINS
('VITAMIN_D', 'Vitamin D (25-OH)', 'vitamins', 'fat_soluble', 'ng/mL', 30, 100, 50, 80, '25-hydroxyvitamin D', 'Athletes should target 50+ ng/mL'),
('VITAMIN_B12', 'Vitamin B12', 'vitamins', 'b_vitamins', 'pg/mL', 232, 1245, 500, 1000, 'Cobalamin', 'Important for energy metabolism'),
('FOLATE', 'Folate', 'vitamins', 'b_vitamins', 'ng/mL', 2.5, 20, 10, 20, 'Folic acid', NULL),
('MMA', 'Methylmalonic Acid', 'vitamins', 'b_vitamins', 'nmol/L', 55, 335, 70, 250, 'Functional B12 marker', 'Elevated = B12 deficiency'),

-- CARDIAC/ADVANCED LIPIDS
('LP_A', 'Lipoprotein(a)', 'cardiac', 'lipoproteins', 'nmol/L', 0, 75, 0, 30, 'Genetic cardiovascular risk', 'Largely genetic'),
('APOB', 'Apolipoprotein B', 'cardiac', 'lipoproteins', 'mg/dL', 60, 117, 60, 90, 'Atherogenic particle count', 'Better predictor than LDL'),
('APOA1', 'Apolipoprotein A1', 'cardiac', 'lipoproteins', 'mg/dL', 100, 200, 140, 200, 'HDL protein - cardioprotective', NULL),
('LDL_P', 'LDL Particle Number', 'cardiac', 'advanced_lipid', 'nmol/L', 0, 1000, 0, 700, 'LDL particle count', 'More predictive than LDL-C'),
('SMALL_LDL_P', 'Small LDL-P', 'cardiac', 'advanced_lipid', 'nmol/L', 0, 600, 0, 300, 'Small dense LDL particles', NULL),
('LDL_MEDIUM', 'LDL Medium', 'cardiac', 'advanced_lipid', 'nmol/L', 0, 215, 0, 150, 'Medium LDL particles', NULL),
('HDL_LARGE', 'HDL Large', 'cardiac', 'advanced_lipid', 'nmol/L', 6729, 99999, 7000, 99999, 'Large HDL particles', NULL),
('LDL_PEAK_SIZE', 'LDL Peak Size', 'cardiac', 'advanced_lipid', 'Angstrom', 222.9, 300, 225, 300, 'LDL particle size', NULL),
('OXLDL', 'Oxidized LDL', 'cardiac', 'advanced_lipid', 'U/L', 0, 60, 0, 50, 'Oxidized LDL - atherogenic', NULL),
('MYELOPEROXIDASE', 'Myeloperoxidase', 'cardiac', 'vascular', 'pmol/L', 0, 470, 0, 350, 'Vascular inflammation marker', NULL),
('LP_PLA2', 'Lp-PLA2 Activity', 'cardiac', 'vascular', 'nmol/min/mL', 0, 123, 0, 100, 'Arterial inflammation marker', NULL),
('TMAO', 'TMAO', 'cardiac', 'metabolic', 'uM', 0, 6.2, 0, 5, 'Gut/CV risk marker', NULL),

-- FATTY ACIDS
('OMEGA3_INDEX', 'Omega-3 Index', 'fatty_acids', 'essential', '%', 4, 999, 8, 12, 'EPA+DHA in red blood cells', 'Critical for inflammation control'),
('EPA', 'EPA', 'fatty_acids', 'omega3', '%', 0.2, 2.3, 0.8, 2.0, 'Eicosapentaenoic acid', NULL),
('DPA', 'DPA', 'fatty_acids', 'omega3', '%', 0.8, 1.8, 1.0, 1.6, 'Docosapentaenoic acid', NULL),
('DHA', 'DHA', 'fatty_acids', 'omega3', '%', 1.4, 5.1, 2.5, 5.0, 'Docosahexaenoic acid', NULL),
('OMEGA3_TOTAL', 'Omega-3 Total', 'fatty_acids', 'omega3', '%', 3, 10, 5, 10, 'Total omega-3 fatty acids', NULL),
('OMEGA6_TOTAL', 'Omega-6 Total', 'fatty_acids', 'omega6', '%', 25, 50, 30, 45, 'Total omega-6 fatty acids', NULL),
('AA_EPA_RATIO', 'AA/EPA Ratio', 'fatty_acids', 'inflammatory', 'ratio', 0, 15, 1.5, 5, 'Inflammatory balance ratio', 'Lower is better for athletes'),
('OMEGA6_OMEGA3_RATIO', 'Omega-6/Omega-3 Ratio', 'fatty_acids', 'inflammatory', 'ratio', 1, 15, 2, 5, 'Inflammatory balance', NULL),
('ARACHIDONIC_ACID', 'Arachidonic Acid', 'fatty_acids', 'omega6', '%', 8.6, 15.6, 9, 14, 'Pro-inflammatory omega-6', NULL),
('LINOLEIC_ACID', 'Linoleic Acid', 'fatty_acids', 'omega6', '%', 18.6, 29.5, 20, 28, 'Essential omega-6', NULL),

-- HEAVY METALS
('MERCURY', 'Mercury (Blood)', 'heavy_metals', 'toxic', 'mcg/L', 0, 10, 0, 5, 'Blood mercury level', 'Fish consumption can elevate'),
('LEAD', 'Lead (Blood)', 'heavy_metals', 'toxic', 'mcg/dL', 0, 3.5, 0, 2, 'Blood lead level', NULL);

-- ============================================
-- VERIFY
-- ============================================
SELECT 'Users:' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'Biomarker Definitions:', COUNT(*) FROM biomarker_definitions;

