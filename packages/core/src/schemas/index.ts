import { z } from 'zod';

// ===========================================
// User Schemas
// ===========================================
export const UserPreferencesSchema = z.object({
  morningDigestTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  eveningDigestTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  workingHours: z.object({
    start: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
    end: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  }),
  defaultLLMProvider: z.enum(['anthropic', 'openai']),
  notifications: z
    .object({
      email: z.boolean().optional(),
      push: z.boolean().optional(),
    })
    .optional(),
});

export const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(255),
  avatarUrl: z.string().url().optional(),
  timezone: z.string().default('America/Los_Angeles'),
  preferences: UserPreferencesSchema.optional(),
});

// ===========================================
// Event Schemas
// ===========================================
export const EventTypeSchema = z.enum([
  'meeting',
  'focus_block',
  'workout',
  'meal',
  'sleep',
  'travel',
  'personal',
  'break',
  'other',
]);

export const EventSourceSchema = z.enum([
  'google_calendar',
  'manual',
  'agent_suggested',
]);

export const CreateEventSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  eventType: EventTypeSchema.default('other'),
  source: EventSourceSchema.default('manual'),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  allDay: z.boolean().default(false),
  timezone: z.string().optional(),
  location: z.string().optional(),
  videoLink: z.string().url().optional(),
  participantIds: z.array(z.string().uuid()).default([]),
  energyCost: z.number().min(0).max(100).default(50),
  isFlexible: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).default({}),
});

// ===========================================
// Task Schemas
// ===========================================
export const TaskStatusSchema = z.enum([
  'inbox',
  'todo',
  'in_progress',
  'blocked',
  'done',
  'archived',
]);

export const TaskPrioritySchema = z.enum([
  'p1_critical',
  'p2_high',
  'p3_medium',
  'p4_low',
]);

export const TaskSourceSchema = z.enum([
  'manual',
  'agent_created',
  'calendar_derived',
  'notion_sync',
  'slack',
]);

export const CreateTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  status: TaskStatusSchema.default('inbox'),
  priority: TaskPrioritySchema.default('p3_medium'),
  source: TaskSourceSchema.default('manual'),
  dueDate: z.coerce.date().optional(),
  dueTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  estimatedMinutes: z.number().positive().optional(),
  energyRequired: z.number().min(0).max(100).default(50),
  contextTags: z.array(z.string()).default([]),
  project: z.string().optional(),
  parentTaskId: z.string().uuid().optional(),
  relatedEventId: z.string().uuid().optional(),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).default({}),
});

export const UpdateTaskSchema = CreateTaskSchema.partial().extend({
  completedAt: z.coerce.date().optional(),
  blockedReason: z.string().optional(),
  actualMinutes: z.number().positive().optional(),
});

// ===========================================
// Health Schemas
// ===========================================
export const CreateHealthSnapshotSchema = z.object({
  snapshotDate: z.coerce.date(),
  snapshotTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  sleepHours: z.number().min(0).max(24).optional(),
  sleepQuality: z.number().min(1).max(10).optional(),
  energyLevel: z.number().min(1).max(10).optional(),
  stressLevel: z.number().min(1).max(10).optional(),
  moodScore: z.number().min(1).max(10).optional(),
  sorenessLevel: z.number().min(0).max(10).optional(),
  sorenessAreas: z.array(z.string()).default([]),
  illnessSymptoms: z.array(z.string()).default([]),
  hrv: z.number().positive().optional(),
  restingHr: z.number().positive().optional(),
  hydrationGlasses: z.number().min(0).optional(),
  mealsLogged: z.number().min(0).optional(),
  alcoholUnits: z.number().min(0).optional(),
  caffeineMg: z.number().min(0).optional(),
  notes: z.string().optional(),
  source: z.string().default('manual'),
  metadata: z.record(z.unknown()).default({}),
});

// ===========================================
// Workout Schemas
// ===========================================
export const WorkoutStatusSchema = z.enum([
  'planned',
  'completed',
  'skipped',
  'partial',
]);

export const WorkoutTypeSchema = z.enum([
  'strength',
  'cardio',
  'hiit',
  'yoga',
  'mobility',
  'sport',
  'walk',
  'run',
  'cycle',
  'swim',
  'other',
]);

export const ExerciseSchema = z.object({
  name: z.string().min(1),
  sets: z.number().positive().optional(),
  reps: z.number().positive().optional(),
  weight: z.number().optional(),
  duration: z.number().positive().optional(),
  distance: z.number().positive().optional(),
  notes: z.string().optional(),
});

export const CreateWorkoutSchema = z.object({
  title: z.string().min(1).max(255),
  workoutType: WorkoutTypeSchema,
  status: WorkoutStatusSchema.default('planned'),
  scheduledDate: z.coerce.date().optional(),
  scheduledTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  plannedDurationMinutes: z.number().positive().optional(),
  plannedIntensity: z.number().min(1).max(10).optional(),
  exercises: z.array(ExerciseSchema).default([]),
  notes: z.string().optional(),
  eventId: z.string().uuid().optional(),
  source: z.string().default('manual'),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).default({}),
});

