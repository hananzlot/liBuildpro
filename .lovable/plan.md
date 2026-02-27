

## Reorganize Company Settings into Grouped Sections

Currently 10 collapsible cards in a flat vertical list. Reorganize into 3 logical groups with section headers and a two-column grid layout.

### Layout

```text
━━━ Company Profile ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┌─────────────────┐  ┌─────────────────────────────┐
│ Company Logo    │  │ Company Info (name, addr…)   │
└─────────────────┘  └─────────────────────────────┘
┌─────────────────────────────────────────────────┐
│ Social Media Links                              │
└─────────────────────────────────────────────────┘

━━━ Sales & Pipeline ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┌─────────────────┐  ┌─────────────────────────────┐
│ Pipeline Config │  │ Opportunity Stage Names      │
└─────────────────┘  └─────────────────────────────┘
┌─────────────────┐  ┌─────────────────────────────┐
│ Stage Badges    │  │ Estimate Settings            │
└─────────────────┘  └─────────────────────────────┘

━━━ Operations & Display ━━━━━━━━━━━━━━━━━━━━━━━━
┌─────────────────┐  ┌─────────────────────────────┐
│ Portal Settings │  │ Project Statuses             │
└─────────────────┘  └─────────────────────────────┘
┌─────────────────────────────────────────────────┐
│ Dashboard KPI Visibility                        │
└─────────────────────────────────────────────────┘
```

### Implementation

**File: `src/pages/AdminSettings.tsx`** — Restructure lines ~964-1414 (the settings TabsContent inner `div`).

**Step 1: Add section headers** — Each group gets a lightweight header with icon + title + Separator:
```tsx
<div className="flex items-center gap-2 pt-2">
  <Building className="h-5 w-5 text-muted-foreground" />
  <h3 className="text-lg font-semibold">Company Profile</h3>
</div>
<Separator className="mb-2" />
```
Icons: `Building` for Company Profile, `Target` for Sales & Pipeline, `Settings` for Operations & Display.

**Step 2: Wrap pairs in responsive grids:**
```tsx
<div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
  {/* Card A */}
  {/* Card B */}
</div>
```
`items-start` ensures cards don't stretch to match height.

**Step 3: Reorder and group:**

- **Company Profile**: LogoUpload + Company Settings (side-by-side), then SocialMediaLinks (full-width)
- **Sales & Pipeline**: Pipeline Configuration + Opportunity Stage Names (side-by-side), then Stage Badge Mappings + Estimate Settings (side-by-side)
- **Operations & Display**: Customer Portal Settings + Project Statuses (side-by-side), then Dashboard KPI Visibility (full-width)

All existing component code stays identical — only the wrapping structure changes.

