

## Root Cause Analysis

The 7 extra phases (Initial Payment, Deployment & Retainer, Demo & Prep, Rough Trades, Walls Floors & Windows, Interior Finish Phase, Final Completion) were created from the **Client Portal estimate signing flow** (`PortalEstimateView.tsx` or `PortalProposals.tsx`). However, they have `agreement_id: null` — meaning either:
- The agreement creation succeeded but the `agreementData?.id` wasn't passed correctly, OR
- These were created from a code path that didn't link them to an agreement (e.g., `PortalEstimateView.tsx` line 453-466 sets `agreement_id: agreementData?.id` which could be `undefined` if the agreement insert failed silently).

**Why they don't show in the Finance section:** The Progress Payments tab in `FinanceSection.tsx` filters phases by `agreement_id` (line 3047: `paymentPhases.filter(p => p.agreement_id === agreement.id)`). Since these 7 phases have `agreement_id = null`, they are invisible in the Finance tab but still appear in the Projects Summary report, which fetches all phases for a project without filtering by agreement.

**The "fddg" phase** also has `agreement_id: null` — likely a manual test entry.

## Plan

### 1. Clean up orphan data (immediate fix)
Delete the 8 orphan phases (`agreement_id IS NULL`) for project 123. These are: "fddg", "Initial Payment", "Deployment & Retainer - Downpayment", "Demo & Prep", "Rough Trades", "Walls Floors & Windows", "Interior Finish Phase", "Final Completion".

### 2. Fix the Projects Summary query to exclude orphan phases
In `ProjectSummaryTab.tsx`, update the phases query (line 204-209) to only fetch phases that have an `agreement_id` (i.e., `.not("agreement_id", "is", null)`). This ensures orphan/unlinked phases never pollute the summary report.

### 3. Add a visible "Unlinked Phases" section in the Finance tab
In `FinanceSection.tsx`, after rendering agreement-grouped phases, add a section that shows any phases with `agreement_id = null` so users can see and clean them up — preventing future invisible orphan records.

### 4. Fix the portal signing flow to prevent future orphans
In both `PortalEstimateView.tsx` (line 451-472) and `PortalProposals.tsx` (line 409-430), add a guard: if `agreementData?.id` is falsy, skip creating payment phases entirely (they'd be orphaned). The code already checks `agreementError` but continues if `agreementData` is null without an error.

