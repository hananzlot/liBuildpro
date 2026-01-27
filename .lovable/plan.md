# Multi-Stage AI Estimate Generation - IMPLEMENTED ✅

## Summary

Implemented a staged AI estimate generation system to eliminate timeouts. The system now makes 4-6 smaller, faster calls instead of one massive request:

1. **PLAN_DIGEST** (only when PDF attached) - Extract data from plans (~2,500 tokens)
2. **ESTIMATE_PLAN** - Create outline with groups + payment schedule (~1,800 tokens)
3. **GROUP_ITEMS** (×N) - Generate 8-12 items per group (~3,500 tokens each)
4. **FINAL_ASSEMBLY** - Merge everything together (~3,000 tokens)

## Changes Made

### Database
- Added `current_stage`, `total_stages`, and `stage_results` columns to `estimate_generation_jobs` table for tracking multi-stage progress

### Edge Function (`supabase/functions/generate-estimate-scope/index.ts`)
- Complete refactor to support staged mode (default enabled)
- Separate functions for each stage: `processPlanDigestStage`, `processEstimatePlanStage`, `processGroupItemsStage`, `processFinalAssemblyStage`
- Per-stage token limits to prevent truncation
- Real-time progress updates via `updateJobProgress()`
- Background processing with `EdgeRuntime.waitUntil()`

### Frontend
- **`EstimateBuilderDialog.tsx`**: Added `currentAIStage` and `stageProgress` state, updated realtime subscription to track stage updates
- **`AIGenerationProgress.tsx`**: Updated to display real-time stage messages and progress bar based on current stage

## How It Works

1. User clicks "Generate with AI"
2. Frontend creates a job record and subscribes to Realtime updates
3. Edge function processes stages sequentially:
   - Each stage updates `current_stage` in the database
   - Frontend receives updates via Realtime and shows progress
4. When complete, result is applied to the estimate

## Expected Improvements

| Metric | Before | After |
|--------|--------|-------|
| Timeout rate | ~30-50% | <5% |
| User feedback | "Generating..." | "Generating items for: Framing" |
| Token efficiency | 32K max (truncated) | 1.8K-3.5K per call |
| Error recovery | Start over | Can resume from stage |