export const CompleteWorkoutSchema = z.object({
  status: z.enum(['completed', 'skipped', 'partial']),
  completedAt: z.date().optional(),
  actualDurationMinutes: z.number().positive().optional(),
  actualIntensity: z.number().min(1).max(10).optional(),
  rpe: z.number().min(1).max(10).optional(),
  avgHeartRate: z.number().positive().optional(),
  maxHeartRate: z.number().positive().optional(),
  caloriesBurned: z.number().positive().optional(),
  exercises: z.array(ExerciseSchema).optional(),
  notes: z.string().optional(),
});

// ===========================================
// Injury Schemas
// ===========================================
export const InjuryStatusSchema = z.enum([
  'active',
  'recovering',
  'healed',
  'chronic',
]);

export const CreateInjurySchema = z.object({
  bodyPart: z.string().min(1).max(100),
  description: z.string().optional(),
  severity: z.number().min(1).max(10),
  status: InjuryStatusSchema.default('active'),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  notes: z.string().optional(),
  limitations: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).default({}),
});

// ===========================================
// Constraint Schemas
// ===========================================
export const ConstraintTypeSchema = z.enum([
  'time_block',
  'energy_budget',
  'recovery',
  'focus',
  'personal',
  'health',
  'custom',
]);

export const CreateConstraintSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  constraintType: ConstraintTypeSchema,
  appliesToDays: z.array(z.number().min(1).max(7)).default([1, 2, 3, 4, 5, 6, 7]),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  rule: z.record(z.unknown()),
  priority: z.number().min(0).max(100).default(50),
  isActive: z.boolean().default(true),
  isFlexible: z.boolean().default(false),
  validFrom: z.coerce.date().optional(),
  validUntil: z.coerce.date().optional(),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).default({}),
});

// ===========================================
// Whiteboard Schemas
// ===========================================
export const WhiteboardEntryTypeSchema = z.enum([
  'observation',
  'suggestion',
  'question',
  'alert',
  'insight',
  'plan',
  'reflection',
]);

export const WhiteboardVisibilitySchema = z.enum([
  'user_only',
  'agents_only',
  'all',
]);

export const CreateWhiteboardEntrySchema = z.object({
  agentId: z.string().min(1),
  entryType: WhiteboardEntryTypeSchema,
  visibility: WhiteboardVisibilitySchema.default('all'),
  title: z.string().max(255).optional(),
  content: z.string().min(1),
  structuredData: z.record(z.unknown()).optional(),
  priority: z.number().min(0).max(100).default(50),
  requiresResponse: z.boolean().default(false),
  responseDeadline: z.coerce.date().optional(),
  relatedEntityType: z.string().optional(),
  relatedEntityId: z.string().uuid().optional(),
  parentEntryId: z.string().uuid().optional(),
  contextDate: z.coerce.date(),
  expiresAt: z.coerce.date().optional(),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).default({}),
});

export const ReactionTypeSchema = z.enum([
  'acknowledge',
  'agree',
  'disagree',
  'question',
  'implement',
  'defer',
  'dismiss',
]);

export const CreateWhiteboardReactionSchema = z.object({
  entryId: z.string().uuid(),
  reactorType: z.enum(['user', 'agent']),
  reactorId: z.string().min(1),
  reactionType: ReactionTypeSchema,
  comment: z.string().optional(),
});

// ===========================================
// Chat Schemas
// ===========================================
export const MessageRoleSchema = z.enum(['user', 'assistant', 'system']);

export const ChatRequestSchema = z.object({
  message: z.string().min(1),
  sessionId: z.string().uuid().optional(),
});

export const CreateChatMessageSchema = z.object({
  sessionId: z.string().uuid(),
  role: MessageRoleSchema,
  content: z.string().min(1),
  respondingAgentId: z.string().optional(),
  toolCalls: z.record(z.unknown()).optional(),
  promptTokens: z.number().optional(),
  completionTokens: z.number().optional(),
  metadata: z.record(z.unknown()).default({}),
});

// ===========================================
// Type exports from schemas
// ===========================================
export type CreateUser = z.infer<typeof CreateUserSchema>;
export type CreateEvent = z.infer<typeof CreateEventSchema>;
export type CreateTask = z.infer<typeof CreateTaskSchema>;
export type UpdateTask = z.infer<typeof UpdateTaskSchema>;
export type CreateHealthSnapshot = z.infer<typeof CreateHealthSnapshotSchema>;
export type CreateWorkout = z.infer<typeof CreateWorkoutSchema>;
export type CompleteWorkout = z.infer<typeof CompleteWorkoutSchema>;
export type CreateInjury = z.infer<typeof CreateInjurySchema>;
export type CreateConstraint = z.infer<typeof CreateConstraintSchema>;
export type CreateWhiteboardEntry = z.infer<typeof CreateWhiteboardEntrySchema>;
export type CreateWhiteboardReaction = z.infer<typeof CreateWhiteboardReactionSchema>;
export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type CreateChatMessage = z.infer<typeof CreateChatMessageSchema>;
