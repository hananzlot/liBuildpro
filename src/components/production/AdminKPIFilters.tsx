import { DateRange } from "react-day-picker";
import { DateRangeFilter } from "@/components/dashboard/DateRangeFilter";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

interface AdminKPIFiltersProps {
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
}

export function AdminKPIFilters({
  dateRange,
  onDateRangeChange,
}: AdminKPIFiltersProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-muted-foreground font-medium">KPI Filter:</span>
      <DateRangeFilter
        dateRange={dateRange}
        onDateRangeChange={onDateRangeChange}
        className="!gap-1"
      />
      {dateRange && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs"
          onClick={() => onDateRangeChange(undefined)}
        >
          <RotateCcw className="h-3 w-3 mr-1" />
          Reset
        </Button>
      )}
    </div>
  );
}
