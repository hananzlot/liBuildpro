import { DateRange } from "react-day-picker";
import { DateRangeFilter } from "@/components/dashboard/DateRangeFilter";
import { MultiSelectFilter } from "@/components/dashboard/MultiSelectFilter";
import { Button } from "@/components/ui/button";
import { Download, FolderKanban, Users } from "lucide-react";

interface AnalyticsFiltersProps {
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
  selectedProjects: string[];
  onProjectsChange: (projects: string[]) => void;
  selectedSalespeople: string[];
  onSalespeopleChange: (salespeople: string[]) => void;
  projectOptions: { value: string; label: string }[];
  salespeopleOptions: { value: string; label: string }[];
  onExport?: () => void;
}

export function AnalyticsFilters({
  dateRange,
  onDateRangeChange,
  selectedProjects,
  onProjectsChange,
  selectedSalespeople,
  onSalespeopleChange,
  projectOptions,
  salespeopleOptions,
  onExport,
}: AnalyticsFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-card border rounded-lg">
      <DateRangeFilter
        dateRange={dateRange}
        onDateRangeChange={onDateRangeChange}
      />
      
      <MultiSelectFilter
        options={projectOptions}
        selected={selectedProjects}
        onChange={onProjectsChange}
        placeholder="All Projects"
        icon={<FolderKanban className="h-3.5 w-3.5" />}
        className="w-[180px]"
      />
      
      <MultiSelectFilter
        options={salespeopleOptions}
        selected={selectedSalespeople}
        onChange={onSalespeopleChange}
        placeholder="All Salespeople"
        icon={<Users className="h-3.5 w-3.5" />}
        className="w-[180px]"
      />

      {onExport && (
        <Button variant="outline" size="sm" onClick={onExport} className="ml-auto">
          <Download className="h-4 w-4 mr-1" />
          Export CSV
        </Button>
      )}
    </div>
  );
}
