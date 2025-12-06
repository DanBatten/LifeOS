-- ============================================
-- LifeOS Biomarker/Blood Panel System
-- Version: 3.0.0
--
-- Design Philosophy:
-- 1. Flexible schema for any lab panel type
-- 2. Store individual biomarker results with reference ranges
-- 3. Track trends over time with baseline calculations
-- 4. Support various panel sources (Quest, Labcorp, etc.)
-- 5. Enable AI analysis of patterns and health correlations
-- ============================================

-- ============================================
-- LAB_PANELS TABLE
-- Master record for each blood draw/lab visit
-- ============================================
CREATE TABLE IF NOT EXISTS lab_panels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Panel Identity
    panel_date DATE NOT NULL,
    panel_name VARCHAR(255), -- "Comprehensive Metabolic Panel", "Athlete Panel", etc.
    lab_provider VARCHAR(100), -- "Quest Diagnostics", "Labcorp", "InsideTracker", etc.
    ordering_physician VARCHAR(255),

    -- Panel Type/Category
    panel_type VARCHAR(50) DEFAULT 'comprehensive', -- basic, comprehensive, athletic, hormonal, specialty

    -- Fasting Status
    fasting_hours INTEGER, -- Hours fasted before draw
    fasting BOOLEAN DEFAULT TRUE,

    -- Context at time of draw
    notes TEXT,
    training_phase VARCHAR(100), -- What training phase were you in
    recent_training_load VARCHAR(50), -- high, moderate, low, rest

    -- Source document
    source_document_url TEXT, -- Link to PDF or image
    source_document_type VARCHAR(20), -- 'pdf', 'image', 'manual'

    -- AI Analysis
    ai_summary TEXT, -- AI-generated overall summary
    ai_concerns JSONB, -- Flagged issues
    ai_recommendations JSONB,

    -- Metadata
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lab_panels_user ON lab_panels(user_id);
CREATE INDEX IF NOT EXISTS idx_lab_panels_date ON lab_panels(panel_date DESC);
CREATE INDEX IF NOT EXISTS idx_lab_panels_type ON lab_panels(panel_type);

-- ============================================
-- BIOMARKER_DEFINITIONS TABLE
-- Reference data for all possible biomarkers
-- ============================================
CREATE TABLE IF NOT EXISTS biomarker_definitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Biomarker Identity
    code VARCHAR(50) UNIQUE NOT NULL, -- standardized code: "HDL", "TSH", "FERRITIN"
    name VARCHAR(255) NOT NULL, -- "HDL Cholesterol", "Thyroid Stimulating Hormone"
    category VARCHAR(100) NOT NULL, -- lipid_panel, metabolic, hormonal, inflammatory, etc.
    subcategory VARCHAR(100), -- specific grouping

    -- Default Reference Ranges (can be overridden per result)
    default_unit VARCHAR(50), -- "mg/dL", "ng/mL", "IU/L"
    default_range_low DECIMAL(12,4),
    default_range_high DECIMAL(12,4),
    optimal_range_low DECIMAL(12,4), -- Athletic/optimal ranges
    optimal_range_high DECIMAL(12,4),

    -- Interpretation guidance
    description TEXT, -- What this biomarker measures
    high_meaning TEXT, -- What elevated levels might indicate
    low_meaning TEXT, -- What low levels might indicate
    athlete_considerations TEXT, -- Special notes for athletes

    -- Metadata
    aliases TEXT[], -- Alternative names
    loinc_code VARCHAR(20), -- Standard medical code
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_biomarker_defs_code ON biomarker_definitions(code);
CREATE INDEX IF NOT EXISTS idx_biomarker_defs_category ON biomarker_definitions(category);

