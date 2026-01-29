
# Plan: Add Job History Tab to AI Queue

## Overview
Add a tabbed interface to the AI Queue Sheet that separates **Active** jobs (pending/processing) from **Past** jobs (completed/failed), allowing admins to view the history of all AI generation requests.

---

## Current State
- The AI Queue Sheet only displays jobs with status `pending` or `processing`
- The `estimate_generation_jobs` table already stores all job history including `completed` and `failed` statuses
- Jobs have `completed_at` and `error_message` fields that can be displayed in the history view

---

## Implementation

### 1. Update the Hook to Fetch History

**File:** `src/hooks/useAIGenerationQueue.ts`

Add a separate query for past jobs:
- Query jobs with status `completed` or `failed`
- Order by `completed_at` descending (most recent first)
- Limit to last 50 jobs to keep the list manageable
- Include duration calculation (completed_at - started_at)

### 2. Add Tabs to the Queue Sheet

**File:** `src/components/admin/AIQueueSheet.tsx`

Modify the Sheet to include two tabs:
- **Active** tab: Current pending/processing jobs (existing view)
- **History** tab: Past completed/failed jobs

### 3. History Tab Features

| Column | Description |
|--------|-------------|
| Project | Address and estimate number |
| Status | Completed (green) or Failed (red) with error tooltip |
| Duration | Time from started_at to completed_at |
| Completed | Timestamp when job finished |
| User | Who submitted the request |
| Actions | View estimate button |

---

## Technical Details

### Hook Changes
```text
// New query for history
const { data: historyJobs = [], isLoading: isLoadingHistory } = useQuery({
  queryKey: ["ai-generation-history", companyId],
  queryFn: async () => {
    // Fetch jobs with status completed/failed
    // Order by completed_at DESC
    // Limit 50
  }
});
```

### UI Structure
```text
<Sheet>
  <SheetContent>
    <SheetHeader>...</SheetHeader>
    
    <Tabs defaultValue="active">
      <TabsList>
        <TabsTrigger value="active">
          Active {activeCount > 0 && <Badge>{activeCount}</Badge>}
        </TabsTrigger>
        <TabsTrigger value="history">History</TabsTrigger>
      </TabsList>
      
      <TabsContent value="active">
        {/* Existing active jobs table */}
      </TabsContent>
      
      <TabsContent value="history">
        {/* New history table with completed/failed jobs */}
      </TabsContent>
    </Tabs>
  </SheetContent>
</Sheet>
```

### History Row Display
- **Completed jobs**: Green badge, show duration
- **Failed jobs**: Red badge with error message tooltip, show duration if available
- **Duration format**: "2m 34s" or "1h 5m" depending on length

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useAIGenerationQueue.ts` | Add `historyJobs` query and `isLoadingHistory` state |
| `src/components/admin/AIQueueSheet.tsx` | Add Tabs component with Active and History views |

---

## User Experience
1. Open AI Queue from sidebar badge or admin settings
2. Default view shows **Active** tab with current queue
3. Click **History** tab to see past 50 completed/failed jobs
4. Failed jobs show error message on hover
5. Click eye icon to navigate to the estimate
