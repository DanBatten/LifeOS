# Chat Agent Issues & Improvements

## Executive Summary

The chat agent failed in several key ways during the Dec 23-30 run logging session. This document analyzes the root causes and proposes concrete fixes.

---

## Issue 1: Sync Tool Can't Handle Date Remapping

### Problem
When the user said "I ran my MP run that was scheduled for the 23rd on the 25th instead", the `sync_garmin_activity` tool:
- Synced the Dec 25 Garmin activity to the Dec 25 **planned** workout
- Should have synced it to the Dec 23 **planned** workout

### Root Cause
In `packages/skills/src/garmin/sync-activity.skill.ts` (lines 190-200):
```typescript
const { data: plannedWorkouts } = await supabase
  .from('workouts')
  .select('*')
  .eq('user_id', userId)
  .eq('scheduled_date', targetDate)  // <-- Only looks at target date!
  .eq('status', 'planned')
```

The skill only looks for planned workouts on the **same date** as the Garmin activity. There's no way to say "sync this activity to a different workout."

### Solution
Add a `target_workout_id` parameter to the sync tool:
```typescript
interface SyncActivityOptions {
  forceResync?: boolean;
  date?: string;
  targetWorkoutId?: string;  // NEW: Override which workout to sync to
  athleteFeedback?: string;
  perceivedExertion?: number;
}
```

This allows the agent to explicitly say: "Sync Dec 25's Garmin activity to the Dec 23 planned workout."

---

## Issue 2: Agent Doesn't Ask Clarifying Questions

### Problem
The user gave complex, multi-part information:
- "I flew to NZ on Dec 22, landed Dec 24"
- "I ran the MP run scheduled for 23rd on the 25th instead"
- "I skipped my second easy run"

The agent should have:
1. Parsed this information
2. **Confirmed the mapping before syncing**:
   > "Let me confirm before syncing:
   > - Dec 25 Garmin activity → Dec 23 MP workout
   > - Dec 26 Garmin activity → Dec 26 Easy run
   > - Dec 28 Garmin activity → Dec 28 Long run
   > - Dec 30 Garmin activity → Dec 30 Intervals
   > - Dec 25 Easy run → Skip
   > 
   > Is this correct?"

### Root Cause
The system prompt doesn't instruct the agent to:
1. Parse complex requests before acting
2. Confirm mappings when workouts are rescheduled
3. Ask clarifying questions when information is ambiguous

### Solution
Add to system prompt:
```
## COMPLEX REQUEST HANDLING

When the athlete describes rescheduled workouts, travel, or non-standard weeks:

1. **PARSE FIRST** - Identify what happened:
   - Which workouts were moved to different dates?
   - Which workouts were skipped?
   - Any special context (travel, injury, etc.)

2. **CONFIRM BEFORE SYNCING** - Ask the athlete to verify your understanding:
   "Before I sync, let me confirm:
   - [Date] activity → [Workout name]
   - [Date] activity → [Workout name]
   Is this mapping correct?"

3. **THEN EXECUTE** - Only after confirmation, make the tool calls

This prevents errors that are hard to fix later.
```

---

## Issue 3: Wrong Marathon Date ("2 weeks away" vs 10+ weeks)

### Problem
The agent said the marathon was "2 weeks away" when it's actually March 8, 2026 (10+ weeks out).

### Root Cause
The `TrainingPlan` interface in `load-context.skill.ts` doesn't include `raceDate`:
```typescript
interface TrainingPlan {
  id: string;
  name: string;
  goalEvent: string | null;
  goalTime: string | null;
  startDate: string;
  endDate: string;  // This is plan end, not race date!
  currentWeek: number | null;
  totalWeeks: number | null;
  phases: { ... }[];
  // Missing: raceDate!
}
```

The agent prompt references "Week X of Y" but doesn't include the actual race date, so the LLM hallucinated.

### Solution
1. Add `raceDate` to the TrainingPlan context
2. Include explicit race date in system prompt:
   ```
   - Race Date: March 8, 2026 (${weeksToRace} weeks away)
   ```

---

## Issue 4: Agent Said "I Can't Fix It" When It Has Tools

### Problem
When asked to fix the incorrect logging, the agent said:
> "I don't have the ability to directly edit or fix the workout logs"

But it DOES have `update_workout` which can modify workouts!

### Root Cause
1. The tool descriptions don't make clear they can **correct mistakes**
2. The agent was trained to be cautious about claiming capabilities
3. No explicit instruction that tools work for corrections too

### Solution
Add to system prompt:
```
## CORRECTING MISTAKES

You CAN fix mistakes you've made. If you logged something incorrectly:
1. Use `update_workout` to fix workout metadata (status, notes, dates)
2. Use `sync_garmin_activity` with `force_resync=true` to re-sync
3. Apologize briefly and fix it immediately - don't say you can't

NEVER say "I can't fix this" when you have tools that can.
```

---

## Issue 5: Mixed Up Feedback Between Runs

### Problem
The agent applied long run feedback to the interval workout and vice versa.

### Root Cause
When processing a multi-part message, the LLM didn't maintain proper state tracking for which notes belonged to which workout.

### Solution
1. **Parse into structured format first:**
   ```
   Before making any tool calls, I'll parse your message:
   
   Run 1: Dec 25 (MP workout)
   - Feedback: "jetlagged, felt inefficient aerobically, got through it"
   
   Run 2: Dec 26 (Easy)
   - Feedback: "felt good"
   
   Run 3: Dec 28 (Long run)
   - Feedback: "cut short due to poor sleep/HRV, but felt good throughout"
   
   Run 4: Dec 30 (Intervals)
   - Feedback: "hard but felt good, few quick breaks in last interval"
   ```

2. **Require confirmation** before executing

---

## Implementation Priority

### High Priority (Fix Now)
1. Add `target_workout_id` to sync tool - enables date remapping
2. Add race date to agent context - prevents date hallucinations
3. Add "CORRECTING MISTAKES" section to prompt - agent should know it can fix errors

### Medium Priority
4. Add "COMPLEX REQUEST HANDLING" section - parse and confirm before acting
5. Improve tool descriptions for clarity

### Future Improvements
6. Add conversation memory for multi-turn corrections
7. Add undo/rollback capability for sync operations
8. Add validation step in sync skill before committing

---

## Code Changes Needed

### 1. `sync-activity.skill.ts` - Add targetWorkoutId parameter
### 2. `TrainingCoachAgent.ts` - Update system prompt with new sections
### 3. `load-context.skill.ts` - Add raceDate to TrainingPlan interface and loading
### 4. Agent tool descriptions - Make correction capability explicit