-- ============================================
-- BIOMARKER_RESULTS TABLE
-- Individual biomarker values from lab panels
-- ============================================
CREATE TABLE IF NOT EXISTS biomarker_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    panel_id UUID NOT NULL REFERENCES lab_panels(id) ON DELETE CASCADE,
    biomarker_id UUID REFERENCES biomarker_definitions(id),

    -- Result Identity (if biomarker_id not in definitions table)
    biomarker_code VARCHAR(50), -- Fallback code if not in definitions
    biomarker_name VARCHAR(255) NOT NULL, -- Display name

    -- The Result
    value DECIMAL(12,4) NOT NULL,
    unit VARCHAR(50) NOT NULL,
    value_text VARCHAR(100), -- For non-numeric results like "Reactive", "Non-reactive"

    -- Reference Range (as reported by lab)
    reference_low DECIMAL(12,4),
    reference_high DECIMAL(12,4),

    -- Flags
    flag VARCHAR(20), -- 'normal', 'low', 'high', 'critical_low', 'critical_high'
    flag_text VARCHAR(100), -- Lab's flag text

    -- Optimal Range (for athletic performance)
    optimal_low DECIMAL(12,4),
    optimal_high DECIMAL(12,4),
    in_optimal_range BOOLEAN,

    -- Trend vs previous
    previous_value DECIMAL(12,4),
    change_percent DECIMAL(5,2),
    trend VARCHAR(20), -- 'increasing', 'decreasing', 'stable'

    -- AI Interpretation
    ai_interpretation TEXT,
    ai_concern_level VARCHAR(20), -- 'none', 'monitor', 'attention', 'concern'

    -- Metadata
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_results_user ON biomarker_results(user_id);
CREATE INDEX IF NOT EXISTS idx_results_panel ON biomarker_results(panel_id);
CREATE INDEX IF NOT EXISTS idx_results_biomarker ON biomarker_results(biomarker_id);
CREATE INDEX IF NOT EXISTS idx_results_code ON biomarker_results(biomarker_code);
CREATE INDEX IF NOT EXISTS idx_results_flag ON biomarker_results(flag);

-- ============================================
-- BIOMARKER_BASELINES TABLE
-- Track rolling baselines per biomarker per user
-- ============================================
CREATE TABLE IF NOT EXISTS biomarker_baselines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    biomarker_code VARCHAR(50) NOT NULL,

    -- Baseline Statistics
    baseline_date DATE NOT NULL,
    sample_count INTEGER, -- How many data points used
    mean_value DECIMAL(12,4),
    median_value DECIMAL(12,4),
    min_value DECIMAL(12,4),
    max_value DECIMAL(12,4),
    stddev_value DECIMAL(12,4),

    -- Personal optimal range (learned over time)
    personal_optimal_low DECIMAL(12,4),
    personal_optimal_high DECIMAL(12,4),

    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, biomarker_code, baseline_date)
);

CREATE INDEX IF NOT EXISTS idx_bio_baselines_user ON biomarker_baselines(user_id);
CREATE INDEX IF NOT EXISTS idx_bio_baselines_code ON biomarker_baselines(biomarker_code);

-- ============================================
-- SEED COMMON BIOMARKER DEFINITIONS
-- ============================================

-- Lipid Panel
INSERT INTO biomarker_definitions (code, name, category, subcategory, default_unit, default_range_low, default_range_high, optimal_range_low, optimal_range_high, description, athlete_considerations) VALUES
('TOTAL_CHOLESTEROL', 'Total Cholesterol', 'lipid_panel', 'cholesterol', 'mg/dL', 0, 200, 150, 180, 'Total amount of cholesterol in blood', 'Athletes may have higher HDL raising total'),
('HDL', 'HDL Cholesterol', 'lipid_panel', 'cholesterol', 'mg/dL', 40, 999, 60, 100, 'Good cholesterol - higher is better', 'Endurance athletes often have elevated HDL'),
('LDL', 'LDL Cholesterol', 'lipid_panel', 'cholesterol', 'mg/dL', 0, 100, 0, 70, 'Bad cholesterol - lower is better', NULL),
('VLDL', 'VLDL Cholesterol', 'lipid_panel', 'cholesterol', 'mg/dL', 2, 30, 5, 20, 'Very low density lipoprotein', NULL),
('TRIGLYCERIDES', 'Triglycerides', 'lipid_panel', 'cholesterol', 'mg/dL', 0, 150, 0, 100, 'Fat in the blood', 'Elevated after high-carb intake'),
('CHOL_HDL_RATIO', 'Cholesterol/HDL Ratio', 'lipid_panel', 'cholesterol', 'ratio', 0, 5, 0, 3.5, 'Risk ratio', NULL),
('LDL_HDL_RATIO', 'LDL/HDL Ratio', 'lipid_panel', 'cholesterol', 'ratio', 0, 3.5, 0, 2.5, 'Risk ratio', NULL)
ON CONFLICT (code) DO NOTHING;

