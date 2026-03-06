import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Megaphone, User, Calendar, Search, ChevronRight, Clock, Plus, CheckSquare, MapPin, Phone, FileText, Loader2, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { OpportunityDetailSheet } from "./OpportunityDetailSheet";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { findContactByIdOrGhlId, formatCurrency } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useStageBadgeMappings } from "@/hooks/useStageBadgeMappings";

// Helper to get PST/PDT offset in hours (uses UTC methods for correctness)
const getPSTOffset = (utcDate: Date): number => {
  // DST in US: second Sunday of March to first Sunday of November
  const year = utcDate.getUTCFullYear();
  const marchSecondSunday = new Date(Date.UTC(year, 2, 8 + (7 - new Date(Date.UTC(year, 2, 1)).getUTCDay()) % 7, 10)); // 2 AM PST = 10 AM UTC
  const novFirstSunday = new Date(Date.UTC(year, 10, 1 + (7 - new Date(Date.UTC(year, 10, 1)).getUTCDay()) % 7, 9)); // 2 AM PDT = 9 AM UTC
  const isDST = utcDate >= marchSecondSunday && utcDate < novFirstSunday;
  return isDST ? 7 : 8; // PDT is UTC-7, PST is UTC-8
};

interface Contact {
  id: string;
  ghl_id: string;
  contact_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  ghl_date_added: string | null;
  custom_fields?: unknown;
  assigned_to?: string | null;
  attributions?: unknown;
  tags?: string[] | null;
  location_id?: string;
  company_id?: string | null;
}

interface Opportunity {
  id?: string;
  ghl_id: string;
  name: string | null;
  status: string | null;
  monetary_value: number | null;
  contact_id: string | null;
  contact_uuid: string | null;
  assigned_to: string | null;
  ghl_date_added: string | null;
  ghl_date_updated: string | null;
  stage_name: string | null;
  pipeline_name: string | null;
  pipeline_id: string | null;
  pipeline_stage_id: string | null;
  address: string | null;
  scope_of_work: string | null;
  company_id?: string | null;
}

interface Appointment {
  id?: string;
  ghl_id: string;
  title: string | null;
  appointment_status: string | null;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  contact_id: string | null;
  contact_uuid: string | null;
  assigned_user_id: string | null;
}

