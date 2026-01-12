import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

type PageSize = "full" | "half" | "third" | "quarter";
type HalfPosition = "top" | "bottom";
type ThirdPosition = "left" | "center" | "right";
type QuarterPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";

interface PageSectionSelectorProps {
  selectedSections: number[];
  onSectionsChange: (sections: number[]) => void;
  soldSections?: number[];
  disabled?: boolean;
}

// Map page size + position to ad slot numbers (12 slots total, 3 columns x 4 rows)
// Each slot represents a potential buyer position on the page
// Grid layout:
// [1]  [2]  [3]
// [4]  [5]  [6]
// [7]  [8]  [9]
// [10] [11] [12]

const getSlotsForSelection = (
  pageSize: PageSize,
  position?: HalfPosition | ThirdPosition | QuarterPosition
): number[] => {
  switch (pageSize) {
    case "full":
      return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    case "half":
      if (position === "top") return [1, 2, 3, 4, 5, 6];
      if (position === "bottom") return [7, 8, 9, 10, 11, 12];
      return [];
    case "third":
      if (position === "left") return [1, 4, 7, 10];
      if (position === "center") return [2, 5, 8, 11];
      if (position === "right") return [3, 6, 9, 12];
      return [];
    case "quarter":
      if (position === "top-left") return [1, 2, 4];
      if (position === "top-right") return [2, 3, 5];
      if (position === "bottom-left") return [7, 8, 10];
      if (position === "bottom-right") return [8, 9, 11];
      return [];
    default:
      return [];
  }
};

// Detect page size and position from slots
const detectFromSlots = (
  slots: number[]
): { pageSize: PageSize | ""; position: string } => {
  const sorted = [...slots].sort((a, b) => a - b);
  const key = sorted.join(",");

  // Full page
  if (key === "1,2,3,4,5,6,7,8,9,10,11,12") return { pageSize: "full", position: "" };

  // Half page
  if (key === "1,2,3,4,5,6") return { pageSize: "half", position: "top" };
  if (key === "7,8,9,10,11,12") return { pageSize: "half", position: "bottom" };

  // Third page
  if (key === "1,4,7,10") return { pageSize: "third", position: "left" };
  if (key === "2,5,8,11") return { pageSize: "third", position: "center" };
  if (key === "3,6,9,12") return { pageSize: "third", position: "right" };

  // Quarter page
  if (key === "1,2,4") return { pageSize: "quarter", position: "top-left" };
  if (key === "2,3,5") return { pageSize: "quarter", position: "top-right" };
  if (key === "7,8,10") return { pageSize: "quarter", position: "bottom-left" };
  if (key === "8,9,11") return { pageSize: "quarter", position: "bottom-right" };

  return { pageSize: "", position: "" };
};

// Check if a position is available (no sold slots overlap)
const isPositionAvailable = (
  pageSize: PageSize,
  position: string,
  soldSlots: number[]
): boolean => {
  const slots = getSlotsForSelection(pageSize, position as any);
  return !slots.some((s) => soldSlots.includes(s));
};