-- Metabolic Panel
INSERT INTO biomarker_definitions (code, name, category, subcategory, default_unit, default_range_low, default_range_high, optimal_range_low, optimal_range_high, description, athlete_considerations) VALUES
('GLUCOSE', 'Glucose (Fasting)', 'metabolic', 'glucose', 'mg/dL', 65, 99, 70, 85, 'Blood sugar level', 'Can be lower in trained athletes'),
('HBA1C', 'Hemoglobin A1c', 'metabolic', 'glucose', '%', 0, 5.7, 4.5, 5.3, '3-month average blood sugar', NULL),
('BUN', 'Blood Urea Nitrogen', 'metabolic', 'kidney', 'mg/dL', 6, 24, 10, 20, 'Kidney function marker', 'Can elevate with high protein intake'),
('CREATININE', 'Creatinine', 'metabolic', 'kidney', 'mg/dL', 0.76, 1.27, 0.8, 1.2, 'Kidney function marker', 'Higher in muscular individuals'),
('EGFR', 'eGFR', 'metabolic', 'kidney', 'mL/min/1.73m2', 90, 999, 90, 120, 'Estimated kidney filtration rate', 'May be falsely low in muscular athletes'),
('BUN_CREAT_RATIO', 'BUN/Creatinine Ratio', 'metabolic', 'kidney', 'ratio', 9, 23, 10, 20, 'Kidney function indicator', NULL),
('SODIUM', 'Sodium', 'metabolic', 'electrolytes', 'mEq/L', 134, 144, 137, 142, 'Electrolyte balance', 'Watch for hyponatremia in endurance'),
('POTASSIUM', 'Potassium', 'metabolic', 'electrolytes', 'mEq/L', 3.5, 5.2, 4.0, 4.8, 'Electrolyte balance', 'Critical for muscle function'),
('CHLORIDE', 'Chloride', 'metabolic', 'electrolytes', 'mEq/L', 96, 106, 98, 104, 'Electrolyte balance', NULL),
('CO2', 'Carbon Dioxide', 'metabolic', 'electrolytes', 'mEq/L', 18, 29, 22, 28, 'Acid-base balance', NULL),
('CALCIUM', 'Calcium', 'metabolic', 'minerals', 'mg/dL', 8.7, 10.2, 9.0, 10.0, 'Bone and muscle function', 'Important for bone health'),
('MAGNESIUM', 'Magnesium', 'metabolic', 'minerals', 'mg/dL', 1.6, 2.6, 2.0, 2.5, 'Muscle and nerve function', 'Often low in athletes'),
('PHOSPHORUS', 'Phosphorus', 'metabolic', 'minerals', 'mg/dL', 2.5, 4.5, 3.0, 4.0, 'Bone and energy metabolism', NULL)
ON CONFLICT (code) DO NOTHING;

-- Liver Panel
INSERT INTO biomarker_definitions (code, name, category, subcategory, default_unit, default_range_low, default_range_high, optimal_range_low, optimal_range_high, description, athlete_considerations) VALUES
('ALT', 'ALT (SGPT)', 'liver', 'enzymes', 'IU/L', 0, 44, 0, 30, 'Liver enzyme', 'Can elevate after intense exercise'),
('AST', 'AST (SGOT)', 'liver', 'enzymes', 'IU/L', 0, 40, 0, 30, 'Liver/muscle enzyme', 'Often elevated in athletes - muscle breakdown'),
('ALP', 'Alkaline Phosphatase', 'liver', 'enzymes', 'IU/L', 39, 117, 40, 100, 'Bone/liver enzyme', NULL),
('GGT', 'GGT', 'liver', 'enzymes', 'IU/L', 0, 65, 0, 30, 'Liver enzyme', 'Sensitive to alcohol'),
('BILIRUBIN_TOTAL', 'Bilirubin (Total)', 'liver', 'bilirubin', 'mg/dL', 0, 1.2, 0.2, 0.9, 'Liver processing marker', NULL),
('BILIRUBIN_DIRECT', 'Bilirubin (Direct)', 'liver', 'bilirubin', 'mg/dL', 0, 0.4, 0, 0.3, 'Conjugated bilirubin', NULL),
('ALBUMIN', 'Albumin', 'liver', 'proteins', 'g/dL', 3.5, 5.5, 4.0, 5.0, 'Liver protein synthesis', NULL),
('TOTAL_PROTEIN', 'Total Protein', 'liver', 'proteins', 'g/dL', 6.0, 8.5, 6.5, 8.0, 'Total blood protein', NULL),
('GLOBULIN', 'Globulin', 'liver', 'proteins', 'g/dL', 1.5, 4.5, 2.0, 3.5, 'Immune proteins', NULL),
('AG_RATIO', 'A/G Ratio', 'liver', 'proteins', 'ratio', 1.1, 2.5, 1.3, 2.0, 'Albumin to globulin ratio', NULL)
ON CONFLICT (code) DO NOTHING;

