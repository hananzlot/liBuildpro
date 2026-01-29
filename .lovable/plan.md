
# Plan: Fix Payment Phase Total Calculation Mismatch

## Problem Summary

When viewing estimate #2076, the payment phase totals appear incorrect because there's a mismatch between:
1. **How phases are saved** (in the `generate-estimate-scope` edge function)
2. **How phases are displayed** (in the EstimateBuilderDialog UI)

### Current State

**Estimate 2076:**
- Total: $2,358,247.50
- Deposit Percent: 10%
- Deposit Max Amount: $1,000

**Stored Payment Phases:**
- Deposit: 10% = $235,824.75 (calculated as 10% of total)
- Other phases: 15%, 15%, 20%, 20%, 10%, 10% = $2,122,422.75

**UI Display Logic:**
- Deposit = min(10% × total, $1,000) = **$1,000**
- Other phases = (total - $1,000) × percent / 100

This creates a visible mismatch where the displayed phase amounts don't match the stored amounts.

---

## Root Cause

Two separate calculation methods exist:

| Component | Deposit Calculation | Other Phases |
|-----------|---------------------|--------------|
| Edge Function | `percent × total` | `percent × total` |
| UI (Builder) | `min(percent × total, max_amount)` | `percent × (total - deposit) / 100` |

The edge function does not respect the `deposit_max_amount` cap when saving phases.

---

## Solution

Align the payment phase calculation in the `generate-estimate-scope` edge function to match the UI logic:

1. **Fetch deposit settings** from the estimate or company settings
2. **Calculate deposit** using the cap: `min(deposit_percent × total, deposit_max_amount)`
3. **Calculate remaining total** after deposit
4. **Store deposit phase** with `percent: 0` and `amount: depositAmount`
5. **Store other phases** with amounts calculated from `remainingTotal`

---

## Technical Changes

### 1. Update `supabase/functions/generate-estimate-scope/index.ts`

**Location:** Lines 390-411 (payment schedule insertion)

**Current Code:**
```typescript
const scheduleToInsert = paymentSchedule.map((phase: any, index: number) => ({
  ...
  percent: phase.percent || 0,
  amount: (phase.percent / 100) * totalEstimate,
  ...
}));
```

**New Code:**
```typescript
// Fetch deposit_max_amount from estimate or default to Infinity (no cap)
const { data: estimateSettings } = await supabase
  .from('estimates')
  .select('deposit_percent, deposit_max_amount')
  .eq('id', estimateId)
  .single();

const depositPercent = estimateSettings?.deposit_percent || depositPercent;
const depositMaxAmount = estimateSettings?.deposit_max_amount || Infinity;

// Calculate capped deposit
const calculatedDeposit = (depositPercent / 100) * totalEstimate;
const cappedDeposit = Math.min(calculatedDeposit, depositMaxAmount);
const remainingTotal = Math.max(0, totalEstimate - cappedDeposit);

// Process phases with proper deposit handling
const scheduleToInsert = paymentSchedule.map((phase: any, index: number) => {
  const isDepositPhase = phase.phase_name?.toLowerCase().includes('deposit');
  
  return {
    estimate_id: estimateId,
    company_id: companyId,
    phase_name: phase.phase_name || `Phase ${index + 1}`,
    percent: isDepositPhase ? 0 : (phase.percent || 0),
    amount: isDepositPhase 
      ? cappedDeposit 
      : (remainingTotal * (phase.percent || 0)) / 100,
    due_type: phase.due_type || 'milestone',
    due_date: phase.due_date || null,
    description: phase.description || null,
    sort_order: index,
  };
});
```

### 2. Fix Existing Estimate Data (Optional One-Time Fix)

For estimate 2076 specifically, the user can:
1. Open the estimate in the builder
2. Increase `deposit_max_amount` to match the actual deposit needed ($250,000+)
3. Click "Auto-balance" on the payment phases
4. Save the estimate

Alternatively, update the estimate's `deposit_max_amount` to a higher value:
```sql
UPDATE estimates 
SET deposit_max_amount = 1000000 
WHERE id = '0f6f684d-fd45-48e9-8b85-398b6e2805f9';
```

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/generate-estimate-scope/index.ts` | Update payment schedule persistence logic to respect deposit cap |

---

## Testing Plan

1. Create a new estimate via AI generation with:
   - Large total (e.g., $500,000+)
   - Low deposit_max_amount (e.g., $1,000)
   - Verify phases calculate correctly with capped deposit

2. Verify existing estimates display correctly when:
   - deposit_max_amount matches or exceeds calculated deposit
   - Phases sum to 100% and balance indicator shows green

3. Test editing an existing estimate and re-saving to ensure phases persist correctly

---

## Impact Assessment

- **Low risk**: Changes only affect new AI-generated estimates
- **Backward compatible**: Existing estimates with matching deposit settings continue to work
- **User action may be needed**: For estimates like #2076 where deposit_max_amount is too low, user should increase it or remove the cap

