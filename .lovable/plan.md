

# Plan: Embed All Real Screenshots into the Marketing Deck

## Screenshot Mapping

Between the previous 10 uploads and these new 10 uploads, we now have 20 real screenshots covering every feature area. Here is the complete mapping of new uploads to slides:

| Upload | Content | Destination |
|---|---|---|
| `4.18.15 PM` | Welcome/Home screen (collapsed sidebar) | `screenshot-home.png` — new, for potential Title slide background or skip |
| `4.19.29 PM` | Welcome/Home screen (expanded sidebar, quick create bar) | Skip — similar to above |
| `4.20.26 PM` | **Dispatch Dashboard** — KPIs, Opportunities by Source, Won by Source, Sales Rep Performance, Won Deals | `screenshot-dashboard.png` — **replace existing** in SlideDashboard |
| `4.20.53 PM` | **Calendar** — Monthly view with color-coded appointments, rep filters | `screenshot-calendar.png` — new asset, enhance SlideDashboard or add to features |
| `4.21.07 PM` | **Follow-up Management** — Buckets (Close to Sale, Stale Notes, Tasks Helper, etc.) | `screenshot-followup.png` — **replace existing** in SlideSalesPortal |
| `4.22.10 PM` | **Estimates list** — 44 total, tabs for Estimates/Proposals/Contracts/Declined | `screenshot-estimates.png` — **replace existing** in SlideEstimates |
| `4.22.45 PM` | **Client Portal** — Project status stepper, customer info, team, tabs | `screenshot-client-portal.png` — **replace existing** in SlideClientPortal |
| `4.23.17-2 PM` | **Customer Proposal Preview** — Branded PDF with $152K ADU proposal | `screenshot-proposal.png` — new asset, add to SlideEstimates as secondary |
| `4.23.36-2 PM` | **Edit Estimate (AI Builder)** — Scope tab with AI Analysis & Assumptions | `screenshot-ai-estimate.png` — new asset, add to SlideEstimates |
| `4.23.53-2 PM` | **E-Sign Docs** — Pending/Awaiting/Signed KPIs, document list | `screenshot-esign.png` — new asset, add to SlideDocSigning |

Combined with the **previous 10 uploads** (which included Production table, Subcontractors, Analytics/Profitability, P&L, Outstanding AR, Outstanding AP), every slide now has real visuals.

## File Changes

### 1. Copy 8 new screenshot files to `src/assets/deck/`

Copy these user uploads as PNG files:
- `screenshot-dashboard.png` (from `4.20.26 PM` — replaces the existing `.jpg`)
- `screenshot-calendar.png` (from `4.20.53 PM`)
- `screenshot-followup.png` (from `4.21.07 PM` — replaces existing `.jpg`)
- `screenshot-estimates.png` (from `4.22.10 PM` — replaces existing `.jpg`)
- `screenshot-client-portal.png` (from `4.22.45 PM` — replaces existing `.jpg`)
- `screenshot-proposal.png` (from `4.23.17-2 PM`)
- `screenshot-ai-estimate.png` (from `4.23.36-2 PM`)
- `screenshot-esign.png` (from `4.23.53-2 PM`)

Also copy the previous batch screenshots that haven't been embedded yet:
- `screenshot-production.png` (Projects table from previous batch)
- `screenshot-subcontractors.png` (License alerts from previous batch)
- `screenshot-analytics.png` (Profitability from previous batch)
- `screenshot-pnl.png` (P&L Statement)
- `screenshot-ar.png` (Outstanding AR)
- `screenshot-ap.png` (Outstanding AP)

### 2. Update `SlideDashboard.tsx`
- Replace screenshot import to use the new Dispatch Dashboard image (KPIs, Opportunities by Source, Won Deals, Sales Rep Performance)
- Update alt text to match real content

### 3. Update `SlideEstimates.tsx`
- Use the **Estimates list** screenshot as the primary visual (44 total, $240K estimates, $1M proposals)
- Could show the AI Estimate Builder or Proposal Preview as a secondary inset or update feature descriptions to reference them

### 4. Update `SlideProduction.tsx`
- Use the **Projects table** screenshot from the previous batch
- Update alt text

### 5. Update `SlideAnalytics.tsx`
- Use the **Profitability** screenshot from the previous batch (KPI cards, Profit by Project/Salesperson charts)

### 6. Update `SlideSalesPortal.tsx`
- Use the **Follow-up Management** screenshot (buckets with badges: Close to Sale, Tasks Helper, Stale Notes, etc.)

### 7. Update `SlideClientPortal.tsx`
- Use the **Client Portal** screenshot (Project Status stepper, Customer Info, Team section)
- Change from the phone-frame mockup layout to a full-width desktop screenshot since the real portal is a desktop web view, not mobile

### 8. Update `SlideDocSigning.tsx`
- Add the **E-Sign Docs** screenshot to the left half (Document Signing section)
- This slide currently has zero visuals — only text/icons

### 9. Consider expanding the deck
With the Calendar, AI Estimate Builder, Proposal Preview, and Subcontractors screenshots, we could:
- Add a secondary visual to SlideDashboard showing the Calendar
- Add the Proposal Preview as a secondary to SlideEstimates
- Keep the deck at 10 slides but with richer visuals per slide

## Technical Details

- All imports change from `.jpg` to `.png` since the uploads are PNG format
- Each component uses `import screenshot from "@/assets/deck/filename.png"`
- Image styling remains `object-cover object-left-top` to keep KPI headers and key data visible
- SlideClientPortal layout changes from phone-frame (340x680px rounded rectangle) to a standard screenshot panel since the actual portal is a desktop-class web app
- No new dependencies needed