-- Iron/Anemia Panel
INSERT INTO biomarker_definitions (code, name, category, subcategory, default_unit, default_range_low, default_range_high, optimal_range_low, optimal_range_high, description, athlete_considerations) VALUES
('IRON', 'Iron', 'iron', 'iron_status', 'ug/dL', 38, 169, 80, 150, 'Serum iron level', 'Critical for oxygen transport'),
('FERRITIN', 'Ferritin', 'iron', 'iron_status', 'ng/mL', 30, 400, 50, 150, 'Iron storage', 'Athletes need higher levels (50+)'),
('TIBC', 'TIBC', 'iron', 'iron_status', 'ug/dL', 250, 370, 260, 350, 'Total iron binding capacity', NULL),
('TRANSFERRIN_SAT', 'Transferrin Saturation', 'iron', 'iron_status', '%', 15, 55, 25, 45, 'Iron transport saturation', NULL),
('TRANSFERRIN', 'Transferrin', 'iron', 'iron_status', 'mg/dL', 200, 360, 220, 340, 'Iron transport protein', NULL)
ON CONFLICT (code) DO NOTHING;

-- Complete Blood Count
INSERT INTO biomarker_definitions (code, name, category, subcategory, default_unit, default_range_low, default_range_high, optimal_range_low, optimal_range_high, description, athlete_considerations) VALUES
('WBC', 'White Blood Cell Count', 'cbc', 'white_cells', 'x10E3/uL', 3.4, 10.8, 4.5, 8.0, 'Immune cell count', 'Can drop with overtraining'),
('RBC', 'Red Blood Cell Count', 'cbc', 'red_cells', 'x10E6/uL', 4.14, 5.80, 4.5, 5.5, 'Oxygen carrying cells', 'Endurance training increases RBC'),
('HEMOGLOBIN', 'Hemoglobin', 'cbc', 'red_cells', 'g/dL', 12.6, 17.7, 14, 16, 'Oxygen carrying protein', 'Critical for endurance performance'),
('HEMATOCRIT', 'Hematocrit', 'cbc', 'red_cells', '%', 37.5, 51.0, 42, 48, 'Red blood cell volume', 'Dehydration falsely elevates'),
('MCV', 'MCV', 'cbc', 'red_cell_indices', 'fL', 79, 97, 82, 94, 'Red cell size', NULL),
('MCH', 'MCH', 'cbc', 'red_cell_indices', 'pg', 26.6, 33.0, 28, 32, 'Hemoglobin per cell', NULL),
('MCHC', 'MCHC', 'cbc', 'red_cell_indices', 'g/dL', 31.5, 35.7, 32, 35, 'Hemoglobin concentration', NULL),
('RDW', 'RDW', 'cbc', 'red_cell_indices', '%', 11.7, 15.4, 12, 14, 'Red cell size variation', NULL),
('PLATELETS', 'Platelet Count', 'cbc', 'platelets', 'x10E3/uL', 150, 379, 175, 325, 'Blood clotting cells', NULL),
('MPV', 'Mean Platelet Volume', 'cbc', 'platelets', 'fL', 7.4, 10.4, 8, 10, 'Platelet size', NULL)
ON CONFLICT (code) DO NOTHING;

