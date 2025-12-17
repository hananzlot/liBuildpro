import { cn } from "@/lib/utils";

interface PageSectionSelectorProps {
  selectedSections: number[];
  onSectionsChange: (sections: number[]) => void;
  soldSections?: number[]; // Sections already sold (disabled)
  disabled?: boolean;
}

export const PageSectionSelector = ({
  selectedSections,
  onSectionsChange,
  soldSections = [],
  disabled = false,
}: PageSectionSelectorProps) => {
  const toggleSection = (section: number) => {
    if (disabled || soldSections.includes(section)) return;

    if (selectedSections.includes(section)) {
      onSectionsChange(selectedSections.filter((s) => s !== section));
    } else {
      onSectionsChange([...selectedSections, section].sort((a, b) => a - b));
    }
  };

  const getSectionLabel = (count: number) => {
    if (count === 0) return "None";
    if (count === 8) return "Full Page";
    if (count === 6) return "3/4 Page";
    if (count === 4) return "1/2 Page";
    if (count === 2) return "1/4 Page";
    if (count === 1) return "1/8 Page";
    return `${count}/8 Page`;
  };

  const selectPreset = (count: number) => {
    if (disabled) return;
    
    // Find available sections (not sold)
    const available = [1, 2, 3, 4, 5, 6, 7, 8].filter((s) => !soldSections.includes(s));
    const toSelect = available.slice(0, count);
    onSectionsChange(toSelect);
  };

  return (
    <div className="space-y-3">
      {/* Quick select presets */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: "1/8", count: 1 },
          { label: "1/4", count: 2 },
          { label: "1/2", count: 4 },
          { label: "3/4", count: 6 },
          { label: "Full", count: 8 },
        ].map((preset) => {
          const availableCount = 8 - soldSections.length;
          const isDisabled = disabled || preset.count > availableCount;
          return (
            <button
              key={preset.label}
              type="button"
              onClick={() => selectPreset(preset.count)}
              disabled={isDisabled}
              className={cn(
                "px-3 py-1 text-xs font-medium rounded-md border transition-colors",
                selectedSections.length === preset.count
                  ? "bg-primary text-primary-foreground border-primary"
                  : isDisabled
                  ? "bg-muted text-muted-foreground border-border cursor-not-allowed opacity-50"
                  : "bg-card text-foreground border-border hover:bg-accent"
              )}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      {/* Visual section selector */}
      <div className="flex items-center gap-4">
        <div className="grid grid-cols-2 gap-1 p-2 rounded-lg border-2 border-border bg-card">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((section) => {
            const isSold = soldSections.includes(section);
            const isSelected = selectedSections.includes(section);
            return (
              <button
                key={section}
                type="button"
                onClick={() => toggleSection(section)}
                disabled={disabled || isSold}
                title={
                  isSold
                    ? `Section ${section}: Already sold`
                    : isSelected
                    ? `Section ${section}: Click to deselect`
                    : `Section ${section}: Click to select`
                }
                className={cn(
                  "w-8 h-8 rounded border-2 transition-all font-medium text-xs",
                  isSold
                    ? "bg-red-500 border-red-600 text-white cursor-not-allowed"
                    : isSelected
                    ? "bg-primary border-primary text-primary-foreground"
                    : "bg-emerald-100 border-emerald-300 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:border-emerald-700 dark:text-emerald-300"
                )}
              >
                {section}
              </button>
            );
          })}
        </div>

        <div className="text-sm">
          <p className="font-medium text-foreground">
            {getSectionLabel(selectedSections.length)}
          </p>
          <p className="text-muted-foreground">
            {selectedSections.length}/8 sections selected
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
