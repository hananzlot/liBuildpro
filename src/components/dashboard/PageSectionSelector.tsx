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

// Map page size + position to section numbers (12 sections total, 3 columns x 4 rows)
// Grid layout:
// [1]  [2]  [3]
// [4]  [5]  [6]
// [7]  [8]  [9]
// [10] [11] [12]

const getSectionsForSelection = (
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
      if (position === "top-left") return [1, 4, 2];
      if (position === "top-right") return [2, 3, 5];
      if (position === "bottom-left") return [7, 10, 8];
      if (position === "bottom-right") return [8, 9, 11];
      return [];
    default:
      return [];
  }
};

// Detect page size and position from sections
const detectFromSections = (
  sections: number[]
): { pageSize: PageSize | ""; position: string } => {
  const sorted = [...sections].sort((a, b) => a - b);
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

// Check if a position is available (no sold sections overlap)
const isPositionAvailable = (
  pageSize: PageSize,
  position: string,
  soldSections: number[]
): boolean => {
  const sections = getSectionsForSelection(pageSize, position as any);
  return !sections.some((s) => soldSections.includes(s));
};

export const PageSectionSelector = ({
  selectedSections,
  onSectionsChange,
  soldSections = [],
  disabled = false,
}: PageSectionSelectorProps) => {
  const detected = detectFromSections(selectedSections);
  const pageSize = detected.pageSize as PageSize | "";
  const position = detected.position;

  const handlePageSizeChange = (newSize: PageSize) => {
    if (newSize === "full") {
      // Full page - set all 12 sections
      onSectionsChange(getSectionsForSelection("full"));
    } else {
      // Clear sections, user needs to select position
      onSectionsChange([]);
    }
  };

  const handlePositionChange = (newPosition: string) => {
    if (!pageSize || pageSize === "full") return;
    const sections = getSectionsForSelection(pageSize, newPosition as any);
    onSectionsChange(sections);
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

  const getSectionLabel = (count: number) => {
    if (count === 0) return "None";
    if (count === 12) return "Full Page";
    if (count === 6) return "1/2 Page";
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

      {/* Visual Preview */}
      <div className="flex items-center gap-4">
        <div className="grid grid-cols-3 gap-1 p-2 rounded-lg border-2 border-border bg-card">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((section) => {
            const isSold = soldSections.includes(section);
            const isSelected = selectedSections.includes(section);
            return (
              <div
                key={section}
                title={
                  isSold
                    ? `Section ${section}: Already sold`
                    : isSelected
                    ? `Section ${section}: Selected`
                    : `Section ${section}: Available`
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
                {section}
              </div>
            );
          })}
        </div>

        <div className="text-sm">
          <p className="font-medium text-foreground">
            {getSectionLabel(selectedSections.length)}
          </p>
          <p className="text-muted-foreground">
            {selectedSections.length}/12 sections selected
          </p>
          {soldSections.length > 0 && (
            <p className="text-red-500 text-xs mt-1">
              {soldSections.length} section(s) already sold
            </p>
          )}
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
          <span>Selected</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-red-500 border border-red-600" />
          <span>Already Sold</span>
        </div>
      </div>
    </div>
  );
};
