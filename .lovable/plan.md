
# Plan: Add PDF Preview for Proposals in Salesperson Portal

## Summary
Update the My Proposals section to show an inline estimate preview dialog when clicking a proposal record, instead of redirecting to the customer portal. The salesperson will see the same preview that customers see, with the option to generate a PDF.

## Current Behavior
- Clicking a proposal row opens the customer portal in a new tab
- No inline preview is available

## New Behavior
- Clicking a proposal row opens the `EstimatePreviewDialog` showing the full estimate details
- The dialog includes a "View PDF" button to generate and open the PDF in a new tab
- An optional external link icon/button can still open the customer portal if needed

## Technical Implementation

### 1. Add State for Selected Estimate

```typescript
const [selectedEstimateId, setSelectedEstimateId] = useState<string | null>(null);
```

### 2. Update Click Handler

Replace the current redirect behavior:

```typescript
const handleOpenProposal = (estimate: Estimate) => {
  // Open the preview dialog instead of redirecting
  setSelectedEstimateId(estimate.id);
};
```

### 3. Add External Link Button (Optional)

To preserve portal access, add a separate button/icon:

```typescript
const handleOpenPortal = (e: React.MouseEvent, estimate: Estimate) => {
  e.stopPropagation(); // Prevent row click
  if (estimate.portal_token) {
    const portalUrl = `${appBaseUrl || window.location.origin}/portal/${estimate.portal_token}`;
    window.open(portalUrl, "_blank");
  }
};
```

### 4. Import and Render EstimatePreviewDialog

```typescript
import { EstimatePreviewDialog } from "@/components/estimates/EstimatePreviewDialog";

// At the bottom of the component return:
<EstimatePreviewDialog
  estimateId={selectedEstimateId}
  open={!!selectedEstimateId}
  onOpenChange={(open) => !open && setSelectedEstimateId(null)}
/>
```

### 5. Update Row UI

Add an `Eye` icon for preview (row click) and keep `ExternalLink` as a separate action:

| Action | Trigger | Behavior |
|--------|---------|----------|
| Click row | Opens EstimatePreviewDialog | Inline preview with PDF button |
| Click external link icon | Opens customer portal | New tab |

### Visual Changes

```text
┌─────────────────────────────────────────────────────────┐
│ Estimate Title                           [Proposal]     │
│ Customer Name                                           │
│ 📍 123 Main St                                          │
│ [Sent] Jan 15, 2026                    $15,000 👁 🔗   │
└─────────────────────────────────────────────────────────┘
                                          ↑    ↑
                                     Preview  Portal
```

## File to Modify

| File | Changes |
|------|---------|
| `src/components/salesperson-portal/PortalProposalsSection.tsx` | Add EstimatePreviewDialog import, add state for selected estimate, update click handler, add separate portal link button |

## Technical Considerations

- The `EstimatePreviewDialog` already handles all the estimate data fetching and rendering
- The "View PDF" button within the dialog calls `generate-contract-pdf` edge function
- No new dependencies required - just reusing existing components
- Portal access is preserved via the separate external link icon
