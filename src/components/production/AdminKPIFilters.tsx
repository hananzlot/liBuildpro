import { DateRange } from "react-day-picker";
import { DateRangeFilter } from "@/components/dashboard/DateRangeFilter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MultiSelectFilter } from "@/components/dashboard/MultiSelectFilter";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { RotateCcw, Search, Filter } from "lucide-react";

// All available project statuses (fallback when no DB statuses exist)
export const PROJECT_STATUSES = ["Estimate", "Pre-Estimate", "Proposal", "New Job", "Awaiting Finance", "In-Progress", "On-Hold", "Completed", "Cancelled"];

// Default statuses - excludes Estimate, Pre-Estimate and Proposal
export const DEFAULT_PROJECT_STATUSES = ["New Job", "Awaiting Finance", "In-Progress", "Completed"];

interface AdminKPIFiltersProps {
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  selectedStatuses?: string[];
  onStatusesChange?: (statuses: string[]) => void;
  dynamicStatuses?: string[];
}

export function AdminKPIFilters({
  dateRange,
  onDateRangeChange,
  searchQuery = "",
  onSearchChange,
  selectedStatuses = DEFAULT_PROJECT_STATUSES,
  onStatusesChange,
  dynamicStatuses,
}: AdminKPIFiltersProps) {
  const allStatuses = dynamicStatuses && dynamicStatuses.length > 0 ? dynamicStatuses : PROJECT_STATUSES;
  const statusOptions = allStatuses.map(status => ({
    value: status,
    label: status,
  }));

  return (
    <div className="flex items-center gap-3 flex-wrap justify-between">
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
      
      {onSearchChange && onStatusesChange && (
        <div className="flex items-center gap-2 flex-wrap">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, address, or amount..."
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="pl-10 w-72 h-9"
                />
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              <p className="text-xs">Search by project name, address, customer, salesperson, project manager, or enter an amount to find matching invoices, phases, bills, and payments.</p>
            </TooltipContent>
          </Tooltip>
          <MultiSelectFilter
            options={statusOptions}
            selected={selectedStatuses}
            onChange={onStatusesChange}
            placeholder="Status"
            icon={<Filter className="h-3.5 w-3.5" />}
            className="w-[160px]"
          />
        </div>
      )}
    </div>
  );
}
