/**
 * Card-First CRM Design System — barrel export
 *
 * Import everything from here for consistency:
 *   import { Card, CardBody, PageHeader, BadgePill, ... } from "@/components/ui/design-system";
 */

// Layout primitives
export { Card, CardHeader, CardBody, CardContent, CardFooter, CardTitle, CardDescription } from "./card";
export { Button, buttonVariants, IconButton } from "./button";
export type { ButtonProps } from "./button";

// Page-level
export { PageHeader } from "./page-header";

// Filters & controls
export { FilterBar, FilterChips } from "./filter-bar";

// Status / stage badges
export { BadgePill, statusToIntent } from "./badge-pill";

// List / table wrappers
export { DataListCard, DataListCardHeader, DataListCardBody, DataListCardFooter } from "./data-list-card";

// Drawers
export { DetailsDrawer, useDetailsDrawerParam } from "./details-drawer";

// Feedback
export { EmptyState } from "./empty-state";

// Spacing scale (Tailwind-compatible values)
export const SPACING = {
  xs: "1",   // 4px
  sm: "2",   // 8px
  md: "3",   // 12px
  lg: "4",   // 16px
  xl: "6",   // 24px
  "2xl": "8",  // 32px
  "3xl": "10", // 40px
} as const;

// Typography presets (classes)
export const TYPOGRAPHY = {
  title: "text-xl font-semibold tracking-tight text-foreground",
  section: "text-sm font-semibold text-foreground",
  body: "text-sm text-foreground",
  muted: "text-sm text-muted-foreground",
  micro: "text-[11px] text-muted-foreground",
} as const;
