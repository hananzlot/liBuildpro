import { useState, useEffect } from "react";
import { Check, ChevronsUpDown, Building2, X } from "lucide-react";
import { useAuth, Company } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";

export function CompanySwitcher() {
  const { 
    isSuperAdmin, 
    company, 
    viewingCompanyId, 
    setViewingCompanyId, 
    isViewingOtherCompany 
  } = useAuth();
  
  const [open, setOpen] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch all companies for super admins
  useEffect(() => {
    if (!isSuperAdmin) return;
    
    const fetchCompanies = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .eq("is_active", true)
        .order("name");
      
      if (!error && data) {
        setCompanies(data as Company[]);
      }
      setIsLoading(false);
    };
    
    fetchCompanies();
  }, [isSuperAdmin]);

  if (!isSuperAdmin) return null;

  const selectedCompany = viewingCompanyId 
    ? companies.find(c => c.id === viewingCompanyId)
    : null;

  const handleSelect = (companyId: string) => {
    setViewingCompanyId(companyId);
    setOpen(false);
  };

  const handleReset = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewingCompanyId(null);
  };

  // Show a prompt if no company is selected
  const noCompanySelected = !viewingCompanyId;

  return (
    <div className="px-2 py-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between text-left font-normal h-auto py-2",
              noCompanySelected && "border-destructive/50 bg-destructive/5",
              viewingCompanyId && "border-amber-500/50 bg-amber-500/5"
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="flex flex-col min-w-0">
                <span className="text-xs text-muted-foreground">
                  {noCompanySelected ? "Select Company" : "Working on:"}
                </span>
                <span className={cn(
                  "text-sm font-medium truncate",
                  noCompanySelected && "text-destructive"
                )}>
                  {selectedCompany?.name || "No company selected"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {viewingCompanyId && (
                <Badge 
                  variant="outline" 
                  className="h-5 px-1.5 text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/30 cursor-pointer hover:bg-amber-500/20"
                  onClick={handleReset}
                >
                  <X className="h-3 w-3" />
                </Badge>
              )}
              <ChevronsUpDown className="h-4 w-4 opacity-50" />
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search companies..." />
            <CommandList>
              <CommandEmpty>
                {isLoading ? "Loading..." : "No companies found."}
              </CommandEmpty>
              <CommandGroup>
                {companies.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={c.name}
                    onSelect={() => handleSelect(c.id)}
                    className="flex items-center gap-2"
                  >
                    <div className="flex h-6 w-6 items-center justify-center rounded bg-muted text-xs font-medium shrink-0">
                      {c.name.substring(0, 2).toUpperCase()}
                    </div>
                    <span className="truncate flex-1">{c.name}</span>
                    <Check
                      className={cn(
                        "h-4 w-4 shrink-0",
                        viewingCompanyId === c.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
