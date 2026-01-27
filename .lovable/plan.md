

# Multi-Stage AI Estimate Generation Implementation Plan

## Overview

This plan implements a staged AI estimate generation system to eliminate timeouts. Instead of generating 50+ line items in a single massive request, the system will make 4-6 smaller, faster calls:

1. **PLAN_DIGEST** (only when PDF attached) - Extract data from plans
2. **ESTIMATE_PLAN** - Create outline with groups + payment schedule
3. **GROUP_ITEMS** (×N) - Generate 8-12 items per group (looped)
4. **FINAL_ASSEMBLY** - Merge everything together

---

## Architecture Diagram

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                     FRONTEND (EstimateBuilderDialog)                      │
├──────────────────────────────────────────────────────────────────────────┤
│  1. User clicks "Generate with AI"                                        │
│  2. Create job record (status: 'pending')                                 │
│  3. Subscribe to Realtime updates on job                                  │
│  4. Call edge function with jobId + staged mode                           │
│  5. Show progress UI with current stage name                              │
│  6. When job status = 'completed', apply result                           │
└─────────────────────────────────┬────────────────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────────────────┐
│              EDGE FUNCTION (generate-estimate-scope)                      │
├──────────────────────────────────────────────────────────────────────────┤
│  Background Processing with EdgeRuntime.waitUntil():                      │
│                                                                           │
│  ┌────────────────┐                                                       │
│  │  Has PDF?      │────Yes────▶ Stage 1: PLAN_DIGEST                     │
│  │                │              (max_tokens: 2000, ~15-30s)              │
│  └───────┬────────┘              Store: plan_digest in job.result_json   │
│          │No                                                              │
│          ▼                                                                │
│  ┌────────────────┐                                                       │
│  │ Stage 2:       │◀───────────────────────────────────────────────────  │
│  │ ESTIMATE_PLAN  │ (max_tokens: 1500, ~10-20s)                          │
│  │                │ Output: groups[], payment_schedule, assumptions       │
│  └───────┬────────┘                                                       │
│          │                                                                │
│          ▼                                                                │
│  ┌────────────────────────────────────────────┐                          │
│  │ Stage 3: GROUP_ITEMS (loop for each group) │                          │
│  │                                             │                          │
│  │  For group in groups[] (max 14 groups):    │                          │
│  │    - Call AI with group_name               │                          │
│  │    - max_tokens: 2500                      │                          │
│  │    - ~8-15s per group                      │                          │
│  │    - Store items in accumulated result     │                          │
│  │    - Update job progress after each group  │                          │
│  └───────┬────────────────────────────────────┘                          │
│          │                                                                │
│          ▼                                                                │
│  ┌────────────────┐                                                       │
│  │ Stage 4:       │                                                       │
│  │ FINAL_ASSEMBLY │ (max_tokens: 2000, ~5-10s)                           │
│  │                │ Merge all data into final schema                      │
│  └───────┬────────┘                                                       │
│          │                                                                │
│          ▼                                                                │
│  Update job: status='completed', result_json={scope:...}                 │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Part 1: Database Changes

### 1.1 Add Stage Tracking to `estimate_generation_jobs`

Add columns to track multi-stage progress:

```sql
ALTER TABLE estimate_generation_jobs
ADD COLUMN current_stage TEXT,
ADD COLUMN total_stages INTEGER DEFAULT 4,
ADD COLUMN stage_results JSONB DEFAULT '{}';
```

**Purpose:**
- `current_stage`: "PLAN_DIGEST" | "ESTIMATE_PLAN" | "GROUP_ITEMS:GroupName" | "FINAL_ASSEMBLY"
- `total_stages`: Number of stages (4 base + N groups)
- `stage_results`: Intermediate results per stage for recovery/debugging

---

## Part 2: Edge Function Changes

### File: `supabase/functions/generate-estimate-scope/index.ts`

### 2.1 Add Multi-Stage Mode Detection

