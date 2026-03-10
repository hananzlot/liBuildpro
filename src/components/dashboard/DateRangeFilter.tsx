import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DateRangeFilterProps {
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
  className?: string;
}

const PRESETS = [
  { label: "All Dates", value: "all", days: -2 },
  { label: "Today", value: "today", days: 0 },
  { label: "Last 7 Days", value: "7d", days: 7 },
  { label: "Last 14 Days", value: "14d", days: 14 },
  { label: "Last 30 Days", value: "30d", days: 30 },
  { label: "Last 60 Days", value: "60d", days: 60 },
  { label: "Last 90 Days", value: "90d", days: 90 },
  { label: "Year to Date", value: "ytd", days: -1 },
  { label: "Custom Range", value: "custom", days: -3 },
];

export function DateRangeFilter({ 
  dateRange, 
  onDateRangeChange, 
  className 
}: DateRangeFilterProps) {
  const [customPickerOpen, setCustomPickerOpen] = React.useState(false);

  const handlePresetChange = (value: string) => {
    if (value === "all") {
      onDateRangeChange(undefined);
      return;
    }

    if (value === "custom") {
      setCustomPickerOpen(true);
      return;
    }

    if (value === "ytd") {
      const end = new Date();
      const start = new Date(end.getFullYear(), 0, 1);
      onDateRangeChange({ from: start, to: end });
      return;
    }

    if (value === "today") {
      const today = new Date();
      const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
      onDateRangeChange({ from: start, to: end });
      return;
    }

    const preset = PRESETS.find(p => p.value === value);
    if (preset && preset.days > 0) {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - preset.days);
      onDateRangeChange({ from: start, to: end });
    }
  };

  const getActivePreset = (): string => {
    if (!dateRange?.from || !dateRange?.to) return "all";
    
    const today = new Date();
    const fromDate = dateRange.from;
    const toDate = dateRange.to;

    // Check if it's "Today"
    if (
      fromDate.toDateString() === today.toDateString() &&
      toDate.toDateString() === today.toDateString()
    ) {
      return "today";
    }

    // Check YTD
    const yearStart = new Date(today.getFullYear(), 0, 1);
    if (
      fromDate.toDateString() === yearStart.toDateString() &&
      toDate.toDateString() === today.toDateString()
    ) {
      return "ytd";
    }

    // Check day presets
    for (const preset of PRESETS) {
      if (preset.days > 0) {
        const expectedStart = new Date();
        expectedStart.setDate(today.getDate() - preset.days);
        if (
          fromDate.toDateString() === expectedStart.toDateString() &&
          toDate.toDateString() === today.toDateString()
        ) {
          return preset.value;
        }
      }
    }

    return "custom";
  };

  const activePreset = getActivePreset();

  const getDisplayLabel = (): string => {
    if (activePreset === "all") return "All Dates";
    if (activePreset === "custom" && dateRange?.from && dateRange?.to) {
      return `${format(dateRange.from, "MMM d")} - ${format(dateRange.to, "MMM d, yyyy")}`;
    }
    const preset = PRESETS.find(p => p.value === activePreset);
    return preset?.label || "All Dates";
  };

  return (
    <div className={cn("flex items-center gap-2 flex-wrap", className)}>
      <Select value={activePreset} onValueChange={handlePresetChange}>
        <SelectTrigger className="w-[200px] h-9">
          <SelectValue placeholder="All Dates">{getDisplayLabel()}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {PRESETS.map((preset) => (
            <SelectItem key={preset.value} value={preset.value}>
              {preset.value === "custom" ? (
                <span className="flex items-center gap-1.5">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {preset.label}
                </span>
              ) : (
                preset.label
              )}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Popover open={customPickerOpen} onOpenChange={setCustomPickerOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn("h-9", activePreset !== "custom" && "hidden")}
          >
            <CalendarIcon className="h-4 w-4 mr-1" />
            {dateRange?.from && dateRange?.to
              ? `${format(dateRange.from, "MMM d")} - ${format(dateRange.to, "MMM d")}`
              : "Pick dates"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={dateRange?.from}
            selected={dateRange}
            onSelect={(range) => {
              onDateRangeChange(range);
              if (range?.from && range?.to) {
                setCustomPickerOpen(false);
              }
            }}
            numberOfMonths={2}
            className="p-3 pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