-- Thyroid Panel
INSERT INTO biomarker_definitions (code, name, category, subcategory, default_unit, default_range_low, default_range_high, optimal_range_low, optimal_range_high, description, athlete_considerations) VALUES
('TSH', 'TSH', 'thyroid', 'thyroid', 'uIU/mL', 0.45, 4.5, 1.0, 2.5, 'Thyroid stimulating hormone', 'Overtraining can affect thyroid'),
('FREE_T4', 'Free T4', 'thyroid', 'thyroid', 'ng/dL', 0.82, 1.77, 1.0, 1.5, 'Active thyroid hormone', NULL),
('FREE_T3', 'Free T3', 'thyroid', 'thyroid', 'pg/mL', 2.0, 4.4, 2.5, 4.0, 'Most active thyroid hormone', 'Can decrease with caloric restriction'),
('REVERSE_T3', 'Reverse T3', 'thyroid', 'thyroid', 'ng/dL', 9.2, 24.1, 10, 20, 'Inactive T3', 'Elevated with overtraining/stress')
ON CONFLICT (code) DO NOTHING;

-- Hormones (Male)
INSERT INTO biomarker_definitions (code, name, category, subcategory, default_unit, default_range_low, default_range_high, optimal_range_low, optimal_range_high, description, athlete_considerations) VALUES
('TESTOSTERONE_TOTAL', 'Total Testosterone', 'hormones', 'androgens', 'ng/dL', 264, 916, 500, 900, 'Primary male hormone', 'Can decrease with overtraining'),
('TESTOSTERONE_FREE', 'Free Testosterone', 'hormones', 'androgens', 'pg/mL', 6.8, 21.5, 15, 25, 'Bioavailable testosterone', NULL),
('SHBG', 'SHBG', 'hormones', 'binding', 'nmol/L', 16.5, 55.9, 20, 45, 'Sex hormone binding globulin', 'Affects free testosterone'),
('ESTRADIOL', 'Estradiol', 'hormones', 'estrogens', 'pg/mL', 7.6, 42.6, 15, 30, 'Estrogen', 'Balance with testosterone important'),
('DHEA_S', 'DHEA-S', 'hormones', 'adrenal', 'ug/dL', 102, 416, 200, 400, 'Adrenal androgen precursor', 'Stress/overtraining can deplete'),
('CORTISOL', 'Cortisol (AM)', 'hormones', 'adrenal', 'ug/dL', 6.2, 19.4, 10, 18, 'Stress hormone', 'Chronically elevated = overtraining'),
('IGF1', 'IGF-1', 'hormones', 'growth', 'ng/mL', 98, 282, 150, 250, 'Growth factor', 'Drops with caloric deficit'),
('PROLACTIN', 'Prolactin', 'hormones', 'pituitary', 'ng/mL', 4.0, 15.2, 5, 12, 'Pituitary hormone', NULL),
('FSH', 'FSH', 'hormones', 'pituitary', 'mIU/mL', 1.5, 12.4, 2, 8, 'Follicle stimulating hormone', NULL),
('LH', 'LH', 'hormones', 'pituitary', 'mIU/mL', 1.7, 8.6, 3, 7, 'Luteinizing hormone', NULL)
ON CONFLICT (code) DO NOTHING;

-- Inflammatory Markers
INSERT INTO biomarker_definitions (code, name, category, subcategory, default_unit, default_range_low, default_range_high, optimal_range_low, optimal_range_high, description, athlete_considerations) VALUES
('HSCRP', 'hs-CRP', 'inflammatory', 'acute_phase', 'mg/L', 0, 3.0, 0, 1.0, 'High-sensitivity C-reactive protein', 'Elevates post-workout for 24-48h'),
('ESR', 'ESR', 'inflammatory', 'acute_phase', 'mm/hr', 0, 22, 0, 10, 'Erythrocyte sedimentation rate', 'Non-specific inflammation marker'),
('HOMOCYSTEINE', 'Homocysteine', 'inflammatory', 'cardiovascular', 'umol/L', 0, 15, 5, 10, 'Cardiovascular risk marker', NULL),
('URIC_ACID', 'Uric Acid', 'inflammatory', 'metabolic', 'mg/dL', 3.7, 8.6, 4, 6, 'Purine metabolism', 'Can elevate with intense training'),
('FIBRINOGEN', 'Fibrinogen', 'inflammatory', 'coagulation', 'mg/dL', 193, 507, 200, 400, 'Clotting factor', NULL)
ON CONFLICT (code) DO NOTHING;