Add a `stagedMode` parameter check:

```typescript
const {
  // ... existing params
  stagedMode = true, // Default to new staged mode
} = body;
```

### 2.2 Create Stage-Specific Helper Functions

**`callStage()`** - Generic stage caller with appropriate token limits:

```typescript
async function callStage(
  stage: 'PLAN_DIGEST' | 'ESTIMATE_PLAN' | 'GROUP_ITEMS' | 'FINAL_ASSEMBLY',
  userMessage: string,
  systemPrompt: string,
  options: { hasPdf?: boolean; pdfBase64?: string; maxTokens: number }
): Promise<any> {
  // Use smaller token limits per stage
  const tokenLimits = {
    PLAN_DIGEST: 2500,
    ESTIMATE_PLAN: 1800,
    GROUP_ITEMS: 3500,
    FINAL_ASSEMBLY: 3000,
  };
  
  const maxTokens = options.maxTokens || tokenLimits[stage];
  // ... call AI with appropriate limits
}
```

### 2.3 Implement Staged Processing Pipeline

Replace `processEstimateGeneration()` with staged logic:

```typescript
async function processEstimateGenerationStaged(params) {
  const { plansFileUrl, jobId, ... } = params;
  
  // Stage 1: PLAN_DIGEST (only if PDF)
  let planDigest = null;
  if (plansFileUrl) {
    await updateJobProgress(jobId, 'PLAN_DIGEST', 1, totalStages);
    planDigest = await callStage('PLAN_DIGEST', ...);
    saveStageResult(jobId, 'plan_digest', planDigest);
  }
  
  // Stage 2: ESTIMATE_PLAN
  await updateJobProgress(jobId, 'ESTIMATE_PLAN', 2, totalStages);
  const estimatePlan = await callStage('ESTIMATE_PLAN', 
    buildEstimatePlanPrompt(planDigest), ...);
  
  // Stage 3: GROUP_ITEMS (loop)
  const groups = estimatePlan.groups || [];
  const groupResults = [];
  for (let i = 0; i < groups.length; i++) {
    await updateJobProgress(jobId, `GROUP_ITEMS:${groups[i].group_name}`, 3 + i, totalStages);
    const items = await callStage('GROUP_ITEMS',
      buildGroupItemsPrompt(groups[i].group_name, planDigest), ...);
    groupResults.push({ ...groups[i], items: items.items });
  }
  
  // Stage 4: FINAL_ASSEMBLY
  await updateJobProgress(jobId, 'FINAL_ASSEMBLY', totalStages, totalStages);
  const finalResult = await callStage('FINAL_ASSEMBLY',
    buildFinalAssemblyPrompt(estimatePlan, groupResults), ...);
  
  return finalResult;
}
```

### 2.4 Token Limits Per Stage

| Stage | max_tokens | Typical Response Time |
|-------|------------|----------------------|
| PLAN_DIGEST | 2,500 | 15-30s |
| ESTIMATE_PLAN | 1,800 | 10-20s |
| GROUP_ITEMS | 3,500 | 8-15s each |
| FINAL_ASSEMBLY | 3,000 | 5-10s |

**Total for 10-group estimate:** ~90-150s spread across 13 calls (vs one 120+ second call that times out)

### 2.5 System Prompt Update

The edge function will use the stored `ai_estimate_instructions` from `company_settings` which you've already updated. The function will:

1. Read the full prompt from `company_settings.ai_estimate_instructions`
2. Parse the mode-specific instructions from it
3. Append the `mode:` and context to the user message

---

## Part 3: Frontend Changes

### File: `src/components/estimates/EstimateBuilderDialog.tsx`

### 3.1 Update Progress UI

Modify `AIGenerationProgress` component to show current stage:

```typescript
// Current: isGeneratingScope is boolean
// New: Add stage tracking state
const [currentStage, setCurrentStage] = useState<string | null>(null);
const [stageProgress, setStageProgress] = useState<{ current: number; total: number } | null>(null);
```

