

## Redesign Company Settings: Vertical Tab Navigation + All Collapsed

The current section-based layout still results in a long scrollable page. A better pattern is a **vertical tab navigation** (like GitHub/Stripe settings) where users select a category on the left and only see that category's cards on the right.

### Current Problems
- Even with sections and jump links, users still see all 10 cards at once
- "Jump to" buttons are redundant with proper navigation
- Having some cards auto-expanded adds visual noise

### Proposed Layout

```text
┌──────────────────┬──────────────────────────────────┐
│ ▸ Company Profile│  Company Logo          [card]    │
│   Sales & Pipeline  Company Info        [card]    │
│   Operations     │  Social Media Links   [card]    │
│                  │                                  │
│                  │  (only cards for selected        │
│                  │   category are shown)            │
└──────────────────┴──────────────────────────────────┘
```

On mobile, the left sidebar becomes horizontal pill tabs above the content.

### Implementation

**File: `src/pages/AdminSettings.tsx`**

1. **Add state** for the active settings category:
   ```tsx
   const [settingsCategory, setSettingsCategory] = useState<"company" | "sales" | "operations">("company");
   ```

2. **Replace** the "Jump to" buttons and section headers/separators with a sidebar + content layout:
   ```tsx
   <div className="flex flex-col md:flex-row gap-6">
     {/* Sidebar - vertical on desktop, horizontal on mobile */}
     <div className="flex md:flex-col gap-1 md:w-48 md:shrink-0">
       <Button variant={settingsCategory === "company" ? "secondary" : "ghost"} 
               className="justify-start" onClick={() => setSettingsCategory("company")}>
         <Building className="h-4 w-4 mr-2" /> Company Profile
       </Button>
       <Button variant={settingsCategory === "sales" ? "secondary" : "ghost"}
               className="justify-start" onClick={() => setSettingsCategory("sales")}>
         <Target className="h-4 w-4 mr-2" /> Sales & Pipeline
       </Button>
       <Button variant={settingsCategory === "operations" ? "secondary" : "ghost"}
               className="justify-start" onClick={() => setSettingsCategory("operations")}>
         <Settings className="h-4 w-4 mr-2" /> Operations & Display
       </Button>
     </div>

     {/* Content area - only shows selected category */}
     <div className="flex-1 space-y-4">
       {settingsCategory === "company" && (
         <>
           <LogoUpload />           {/* defaultOpen removed */}
           <CompanySettingsCard />
           <SocialMediaLinks />
         </>
       )}
       {settingsCategory === "sales" && (
         <>
           <PipelineConfig />       {/* defaultOpen removed */}
           <OpportunityStages />
           <StageBadges />
           <EstimateSettings />
         </>
       )}
       {settingsCategory === "operations" && (
         <>
           <CustomerPortal />       {/* defaultOpen removed */}
           <ProjectStatuses />
           <DashboardKPI />
         </>
       )}
     </div>
   </div>
   ```

3. **Collapse all cards by default** — change `defaultOpen` to `false` (or remove the prop) on LogoUpload, Pipeline Configuration, and Customer Portal Settings.

4. **Remove** the "Jump to" navigation bar, section headers (`<h3>`), separators, section wrapper `<div>`s, and `scroll-mt-6` / `id` attributes — all replaced by the sidebar.

5. **Remove** grid layouts (`grid-cols-2`) — with only 3-4 cards visible at a time, a single-column stack is cleaner and avoids mismatched card heights.

This reduces cognitive load significantly: users see 3-4 cards max instead of 10, with clear category switching.