interface GHLUser {
  id?: string;
  ghl_id: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

interface ContactNote {
  id: string;
  ghl_id?: string | null;
  contact_id: string;
  body: string | null;
  ghl_date_added: string | null;
  user_id?: string | null;
}

// Import is already at top - use findContactByIdOrGhlId from utils

type ViewMode = "opportunities" | "won";

interface SourceDetailSheetProps {
  source: string | null;
  mode: ViewMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacts: Contact[];
  filteredContacts: Contact[];
  opportunities: Opportunity[];
  filteredOpportunities: Opportunity[];
  appointments: Appointment[];
  filteredAppointments: Appointment[];
  users: GHLUser[];
  showAppointments?: boolean;
  showNoAppointments?: boolean;
  userId?: string | null;
  notes?: ContactNote[];
}

export function SourceDetailSheet({
  source,
  mode,
  open,
  onOpenChange,
  contacts,
  filteredContacts,
  opportunities,
  filteredOpportunities,
  appointments,
  filteredAppointments,
  users,
  showAppointments = false,
  showNoAppointments = false,
  userId,
  notes = [],
}: SourceDetailSheetProps) {
  const { user, companyId: authCompanyId } = useAuth();
  const queryClient = useQueryClient();
  
  // Badge mappings from Admin Settings
  const effectiveCompanyId = authCompanyId || opportunities[0]?.company_id || filteredOpportunities[0]?.company_id || null;
  const { mappings: badgeMappings, isConfigured: hasBadgeMappings, getCountForBadge, filterByBadge } = useStageBadgeMappings(effectiveCompanyId);
  
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("date");
  const [searchFilter, setSearchFilter] = useState("");
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [oppSheetOpen, setOppSheetOpen] = useState(false);
  
  // Task creation state
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [taskOpp, setTaskOpp] = useState<Opportunity | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskNotes, setTaskNotes] = useState("");
  const [taskAssignee, setTaskAssignee] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskDueTime, setTaskDueTime] = useState("");
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  
  // Stage change state
  const [updatingStageForOpp, setUpdatingStageForOpp] = useState<string | null>(null);
  const [configuredStages, setConfiguredStages] = useState<string[]>([]);


  const normalizePipelineStages = useCallback((rawSettingValue: string): string[] => {
    // company_settings.setting_value might be a JSON array string (preferred)
    // but we also support a legacy comma-separated string.
    let stages: string[] = [];

    try {
      const parsed = JSON.parse(rawSettingValue);
      if (Array.isArray(parsed)) {
        stages = parsed.map((s) => String(s));
      } else if (typeof parsed === "string") {
        stages = parsed.split(",");
      }
    } catch {
      stages = rawSettingValue.split(",");
    }

    const seen = new Set<string>();
    const result: string[] = [];
    for (const stage of stages) {
      const cleaned = String(stage).trim().replace(/\s+/g, " ");
      if (!cleaned) continue;
      const key = cleaned.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(cleaned);
    }
    return result;
  }, []);

  // Fetch configured pipeline stages from company_settings ONLY
  useEffect(() => {
    const fetchConfiguredStages = async () => {
      // Always reset when opening to avoid showing stages from a previous company context
      setConfiguredStages([]);

      // Derive company ID from multiple sources for robustness
      const companyId = authCompanyId || 
        opportunities[0]?.company_id || 
        filteredOpportunities[0]?.company_id ||
        filteredContacts[0]?.company_id || 
        null;
      

      
      if (!companyId) {
        console.warn("[SourceDetailSheet] No company ID available to fetch pipeline stages");
        return;
      }
      
      const { data, error } = await supabase
        .from("company_settings")
        .select("setting_value")
        .eq("company_id", companyId)
        .eq("setting_key", "pipeline_stages")
        .maybeSingle();
      
      if (error) {
        console.error("[SourceDetailSheet] Error fetching pipeline stages:", error);
        return;
      }
      

      
      if (data?.setting_value) {
        try {
          const stages = normalizePipelineStages(data.setting_value);

          setConfiguredStages(stages);
        } catch (e) {
          console.error("Failed to parse pipeline_stages:", e);
        }
      } else {
        console.warn("[SourceDetailSheet] No pipeline_stages setting found for company:", companyId);
      }
    };
    
    if (open) {
      fetchConfiguredStages();
    }
  }, [open, authCompanyId, opportunities, filteredOpportunities, filteredContacts, normalizePipelineStages]);

  // Reset filters when sheet opens - default to "all" status
  useEffect(() => {
    if (open) {
      setStatusFilter("all");
      setStageFilter("all");
      setSearchFilter("");
    }
  }, [open]);

  const getStatusColor = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case "won": return "bg-emerald-500/20 text-emerald-400";
      case "lost":
      case "abandoned": return "bg-red-500/20 text-red-400";
      case "open": return "bg-blue-500/20 text-blue-400";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const openTaskDialog = (opp: Opportunity, e: React.MouseEvent) => {
    e.stopPropagation();
    setTaskOpp(opp);
    const contact = findContactByIdOrGhlId(contacts, opp.contact_uuid, opp.contact_id);
    const contactName = contact?.contact_name || 
      `${contact?.first_name || ""} ${contact?.last_name || ""}`.trim() || "";
    setTaskTitle(`Follow up: ${opp.name || contactName || "Opportunity"}`);
    setTaskNotes("");
    setTaskAssignee(opp.assigned_to || "__unassigned__");
    setTaskDueDate("");
    setTaskDueTime("09:00");
    setTaskDialogOpen(true);
  };

  const handleCreateTask = async () => {
    if (!taskOpp || !taskTitle.trim()) {
      toast.error("Please enter a task title");
      return;
    }

    setIsCreatingTask(true);
    try {
      // Get location_id from contact
      const contact = findContactByIdOrGhlId(contacts, taskOpp.contact_uuid, taskOpp.contact_id);
      const locationId = contact?.location_id || "pVeFrqvtYWNIPRIi0Fmr";

      const assignedToValue = taskAssignee && taskAssignee !== "__unassigned__" ? taskAssignee : null;
      
      // Combine date and time, treating input as PST
      let dueDateValue: string | null = null;
      if (taskDueDate) {
        const timeStr = taskDueTime || "09:00";
        // Treat input as PST: parse as UTC first, then add PST offset to get actual UTC
        const pstOffset = getPSTOffset(new Date(`${taskDueDate}T12:00:00Z`));
        const tempUtcDate = new Date(`${taskDueDate}T${timeStr}:00.000Z`);
        const utcDate = new Date(tempUtcDate.getTime() + pstOffset * 60 * 60 * 1000);
        dueDateValue = utcDate.toISOString();
      }

      // Create task (saves to Supabase, syncs to GHL if connected)
      const ghlResponse = await supabase.functions.invoke('create-ghl-task', {
        body: {
          title: taskTitle.trim(),
          body: taskNotes.trim() || null,
          dueDate: dueDateValue,
          assignedTo: assignedToValue,
          contactId: taskOpp.contact_id,
          locationId: locationId,
          enteredBy: userId || null,
        }
      });

      if (ghlResponse.error) {
        console.error('Task creation error:', ghlResponse.error);
        toast.error("Failed to create task");
      } else {

        toast.success("Task created");
      }

      setTaskDialogOpen(false);
      setTaskOpp(null);
      setTaskTitle("");
      setTaskNotes("");
      setTaskAssignee("");
      setTaskDueDate("");
      setTaskDueTime("");
    } catch (err) {
      console.error("Error creating task:", err);
      toast.error("Failed to create task");
    } finally {
      setIsCreatingTask(false);
    }
  };

  // Helper to normalize source names (same logic as in useGHLContacts)
  const normalizeSourceName = (sourceName: string): string => {
    if (!sourceName) return "Direct";
    return sourceName
      .toLowerCase()
      .split(/[\s-_]+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Get contacts for this source within the date range (normalized matching)
  const sourceContactsInDateRange = useMemo(() => {
    return filteredContacts.filter(c => normalizeSourceName(c.source || "Direct") === source);
  }, [filteredContacts, source]);

  const sourceContactIdsInDateRange = useMemo(() => {
    // For "won" mode, get contact IDs from won opportunities that match this source
    if (mode === "won") {
      const contactKeysFromWonOpps = new Set(
        filteredOpportunities
          .filter(o => o.status?.toLowerCase() === "won")
          .flatMap(o => [o.contact_id, o.contact_uuid].filter(Boolean) as string[])
      );
      const matchingContactKeys = new Set<string>();
      contacts.forEach(c => {
        const hasMatch = (c.ghl_id && contactKeysFromWonOpps.has(c.ghl_id)) || contactKeysFromWonOpps.has(c.id);
        if (hasMatch && normalizeSourceName(c.source || "Direct") === source) {
          if (c.ghl_id) matchingContactKeys.add(c.ghl_id);
          matchingContactKeys.add(c.id);
        }
      });
      return matchingContactKeys;
    }
    // For opportunities mode, use ALL contacts matching this source (not just date-filtered)
    // because opportunities are already date-filtered, and a contact may have been created
    // before the date range but still have opportunities created within it
    const keys = new Set<string>();
    contacts.forEach(c => {
      if (normalizeSourceName(c.source || "Direct") === source) {
        if (c.ghl_id) keys.add(c.ghl_id);
        keys.add(c.id);
      }
    });
    return keys;
  }, [mode, filteredOpportunities, contacts, source]);

  // Keep all contacts for "No Appointments" check (need to know if contact EVER had appointments)
  const allSourceContacts = useMemo(() => {
    return contacts.filter(c => normalizeSourceName(c.source || "Direct") === source);
  }, [contacts, source]);

  const allSourceContactIds = useMemo(() => {
    const keys = new Set<string>();
    allSourceContacts.forEach(c => {
      if (c.ghl_id) keys.add(c.ghl_id);
      keys.add(c.id);
    });
    return keys;
  }, [allSourceContacts]);

  // Get appointments for this source - match appointments by contact AND by start_time within date range
  // Use ALL appointments (not just filteredAppointments) and filter by contact in source
  const sourceAppointments = useMemo(() => {
    return appointments
      .filter(a => {
        const key = a.contact_id || a.contact_uuid;
        return key && sourceContactIdsInDateRange.has(key);
      })
      .filter(a => a.appointment_status?.toLowerCase() !== 'cancelled');
  }, [appointments, sourceContactIdsInDateRange]);

  // Get contact IDs that have appointments (for "Appointments" view - use filtered)
  const contactIdsWithFilteredAppointments = useMemo(() => {
    const ids = new Set<string>();
    sourceAppointments.forEach(a => {
      if (a.contact_id) ids.add(a.contact_id);
      if (a.contact_uuid) ids.add(a.contact_uuid);
    });
    return ids;
  }, [sourceAppointments]);

  // Get contact IDs that have ANY appointments ever (for "No Appointments" view - use all appointments)
  const contactIdsWithAnyAppointments = useMemo(() => {
    const ids = new Set<string>();
    appointments
      .filter(a => a.appointment_status?.toLowerCase() !== 'cancelled')
      .forEach(a => {
        if (a.contact_id) ids.add(a.contact_id);
        if (a.contact_uuid) ids.add(a.contact_uuid);
      });
    return ids;
  }, [appointments]);

  // Get opportunities for this source (use filtered opportunities, filtered by contacts in date range)
  const sourceOpportunities = useMemo(() => {
    return filteredOpportunities
      .filter(o => {
        const key = o.contact_id || o.contact_uuid;
        return key && sourceContactIdsInDateRange.has(key);
      })
      .filter(o => o.stage_name?.toLowerCase() !== 'quickbase');
  }, [filteredOpportunities, sourceContactIdsInDateRange]);

  // Unique appointments count (unique by appointment ghl_id)
  const uniqueAppointmentsCount = useMemo(() => {
    const uniqueIds = new Set(sourceAppointments.map(a => a.ghl_id));
    return uniqueIds.size;
  }, [sourceAppointments]);


  // Filter based on mode and search
  const displayOpportunities = useMemo(() => {
    let opps = sourceOpportunities;
    
    // When viewing appointments tab, only show contacts that have appointments (in date range)
    if (showAppointments) {
      opps = opps.filter(o => {
        const key = o.contact_id || o.contact_uuid;
        return key && contactIdsWithFilteredAppointments.has(key);
      });
    }
    
    // When viewing no appointments tab, only show contacts WITHOUT ANY appointments ever
    if (showNoAppointments) {
      opps = opps.filter(o => {
        const key = o.contact_id || o.contact_uuid;
        return key && !contactIdsWithAnyAppointments.has(key);
      });
    }
    
    if (mode === "won") {
      opps = opps.filter(o => o.status?.toLowerCase() === "won");
    }
    
    if (statusFilter !== "all") {
      opps = opps.filter(o => o.status?.toLowerCase() === statusFilter);
    }

    if (stageFilter !== "all") {
      // Check if stageFilter is a configured badge name
      const badgeMapping = badgeMappings.find(m => m.badgeName === stageFilter);
      if (badgeMapping) {
        // Filter by badge (stages associated with this badge)
        opps = filterByBadge(stageFilter, opps);
      } else {
        // Legacy hardcoded matching for backwards compatibility when no mappings configured
        if (stageFilter === "no contact") {
          opps = opps.filter(o => o.stage_name?.toLowerCase().includes("no contact") || o.stage_name?.toLowerCase().includes("not contacted"));
        } else if (stageFilter === "no answer") {
          opps = opps.filter(o => o.stage_name?.toLowerCase().includes("no answer") || o.stage_name?.toLowerCase().includes("never answer"));
        } else {
          opps = opps.filter(o => o.stage_name === stageFilter);
        }
      }
    }
    
    if (searchFilter.trim()) {
      const term = searchFilter.toLowerCase();
      opps = opps.filter(o => {
        const contact = findContactByIdOrGhlId(contacts, o.contact_uuid, o.contact_id);
        const contactName = contact?.contact_name || `${contact?.first_name || ""} ${contact?.last_name || ""}`.trim();
        return o.name?.toLowerCase().includes(term) || contactName.toLowerCase().includes(term);
      });
    }
    
    // Sort based on selected option
    return opps.sort((a, b) => {
      switch (sortBy) {
        case "stage":
          return (a.stage_name || "").localeCompare(b.stage_name || "");
        case "value":
          return (b.monetary_value || 0) - (a.monetary_value || 0);
        case "status":
          return (a.status || "").localeCompare(b.status || "");
        case "date":
        default:
          return new Date(b.ghl_date_added || 0).getTime() - new Date(a.ghl_date_added || 0).getTime();
      }
    });
  }, [sourceOpportunities, mode, statusFilter, stageFilter, sortBy, searchFilter, contacts, showAppointments, showNoAppointments, contactIdsWithFilteredAppointments, contactIdsWithAnyAppointments, badgeMappings, filterByBadge]);

  // Available statuses - "open" first, then alphabetically
  const availableStatuses = useMemo(() => {
    const statuses = new Set(sourceOpportunities.map(o => o.status?.toLowerCase() || "unknown"));
    return Array.from(statuses).sort((a, b) => {
      if (a === "open") return -1;
      if (b === "open") return 1;
      return a.localeCompare(b);
    });
  }, [sourceOpportunities]);

  // Available stages
  const availableStages = useMemo(() => {
    const stages = new Set(sourceOpportunities.map(o => o.stage_name).filter(Boolean) as string[]);
    return Array.from(stages).sort();
  }, [sourceOpportunities]);

  // Totals
  const totalValue = displayOpportunities.reduce((sum, o) => sum + (o.monetary_value || 0), 0);
  const wonValue = sourceOpportunities
    .filter(o => o.status?.toLowerCase() === "won")
    .reduce((sum, o) => sum + (o.monetary_value || 0), 0);

  const handleOpportunityClick = (opp: Opportunity) => {
    setSelectedOpportunity(opp);
    setOppSheetOpen(true);
  };

  // Use configured stages from company_settings (Main pipeline only)
  const allAvailableStages = useMemo(() => {
    // Stages should ONLY come from company_settings
    return configuredStages;
  }, [configuredStages]);

  // Handle inline stage change
  const handleStageChange = async (opp: Opportunity, newStageName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!opp.ghl_id || newStageName === opp.stage_name) return;
    
    setUpdatingStageForOpp(opp.ghl_id);
    try {
      // Build stage map from opportunities
      const stageMapForPipeline = new Map<string, string>();
      opportunities.forEach(o => {
        if (o.stage_name && o.pipeline_stage_id && o.pipeline_id === opp.pipeline_id) {
          stageMapForPipeline.set(o.stage_name, o.pipeline_stage_id);
        }
      });
      const newStageId = stageMapForPipeline.get(newStageName) || "";
      
      const { data, error } = await supabase.functions.invoke("update-ghl-opportunity", {
        body: {
          ghl_id: opp.ghl_id,
          opportunity_uuid: opp.id,
          stage_name: newStageName,
          pipeline_stage_id: newStageId,
          edited_by: user?.id || null
        }
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      toast.success("Stage updated");
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
    } catch (error) {
      console.error("Error updating stage:", error);
      toast.error("Failed to update stage");
    } finally {
      setUpdatingStageForOpp(null);
    }
  };

  if (!source) return null;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-xl p-0">
          <div className="sticky top-0 bg-background border-b p-4">
            <SheetHeader>
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Megaphone className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <SheetTitle className="text-lg">{source}</SheetTitle>
                  <SheetDescription>
                    {showAppointments 
                      ? `${uniqueAppointmentsCount} unique appointments scheduled`
                      : showNoAppointments
                        ? `${displayOpportunities.length} opportunities without appointments`
                        : mode === "opportunities" 
                          ? `${sourceOpportunities.length} opportunities • ${sourceOpportunities.filter(o => o.status?.toLowerCase() === "won").length} won`
                          : `${displayOpportunities.length} won • ${formatCurrency(wonValue)}`
                    }
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>
          </div>

          <div className="p-4 space-y-3">
            {/* Compact Summary Stats */}
            {showAppointments ? (
              <div className="flex items-center gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Appointments: </span>
                  <span className="font-medium">{uniqueAppointmentsCount}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Contacts: </span>
                  <span className="font-medium">{new Set(sourceAppointments.map(a => a.contact_id)).size}</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-x-1 gap-y-1 text-sm">
                <button
                  onClick={() => { setStatusFilter("all"); setStageFilter("all"); }}
                  className={`px-2 py-0.5 rounded-md transition-colors ${statusFilter === "all" && stageFilter === "all" ? "bg-primary/20 text-primary" : "hover:bg-muted"}`}
                >
                  <span className="text-muted-foreground">All: </span>
                  <span className="font-medium">{sourceOpportunities.length}</span>
                </button>
                <button
                  onClick={() => { setStatusFilter("open"); setStageFilter("all"); }}
                  className={`px-2 py-0.5 rounded-md transition-colors ${statusFilter === "open" ? "bg-blue-500/20 text-blue-500" : "hover:bg-muted"}`}
                >
                  <span className="text-muted-foreground">Open: </span>
                  <span className="font-medium">{sourceOpportunities.filter(o => o.status?.toLowerCase() === "open").length}</span>
                </button>

                {/* Dynamic badge filters from Admin Settings */}
                {hasBadgeMappings ? (
                  badgeMappings.map(mapping => {
                    const count = getCountForBadge(mapping.badgeName, sourceOpportunities);
                    const colorClass = mapping.color === "red" ? "bg-red-500/20 text-red-500" :
                      mapping.color === "blue" ? "bg-blue-500/20 text-blue-500" :
                      mapping.color === "green" ? "bg-green-500/20 text-green-500" :
                      mapping.color === "purple" ? "bg-purple-500/20 text-purple-500" :
                      mapping.color === "orange" ? "bg-orange-500/20 text-orange-500" :
                      mapping.color === "teal" ? "bg-teal-500/20 text-teal-500" :
                      "bg-amber-500/20 text-amber-500";
                    return (
                      <button
                        key={mapping.badgeName}
                        onClick={() => { setStatusFilter("all"); setStageFilter(mapping.badgeName); }}
                        className={`px-2 py-0.5 rounded-md transition-colors ${stageFilter === mapping.badgeName ? colorClass : "hover:bg-muted"}`}
                      >
                        <span className="text-muted-foreground">{mapping.badgeName}: </span>
                        <span className={`font-medium ${stageFilter === mapping.badgeName ? "" : colorClass.split(" ")[1]}`}>{count}</span>
                      </button>
                    );
                  })
                ) : (
                  /* Legacy hardcoded badges when no mappings configured */
                  <>
                    <button
                      onClick={() => { setStatusFilter("all"); setStageFilter("no contact"); }}
                      className={`px-2 py-0.5 rounded-md transition-colors ${stageFilter === "no contact" ? "bg-amber-500/20 text-amber-500" : "hover:bg-muted"}`}
                    >
                      <span className="text-muted-foreground">No Contact: </span>
                      <span className="font-medium text-amber-500">{sourceOpportunities.filter(o => o.stage_name?.toLowerCase().includes("no contact") || o.stage_name?.toLowerCase().includes("not contacted")).length}</span>
                    </button>
                    <button
                      onClick={() => { setStatusFilter("all"); setStageFilter("no answer"); }}
                      className={`px-2 py-0.5 rounded-md transition-colors ${stageFilter === "no answer" ? "bg-amber-500/20 text-amber-500" : "hover:bg-muted"}`}
                    >
                      <span className="text-muted-foreground">No Answer: </span>
                      <span className="font-medium text-amber-500">{sourceOpportunities.filter(o => o.stage_name?.toLowerCase().includes("no answer") || o.stage_name?.toLowerCase().includes("never answer")).length}</span>
                    </button>
                  </>
                )}

                <div className="px-2 py-0.5">
                  <span className="text-muted-foreground">Appointments: </span>
                  <span className="font-medium">{uniqueAppointmentsCount}</span>
                </div>
                <button
                  onClick={() => { setStatusFilter("lost"); setStageFilter("all"); }}
                  className={`px-2 py-0.5 rounded-md transition-colors ${statusFilter === "lost" ? "bg-red-500/20 text-red-500" : "hover:bg-muted"}`}
                >
                  <span className="text-muted-foreground">Lost: </span>
                  <span className="font-medium text-red-500">{sourceOpportunities.filter(o => o.status?.toLowerCase() === "lost").length}</span>
                </button>
                <button
                  onClick={() => { setStatusFilter("won"); setStageFilter("all"); }}
                  className={`px-2 py-0.5 rounded-md transition-colors ${statusFilter === "won" ? "bg-emerald-500/20 text-emerald-500" : "hover:bg-muted"}`}
                >
                  <span className="text-muted-foreground">Won: </span>
                  <span className="font-medium text-emerald-500">{sourceOpportunities.filter(o => o.status?.toLowerCase() === "won").length}</span>
                </button>
                <div className="px-2 py-0.5">
                  <span className="text-muted-foreground">Won Value: </span>
                  <span className="font-medium text-emerald-500">{formatCurrency(wonValue)}</span>
                </div>
              </div>
            )}

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              {mode === "opportunities" && (
                <>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-8 w-24 text-xs">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      {availableStatuses.map(status => (
                        <SelectItem key={status} value={status} className="capitalize">
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={stageFilter} onValueChange={setStageFilter}>
                    <SelectTrigger className="h-8 w-32 text-xs">
                      <SelectValue placeholder="Stage" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Stages</SelectItem>
                      {availableStages.map(stage => (
                        <SelectItem key={stage} value={stage}>
                          {stage}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="h-8 w-28 text-xs">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">By Date</SelectItem>
                  <SelectItem value="stage">By Stage</SelectItem>
                  <SelectItem value="status">By Status</SelectItem>
                  <SelectItem value="value">By Value</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative flex-1 min-w-[120px]">
                <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="h-8 pl-8 text-xs"
                />
              </div>
            </div>

            {/* Opportunities List */}
            <ScrollArea className="h-[calc(100vh-350px)]">
              <div className="space-y-2">
                {displayOpportunities.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-8">
                    No {mode === "won" ? "won opportunities" : "opportunities"} found
                  </p>
                ) : (
                  displayOpportunities.map((opp) => {
                    const contact = findContactByIdOrGhlId(contacts, opp.contact_uuid, opp.contact_id);
                    const contactName = contact?.contact_name || 
                      `${contact?.first_name || ""} ${contact?.last_name || ""}`.trim() || "Unknown";
                    
                    // Get all appointments for this contact, sorted by date (newest first)
                    const contactAppointments = appointments
                      .filter(a => a.contact_id === opp.contact_id && a.start_time)
                      .sort((a, b) => new Date(b.start_time!).getTime() - new Date(a.start_time!).getTime());
                    
                    // Find upcoming appointment (today or future)
                    const now = new Date();
                    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    const upcomingAppt = contactAppointments.find(a => 
                      new Date(a.start_time!) >= startOfToday
                    );

                    const getApptStatusColor = (status: string | null) => {
                      switch (status?.toLowerCase()) {
                        case "showed": return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
                        case "confirmed": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
                        case "no show":
                        case "noshow":
                        case "cancelled": return "bg-red-500/20 text-red-400 border-red-500/30";
                        default: return "bg-muted text-muted-foreground";
                      }
                    };
                    
                    // Get the most recent note for this contact
                    const contactNotes = notes
                      .filter(n => n.contact_id === opp.contact_id && n.body)
                      .sort((a, b) => {
                        const dateA = a.ghl_date_added ? new Date(a.ghl_date_added).getTime() : 0;
                        const dateB = b.ghl_date_added ? new Date(b.ghl_date_added).getTime() : 0;
                        return dateB - dateA;
                      });
                    const latestNote = contactNotes[0];
                    
                    return (
                      <div
                        key={opp.ghl_id}
                        className="p-3 rounded-lg border bg-card hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => handleOpportunityClick(opp)}
                      >
                        {/* Row 1: Name + Stage Badge + Value + Status */}
                        <div className="flex items-center gap-2 mb-1.5">
                          {/* Left: Opportunity Name (truncated) */}
                          <span className="font-medium text-sm truncate flex-1 min-w-0">{opp.name || "Unnamed"}</span>
                          {/* Middle: Stage dropdown + Value */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <Badge 
                                  variant="secondary" 
                                  className="text-xs font-normal cursor-pointer hover:bg-secondary/80 transition-colors"
                                >
                                  {updatingStageForOpp === opp.ghl_id ? (
                                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                  ) : null}
                                  {opp.stage_name || "No Stage"}
                                </Badge>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="start"
                                className="max-h-64 overflow-y-auto bg-popover text-popover-foreground z-50 border border-border shadow-md"
                              >
                                {allAvailableStages.length === 0 ? (
                                  <DropdownMenuItem disabled>
                                    No pipeline stages configured
                                  </DropdownMenuItem>
                                ) : (
                                  allAvailableStages.map((stage) => (
                                    <DropdownMenuItem
                                      key={stage}
                                      onClick={(e) => handleStageChange(opp, stage, e)}
                                      className={opp.stage_name === stage ? "bg-accent" : ""}
                                    >
                                      {stage}
                                    </DropdownMenuItem>
                                  ))
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                            <span className="font-mono text-xs font-semibold text-emerald-600">
                              {formatCurrency(opp.monetary_value)}
                            </span>
                          </div>
                          {/* Right side: Status + Chevron */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Badge variant="outline" className={`text-xs ${getStatusColor(opp.status)}`}>
                              {opp.status || "Unknown"}
                            </Badge>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>

                        {/* Row 2: Sales Rep + Upcoming Appointment */}
                        <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                          {(() => {
                            const assignedUser = users.find(u => u.ghl_id === opp.assigned_to);
                            const repName = assignedUser?.name || 
                              (assignedUser?.first_name && assignedUser?.last_name 
                                ? `${assignedUser.first_name} ${assignedUser.last_name}` 
                                : assignedUser?.first_name || assignedUser?.last_name || null);
                            return repName ? (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {repName}
                              </span>
                            ) : null;
                          })()}
                          {upcomingAppt && (
                            <Badge variant="outline" className="text-xs font-normal bg-amber-500/10 text-amber-500 border-amber-500/30">
                              <Clock className="h-3 w-3 mr-1" />
                              {format(new Date(upcomingAppt.start_time!), "MMM d, h:mm a")}
                            </Badge>
                          )}
                        </div>
                        
                        {/* Contact Details: Address, Phone, Scope */}
                        <div className="space-y-1 text-xs text-muted-foreground mb-2">
                          {/* Phone */}
                          {contact?.phone && (
                            <div className="flex items-center gap-1.5">
                              <Phone className="h-3 w-3 shrink-0" />
                              <a 
                                href={`tel:${contact.phone}`} 
                                className="text-primary hover:underline truncate"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {contact.phone}
                              </a>
                            </div>
                          )}
                          {/* Address */}
                          {opp.address && (
                            <div className="flex items-start gap-1.5">
                              <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
                              <span className="truncate">{opp.address}</span>
                            </div>
                          )}
                          {/* Scope of Work */}
                          {opp.scope_of_work && (
                            <div className="flex items-start gap-1.5">
                              <FileText className="h-3 w-3 shrink-0 mt-0.5" />
                              <span className="line-clamp-2">{opp.scope_of_work}</span>
                            </div>
                          )}
                        </div>

                        {/* Latest Note */}
                        {latestNote && (
                          <div className="mb-2 p-2 rounded-md bg-muted/50 border border-border/50">
                            <div className="flex items-start gap-1.5">
                              <MessageSquare className="h-3 w-3 shrink-0 mt-0.5 text-muted-foreground" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-foreground line-clamp-2">{latestNote.body}</p>
                                {latestNote.ghl_date_added && (
                                  <p className="text-[10px] text-muted-foreground mt-0.5">
                                    {format(new Date(latestNote.ghl_date_added), "MMM d, yyyy 'at' h:mm a")}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                        
                        <div className="flex items-center justify-end text-xs text-muted-foreground">
                          {opp.ghl_date_added && (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(opp.ghl_date_added).toLocaleString("en-US", {
                                timeZone: "America/Los_Angeles",
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                                hour12: true,
                              })} PST
                            </div>
                          )}
                        </div>
                        {/* Appointments History */}
                        {contactAppointments.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-border/50">
                            <div className="text-xs text-muted-foreground mb-1.5">
                              Appointments ({contactAppointments.length})
                            </div>
                            <div className="space-y-1">
                              {contactAppointments.slice(0, 3).map((appt) => (
                                <div key={appt.ghl_id} className="flex items-center justify-between text-xs">
                                  <div className="flex items-center gap-1.5">
                                    <Calendar className="h-3 w-3 text-muted-foreground" />
                                    <span>{format(new Date(appt.start_time!), "MMM d, yyyy")}</span>
                                  </div>
                                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${getApptStatusColor(appt.appointment_status)}`}>
                                    {appt.appointment_status || "Unknown"}
                                  </Badge>
                                </div>
                              ))}
                              {contactAppointments.length > 3 && (
                                <div className="text-xs text-muted-foreground">
                                  +{contactAppointments.length - 3} more
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>
        </SheetContent>
      </Sheet>

      <OpportunityDetailSheet
        opportunity={selectedOpportunity as any}
        appointments={appointments as any}
        contacts={contacts as any}
        users={users as any}
        open={oppSheetOpen}
        onOpenChange={setOppSheetOpen}
        allOpportunities={opportunities as any}
      />

      {/* Create Task Dialog */}
      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5" />
              Create Task
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="taskTitle">Task Title</Label>
              <Input
                id="taskTitle"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="Enter task title..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="taskNotes">Notes</Label>
              <Textarea
                id="taskNotes"
                value={taskNotes}
                onChange={(e) => setTaskNotes(e.target.value)}
                placeholder="Add notes for this task..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="taskAssignee">Assign To</Label>
              <Select value={taskAssignee} onValueChange={setTaskAssignee}>
                <SelectTrigger>
                  <SelectValue placeholder="Select team member..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__unassigned__">Unassigned</SelectItem>
                  {[...users].sort((a, b) => {
                    const nameA = (a.name || `${a.first_name || ""} ${a.last_name || ""}`.trim() || a.email || "Unknown").toLowerCase();
                    const nameB = (b.name || `${b.first_name || ""} ${b.last_name || ""}`.trim() || b.email || "Unknown").toLowerCase();
                    return nameA.localeCompare(nameB);
                  }).map((user) => (
                    <SelectItem key={user.ghl_id} value={user.ghl_id}>
                      {user.name || `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.email || "Unknown"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Due Date & Time (PST) - Optional</Label>
              <div className="flex gap-2">
                <Input
                  id="taskDueDate"
                  type="date"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                  className="flex-1"
                />
                <Input
                  id="taskDueTime"
                  type="time"
                  value={taskDueTime}
                  onChange={(e) => setTaskDueTime(e.target.value)}
                  className="w-28"
                />
              </div>
              <p className="text-xs text-muted-foreground">Times are in Pacific Standard Time (PST/PDT)</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTaskDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateTask} disabled={isCreatingTask}>
              {isCreatingTask ? "Creating..." : "Create Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
