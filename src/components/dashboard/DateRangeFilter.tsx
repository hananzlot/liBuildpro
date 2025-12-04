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

interface DateRangeFilterProps {
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
  className?: string;
}

export function DateRangeFilter({ 
  dateRange, 
  onDateRangeChange, 
  className 
}: DateRangeFilterProps) {
  const handlePreset = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    onDateRangeChange({ from: start, to: end });
  };

  const handleClear = () => {
    onDateRangeChange(undefined);
  };

  return (
    <div className={cn("flex items-center gap-2 flex-wrap", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "justify-start text-left font-normal min-w-[240px]",
              !dateRange && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {dateRange?.from ? (
              dateRange.to ? (
                <>
                  {format(dateRange.from, "MMM d, yyyy")} -{" "}
                  {format(dateRange.to, "MMM d, yyyy")}
                </>
              ) : (
                format(dateRange.from, "MMM d, yyyy")
              )
            ) : (
              <span>All time</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={dateRange?.from}
            selected={dateRange}
            onSelect={onDateRangeChange}
            numberOfMonths={2}
            className="p-3 pointer-events-auto"
          />
        </PopoverContent>
      </Popover>

      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handlePreset(14)}
          className="text-xs"
        >
          14D
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handlePreset(7)}
          className="text-xs"
        >
          7D
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handlePreset(30)}
          className="text-xs"
        >
          30D
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handlePreset(60)}
          className="text-xs"
        >
          60D
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handlePreset(90)}
          className="text-xs"
        >
          90D
        </Button>
        {dateRange && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="text-xs text-muted-foreground"
          >
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}