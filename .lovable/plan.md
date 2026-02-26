

## Problem

The split-view (PDF + finance content) uses `h-full` but the parent `TabsContent` and `SheetContent` use `overflow-y-auto` with no fixed height constraint, so the panels don't expand to fill the viewport.

## Plan

**1. Make the split-view use viewport height directly**

In `FinanceSection.tsx`, change the `ResizablePanelGroup` wrapper (around line 3949) to use `h-[calc(100vh-120px)]` instead of just `h-full min-h-0`. The `120px` offset accounts for the sheet header, tabs bar, and tab content margin. This ensures both panels fill the available screen height regardless of screen size.

**2. Ensure the parent doesn't constrain it**

On the `TabsContent` for finance (line 1919 in `ProjectDetailSheet.tsx`), add `overflow-hidden` when the PDF viewer is active so the parent scroll doesn't interfere. Alternatively, the simpler approach is to just set a viewport-relative height on the `ResizablePanelGroup` itself since it's already conditionally rendered.

**Implementation detail:**
```tsx
// FinanceSection.tsx ~line 3949
<ResizablePanelGroup direction="horizontal" className="h-[calc(100vh-8rem)] min-h-[400px]">
```

This single CSS change makes both panels dynamically fill the user's screen height, minus a small offset for the header/tabs chrome.

