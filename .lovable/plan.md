
# Show "Project" Button as a Dropdown for Opportunities with Multiple Linked Projects

## What's Happening Now

In `src/components/dashboard/OpportunityDetailSheet.tsx`:

1. **State**: Only one project ID is tracked: `const [associatedProjectId, setAssociatedProjectId] = useState<string | null>(null)`
2. **Fetch**: The query uses `.maybeSingle()` which returns `null` when more than one project row matches — so the button disappears entirely for multi-project opportunities.
3. **Button**: A single "Project" button navigates to `/production/{associatedProjectId}`. It only shows when `associatedProjectId` is non-null.

## The Fix

**3 changes to `src/components/dashboard/OpportunityDetailSheet.tsx`:**

### 1. Add a new state for all linked projects

Replace the single `associatedProjectId` state with an array that stores all linked projects (id + name):

```typescript
// Before
const [associatedProjectId, setAssociatedProjectId] = useState<string | null>(null);

// After
const [associatedProjectId, setAssociatedProjectId] = useState<string | null>(null); // keep for backward compat (portal creation)
const [associatedProjects, setAssociatedProjects] = useState<{ id: string; project_name: string | null }[]>([]);
```

### 2. Update the fetch query (around line 409)

Instead of `.maybeSingle()`, fetch **all** linked projects with their names:

```typescript
// Before (only fetches one, silently fails for >1 row)
const { data: projectData } = await supabase
  .from("projects")
  .select("id")
  .eq("opportunity_id", opportunity.ghl_id)
  .maybeSingle();
setAssociatedProjectId(projectData?.id ?? null);

// After (fetches all)
const { data: projectsData } = await supabase
  .from("projects")
  .select("id, project_name")
  .or(`opportunity_id.eq.${opportunity.ghl_id},opportunity_uuid.eq.${opportunity.id || 'none'}`)
  .eq("company_id", companyId)
  .order("created_at", { ascending: false });

setAssociatedProjects(projectsData || []);
setAssociatedProjectId(projectsData?.[0]?.id ?? null); // keep for portal creation flow
```

### 3. Replace the single Project button with smart rendering (around line 2688)

- **0 projects**: Button hidden (existing behavior)
- **1 project**: Single "Project" button navigating directly (existing behavior)
- **2+ projects**: A dropdown button listing each project by name

```tsx
{(isAdmin || isProduction) && associatedProjects.length === 1 && (
  <Button variant="outline" size="sm" className="h-7"
    onClick={() => { onOpenChange(false); navigate(`/production/${associatedProjects[0].id}`); }}>
    <FolderOpen className="h-3.5 w-3.5 mr-1" />
    Project
  </Button>
)}

{(isAdmin || isProduction) && associatedProjects.length > 1 && (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="outline" size="sm" className="h-7">
        <FolderOpen className="h-3.5 w-3.5 mr-1" />
        Project
        <ChevronDown className="h-3.5 w-3.5 ml-1" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="z-[200]">
      {associatedProjects.map((proj) => (
        <DropdownMenuItem key={proj.id}
          onClick={() => { onOpenChange(false); navigate(`/production/${proj.id}`); }}>
          {proj.project_name || `Project ${proj.id.slice(0, 8)}`}
        </DropdownMenuItem>
      ))}
    </DropdownMenuContent>
  </DropdownMenu>
)}
```

### 4. Add DropdownMenu imports

Add `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem` to the imports at the top of the file. `ChevronDown` and `FolderOpen` are already imported.

## Files Changed

- `src/components/dashboard/OpportunityDetailSheet.tsx` — state, fetch, and button rendering updates only

## No Database Changes Required

This is a pure frontend change. The existing `projects` table already stores `project_name` and `opportunity_id`.
