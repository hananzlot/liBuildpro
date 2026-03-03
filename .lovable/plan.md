

## Updated Plan: Soft-delete project on estimate deletion (only if no sibling estimates)

### Problem
When an estimate is deleted, its linked project remains orphaned — but only if that was the **last** estimate on the project. Projects can have multiple estimates (confirmed: up to 8 in production data).

### Approach
In the `deleteMutation` in `src/pages/Estimates.tsx`, after deleting the estimate:

1. If the deleted estimate had a `project_id`, query how many **remaining** estimates still reference that project.
2. If zero remain, call `soft_delete_early_stage_project(project_id)` to archive the project.
3. If other estimates still exist, leave the project alone.
4. Invalidate project/production query caches so the UI updates.

### Changes

**File: `src/pages/Estimates.tsx`**

Inside the `deleteMutation.mutationFn`, after the estimate row is deleted and before opportunity value recalculation:

```typescript
// After deleting the estimate row...

// If project was linked, check if any other estimates still reference it
if (projectId) {
  const { count } = await supabase
    .from("estimates")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);

  if (count === 0) {
    // No remaining estimates — soft-delete the project if early-stage
    await supabase.rpc("soft_delete_early_stage_project", {
      p_project_id: projectId,
    });
  }
}
```

In `onSuccess`, add cache invalidation for projects:
```typescript
queryClient.invalidateQueries({ queryKey: ["projects"] });
queryClient.invalidateQueries({ queryKey: ["production"] });
```

No database changes needed — `soft_delete_early_stage_project` RPC already exists and handles status validation and access control.

