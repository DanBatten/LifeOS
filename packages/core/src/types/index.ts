// ===========================================
// User Types
// ===========================================
export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  timezone: string;
  preferences: UserPreferences;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPreferences {
  morningDigestTime: string;
  eveningDigestTime: string;
  workingHours: { start: string; end: string };
  defaultLLMProvider: LLMProviderType;
  notifications?: {
    email?: boolean;
    push?: boolean;
  };
}

// ===========================================
// People Types
// ===========================================
export interface Person {
  id: string;
  userId: string;
  name: string;
  relationship?: string;
  email?: string;
  phone?: string;
  notes?: string;
  tags: string[];
  metadata: Record<string, unknown>;
  lastContactAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ===========================================
// Event Types
// ===========================================
export type EventType =
  | 'meeting'
  | 'focus_block'
  | 'workout'
  | 'meal'
  | 'sleep'
  | 'travel'
  | 'personal'
  | 'break'
  | 'other';

export type EventSource = 'google_calendar' | 'manual' | 'agent_suggested';

export interface CalendarEvent {
  id: string;
  userId: string;
  googleEventId?: string;
  title: string;
  description?: string;
  eventType: EventType;
  source: EventSource;
  startTime: Date;
  endTime: Date;
  allDay: boolean;
  timezone?: string;
  location?: string;
  videoLink?: string;
  participantIds: string[];
  energyCost: number;
  isFlexible: boolean;
  tags: string[];
  metadata: Record<string, unknown>;
  syncedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ===========================================
// Task Types
// ===========================================
export type TaskStatus =
  | 'inbox'
  | 'todo'
  | 'in_progress'
  | 'blocked'
  | 'done'
  | 'archived';

export type TaskPriority = 'p1_critical' | 'p2_high' | 'p3_medium' | 'p4_low';

export type TaskSource =
  | 'manual'
  | 'agent_created'
  | 'calendar_derived'
  | 'notion_sync'
  | 'slack';

export interface Task {
  id: string;
  userId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  source: TaskSource;
  dueDate?: Date;
  dueTime?: string;
  estimatedMinutes?: number;
  actualMinutes?: number;
  energyRequired: number;
  contextTags: string[];
  project?: string;
  parentTaskId?: string;
  relatedEventId?: string;
  assignedToPeopleIds: string[];
  completedAt?: Date;
  blockedReason?: string;
  notionPageId?: string;
  externalUrl?: string;
  tags: string[];
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// ===========================================
// Health Types
// ===========================================
export interface HealthSnapshot {
  id: string;
  userId: string;
  snapshotDate: Date;
  snapshotTime?: string;
  sleepHours?: number;
  sleepQuality?: number;
  energyLevel?: number;
  stressLevel?: number;
  moodScore?: number;
  sorenessLevel?: number;
  sorenessAreas: string[];
  illnessSymptoms: string[];
  hrv?: number;
  restingHr?: number;
  hydrationGlasses?: number;
  mealsLogged?: number;
  alcoholUnits?: number;
  caffeineMg?: number;
  notes?: string;
  // Garmin activity data
  activeCalories?: number;
  totalCalories?: number;
  steps?: number;
  stepsGoal?: number;
  moderateIntensityMinutes?: number;
  vigorousIntensityMinutes?: number;
  avgSpo2?: number;
  minSpo2?: number;
  floorsAscended?: number;
  source: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// ===========================================
// Training Plan Types
// ===========================================
export type TrainingPlanStatus = 'draft' | 'active' | 'completed' | 'abandoned';
export type CoachingStyle = 'analytical' | 'motivational' | 'balanced';
export type AdaptationAggressiveness = 'conservative' | 'moderate' | 'aggressive';

export interface TrainingPlan {
  id: string;
  userId: string;
  name: string;
  description?: string;
  sport: string;
  goalEvent?: string;
  goalTimeSeconds?: number;
  goalPacePerMileSeconds?: number;
  startDate: Date;
  endDate: Date;
  totalWeeks: number;
  status: TrainingPlanStatus;
  currentWeek: number;
  config: Record<string, unknown>;
  coachingStyle: CoachingStyle;
  adaptationAggressiveness: AdaptationAggressiveness;
  notionPageId?: string;
  externalUrl?: string;
  tags: string[];
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export type PhaseType = 'base' | 'build' | 'peak' | 'taper' | 'recovery' | 'transition';

export interface TrainingPhase {
  id: string;
  planId: string;
  name: string;
  description?: string;
  phaseType: PhaseType;
  startWeek: number;
  endWeek: number;
  startDate?: Date;
  endDate?: Date;
  focusAreas: string[];
  weeklyVolumeTargetMiles?: number;
  intensityDistribution?: {
    easy: number;
    tempo: number;
    intervals: number;
  };
  config: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface TrainingWeek {
  id: string;
  planId: string;
  phaseId?: string;
  weekNumber: number;
  startDate: Date;
  endDate: Date;
  plannedMiles?: number;
  actualMiles?: number;
  plannedWorkouts: number;
  completedWorkouts: number;
  weekType: string;
  focusDescription?: string;
  coachSummary?: string;
  athleteFeedback?: string;
  recoveryStatus?: string;
  adaptationsMade: string[];
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// ===========================================
// Workout Types (Enhanced)
// ===========================================
export type WorkoutStatus = 'planned' | 'completed' | 'skipped' | 'partial';

export type WorkoutType =
  | 'strength'
  | 'cardio'
  | 'hiit'
  | 'yoga'
  | 'mobility'
  | 'sport'
  | 'walk'
  | 'run'
  | 'cycle'
  | 'swim'
  | 'other';

export interface Exercise {
  name: string;
  sets?: number;
  reps?: number;
  weight?: number;
  duration?: number;
  distance?: number;
  notes?: string;
}

export interface WorkoutSplit {
  mile?: number;
  segment?: string;
  pace: string;
  elevation?: string;
  avgHr?: number;
  note?: string;
}

export interface Workout {
  id: string;
  userId: string;
  planId?: string;
  phaseId?: string;
  weekId?: string;
  weekNumber?: number;
  dayOfWeek?: number;
  title: string;
  workoutType: WorkoutType;
  status: WorkoutStatus;
  scheduledDate?: Date;
  scheduledTime?: string;
  
  // Prescription
  prescribedDescription?: string;
  prescribedDistanceMiles?: number;
  prescribedPacePerMile?: string;
  prescribedHrZone?: string;
  prescribedStructure?: Record<string, unknown>;
  
  // Execution
  plannedDurationMinutes?: number;
  actualDurationMinutes?: number;
  startedAt?: Date;
  completedAt?: Date;
  
  // Biometrics
  avgHeartRate?: number;
  maxHeartRate?: number;
  preWorkoutRestingHr?: number;
  preWorkoutSleepHours?: number;
  preWorkoutSoreness?: number;
  preWorkoutEnergy?: number;
  bodyBatteryStart?: number;
  bodyBatteryEnd?: number;
  
  // Performance Metrics
  trainingLoad?: number;
  trainingEffectAerobic?: number;
  trainingEffectAnaerobic?: number;
  cadenceAvg?: number;
  cadenceMax?: number;
  avgPowerWatts?: number;
  groundContactTimeMs?: number;
  verticalOscillationCm?: number;
  
  // Environment
  temperatureF?: number;
  humidityPct?: number;
  weatherConditions?: string;
  terrainType?: string;
  elevationGainFt?: number;
  elevationLossFt?: number;
  
  // Detailed Data
  splits?: WorkoutSplit[];
  intervals?: Record<string, unknown>[];
  deviceData?: Record<string, unknown>;
  
  // Fueling
  fuelingPre?: Record<string, unknown>;
  fuelingDuring?: Record<string, unknown>;
  
  // Feedback
  personalNotes?: string;
  perceivedExertion?: number;
  perceivedDifficulty?: string;
  discomfortNotes?: string;
  discomfortLocations?: string[];
  
  // Coach Analysis
  coachNotes?: string;
  executionScore?: number;
  keyObservations?: string[];
  recommendations?: string[];
  adaptationTriggers?: string[];
  
  // Legacy fields
  plannedIntensity?: number;
  actualIntensity?: number;
  rpe?: number;
  caloriesBurned?: number;
  exercises: Exercise[];
  notes?: string;
  eventId?: string;
  externalId?: string;
  source: string;
  tags: string[];
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export type AdaptationType = 'volume_reduction' | 'intensity_reduction' | 'rest_day' | 'workout_swap' | 'schedule_shift';
export type AdaptationTrigger = 'fatigue' | 'injury' | 'illness' | 'life_stress' | 'weather' | 'travel' | 'performance' | 'coach_decision';

export interface WorkoutAdaptation {
  id: string;
  originalWorkoutId: string;
  adaptedWorkoutId?: string;
  adaptationType: AdaptationType;
  trigger: AdaptationTrigger;
  reason: string;
  originalPlan?: Record<string, unknown>;
  adaptedPlan?: Record<string, unknown>;
  approvedBy?: string;
  approvedAt?: Date;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface BiometricBaseline {
  id: string;
  userId: string;
  metricName: string;
  baselineValue: number;
  unit: string;
  calculatedFrom: string;
  sampleSize: number;
  standardDeviation?: number;
  percentile5?: number;
  percentile95?: number;
  validFrom: Date;
  validUntil?: Date;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export type CoachingInteractionType = 'feedback' | 'question' | 'guidance' | 'motivation' | 'analysis';

export interface CoachingInteraction {
  id: string;
  userId: string;
  workoutId?: string;
  weekId?: string;
  interactionType: CoachingInteractionType;
  athleteInput?: string;
  coachResponse: string;
  sentiment?: string;
  actionItems?: string[];
  followUpRequired: boolean;
  followUpDate?: Date;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

// ===========================================
// Injury Types
// ===========================================
export type InjuryStatus = 'active' | 'recovering' | 'healed' | 'chronic';

export interface Injury {
  id: string;
  userId: string;
  bodyPart: string;
  description?: string;
  severity: number; // 1-10
  status: InjuryStatus;
  startDate: Date;
  endDate?: Date;
  notes?: string;
  limitations: string[];
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// ===========================================
// Constraint Types
// ===========================================
export type ConstraintType =
  | 'time_block'
  | 'energy_budget'
  | 'recovery'
  | 'focus'
  | 'personal'
  | 'health'
  | 'custom';

export interface Constraint {
  id: string;
  userId: string;
  name: string;
  description?: string;
  constraintType: ConstraintType;
  appliesToDays: number[];
  startTime?: string;
  endTime?: string;
  rule: Record<string, unknown>;
  priority: number;
  isActive: boolean;
  isFlexible: boolean;
  validFrom?: Date;
  validUntil?: Date;
  tags: string[];
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// ===========================================
// Whiteboard Types
// ===========================================
export type WhiteboardEntryType =
  | 'observation'
  | 'suggestion'
  | 'question'
  | 'alert'
  | 'insight'
  | 'plan'
  | 'reflection';

export type WhiteboardVisibility = 'user_only' | 'agents_only' | 'all';

export interface WhiteboardEntry {
  id: string;
  userId: string;
  agentId: string;
  entryType: WhiteboardEntryType;
  visibility: WhiteboardVisibility;
  title?: string;
  content: string;
  structuredData?: Record<string, unknown>;
  priority: number;
  requiresResponse: boolean;
  responseDeadline?: Date;
  isRead: boolean;
  isActioned: boolean;
  actionedAt?: Date;
  relatedEntityType?: string;
  relatedEntityId?: string;
  parentEntryId?: string;
  contextDate: Date;
  expiresAt?: Date;
  tags: string[];
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export type ReactionType =
  | 'acknowledge'
  | 'agree'
  | 'disagree'
  | 'question'
  | 'implement'
  | 'defer'
  | 'dismiss';

export interface WhiteboardReaction {
  id: string;
  entryId: string;
  reactorType: 'user' | 'agent';
  reactorId: string;
  reactionType: ReactionType;
  comment?: string;
  createdAt: Date;
}

// ===========================================
// Agent Types
// ===========================================
export type AgentId =
  | 'health-agent'
  | 'workload-agent'
  | 'training-agent'
  | 'training-coach'
  | 'planning-coach'
  | 'nutrition-agent'
  | 'meal-planner-agent'
  | 'reflection-agent'
  | 'orchestrator';

export interface AgentConfig {
  id: AgentId;
  name: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

export interface AgentContext {
  userId: string;
  date: string;
  userName: string;
  supabase: unknown; // Will be typed properly in database package
  data: Record<string, unknown>;
}

export interface AgentOutput {
  agentId: AgentId;
  timestamp: string;
  response: {
    content: string;
    toolCalls?: ToolCall[];
  };
  duration: number;
  tokenUsage: TokenUsage;
}

// ===========================================
// LLM Types
// ===========================================
export type LLMProviderType = 'anthropic' | 'openai';

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (args: unknown, context: AgentContext) => Promise<unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  id: string;
  result?: unknown;
  error?: string;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LLMRequest {
  systemPrompt: string;
  messages: LLMMessage[];
  tools?: Tool[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMResponse {
  content: string;
  toolCalls?: ToolCall[];
  usage: TokenUsage;
  model: string;
  stopReason: string;
}

// ===========================================
// Agent Run Types (for logging)
// ===========================================
export interface AgentRun {
  id: string;
  userId: string;
  agentId: AgentId;
  runType: string;
  triggerReason?: string;
  inputContext?: Record<string, unknown>;
  outputResult?: Record<string, unknown>;
  llmProvider?: string;
  llmModel?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalCostCents?: number;
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  errorMessage?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

// ===========================================
// Chat Types
// ===========================================
export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  userId: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  respondingAgentId?: AgentId;
  toolCalls?: Record<string, unknown>;
  promptTokens?: number;
  completionTokens?: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

// ===========================================
// Daily Plan Types
// ===========================================
export interface DailyPlan {
  date: string;
  summary: string;
  healthStatus: {
    recoveryScore: number;
    recommendations: string[];
    alerts: string[];
  };
  schedule: ScheduleItem[];
  prioritizedTasks: Task[];
  workoutPlan?: {
    workout: Workout;
    modifications?: string[];
    rationale?: string;
  };
  whiteboardHighlights: WhiteboardEntry[];
}

export interface ScheduleItem {
  time: string;
  event?: CalendarEvent;
  task?: Task;
  workout?: Workout;
  type: 'event' | 'task' | 'workout' | 'break' | 'focus';
  notes?: string;
}

// ===========================================
// Event Trigger Types
// ===========================================
export type EventTriggerType =
  | 'calendar_change'
  | 'health_checkin'
  | 'task_completed'
  | 'task_added'
  | 'workout_completed'
  | 'weekly_review'
  | 'user_message';

export interface EventTrigger {
  type: EventTriggerType;
  entityId?: string;
  data?: Record<string, unknown>;
  timestamp: Date;
}

// ===========================================
// Biomarker Types
// ===========================================
export type BiomarkerCategory =
  | 'lipid_panel'
  | 'metabolic'
  | 'cbc'
  | 'thyroid'
  | 'hormones'
  | 'vitamins'
  | 'minerals'
  | 'iron'
  | 'liver'
  | 'kidney'
  | 'inflammatory'
  | 'cardiac'
  | 'other';

export interface BiomarkerDefinition {
  id: string;
  code: string;
  name: string;
  category: BiomarkerCategory;
  subcategory?: string;
  defaultUnit: string;
  defaultRangeLow?: number;
  defaultRangeHigh?: number;
  optimalRangeLow?: number;
  optimalRangeHigh?: number;
  description?: string;
  athleteConsiderations?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export type LabPanelSource = 'quest' | 'labcorp' | 'hospital' | 'clinic' | 'home_test' | 'other';
export type LabPanelStatus = 'pending' | 'complete' | 'partial' | 'cancelled';

export interface LabPanel {
  id: string;
  userId: string;
  panelDate: Date;
  panelName?: string;
  labName?: string;
  source: LabPanelSource;
  status: LabPanelStatus;
  fastingHours?: number;
  notes?: string;
  documentUrl?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export type BiomarkerFlag = 'normal' | 'low' | 'high' | 'critical_low' | 'critical_high';

export interface BiomarkerResult {
  id: string;
  userId: string;
  panelId?: string;
  biomarkerId: string;
  resultDate: Date;
  value: number;
  unit: string;
  referenceLow?: number;
  referenceHigh?: number;
  flag?: BiomarkerFlag;
  labNotes?: string;
  userNotes?: string;
  coachAnalysis?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface BiomarkerBaseline {
  id: string;
  userId: string;
  biomarkerId: string;
  baselineValue: number;
  unit: string;
  sampleCount: number;
  standardDeviation?: number;
  minObserved?: number;
  maxObserved?: number;
  optimalTargetLow?: number;
  optimalTargetHigh?: number;
  athleteSpecificNotes?: string;
  validFrom: Date;
  validUntil?: Date;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// ===========================================
// Meal Planning Types
// ===========================================

export type CookingSkill = 'beginner' | 'intermediate' | 'advanced';
export type BudgetLevel = 'budget' | 'moderate' | 'premium';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'pre_workout' | 'post_workout';
export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
export type RecipeCategory = 'quick_weeknight' | 'batch_cooking' | 'special_occasion' | 'kid_favorite' | 'athlete_recovery' | 'pre_workout' | 'other';
export type GrocerySection = 'produce' | 'proteins' | 'dairy' | 'grains' | 'pantry' | 'frozen' | 'athlete_specific' | 'other';
export type AgeCategory = 'infant' | 'toddler' | 'child' | 'teen' | 'adult' | 'senior';
export type PickyLevel = 'not_picky' | 'normal' | 'picky' | 'very_picky';
export type FamilyRelationship = 'spouse' | 'child' | 'parent' | 'other';

export interface MealPreferences {
  favoriteFoods?: string[];
  dislikedFoods?: string[];
  cookingSkill?: CookingSkill;
  weeknightCookingTime?: number; // minutes
  weekendCookingTime?: number;
  batchCookingDay?: DayOfWeek;
  groceryStorePreference?: string;
  budgetLevel?: BudgetLevel;
  dietaryRestrictions?: string[];
}

export interface FamilyMember {
  id: string;
  userId: string;
  name: string;
  relationship: FamilyRelationship;
  ageCategory?: AgeCategory;
  dietaryRestrictions?: string[];
  allergies?: string[];
  favoriteFoods?: string[];
  dislikedFoods?: string[];
  pickyLevel?: PickyLevel;
  notes?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateFamilyMember {
  name: string;
  relationship: FamilyRelationship;
  ageCategory?: AgeCategory;
  dietaryRestrictions?: string[];
  allergies?: string[];
  favoriteFoods?: string[];
  dislikedFoods?: string[];
  pickyLevel?: PickyLevel;
  notes?: string;
}

export interface MealPlan {
  id: string;
  userId: string;
  weekStartDate: Date;
  trainingPhase?: string;
  weeklyMileage?: number;
  hasLongRunDay?: DayOfWeek;
  status: 'draft' | 'active' | 'completed' | 'archived';
  generatedBy: string;
  athleteNeedsSummary?: string;
  notes?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateMealPlan {
  weekStartDate: Date;
  trainingPhase?: string;
  weeklyMileage?: number;
  hasLongRunDay?: DayOfWeek;
  athleteNeedsSummary?: string;
  notes?: string;
}

export interface PlannedMeal {
  id: string;
  mealPlanId: string;
  userId: string;
  dayOfWeek: DayOfWeek;
  mealType: MealType;
  name: string;
  description?: string;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  isFamilyMeal: boolean;
  athleteModifications?: string;
  kidModifications?: string;
  trainingRelevance?: string;
  recipeId?: string;
  completed: boolean;
  completionNotes?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePlannedMeal {
  mealPlanId: string;
  dayOfWeek: DayOfWeek;
  mealType: MealType;
  name: string;
  description?: string;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  isFamilyMeal?: boolean;
  athleteModifications?: string;
  kidModifications?: string;
  trainingRelevance?: string;
  recipeId?: string;
}

export interface RecipeIngredient {
  item: string;
  quantity: string;
  unit?: string;
  notes?: string;
}

export interface SavedRecipe {
  id: string;
  userId: string;
  name: string;
  category: RecipeCategory;
  servings: number;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  ingredients: RecipeIngredient[];
  instructions: string[];
  athleteAdaptation?: string;
  nutritionNotes?: string;
  isGoodPreWorkout: boolean;
  isGoodPostWorkout: boolean;
  isCarbHeavy: boolean;
  isProteinHeavy: boolean;
  kidAdaptation?: string;
  kidFriendlyRating?: number;
  tags: string[];
  sourceUrl?: string;
  sourceNotes?: string;
  timesMade: number;
  lastMadeDate?: Date;
  isFavorite: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSavedRecipe {
  name: string;
  category: RecipeCategory;
  servings?: number;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  ingredients: RecipeIngredient[];
  instructions: string[];
  athleteAdaptation?: string;
  nutritionNotes?: string;
  isGoodPreWorkout?: boolean;
  isGoodPostWorkout?: boolean;
  isCarbHeavy?: boolean;
  isProteinHeavy?: boolean;
  kidAdaptation?: string;
  kidFriendlyRating?: number;
  tags?: string[];
  sourceUrl?: string;
  sourceNotes?: string;
}

export interface GroceryList {
  id: string;
  userId: string;
  mealPlanId?: string;
  forWeekOf: Date;
  name: string;
  status: 'draft' | 'active' | 'shopping' | 'completed';
  primaryStore?: string;
  estimatedTotalLow?: number;
  estimatedTotalHigh?: number;
  actualTotal?: number;
  itemsTotal: number;
  itemsPurchased: number;
  shoppingStartedAt?: Date;
  shoppingCompletedAt?: Date;
  notes?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateGroceryList {
  mealPlanId?: string;
  forWeekOf: Date;
  name?: string;
  primaryStore?: string;
  estimatedTotalLow?: number;
  estimatedTotalHigh?: number;
}

export interface GroceryListItem {
  id: string;
  groceryListId: string;
  itemName: string;
  quantity?: string;
  section: GrocerySection;
  forMeals?: string[];
  isAthleteSpecific: boolean;
  notes?: string;
  isPurchased: boolean;
  purchasedAt?: Date;
  actualPrice?: number;
  substitutedWith?: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateGroceryListItem {
  groceryListId: string;
  itemName: string;
  quantity?: string;
  section: GrocerySection;
  forMeals?: string[];
  isAthleteSpecific?: boolean;
  notes?: string;
  sortOrder?: number;
}

export interface BatchCookingPlan {
  id: string;
  userId: string;
  mealPlanId?: string;
  plannedDate: Date;
  totalTimeMinutes?: number;
  status: 'planned' | 'in_progress' | 'completed' | 'skipped';
  items: BatchCookingItem[];
  additionalShopping?: string[];
  startedAt?: Date;
  completedAt?: Date;
  actualDurationMinutes?: number;
  completionNotes?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface BatchCookingItem {
  item: string;
  quantity: string;
  prepOrder: number;
  activeTimeMinutes: number;
  storage: string;
  usedFor: string[];
  keepsDays: number;
}

export interface CreateBatchCookingPlan {
  mealPlanId?: string;
  plannedDate: Date;
  totalTimeMinutes?: number;
  items: BatchCookingItem[];
  additionalShopping?: string[];
}