### 3.2 Update Realtime Subscription Handler

Listen for stage updates:

```typescript
.on('postgres_changes', {
  event: 'UPDATE',
  table: 'estimate_generation_jobs',
  filter: `id=eq.${jobId}`,
}, (payload) => {
  const job = payload.new;
  
  // Update progress UI
  if (job.current_stage) {
    setCurrentStage(job.current_stage);
  }
  if (job.total_stages) {
    const stageNum = parseStageNumber(job.current_stage);
    setStageProgress({ current: stageNum, total: job.total_stages });
  }
  
  // Handle completion/failure
  if (job.status === 'completed') { ... }
  if (job.status === 'failed') { ... }
})
```

### 3.3 Update AIGenerationProgress Component

### File: `src/components/estimates/AIGenerationProgress.tsx`

Add stage-specific status messages:

```typescript
const getStageMessage = (stage: string | null) => {
  if (!stage) return 'Starting AI generation...';
  if (stage === 'PLAN_DIGEST') return 'Analyzing construction plans...';
  if (stage === 'ESTIMATE_PLAN') return 'Creating estimate outline...';
  if (stage.startsWith('GROUP_ITEMS:')) {
    const groupName = stage.replace('GROUP_ITEMS:', '');
    return `Generating items for: ${groupName}`;
  }
  if (stage === 'FINAL_ASSEMBLY') return 'Assembling final estimate...';
  return 'Processing...';
};
```

---

## Part 4: Prompt Integration

### How the System Uses Your New Prompt

The edge function will:

1. **Read the full prompt** from `company_settings.ai_estimate_instructions`
2. **Build mode-specific user messages** by appending:

```typescript
// For ESTIMATE_PLAN stage
const userMessage = `
mode: "ESTIMATE_PLAN"

Project Type: ${projectType}
Job Location: ${jobAddress}
Default Markup: ${markupPercent}%

WORK SCOPE:
${workScopeDescription}

${planDigest ? `PLAN DIGEST (from PDF analysis):\n${JSON.stringify(planDigest)}` : ''}
`;
```

3. **Use the stored system prompt** directly (it contains all mode instructions)

---

## Implementation Order

| Step | Task | Effort |
|------|------|--------|
| 1 | Add database columns for stage tracking | 5 min |
| 2 | Refactor edge function to support staged mode | 45 min |
| 3 | Add `callStage()` helper with per-stage token limits | 20 min |
| 4 | Implement staged processing pipeline | 30 min |
| 5 | Update frontend to track and display stage progress | 20 min |
| 6 | Update `AIGenerationProgress` with stage-specific messages | 10 min |
| 7 | Test with simple scope (no PDF) | 5 min |
| 8 | Test with PDF plans | 10 min |

**Total estimated implementation time:** ~2.5 hours

---

## Expected Improvements

| Metric | Before (Single Call) | After (Staged) |
|--------|---------------------|----------------|
| Timeout rate | ~30-50% for complex scopes | <5% |
| Max response time | 90-150s (often times out) | 90-150s spread across calls |
| User feedback | "Generating..." for 2+ min | "Creating outline... Generating Framing items..." |
| Token efficiency | 32,000 max (often truncated) | 1,800-3,500 per call (never truncated) |
| Error recovery | Start over | Can resume from last stage |

---

## Technical Notes

- **Backward Compatibility**: The `stagedMode` flag defaults to `true` but can be set to `false` to use legacy single-call mode
- **Prompt Storage**: Your new multi-stage prompt is already stored in `company_settings.ai_estimate_instructions`
- **PDF Handling**: PDF is only attached in the `PLAN_DIGEST` stage; subsequent stages receive the extracted `plan_digest` as text
- **Group Limits**: The prompt enforces `groups <= 14` and `items <= 12` per group, ensuring predictable response sizes

