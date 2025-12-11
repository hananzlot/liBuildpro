import { Building2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type LocationFilterValue = "all" | "location1" | "location2";

interface LocationFilterProps {
  value: LocationFilterValue;
  onChange: (value: LocationFilterValue) => void;
  location1Name?: string;
  location2Name?: string;
}

export function LocationFilter({
  value,
  onChange,
  location1Name = "CA Pro Builders",
  location2Name = "Location 2",
}: LocationFilterProps) {
  return (
    <div className="flex items-center gap-2">
      <Building2 className="h-4 w-4 text-muted-foreground" />
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-[180px] h-9">
          <SelectValue placeholder="Select location" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Locations</SelectItem>
          <SelectItem value="location1">{location1Name}</SelectItem>
          <SelectItem value="location2">{location2Name}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