export const PageSectionSelector = ({
  selectedSections,
  onSectionsChange,
  soldSections = [],
  disabled = false,
}: PageSectionSelectorProps) => {
  // Maintain internal state for pageSize and position
  const [pageSize, setPageSize] = useState<PageSize | "">("");
  const [position, setPosition] = useState<string>("");
  
  // Track if change is internal to prevent useEffect from resetting state
  const isInternalChange = useRef(false);
  const prevSectionsRef = useRef<string>("");

  // Sync state from selectedSections only for external changes (e.g., editing existing data or page change)
  useEffect(() => {
    const currentKey = selectedSections.sort((a, b) => a - b).join(",");
    
    // Skip if this was an internal change
    if (isInternalChange.current) {
      isInternalChange.current = false;
      prevSectionsRef.current = currentKey;
      return;
    }
    
    // Only update if sections actually changed from external source
    if (currentKey !== prevSectionsRef.current) {
      prevSectionsRef.current = currentKey;
      
      if (selectedSections.length > 0) {
        const detected = detectFromSlots(selectedSections);
        if (detected.pageSize) {
          setPageSize(detected.pageSize);
          setPosition(detected.position);
        }
      } else {
        // External reset (e.g., page number changed)
        setPageSize("");
        setPosition("");
      }
    }
  }, [selectedSections]);

  const handlePageSizeChange = (newSize: PageSize) => {
    setPageSize(newSize);
    setPosition(""); // Reset position when size changes
    
    // Mark as internal change to prevent useEffect from resetting
    isInternalChange.current = true;
    
    if (newSize === "full") {
      // Full page - set all 12 slots immediately
      onSectionsChange(getSlotsForSelection("full"));
    } else {
      // Clear slots, user needs to select position
      onSectionsChange([]);
    }
  };

  const handlePositionChange = (newPosition: string) => {
    if (!pageSize || pageSize === "full") return;
    setPosition(newPosition);
    
    // Mark as internal change to prevent useEffect from resetting
    isInternalChange.current = true;
    
    const slots = getSlotsForSelection(pageSize, newPosition as any);
    onSectionsChange(slots);
  };

  const getPositionOptions = () => {
    switch (pageSize) {
      case "half":
        return [
          { value: "top", label: "Top" },
          { value: "bottom", label: "Bottom" },
        ];
      case "third":
        return [
          { value: "left", label: "Left" },
          { value: "center", label: "Center" },
          { value: "right", label: "Right" },
        ];
      case "quarter":
        return [
          { value: "top-left", label: "Top Left" },
          { value: "top-right", label: "Top Right" },
          { value: "bottom-left", label: "Bottom Left" },
          { value: "bottom-right", label: "Bottom Right" },
        ];
      default:
        return [];
    }
  };

  const positionOptions = getPositionOptions();

  const getPageSizeLabel = (count: number) => {
    if (count === 0) return "None selected";
    if (count === 12) return "Full Page";
    if (count === 6) return "Half Page";
    if (count === 4) return "1/3 Page";
    if (count === 3) return "1/4 Page";
    return `${count}/12 Page`;
  };

  return (
    <div className="space-y-4">
      {/* Page Size Selection */}
      <div className="space-y-2">
        <Label>Page Size Sold *</Label>
        <Select
          value={pageSize}
          onValueChange={(value) => handlePageSizeChange(value as PageSize)}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select page size" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="full" disabled={!isPositionAvailable("full", "", soldSections)}>
              Full Page
            </SelectItem>
            <SelectItem value="half">Half Page (1/2)</SelectItem>
            <SelectItem value="third">1/3 Page</SelectItem>
            <SelectItem value="quarter">1/4 Page</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Position Selection - only show if pageSize requires it */}
      {pageSize && pageSize !== "full" && positionOptions.length > 0 && (
        <div className="space-y-2">
          <Label>Position *</Label>
          <Select
            value={position}
            onValueChange={handlePositionChange}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select position" />
            </SelectTrigger>
            <SelectContent>
              {positionOptions.map((opt) => (
                <SelectItem
                  key={opt.value}
                  value={opt.value}
                  disabled={!isPositionAvailable(pageSize, opt.value, soldSections)}
                >
                  {opt.label}
                  {!isPositionAvailable(pageSize, opt.value, soldSections) && " (Sold)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Visual Preview - Ad Slots Grid */}
      <div className="space-y-2">
        <Label className="text-muted-foreground text-xs">Page Ad Slots Preview</Label>
        <div className="flex items-center gap-4">
          <div className="grid grid-cols-3 gap-1 p-2 rounded-lg border-2 border-border bg-card">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((slot) => {
              const isSold = soldSections.includes(slot);
              const isSelected = selectedSections.includes(slot);
              return (
                <div
                  key={slot}
                  title={
                    isSold
                      ? `Slot ${slot}: Already sold to another buyer`
                      : isSelected
                      ? `Slot ${slot}: Your selection`
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
            <p className="font-medium text-foreground">
              {getPageSizeLabel(selectedSections.length)}
            </p>
            <p className="text-muted-foreground">
              {selectedSections.length} of 12 ad slots
            </p>
            {soldSections.length > 0 && (
              <p className="text-red-500 text-xs mt-1">
                {soldSections.length} slot(s) sold to other buyers
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
          <span>Your Selection</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-red-500 border border-red-600" />
          <span>Sold to Other Buyer</span>
        </div>
      </div>
    </div>
  );
};
