

# Marketing Deck for Your CRM Platform

Based on my exploration of the codebase, your platform is a comprehensive, multi-tenant CRM built for home services / contracting companies. Here is what I propose building as a slide deck — a new in-app page at `/deck` that uses scaled 1920x1080 slides with fullscreen presentation mode.

---

## Deck Structure (10 Slides)

### Slide 1 — Title
"Your All-in-One Contractor CRM" — tagline, logo placeholder, clean hero layout.

### Slide 2 — The Problem
Pain points: scattered tools, no visibility into pipeline, manual project tracking, lost revenue from missed follow-ups.

### Slide 3 — Dispatch Dashboard
Lead tracking, appointment management, sales rep leaderboards, source analytics, follow-up management — all in one view. Highlights the GHL integration for automatic lead sync.

### Slide 4 — Estimates & Proposals
AI-powered estimate builder, line-item pricing, proposal generation with PDF preview, digital sending, and contract printing. Scope-to-estimate workflow.

### Slide 5 — Production Management
Full project lifecycle: kanban/table views, project editor, finance tracking (bills, invoices, deposits), photo/document management, notes, subcontractor management with vendor mapping.

### Slide 6 — Financial Analytics
Profitability analysis, cash flow tracking, P&L statements, balance sheets, accounts receivable/payable, commission reports, QuickBooks integration.

### Slide 7 — Client Portal
Customer-facing portal with passcode access: view project status, sign documents, chat with staff (portal + SMS), review estimates and compliance documents.

### Slide 8 — Salesperson Portal
Dedicated rep portal: scope submissions for pricing, estimate creation, file uploads, proposal management, calendar access — all tied to assigned projects.

### Slide 9 — Document Signing & Multi-Tenant
Digital signature flows with multi-signer support, signature templates. Multi-tenant architecture with per-company feature gating, subscription plans, and super-admin controls.

### Slide 10 — CTA / Pricing
Call to action, feature tier summary (from your subscription/feature gate system), contact info.

---

## Technical Approach

- **New page**: `src/pages/Deck.tsx` — standalone, no auth required (public marketing page)
- **Slide components**: Each slide is a React component rendered at 1920x1080, scaled to fit viewport
- **Fullscreen mode**: Browser Fullscreen API with arrow key navigation
- **Thumbnail strip**: Left sidebar with slide previews for quick navigation
- **Design**: Dark gradient backgrounds, feature icons from lucide-react, clean typography, accent colors matching your existing design system
- **No external dependencies**: Uses your existing UI primitives (Card, Badge, Button) plus custom slide layout CSS

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/pages/Deck.tsx` | Main deck page with scaling, navigation, fullscreen |
| `src/components/deck/SlideLayout.tsx` | 1920x1080 scaled wrapper |
| `src/components/deck/slides/` | Individual slide components (10 files) |
| `src/components/deck/DeckNavigation.tsx` | Thumbnail sidebar + keyboard nav |
| Route entry in `App.tsx` | Public `/deck` route |

