import { useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

type PageSize = "full" | "half" | "third" | "quarter";

interface PageSectionSelectorProps {
  selectedSections: number[];
  onSectionsChange: (sections: number[]) => void;
  soldSections?: number[];
  disabled?: boolean;
  pageSize: PageSize | "";
  onPageSizeChange: (size: PageSize) => void;
  existingPageSizes?: string[]; // Page sizes already sold on this page
}

// 12 buyer slots per page
// Grid layout:
// [1]  [2]  [3]
// [4]  [5]  [6]
// [7]  [8]  [9]
// [10] [11] [12]

const ALL_SLOTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

// Get the next available slot (first green box)
const getNextAvailableSlot = (soldSlots: number[]): number | null => {
  for (const slot of ALL_SLOTS) {
    if (!soldSlots.includes(slot)) {
      return slot;
    }
  }
  return null; // Page is full
};

// Determine allowed page sizes based on existing sales
// Rules:
// - Full page already sold → only Full allowed
// - Half page already sold → only 1/2, 1/3, 1/4 allowed
// - 1/3 page already sold → only 1/3 allowed
// - 1/4 page already sold → only 1/4 and 1/2 allowed
const getAllowedPageSizes = (existingPageSizes: string[]): PageSize[] => {
  if (existingPageSizes.length === 0) {
    // No existing sales, all sizes allowed
    return ["full", "half", "third", "quarter"];
  }

  // Normalize existing sizes
  const normalizedSizes = existingPageSizes.map(s => {
    const lower = s.toLowerCase();
    if (lower === "full" || lower === "cover" || lower === "back page") return "full";
    if (lower === "1/2" || lower === "half") return "half";
    if (lower === "1/3" || lower === "third") return "third";
    if (lower === "1/4" || lower === "quarter") return "quarter";
    return lower;
  });

  // Check what's already sold
  const hasFullPage = normalizedSizes.includes("full");
  const hasHalfPage = normalizedSizes.includes("half");
  const hasThirdPage = normalizedSizes.includes("third");
  const hasQuarterPage = normalizedSizes.includes("quarter");

  // Apply rules
  if (hasFullPage) {
    // Only full page allowed after a full page sale
    return ["full"];
  }

  if (hasThirdPage) {
    // Only 1/3 allowed after a 1/3 sale
    return ["third"];
  }

  if (hasHalfPage && hasQuarterPage) {
    // Both half and quarter exist, only those two allowed
    return ["half", "quarter"];
  }

  if (hasHalfPage) {
    // Half page sold → 1/2, 1/3, 1/4 allowed
    return ["half", "third", "quarter"];
  }

  if (hasQuarterPage) {
    // 1/4 sold → only 1/4 and 1/2 allowed
    return ["quarter", "half"];
  }

  return ["full", "half", "third", "quarter"];
};

export const PageSectionSelector = ({
  selectedSections,
  onSectionsChange,
  soldSections = [],
  disabled = false,
  pageSize,
  onPageSizeChange,
  existingPageSizes = [],
}: PageSectionSelectorProps) => {
  
  // Calculate allowed page sizes based on existing sales
  const allowedPageSizes = useMemo(() => {
    return getAllowedPageSizes(existingPageSizes);
  }, [existingPageSizes]);

  // Auto-assign the next available slot when page size is selected and no slot is assigned yet
  useEffect(() => {
    if (pageSize && selectedSections.length === 0) {
      const nextSlot = getNextAvailableSlot(soldSections);
      if (nextSlot !== null) {
        onSectionsChange([nextSlot]);
      }
    }
  }, [pageSize, selectedSections.length, soldSections, onSectionsChange]);

  const handlePageSizeChange = (newSize: PageSize) => {
    onPageSizeChange(newSize);
    
    // Auto-assign next available slot
    const nextSlot = getNextAvailableSlot(soldSections);
    if (nextSlot !== null) {
      onSectionsChange([nextSlot]);
    }
  };

  const getPageSizeLabel = (size: PageSize | "") => {
    switch (size) {
      case "full": return "Full Page";
      case "half": return "Half Page";
      case "third": return "1/3 Page";
      case "quarter": return "1/4 Page";
      default: return "";
    }
  };

  const availableSlots = ALL_SLOTS.filter(s => !soldSections.includes(s));
  const isPageFull = availableSlots.length === 0;

  const pageSizeOptions: { value: PageSize; label: string }[] = [
    { value: "full", label: "Full Page" },
    { value: "half", label: "Half Page (1/2)" },
    { value: "third", label: "1/3 Page" },
    { value: "quarter", label: "1/4 Page" },
  ];

  return (
    <div className="space-y-4">
      {/* Page Size Selection */}
      <div className="space-y-2">
        <Label>Page Size Sold *</Label>
        <Select
          value={pageSize}
          onValueChange={(value) => handlePageSizeChange(value as PageSize)}
          disabled={disabled || isPageFull}
        >
          <SelectTrigger>
            <SelectValue placeholder={isPageFull ? "Page is full (12 slots)" : "Select page size"} />
          </SelectTrigger>
          <SelectContent>
            {pageSizeOptions.map((option) => {
              const isAllowed = allowedPageSizes.includes(option.value);
              return (
                <SelectItem 
                  key={option.value} 
                  value={option.value}
                  disabled={!isAllowed}
                >
                  {option.label}
                  {!isAllowed && " (not compatible)"}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        {existingPageSizes.length > 0 && allowedPageSizes.length < 4 && (
          <p className="text-xs text-muted-foreground">
            Options limited based on existing sales on this page
          </p>
        )}
      </div>

      {/* Visual Preview - Buyer Slots Grid */}
      <div className="space-y-2">
        <Label className="text-muted-foreground text-xs">Page Buyer Slots (12 max per page)</Label>
        <div className="flex items-center gap-4">
          <div className="grid grid-cols-3 gap-1 p-2 rounded-lg border-2 border-border bg-card">
            {ALL_SLOTS.map((slot) => {
              const isSold = soldSections.includes(slot);
              const isSelected = selectedSections.includes(slot);
              return (
                <div
                  key={slot}
                  title={
                    isSold
                      ? `Slot ${slot}: Sold to another buyer`
                      : isSelected
                      ? `Slot ${slot}: This sale`
                      : `Slot ${slot}: Available`
                  }
                  className={cn(
                    "w-6 h-6 rounded border-2 flex items-center justify-center font-medium text-xs",
                    isSold
                      ? "bg-red-500 border-red-600 text-white"
                      : isSelected
                      ? "bg-primary border-primary text-primary-foreground"
                      : "bg-emerald-100 border-emerald-300 text-emerald-800 dark:bg-emerald-900/30 dark:border-emerald-700 dark:text-emerald-300"
                  )}
                >
                  {slot}
                </div>
              );
            })}
          </div>

          <div className="text-sm">
            {pageSize && (
              <p className="font-medium text-foreground">
                {getPageSizeLabel(pageSize)}
              </p>
            )}
            <p className="text-muted-foreground">
              {soldSections.length} of 12 slots sold
            </p>
            {selectedSections.length > 0 && (
              <p className="text-primary text-xs mt-1">
                Assigning slot #{selectedSections[0]}
              </p>
            )}
            {isPageFull && (
              <p className="text-red-500 text-xs mt-1">
                Page is full - no more buyers can be added
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300 dark:bg-emerald-900/30 dark:border-emerald-700" />
          <span>Available</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-primary border border-primary" />
          <span>This Sale</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-red-500 border border-red-600" />
          <span>Other Buyers</span>
        </div>
      </div>
    </div>
  );
};
