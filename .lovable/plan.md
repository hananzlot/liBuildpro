
# Plan: Update Portal Query to Include Opportunity-Assigned Projects

## Summary
Enhance the `PortalProjectLinksSection` component to also find projects that are linked to opportunities assigned to the salesperson. Currently, only projects where the salesperson is directly set as `primary_salesperson` (or secondary/tertiary/quaternary) are shown. Projects linked via opportunity assignment are missed.

## Current Problem

The current query only checks:
```sql
primary_salesperson = salespersonName
OR secondary_salesperson = salespersonName
OR tertiary_salesperson = salespersonName
OR quaternary_salesperson = salespersonName
```

However, projects like #47 (Amal Alwan) have:
- `primary_salesperson: null`
- But linked to an opportunity with `assigned_to: sKyd4E0c4l51cpdgr7uv` (Brendan G)

## Solution

Update the component to:
1. Accept additional props: `salespersonId` (UUID) and `salespersonGhlUserId` (optional)
2. Perform a two-step query:
   - **Step 1**: Get projects directly assigned to the salesperson (current behavior)
   - **Step 2**: Get projects linked to opportunities assigned to the salesperson

## Technical Implementation

### 1. Update Props Interface

Add new props to accept the salesperson's UUID and GHL user ID:

```typescript
interface PortalProjectLinksSectionProps {
  salespersonName: string;
  salespersonId: string;           // NEW: Internal UUID
  salespersonGhlUserId?: string;   // NEW: GHL user ID (optional)
  companyId: string;
}
```

### 2. Update Query Logic

Modify the query function to:

```text
Step 1: Fetch projects directly assigned by name (existing behavior)
  - Match primary/secondary/tertiary/quaternary_salesperson

Step 2: Fetch projects linked via opportunity assignment
  - Query opportunities where assigned_to = ghl_user_id
  - Get project IDs from opportunity_uuid relationship
  - Join with projects table

Step 3: Combine and deduplicate results
  - Merge both sets of projects
  - Use Map to ensure unique project IDs
```

### 3. Updated Query Implementation

```typescript
queryFn: async () => {
  if (!salespersonName || !companyId) return [];

  // Step 1: Projects directly assigned to salesperson
  const { data: directProjects, error: directError } = await supabase
    .from("projects")
    .select("id, project_number, project_name, project_address, customer_first_name, customer_last_name")
    .eq("company_id", companyId)
    .or(`primary_salesperson.eq.${salespersonName},secondary_salesperson.eq.${salespersonName},tertiary_salesperson.eq.${salespersonName},quaternary_salesperson.eq.${salespersonName}`)
    .is("deleted_at", null);

  if (directError) throw directError;

  // Step 2: Projects linked via opportunity assignment
  let opportunityProjects: Project[] = [];
  
  if (salespersonGhlUserId) {
    // Get opportunities assigned to this salesperson
    const { data: opportunities } = await supabase
      .from("opportunities")
      .select("id, ghl_id")
      .eq("company_id", companyId)
      .eq("assigned_to", salespersonGhlUserId);

    if (opportunities?.length) {
      const oppIds = opportunities.map(o => o.id);
      const oppGhlIds = opportunities.map(o => o.ghl_id).filter(Boolean);

      // Get projects linked to these opportunities
      const { data: linkedProjects } = await supabase
        .from("projects")
        .select("id, project_number, project_name, project_address, customer_first_name, customer_last_name")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .or(
          oppIds.map(id => `opportunity_uuid.eq.${id}`).join(',') + 
          (oppGhlIds.length ? ',' + oppGhlIds.map(id => `opportunity_id.eq.${id}`).join(',') : '')
        );

      opportunityProjects = linkedProjects || [];
    }
  }

  // Step 3: Merge and deduplicate
  const projectMap = new Map<string, Project>();
  [...(directProjects || []), ...opportunityProjects].forEach(p => {
    if (!projectMap.has(p.id)) {
      projectMap.set(p.id, p);
    }
  });

  const allProjects = Array.from(projectMap.values())
    .sort((a, b) => (b.project_number || 0) - (a.project_number || 0));

  // Fetch portal tokens for combined projects...
}
```

### 4. Update Parent Component Props

In `SalespersonCalendarPortal.tsx`, update the `PortalProjectLinksSection` usage:

```typescript
<PortalProjectLinksSection 
  salespersonName={salesperson.name} 
  salespersonId={salesperson.id}           // ADD
  salespersonGhlUserId={salesperson.ghl_user_id}  // ADD
  companyId={salesperson.company_id} 
/>
```

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/salesperson-portal/PortalProjectLinksSection.tsx` | Add new props, update query logic to include opportunity-linked projects |
| `src/pages/SalespersonCalendarPortal.tsx` | Pass `salespersonId` and `salespersonGhlUserId` props |

## Query Key Update

Update the query key to include all relevant identifiers for proper cache invalidation:

```typescript
queryKey: ["salesperson-portal-project-links", salespersonName, salespersonId, salespersonGhlUserId, companyId]
```

## Expected Outcome

After this change, salespeople like Brendan G will see all projects where:
1. They are directly assigned as primary/secondary/tertiary/quaternary salesperson
2. The project is linked to an opportunity that is assigned to them (via `ghl_user_id`)

This will include projects #46, #47, #48, #50 for Brendan G's portal.
