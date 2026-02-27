import { useState, useMemo, useRef } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown, X, Search } from "lucide-react";

interface Option {
  value: string;
  label: string;
}

interface MultiSelectFilterProps {
  options: Option[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder: string;
  icon?: React.ReactNode;
  className?: string;
  onAddNew?: (value: string) => void;
  addNewLabel?: string;
}

export function MultiSelectFilter({
  options,
  selected,
  onChange,
  placeholder,
  icon,
  className = "w-[160px]",
  onAddNew,
  addNewLabel = "Add new...",
}: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddNew, setShowAddNew] = useState(false);
  const [newValue, setNewValue] = useState("");
  const addNewInputRef = useRef<HTMLInputElement>(null);

  // Filter options based on search query
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const query = searchQuery.toLowerCase();
    return options.filter((option) =>
      option.label.toLowerCase().includes(query)
    );
  }, [options, searchQuery]);

  const handleToggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const handleSelectAll = () => {
    // Select/deselect only filtered options
    const filteredValues = filteredOptions.map((o) => o.value);
    const allFilteredSelected = filteredValues.every((v) => selected.includes(v));
    
    if (allFilteredSelected) {
      // Deselect filtered options
      onChange(selected.filter((v) => !filteredValues.includes(v)));
    } else {
      // Select all filtered options (add to existing selection)
      const newSelected = [...new Set([...selected, ...filteredValues])];
      onChange(newSelected);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setSearchQuery("");
      setShowAddNew(false);
      setNewValue("");
    }
  };

  const getDisplayText = () => {
    if (selected.length === 0) return placeholder;
    if (selected.length === 1) {
      const option = options.find((o) => o.value === selected[0]);
      return option?.label || selected[0];
    }
    return `${selected.length} selected`;
  };

  const filteredValues = filteredOptions.map((o) => o.value);
  const allFilteredSelected = filteredValues.length > 0 && filteredValues.every((v) => selected.includes(v));

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`h-8 text-xs justify-between bg-background border-border ${className}`}
        >
          <span className="flex items-center gap-1 truncate">
            {icon}
            {getDisplayText()}
          </span>
          <span className="flex items-center gap-1 ml-1">
            {selected.length > 0 && (
              <X
                className="h-3 w-3 opacity-50 hover:opacity-100"
                onClick={handleClear}
              />
            )}
            <ChevronDown className="h-3 w-3 opacity-50" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0 bg-popover border-border" align="start">
        {/* Search input */}
        <div className="p-2 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Type to filter..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-7 text-xs bg-background"
            />
          </div>
        </div>
        <div className="p-2 border-b border-border">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-xs h-7"
            onClick={handleSelectAll}
          >
            {allFilteredSelected ? "Deselect All" : "Select All"}
            {searchQuery && ` (${filteredOptions.length})`}
          </Button>
        </div>
        <ScrollArea className="h-[200px]">
          <div className="p-2 space-y-1">
            {filteredOptions.length === 0 ? (
              <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                No matches found
              </div>
            ) : (
              filteredOptions.map((option) => (
                <div
                  key={option.value}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer"
                  onClick={() => handleToggle(option.value)}
                >
                  <Checkbox
                    checked={selected.includes(option.value)}
                    onCheckedChange={() => handleToggle(option.value)}
                    className="h-4 w-4"
                  />
                  <span className="text-sm truncate">{option.label}</span>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
        {onAddNew && (
          <div className="border-t border-border p-2">
            {showAddNew ? (
              <div className="flex gap-1.5">
                <Input
                  ref={addNewInputRef}
                  placeholder={addNewLabel}
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  className="h-7 text-xs"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newValue.trim()) {
                      onAddNew(newValue.trim());
                      setNewValue("");
                      setShowAddNew(false);
                    } else if (e.key === 'Escape') {
                      setShowAddNew(false);
                      setNewValue("");
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => {
                    if (newValue.trim()) {
                      onAddNew(newValue.trim());
                      setNewValue("");
                      setShowAddNew(false);
                    }
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-start text-xs h-7 text-muted-foreground"
                onClick={() => setShowAddNew(true)}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                {addNewLabel}
              </Button>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
