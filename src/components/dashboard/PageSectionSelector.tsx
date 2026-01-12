import { useEffect } from "react";
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

export const PageSectionSelector = ({
  selectedSections,
  onSectionsChange,
  soldSections = [],
  disabled = false,
  pageSize,
  onPageSizeChange,
}: PageSectionSelectorProps) => {
  
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
            <SelectValue placeholder={isPageFull ? "Page is full (12 buyers)" : "Select page size"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="full">Full Page</SelectItem>
            <SelectItem value="half">Half Page (1/2)</SelectItem>
            <SelectItem value="third">1/3 Page</SelectItem>
            <SelectItem value="quarter">1/4 Page</SelectItem>
          </SelectContent>
        </Select>
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
