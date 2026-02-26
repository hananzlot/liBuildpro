import { useState, useEffect } from "react";
import { Check, ChevronsUpDown, Building2, X, Layers } from "lucide-react";
import { useAuth, Company } from "@/contexts/AuthContext";
import { useUnifiedMode } from "@/hooks/useUnifiedMode";
import { useAppTabs } from "@/contexts/AppTabsContext";
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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export function CompanySwitcher() {
  const { 
    isSuperAdmin, 
    isCorpAdmin,
    company, 
    corporationId,
    viewingCompanyId, 
    setViewingCompanyId, 
    isViewingOtherCompany 
  } = useAuth();
  
  const { canUnify, isUnified, toggleUnified } = useUnifiedMode();
  const { closeAllTabs } = useAppTabs();
  
  const [open, setOpen] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const canSwitch = isSuperAdmin || isCorpAdmin;

  // Fetch companies: all for super admins, corporation-scoped for corp admins
  useEffect(() => {
    if (!canSwitch) return;
    
    const fetchCompanies = async () => {
      setIsLoading(true);
      
      let query = supabase
        .from("companies")
        .select("*")
        .eq("is_active", true)
        .order("name");
      
      // Corp admins only see companies in their corporation
      if (!isSuperAdmin && isCorpAdmin && company?.corporation_id) {
        query = query.eq("corporation_id", company.corporation_id);
      }
      
      const { data, error } = await query;
      
      if (!error && data) {
        setCompanies(data as Company[]);
      }
      setIsLoading(false);
    };
    
    fetchCompanies();
  }, [canSwitch, isSuperAdmin, isCorpAdmin, company?.corporation_id]);

  if (!canSwitch) return null;

  const selectedCompany = viewingCompanyId 
    ? companies.find(c => c.id === viewingCompanyId)
    : company;

  const handleSelect = (companyId: string) => {
    // Close all tabs before switching company context
    closeAllTabs();
    // If selecting their own company, reset the override
    if (!isSuperAdmin && companyId === company?.id) {
      setViewingCompanyId(null);
    } else {
      setViewingCompanyId(companyId);
    }
    setOpen(false);
  };

  const handleReset = (e: React.MouseEvent) => {
    e.stopPropagation();
    closeAllTabs();
    setViewingCompanyId(null);
  };

  // Super admins must select a company; corp admins default to their own
  const noCompanySelected = isSuperAdmin && !viewingCompanyId;
  const isOverriding = viewingCompanyId !== null;
  const label = isUnified ? "Unified:" : (isSuperAdmin ? "Working on:" : "Viewing:");
  const displayName = isUnified 
    ? "All Companies" 
    : (selectedCompany?.name || (noCompanySelected ? "No company selected" : company?.name || "—"));

  return (
    <div className="px-3 py-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between text-left font-normal h-auto py-2 bg-sidebar-surface-hover border-sidebar-border text-sidebar-foreground hover:bg-sidebar-surface-active hover:text-sidebar-foreground",
              noCompanySelected && "border-destructive/50 bg-destructive/10",
              isOverriding && "border-blue-500/50 bg-blue-500/10"
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Building2 className="h-4 w-4 shrink-0 text-sidebar-muted-foreground" />
              <div className="flex flex-col min-w-0">
                <span className="text-[11px] text-sidebar-muted-foreground">
                  {noCompanySelected ? "Select Company" : label}
                </span>
                <span className={cn(
                  "text-sm font-medium truncate",
                  noCompanySelected && "text-destructive"
                )}>
                  {displayName}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {isOverriding && (
                <Badge 
                  variant="outline" 
                  className="h-5 px-1.5 text-[10px] bg-blue-500/10 text-blue-400 border-blue-500/30 cursor-pointer hover:bg-blue-500/20"
                  onClick={handleReset}
                >
                  <X className="h-3 w-3" />
                </Badge>
              )}
              <ChevronsUpDown className="h-4 w-4 text-sidebar-muted-foreground opacity-70" />
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
                {companies.map((c) => {
                  const isActive = viewingCompanyId 
                    ? viewingCompanyId === c.id 
                    : company?.id === c.id;
                  return (
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
                          isActive ? "opacity-100" : "opacity-0"
                        )}
                      />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Unified View Toggle for Corp Admins */}
      {canUnify && (
        <div className="flex items-center justify-between gap-2 px-1 pt-1.5">
          <div className="flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-sidebar-muted-foreground" />
            <Label htmlFor="unified-toggle" className="text-xs text-sidebar-muted-foreground cursor-pointer">
              Unified View
            </Label>
          </div>
          <Switch
            id="unified-toggle"
            checked={isUnified}
            onCheckedChange={toggleUnified}
            className="scale-75"
          />
        </div>
      )}
    </div>
  );
}