-- Vitamins
INSERT INTO biomarker_definitions (code, name, category, subcategory, default_unit, default_range_low, default_range_high, optimal_range_low, optimal_range_high, description, athlete_considerations) VALUES
('VITAMIN_D', 'Vitamin D (25-OH)', 'vitamins', 'fat_soluble', 'ng/mL', 30, 100, 50, 80, '25-hydroxyvitamin D', 'Athletes should target 50+ ng/mL'),
('VITAMIN_B12', 'Vitamin B12', 'vitamins', 'b_vitamins', 'pg/mL', 232, 1245, 500, 1000, 'Cobalamin', 'Important for energy metabolism'),
('FOLATE', 'Folate', 'vitamins', 'b_vitamins', 'ng/mL', 2.5, 20, 10, 20, 'Folic acid', NULL),
('VITAMIN_A', 'Vitamin A', 'vitamins', 'fat_soluble', 'ug/dL', 38, 98, 50, 80, 'Retinol', NULL),
('VITAMIN_E', 'Vitamin E', 'vitamins', 'fat_soluble', 'mg/L', 5.5, 17, 8, 15, 'Tocopherol', 'Antioxidant important for recovery')
ON CONFLICT (code) DO NOTHING;

-- Cardiac Markers
INSERT INTO biomarker_definitions (code, name, category, subcategory, default_unit, default_range_low, default_range_high, optimal_range_low, optimal_range_high, description, athlete_considerations) VALUES
('LP_A', 'Lipoprotein(a)', 'cardiac', 'lipoproteins', 'nmol/L', 0, 75, 0, 30, 'Genetic cardiovascular risk', 'Largely genetic, hard to modify'),
('APOB', 'Apolipoprotein B', 'cardiac', 'lipoproteins', 'mg/dL', 60, 117, 60, 90, 'Atherogenic particle count', 'Better predictor than LDL'),
('NT_PROBNP', 'NT-proBNP', 'cardiac', 'heart_function', 'pg/mL', 0, 125, 0, 50, 'Heart strain marker', 'Can elevate post-endurance exercise'),
('LDL_P', 'LDL Particle Number', 'cardiac', 'advanced_lipid', 'nmol/L', 0, 1000, 0, 700, 'LDL particle count', 'More predictive than LDL-C'),
('SMALL_LDL_P', 'Small LDL-P', 'cardiac', 'advanced_lipid', 'nmol/L', 0, 600, 0, 300, 'Small dense LDL particles', 'Atherogenic particles')
ON CONFLICT (code) DO NOTHING;

-- Omega/Fatty Acids
INSERT INTO biomarker_definitions (code, name, category, subcategory, default_unit, default_range_low, default_range_high, optimal_range_low, optimal_range_high, description, athlete_considerations) VALUES
('OMEGA3_INDEX', 'Omega-3 Index', 'fatty_acids', 'essential', '%', 4, 999, 8, 12, 'EPA+DHA in red blood cells', 'Critical for inflammation control'),
('AA_EPA_RATIO', 'AA/EPA Ratio', 'fatty_acids', 'inflammatory', 'ratio', 0, 15, 1.5, 5, 'Inflammatory balance ratio', 'Lower is better for athletes')
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- TRIGGERS
-- ============================================
CREATE TRIGGER update_lab_panels_updated_at BEFORE UPDATE ON lab_panels
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE lab_panels ENABLE ROW LEVEL SECURITY;
ALTER TABLE biomarker_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE biomarker_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE biomarker_baselines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for now" ON lab_panels FOR ALL USING (true);
CREATE POLICY "Allow all for now" ON biomarker_definitions FOR ALL USING (true);
CREATE POLICY "Allow all for now" ON biomarker_results FOR ALL USING (true);
CREATE POLICY "Allow all for now" ON biomarker_baselines FOR ALL USING (true);

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE lab_panels IS 'Master record for each blood draw/lab panel';
COMMENT ON TABLE biomarker_definitions IS 'Reference data for all biomarker types with ranges and descriptions';
COMMENT ON TABLE biomarker_results IS 'Individual biomarker values from lab panels';
COMMENT ON TABLE biomarker_baselines IS 'Rolling baseline calculations per biomarker per user';

COMMENT ON COLUMN biomarker_definitions.optimal_range_low IS 'Optimal/athletic range, often tighter than standard lab reference';
COMMENT ON COLUMN biomarker_results.ai_concern_level IS 'AI-determined concern: none, monitor, attention, concern';
COMMENT ON COLUMN biomarker_results.in_optimal_range IS 'Whether value falls in athletic optimal range';
