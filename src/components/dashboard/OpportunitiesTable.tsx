import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { useAppTabs } from "@/contexts/AppTabsContext";
import { useAuth } from "@/contexts/AuthContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BadgePill, statusToIntent } from "@/components/ui/badge-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  DollarSign,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CalendarCheck,
  CalendarX,
  User,
  Clock,
  ChevronLeft,
  ChevronRight,
  Download,
  CalendarIcon,
  StickyNote,
  ListChecks,
  Plus,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { OpportunityDetailSheet } from "./OpportunityDetailSheet";
import { AppointmentDetailSheet } from "./AppointmentDetailSheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiSelectFilter } from "./MultiSelectFilter";
import { DateRange } from "react-day-picker";
import { DateRangeFilter } from "./DateRangeFilter";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn, getAddressFromContact, extractCustomField, CUSTOM_FIELD_IDS, findContactByIdOrGhlId } from "@/lib/utils";
import { toast } from "sonner";
import { useOpportunitiesFilters } from "@/stores/useOpportunitiesFilters";

interface Opportunity {
  id?: string;
  ghl_id: string;
  name: string | null;
  stage_name: string | null;
  monetary_value: number | null;
  status: string | null;
  ghl_date_added: string | null;
  ghl_date_updated: string | null;
  pipeline_id: string | null;
  pipeline_name: string | null;
  pipeline_stage_id: string | null;
  contact_id: string | null;
  contact_uuid?: string | null;
  assigned_to: string | null;
  address?: string | null;
  scope_of_work?: string | null;
  opportunity_number?: number | null;
  updated_at?: string | null;
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
  contact_uuid?: string | null;
  assigned_user_id: string | null;
  calendar_id: string | null;
  address?: string | null;
  salesperson_confirmed?: boolean;
  salesperson_confirmed_at?: string | null;
  salesperson_confirmation_status?: string | null;
  location_id?: string;
}

interface Contact {
  id: string;
  ghl_id: string;
  location_id: string;
  contact_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  custom_fields?: unknown;
  attributions?: unknown;
  ghl_date_added?: string | null;
  assigned_to?: string | null;
}

interface GHLUser {
  ghl_id: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

interface Conversation {
  ghl_id: string;
  contact_id: string | null;
  type: string | null;
  unread_count: number | null;
  inbox_status: string | null;
  last_message_body: string | null;
  last_message_date: string | null;
  last_message_type: string | null;
  last_message_direction: string | null;
}

interface ContactNote {
  ghl_id: string;
  contact_id: string;
  body: string | null;
  ghl_date_added: string | null;
}

interface Task {
  ghl_id: string;
  contact_id: string;
  title: string;
  body: string | null;
  due_date: string | null;
  completed: boolean;
  created_at: string;
}

interface OpportunitiesTableProps {
  opportunities: Opportunity[];
  appointments?: Appointment[];
  contacts?: Contact[];
  users?: GHLUser[];
  conversations?: Conversation[];
  notes?: ContactNote[];
  tasks?: Task[];
  showAlternatingColors?: boolean;
  onAlternatingColorsChange?: (value: boolean) => void;
  onDownloadCSV?: (downloadFn: () => void) => void;
  tableDateField?: "updatedDate" | "createdDate";
  tableDateRange?: DateRange;
}

type SortColumn = "name" | "stage" | "value" | "status" | "source" | "createdDate" | "updatedDate";

//const [sortColumn, setSortColumn] = useState<SortColumn>("updatedDate");

type SortDirection = "asc" | "desc";

const ITEMS_PER_PAGE = 25;

export function OpportunitiesTable({
  opportunities,
  appointments = [],
  contacts = [],
  users = [],
  conversations = [],
  notes = [],
  tasks = [],
  showAlternatingColors: externalShowAlternatingColors,
  onAlternatingColorsChange,
  onDownloadCSV,
  tableDateField: externalTableDateField,
  tableDateRange: externalTableDateRange,
}: OpportunitiesTableProps) {
  const { companyId } = useCompanyContext();
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const { openTab } = useAppTabs();
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Persistent list filters/sort/pagination
  const {
    stageFilter,
    sourceFilter,
    statusFilter,
    appointmentFilter,
    salesRepFilter,
    sortColumn,
    sortDirection,
    currentPage,
    setStageFilter,
    setSourceFilter,
    setStatusFilter,
    setAppointmentFilter,
    setSalesRepFilter,
    setSort,
    setCurrentPage,
    clearTableFilters,
  } = useOpportunitiesFilters();

  // Quick add task dialog state
  const [quickTaskDialogOpen, setQuickTaskDialogOpen] = useState(false);
  const [quickTaskContactId, setQuickTaskContactId] = useState<string | null>(null);
  const [quickTaskContactName, setQuickTaskContactName] = useState<string>("");
  const [quickTaskTitle, setQuickTaskTitle] = useState("");
  const [quickTaskDueDate, setQuickTaskDueDate] = useState("");
  const [isCreatingQuickTask, setIsCreatingQuickTask] = useState(false);

  // Quick add note dialog state
  const [quickNoteDialogOpen, setQuickNoteDialogOpen] = useState(false);
  const [quickNoteContactId, setQuickNoteContactId] = useState<string | null>(null);
  const [quickNoteContactName, setQuickNoteContactName] = useState<string>("");
  const [quickNoteText, setQuickNoteText] = useState("");
  const [isCreatingQuickNote, setIsCreatingQuickNote] = useState(false);
  const [internalTableDateField, setInternalTableDateField] = useState<"updatedDate" | "createdDate">("updatedDate");
  const [internalTableDateRange, setInternalTableDateRange] = useState<DateRange | undefined>(undefined);
  const [internalShowAlternatingColors, setInternalShowAlternatingColors] = useState(true);
  
  // Use external control if provided, otherwise use internal state
  const tableDateField = externalTableDateField ?? internalTableDateField;
  const tableDateRange = externalTableDateRange ?? internalTableDateRange;
  
  // Use external control if provided, otherwise use internal state
  const showAlternatingColors = externalShowAlternatingColors ?? internalShowAlternatingColors;
  const setShowAlternatingColors = onAlternatingColorsChange ?? setInternalShowAlternatingColors;

  // Appointment sheet state
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [appointmentSheetOpen, setAppointmentSheetOpen] = useState(false);
  
  // Quick add appointment dialog state
  const [quickApptDialogOpen, setQuickApptDialogOpen] = useState(false);
  const [quickApptContactId, setQuickApptContactId] = useState<string | null>(null);
  const [quickApptContactName, setQuickApptContactName] = useState<string>("");
  const [quickApptOpportunity, setQuickApptOpportunity] = useState<Opportunity | null>(null);
  const [quickApptTitle, setQuickApptTitle] = useState("");
  const [quickApptDate, setQuickApptDate] = useState("");
  const [quickApptTime, setQuickApptTime] = useState("09:00");
  const [isCreatingQuickAppt, setIsCreatingQuickAppt] = useState(false);

  const uniqueStages = useMemo(() => {
    const stages = new Set<string>();
    opportunities.forEach((opp) => {
      if (opp.stage_name) stages.add(opp.stage_name);
    });
    return Array.from(stages).sort();
  }, [opportunities]);

  // Format stages for multi-select
  const stageOptions = useMemo(() => {
    return uniqueStages.map((stage) => ({ value: stage, label: stage }));
  }, [uniqueStages]);

  // Fetch salespeople for the filter (use salespeople table instead of ghl_users)
  const { data: salespeople = [] } = useQuery({
    queryKey: ["salespeople-for-filter", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("salespeople")
        .select("id, name, ghl_user_id, is_active")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
    staleTime: 10 * 60 * 1000,
  });

  // Format sales reps for multi-select - use internal UUID as value
  const salesRepOptions = useMemo(() => {
    return salespeople.map((sp) => ({ 
      value: sp.id, // Use internal UUID
      label: sp.name || "Unknown",
      ghlUserId: sp.ghl_user_id, // Keep for matching
    }));
  }, [salespeople]);

  // Create a map from salesperson UUID to their GHL user ID for matching
  const salespersonIdMap = useMemo(() => {
    const map = new Map<string, { uuid: string; ghlId: string | null }>();
    salespeople.forEach((sp) => {
      map.set(sp.id, { uuid: sp.id, ghlId: sp.ghl_user_id });
      if (sp.ghl_user_id) {
        map.set(sp.ghl_user_id, { uuid: sp.id, ghlId: sp.ghl_user_id });
      }
    });
    return map;
  }, [salespeople]);

  // Get unique sources from contacts
  const uniqueSources = useMemo(() => {
    const sources = new Set<string>();
    contacts.forEach((c) => {
      if (c.source) sources.add(c.source);
    });
    return Array.from(sources).sort();
  }, [contacts]);

  // Format sources for multi-select
  const sourceOptions = useMemo(() => {
    return uniqueSources.map((source) => ({ value: source, label: source }));
  }, [uniqueSources]);

  // Status options for filter
  const statusOptions = useMemo(() => {
    return [
      { value: "open", label: "Open" },
      { value: "won", label: "Won" },
      { value: "lost", label: "Lost" },
      { value: "abandoned", label: "Abandoned" },
    ];
  }, []);


  // Track which contacts have appointments (excluding cancelled)
  const contactsWithAppointments = useMemo(() => {
    const set = new Set<string>();
    appointments
      .filter((a) => (a.contact_id || a.contact_uuid) && a.appointment_status?.toLowerCase() !== "cancelled")
      .forEach((a) => {
        if (a.contact_id) set.add(a.contact_id);
        if (a.contact_uuid) set.add(a.contact_uuid);
      });
    return set;
  }, [appointments]);

  // Map contact key (ghl_id AND uuid) to appointments for quick lookup
  const appointmentsByContact = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    appointments
      .filter((a) => (a.contact_id || a.contact_uuid) && a.appointment_status?.toLowerCase() !== "cancelled")
      .forEach((a) => {
        const keys = [a.contact_id, a.contact_uuid].filter(Boolean) as string[];
        keys.forEach((key) => {
          const existing = map.get(key) || [];
          existing.push(a);
          map.set(key, existing);
        });
      });
    return map;
  }, [appointments]);

  // User/salesperson lookup map - keyed by GHL ID AND internal UUID for full coverage
  const userMap = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((u) => {
      const displayName = u.name || `${u.first_name || ""} ${u.last_name || ""}`.trim() || u.email || u.ghl_id;
      if (u.ghl_id) {
        map.set(u.ghl_id, displayName);
      }
    });
    // Also add salespeople keyed by their internal UUID and GHL user ID
    salespeople.forEach((sp) => {
      const name = sp.name || "Unknown";
      if (sp.id && !map.has(sp.id)) {
        map.set(sp.id, name);
      }
      if (sp.ghl_user_id && !map.has(sp.ghl_user_id)) {
        map.set(sp.ghl_user_id, name);
      }
    });
    return map;
  }, [users, salespeople]);

  // Contact lookup map - keyed by both ghl_id AND uuid for full coverage
  const contactMap = useMemo(() => {
    const map = new Map<string, Contact>();
    contacts.forEach((c) => {
      if (c.ghl_id) {
        map.set(c.ghl_id, c);
      }
      if (c.id) {
        map.set(c.id, c);
      }
    });
    return map;
  }, [contacts]);

  // Helper to resolve contact from an opportunity (prefers contact_uuid, falls back to contact_id)
  const getOppContact = (opp: Opportunity): Contact | null => {
    if (opp.contact_uuid) {
      const c = contactMap.get(opp.contact_uuid);
      if (c) return c;
    }
    if (opp.contact_id) {
      const c = contactMap.get(opp.contact_id);
      if (c) return c;
    }
    return null;
  };

  // Helper to get the best contact key for map lookups (notes, tasks, appointments)
  const getOppContactKey = (opp: Opportunity): string | null => {
    return opp.contact_uuid || opp.contact_id || null;
  };

  // Build a ghl_id -> uuid reverse map for cross-referencing
  const ghlIdToUuid = useMemo(() => {
    const map = new Map<string, string>();
    contacts.forEach((c) => {
      if (c.ghl_id && c.id) {
        map.set(c.ghl_id, c.id);
      }
    });
    return map;
  }, [contacts]);

  // Map contact key (ghl_id AND uuid) to latest note
  const latestNoteByContact = useMemo(() => {
    const map = new Map<string, ContactNote>();
    notes.forEach((note) => {
      if (note.contact_id && !map.has(note.contact_id)) {
        map.set(note.contact_id, note);
        // Also key by UUID
        const uuid = ghlIdToUuid.get(note.contact_id);
        if (uuid && !map.has(uuid)) {
          map.set(uuid, note);
        }
      }
    });
    return map;
  }, [notes, ghlIdToUuid]);

  // Map contact key (ghl_id AND uuid) to latest task
  const latestTaskByContact = useMemo(() => {
    const map = new Map<string, Task>();
    const sortedTasks = [...tasks].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    sortedTasks.forEach((task) => {
      if (task.contact_id && !map.has(task.contact_id)) {
        map.set(task.contact_id, task);
        const uuid = ghlIdToUuid.get(task.contact_id);
        if (uuid && !map.has(uuid)) {
          map.set(uuid, task);
        }
      }
    });
    return map;
  }, [tasks, ghlIdToUuid]);

  const getLastEditedDate = (opp: Opportunity): string | null => {
    const candidates = [opp.updated_at, opp.ghl_date_updated].filter(Boolean) as string[];
    if (candidates.length === 0) return opp.ghl_date_added || null;
    if (candidates.length === 1) return candidates[0];
    return new Date(candidates[0]) > new Date(candidates[1]) ? candidates[0] : candidates[1];
  };

  const formatAppointmentDateTime = (dateString: string | null) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return (
      date.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit" }) +
      " " +
      date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
    );
  };

  const filteredAndSortedOpportunities = useMemo(() => {
    let filtered = opportunities;

    // Apply stage filter (multi-select)
    if (stageFilter.length > 0) {
      filtered = filtered.filter((opp) => opp.stage_name && stageFilter.includes(opp.stage_name));
    }

    // Apply source filter (multi-select)
    if (sourceFilter.length > 0) {
      filtered = filtered.filter((opp) => {
        const contact = getOppContact(opp);
        return contact?.source && sourceFilter.includes(contact.source);
      });
    }

    // Apply status filter (multi-select)
    if (statusFilter.length > 0) {
      filtered = filtered.filter((opp) => {
        const status = opp.status?.toLowerCase() || "";
        return statusFilter.includes(status);
      });
    }

    // Apply appointment filter
    if (appointmentFilter === "with") {
      filtered = filtered.filter((opp) => {
        const key = getOppContactKey(opp);
        return key && contactsWithAppointments.has(key);
      });
    } else if (appointmentFilter === "without") {
      filtered = filtered.filter((opp) => {
        const key = getOppContactKey(opp);
        return !key || !contactsWithAppointments.has(key);
      });
    }

    // Apply sales rep filter (multi-select) - match using both UUID and GHL ID
    if (salesRepFilter.length > 0) {
      // Build a set of all IDs to match (both UUIDs and GHL IDs for selected salespeople)
      const matchingIds = new Set<string>();
      salesRepFilter.forEach((selectedId) => {
        matchingIds.add(selectedId); // Add the UUID
        // Also add the GHL ID if this salesperson has one
        const sp = salespeople.find(s => s.id === selectedId);
        if (sp?.ghl_user_id) {
          matchingIds.add(sp.ghl_user_id);
        }
      });
      
      filtered = filtered.filter((opp) => {
        // Check opportunity assigned_to (could be UUID or GHL ID)
        if (opp.assigned_to && matchingIds.has(opp.assigned_to)) return true;
        // Check contact assigned_to
        const contact = getOppContact(opp);
        if (contact?.assigned_to && matchingIds.has(contact.assigned_to)) return true;
        // Check appointment assigned_user_id
        const key = getOppContactKey(opp);
        const oppAppointments = key ? appointmentsByContact.get(key) || [] : [];
        return oppAppointments.some((a) => a.assigned_user_id && matchingIds.has(a.assigned_user_id));
      });
    }

    // Apply table date range filter
    if (tableDateRange?.from) {
      filtered = filtered.filter((opp) => {
        let dateStr: string | null | undefined;
        if (tableDateField === "updatedDate") {
          dateStr = getLastEditedDate(opp);
        } else {
          const contact = getOppContact(opp);
          dateStr = contact?.ghl_date_added || opp.ghl_date_added;
        }
        if (!dateStr) return false;
        const date = new Date(dateStr);
        const from = tableDateRange.from!;
        const to = tableDateRange.to || tableDateRange.from!;
        // Normalize to start/end of day
        const fromStart = new Date(from.getFullYear(), from.getMonth(), from.getDate());
        const toEnd = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59);
        return date >= fromStart && date <= toEnd;
      });
    }

    // Helper to get effective date from contact (quickbase stage = 90 days ago)
    const getEffectiveDate = (opp: Opportunity): number => {
      if (opp.stage_name?.toLowerCase() === "quickbase") {
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        return ninetyDaysAgo.getTime();
      }
      // Use contact's date if available, otherwise fall back to opportunity date
      const contact = getOppContact(opp);
      const dateStr = contact?.ghl_date_added || opp.ghl_date_added;
      return dateStr ? new Date(dateStr).getTime() : 0;
    };

    // Helper: normalize a Date to midnight (so only the day matters)
    const toDayTimestamp = (dateStr: string | null | undefined): number => {
      if (!dateStr) return 0;
      const d = new Date(dateStr);
      // strip time, keep local date; use setUTCHours(0,0,0,0) if you prefer UTC
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    };

    // Helper to get Created date (by day)
    const getCreatedDate = (opp: Opportunity): number => {
      if (opp.stage_name?.toLowerCase() === "quickbase") {
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        ninetyDaysAgo.setHours(0, 0, 0, 0);
        return ninetyDaysAgo.getTime();
      }
      const contact = getOppContact(opp);
      const dateStr = contact?.ghl_date_added || opp.ghl_date_added;
      return toDayTimestamp(dateStr);
    };


    // Helper to get UPDATED date (by day)
    const getUpdatedDate = (opp: Opportunity): number => {
      const dateStr = getLastEditedDate(opp);
      return toDayTimestamp(dateStr);
    };

    // Sort opportunities
    return [...filtered].sort((a, b) => {
      const dir = sortDirection === "asc" ? 1 : -1;
      let comparison = 0;

      const aCreated = getCreatedDate(a);
      const bCreated = getCreatedDate(b);
      const aUpdated = getUpdatedDate(a);
      const bUpdated = getUpdatedDate(b);

      switch (sortColumn) {
        case "name":
          comparison = (a.name || "").localeCompare(b.name || "");
          return dir * comparison;

        case "stage":
          comparison = (a.stage_name || "").localeCompare(b.stage_name || "");
          if (comparison !== 0) return dir * comparison;
          // secondary: created date
          return dir * (aCreated - bCreated);

        case "value":
          comparison = (a.monetary_value || 0) - (b.monetary_value || 0);
          return dir * comparison;

        case "source": {
          const contactA = getOppContact(a);
          const contactB = getOppContact(b);
          comparison = (contactA?.source || "").localeCompare(contactB?.source || "");
          return dir * comparison;
        }

        case "status":
          comparison = (a.status || "").localeCompare(b.status || "");
          return dir * comparison;

        case "createdDate":
          // primary: created date only
          return dir * (aCreated - bCreated);

        case "updatedDate":
        default:
          // primary: updated date
          comparison = aUpdated - bUpdated;
          if (comparison !== 0) {
            return dir * comparison;
          }
          // secondary: created date
          return dir * (aCreated - bCreated);
      }
    });
  }, [
    opportunities,
    stageFilter,
    sourceFilter,
    statusFilter,
    appointmentFilter,
    salesRepFilter,
    salespeople,
    sortColumn,
    sortDirection,
    contactsWithAppointments,
    contactMap,
    appointmentsByContact,
    tableDateRange,
    tableDateField,
  ]);

  // Reset to page 1 when filters change
  const handleStageFilterChange = (selected: string[]) => {
    setCurrentPage(1);
    setStageFilter(selected);
  };

  const handleSourceFilterChange = (selected: string[]) => {
    setCurrentPage(1);
    setSourceFilter(selected);
  };

  const handleStatusFilterChange = (selected: string[]) => {
    setCurrentPage(1);
    setStatusFilter(selected);
  };

  const handleSalesRepFilterChange = (selected: string[]) => {
    setCurrentPage(1);
    setSalesRepFilter(selected);
  };

  const handleAppointmentFilterChange = (value: string) => {
    setCurrentPage(1);
    setAppointmentFilter(value as "all" | "with" | "without");
  };

  // Helper to extract custom field value (use shared util for address with fallback)
  const getCustomFieldValue = (contact: Contact | undefined, fieldId: string, contactId?: string | null): string => {
    // For address, use the shared utility with appointment fallback
    if (fieldId === CUSTOM_FIELD_IDS.ADDRESS) {
      return getAddressFromContact(contact, appointments, contactId) || "";
    }
    return extractCustomField(contact?.custom_fields, fieldId) || "";
  };

  // CSV download function
  const downloadCSV = () => {
    const headers = [
      "Name",
      "Pipeline",
      "Stage",
      "Value",
      "Status",
      "Contact Name",
      "Phone",
      "Email",
      "Address",
      "Scope of Work",
      "Sales Rep",
      "Contact Created",
      "Latest Appointment",
      "Latest Note Date",
      "Latest Note Content",
      "Latest Task Date",
    ];

    const rows = filteredAndSortedOpportunities.map((opp) => {
      const contact = getOppContact(opp);
      const key = getOppContactKey(opp);
      const oppAppointments = key ? appointmentsByContact.get(key) || [] : [];
      const latestAppt =
        oppAppointments.length > 0
          ? oppAppointments.sort(
              (a, b) => new Date(b.start_time || 0).getTime() - new Date(a.start_time || 0).getTime(),
            )[0]
          : null;
      const salesRepName = latestAppt?.assigned_user_id
        ? userMap.get(latestAppt.assigned_user_id)
        : opp.assigned_to
          ? userMap.get(opp.assigned_to)
          : "";
      const contactDate = contact?.ghl_date_added || opp.ghl_date_added;

      const address = getCustomFieldValue(contact, CUSTOM_FIELD_IDS.ADDRESS, opp.contact_id);
      const scopeOfWork = getCustomFieldValue(contact, CUSTOM_FIELD_IDS.SCOPE_OF_WORK);
      const contactName =
        contact?.contact_name || [contact?.first_name, contact?.last_name].filter(Boolean).join(" ") || "";

      // Get latest note and task for this contact
      const latestNote = key ? latestNoteByContact.get(key) : null;
      const latestTask = key ? latestTaskByContact.get(key) : null;
      
      // Strip HTML from note body for CSV
      const noteContent = latestNote?.body 
        ? latestNote.body.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
        : "";

      return [
        opp.name || "",
        opp.pipeline_name || "",
        opp.stage_name || "",
        opp.monetary_value?.toString() || "",
        opp.status || "",
        contactName,
        contact?.phone || "",
        contact?.email || "",
        address,
        scopeOfWork,
        salesRepName || "",
        contactDate ? new Date(contactDate).toLocaleDateString() : "",
        latestAppt?.start_time ? new Date(latestAppt.start_time).toLocaleString() : "",
        latestNote?.ghl_date_added ? new Date(latestNote.ghl_date_added).toLocaleDateString() : "",
        noteContent,
        latestTask?.created_at ? new Date(latestTask.created_at).toLocaleDateString() : "",
      ];
    });

    // Escape CSV values
    const escapeCSV = (value: string) => {
      if (value.includes(",") || value.includes('"') || value.includes("\n")) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    const csvContent = [headers.map(escapeCSV).join(","), ...rows.map((row) => row.map(escapeCSV).join(","))].join(
      "\n",
    );

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `opportunities_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  // Expose downloadCSV to parent if callback provided
  useEffect(() => {
    if (onDownloadCSV) {
      onDownloadCSV(downloadCSV);
    }
  }, [onDownloadCSV, filteredAndSortedOpportunities]);

  const totalItems = filteredAndSortedOpportunities.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedOpportunities = filteredAndSortedOpportunities.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const formatCurrency = (value: number | null) => {
    if (!value) return "-";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const getStatusColor = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case "won":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "lost":
      case "abandoned":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      case "open":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      default:
        return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    }
  };

  const handleRowClick = (opportunity: Opportunity) => {
    // Open in a new tab using the full-page route
    const id = opportunity.id || opportunity.ghl_id;
    const contact = findContactByIdOrGhlId(contacts, opportunity.contact_uuid, opportunity.contact_id);
    const customerName = contact?.contact_name || contact?.first_name || '';
    const oppNum = opportunity.opportunity_number;
    const title = oppNum 
      ? `Opp ${oppNum}${customerName ? ` (${customerName})` : ''}`
      : opportunity.name || 'Opportunity';
    openTab(`/opportunity/${id}`, title);
  };

  const handleSort = (column: SortColumn) => {
    setCurrentPage(1);

    if (sortColumn === column) {
      setSort(column, sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSort(
        column,
        column === "value" || column === "createdDate" || column === "updatedDate" ? "desc" : "asc",
      );
    }
  };

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    }
    return sortDirection === "asc" ? <ArrowUp className="h-4 w-4 ml-1" /> : <ArrowDown className="h-4 w-4 ml-1" />;
  };

  // Check if a task is overdue (due date has passed and not completed)
  const isTaskOverdue = (task: Task): boolean => {
    if (task.completed || !task.due_date) return false;
    const dueDate = new Date(task.due_date);
    const now = new Date();
    return dueDate < now;
  };

  // Check if opportunity has an overdue task
  const hasOverdueTask = (contactId: string | null): boolean => {
    if (!contactId) return false;
    const task = latestTaskByContact.get(contactId);
    return task ? isTaskOverdue(task) : false;
  };

  // Open quick task dialog
  const openQuickTaskDialog = (e: React.MouseEvent, contactId: string | null, contactName: string) => {
    e.stopPropagation();
    if (!contactId) {
      toast.error("No contact linked to this opportunity");
      return;
    }
    setQuickTaskContactId(contactId);
    setQuickTaskContactName(contactName);
    setQuickTaskTitle("");
    setQuickTaskDueDate("");
    setQuickTaskDialogOpen(true);
  };

  // Open quick note dialog
  const openQuickNoteDialog = (e: React.MouseEvent, contactId: string | null, contactName: string) => {
    e.stopPropagation();
    if (!contactId) {
      toast.error("No contact linked to this opportunity");
      return;
    }
    setQuickNoteContactId(contactId);
    setQuickNoteContactName(contactName);
    setQuickNoteText("");
    setQuickNoteDialogOpen(true);
  };

  // Create quick task
  const handleCreateQuickTask = async () => {
    if (!quickTaskContactId || !quickTaskTitle.trim()) {
      toast.error("Please enter a task title");
      return;
    }
    setIsCreatingQuickTask(true);
    try {
      // Get location_id from contact - let edge function look it up if not available
      const contact = contactMap.get(quickTaskContactId);
      const locationId = contact?.location_id || null;
      
      const { error } = await supabase.functions.invoke("create-ghl-task", {
        body: {
          contactId: quickTaskContactId,
          title: quickTaskTitle.trim(),
          body: "",
          dueDate: quickTaskDueDate || null,
          assignedTo: profile?.ghl_user_id || null, // Auto-assign to current user
          locationId: locationId,
          companyId: companyId,
          enteredBy: user?.id || null,
        }
      });
      
      if (error) throw error;
      
      toast.success("Task created");
      setQuickTaskDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["ghl_tasks"] });
      queryClient.invalidateQueries({ queryKey: ["ghl-metrics"] });
    } catch (error) {
      console.error("Error creating task:", error);
      toast.error("Failed to create task");
    } finally {
      setIsCreatingQuickTask(false);
    }
  };

  // Create quick note
  const handleCreateQuickNote = async () => {
    if (!quickNoteContactId || !quickNoteText.trim()) {
      toast.error("Please enter a note");
      return;
    }
    setIsCreatingQuickNote(true);
    try {
      const { error } = await supabase.functions.invoke("create-contact-note", {
        body: {
          contactId: quickNoteContactId,
          body: quickNoteText.trim(),
          companyId: companyId,
          enteredBy: user?.id || null,
        }
      });
      
      if (error) throw error;
      
      toast.success("Note added");
      setQuickNoteDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["contact_notes"] });
      queryClient.invalidateQueries({ queryKey: ["ghl-metrics"] });
    } catch (error) {
      console.error("Error creating note:", error);
      toast.error("Failed to add note");
    } finally {
      setIsCreatingQuickNote(false);
    }
  };

  // Handle clicking calendar icon - open existing appointment or create new
  const handleCalendarIconClick = (e: React.MouseEvent, opp: Opportunity, contact: Contact | undefined) => {
    e.stopPropagation(); // Prevent row click
    
    const contactKey = getOppContactKey(opp);
    const contactAppts = contactKey ? appointmentsByContact.get(contactKey) : [];
    
    if (contactAppts && contactAppts.length > 0) {
      // Open the most recent/upcoming appointment
      const now = new Date();
      const upcoming = contactAppts
        .filter(a => a.start_time && new Date(a.start_time) > now)
        .sort((a, b) => new Date(a.start_time!).getTime() - new Date(b.start_time!).getTime());
      
      const apptToShow = upcoming[0] || contactAppts[0];
      setSelectedAppointment(apptToShow);
      setAppointmentSheetOpen(true);
    } else {
      // No appointments - open create dialog
      const contactName = contact?.contact_name || 
        `${contact?.first_name || ""} ${contact?.last_name || ""}`.trim() || 
        opp.name || "Unknown";
      
      setQuickApptContactId(opp.contact_id);
      setQuickApptContactName(contactName);
      setQuickApptOpportunity(opp);
      setQuickApptTitle(`Meeting with ${contactName}`);
      setQuickApptDate(format(new Date(), "yyyy-MM-dd"));
      setQuickApptTime("09:00");
      setQuickApptDialogOpen(true);
    }
  };

  // Create quick appointment
  const handleCreateQuickAppt = async () => {
    if (!quickApptContactId || !quickApptTitle.trim() || !quickApptDate) {
      toast.error("Please fill in all required fields");
      return;
    }
    setIsCreatingQuickAppt(true);
    try {
      const startTime = new Date(`${quickApptDate}T${quickApptTime}:00`);
      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour
      
      const { error } = await supabase.functions.invoke("create-ghl-appointment", {
        body: {
          contactId: quickApptContactId,
          title: quickApptTitle.trim(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          enteredBy: user?.id || null,
          companyId: companyId,
        }
      });
      
      if (error) throw error;
      
      toast.success("Appointment created");
      setQuickApptDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["ghl_appointments"] });
      queryClient.invalidateQueries({ queryKey: ["ghl-metrics"] });
    } catch (error) {
      console.error("Error creating appointment:", error);
      toast.error("Failed to create appointment");
    } finally {
      setIsCreatingQuickAppt(false);
    }
  };

  return (
    <>
      <div className="rounded-xl border border-border/50 bg-card shadow-sm overflow-hidden">
        {/* Filter Surface */}
        <div className="px-4 py-3 border-b border-border/40">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-styled pb-1">
            <MultiSelectFilter
              options={statusOptions}
              selected={statusFilter}
              onChange={handleStatusFilterChange}
              placeholder="All Statuses"
            />
            <MultiSelectFilter
              options={stageOptions}
              selected={stageFilter}
              onChange={handleStageFilterChange}
              placeholder="All Stages"
            />
            <MultiSelectFilter
              options={salesRepOptions}
              selected={salesRepFilter}
              onChange={handleSalesRepFilterChange}
              placeholder="All Sales Reps"
              icon={<User className="h-3 w-3" />}
            />
            <Select value={appointmentFilter} onValueChange={handleAppointmentFilterChange}>
              <SelectTrigger className="w-[160px] h-8 text-xs">
                <SelectValue placeholder="With Appointments?" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">With Appointments?</SelectItem>
                <SelectItem value="with">With Appointments</SelectItem>
                <SelectItem value="without">Without Appointments</SelectItem>
              </SelectContent>
            </Select>
            <MultiSelectFilter
              options={sourceOptions}
              selected={sourceFilter}
              onChange={handleSourceFilterChange}
              placeholder="All Sources"
            />
            {(stageFilter.length > 0 || sourceFilter.length > 0 || statusFilter.length > 0 || appointmentFilter !== "all" || salesRepFilter.length > 0) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => clearTableFilters()}
              >
                Clear Filters
              </Button>
            )}
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-auto max-h-[calc(100vh-280px)] scrollbar-styled">
          <Table className="w-full table-fixed">
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow className="border-border/40 hover:bg-transparent">
                <TableHead
                  className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors w-[12%]"
                  onClick={() => handleSort("name")}
                >
                  <div className="flex items-end gap-0.5">
                    Name
                    <SortIcon column="name" />
                  </div>
                </TableHead>
                <TableHead
                  className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors w-[10%]"
                  onClick={() => handleSort("stage")}
                >
                  <div className="flex items-end gap-0.5">
                    Stage
                    <SortIcon column="stage" />
                  </div>
                </TableHead>
                <TableHead
                  className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors w-[9%]"
                  onClick={() => handleSort("source")}
                >
                  <div className="flex items-end gap-0.5">
                    Source / Status
                    <SortIcon column="source" />
                  </div>
                </TableHead>

                <TableHead className="text-muted-foreground w-[11%]">
                  <div className="flex items-end gap-1">
                    <User className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>Rep / Dates</span>
                  </div>
                </TableHead>
                <TableHead className="text-muted-foreground w-[13%]">
                  <div className="flex items-end gap-1">
                    <StickyNote className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>Note</span>
                  </div>
                </TableHead>
                <TableHead className="text-muted-foreground w-[12%]">
                  <div className="flex items-end gap-1">
                    <ListChecks className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>Task</span>
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border/30">
              {paginatedOpportunities.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No opportunities found
                  </TableCell>
                </TableRow>
              ) : (
                paginatedOpportunities.map((opp) => {
                  const key = getOppContactKey(opp);
                  const oppAppointments = key ? appointmentsByContact.get(key) || [] : [];
                  const latestAppt =
                    oppAppointments.length > 0
                      ? oppAppointments.sort(
                          (a, b) => new Date(b.start_time || 0).getTime() - new Date(a.start_time || 0).getTime(),
                        )[0]
                      : null;
                  const salesRepName = latestAppt?.assigned_user_id ? userMap.get(latestAppt.assigned_user_id) : (opp.assigned_to ? userMap.get(opp.assigned_to) : null);
                  const contact = getOppContact(opp);
                  const contactDate = contact?.ghl_date_added || opp.ghl_date_added;
                  
                  // Get latest note and task for this contact
                  const latestNote = key ? latestNoteByContact.get(key) : null;
                  const latestTask = key ? latestTaskByContact.get(key) : null;
                  
                  // Strip HTML from note body and truncate
                  const notePreview = latestNote?.body 
                    ? latestNote.body.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim().slice(0, 50) + (latestNote.body.length > 50 ? '...' : '')
                    : null;
                  
                  // Determine display name: prefer contact_name if opportunity name looks invalid
                  const isInvalidOppName = !opp.name || 
                    opp.name.includes('@') || 
                    opp.name.startsWith('(') || 
                    opp.name.toLowerCase() === 'decline' ||
                    opp.name.toLowerCase() === '(decline)';
                  const displayName = isInvalidOppName && contact?.contact_name 
                    ? contact.contact_name 
                    : (opp.name || contact?.contact_name || "Unnamed");

                  // Check if this opportunity has an overdue task
                  const overdueTask = latestTask && isTaskOverdue(latestTask);

                  return (
                    <TableRow
                      key={opp.id || opp.ghl_id || `opp-${paginatedOpportunities.indexOf(opp)}`}
                      className={cn(
                        "border-border/30 hover:bg-muted/30 cursor-pointer",
                        overdueTask && "bg-destructive/5 hover:bg-destructive/10",
                        showAlternatingColors && !overdueTask && paginatedOpportunities.indexOf(opp) % 2 === 1 && "bg-muted/50"
                      )}
                      onClick={() => handleRowClick(opp)}
                    >
                      <TableCell className="font-medium truncate max-w-[150px]">
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {overdueTask && (
                              <span title="Has overdue task">
                                <AlertTriangle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
                              </span>
                            )}
                            {key && contactsWithAppointments.has(key) ? (
                              <button
                                type="button"
                                title="View appointment"
                                className="p-0.5 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors flex-shrink-0"
                                onClick={(e) => handleCalendarIconClick(e, opp, contact)}
                              >
                                <CalendarCheck className="h-3.5 w-3.5 text-emerald-500" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                title="Create appointment"
                                className="p-0.5 rounded hover:bg-muted transition-colors flex-shrink-0"
                                onClick={(e) => handleCalendarIconClick(e, opp, contact)}
                              >
                                <CalendarX className="h-3.5 w-3.5 text-muted-foreground/50" />
                              </button>
                            )}
                            {(() => {
                              const scopeFromOpportunity = opp.scope_of_work;
                              const scopeFromCustomField = extractCustomField(contact?.custom_fields, CUSTOM_FIELD_IDS.SCOPE_OF_WORK);
                              const scopeFromAttributions = (() => {
                                if (!contact?.attributions) return null;
                                const attrs = contact.attributions as Array<{ utmCampaign?: string }>;
                                const campaign = attrs.find(a => a.utmCampaign)?.utmCampaign;
                                return campaign || null;
                              })();
                              const scopeOfWork = scopeFromOpportunity || scopeFromCustomField || scopeFromAttributions;
                              
                              return scopeOfWork ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="cursor-help underline decoration-dotted underline-offset-2 truncate">{displayName}</span>
                                  </TooltipTrigger>
                                  <TooltipContent side="bottom" className="max-w-xs whitespace-pre-wrap text-sm">
                                    <p className="font-semibold mb-1">Scope of Work:</p>
                                    <p>{scopeOfWork}</p>
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                <span className="truncate" title={displayName}>{displayName}</span>
                              );
                            })()}
                          </div>
                          {(() => {
                            const address = opp.address || getAddressFromContact(contact, appointments, opp.contact_id);
                            return address ? (
                              <span className="text-[11px] text-muted-foreground truncate" title={address}>{address}</span>
                            ) : null;
                          })()}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        <div className="flex flex-col gap-0.5 min-w-0">
                          {(() => {
                            const scopeFromOpportunity = opp.scope_of_work;
                            const scopeFromCustomField = extractCustomField(contact?.custom_fields, CUSTOM_FIELD_IDS.SCOPE_OF_WORK);
                            const scopeFromAttributions = (() => {
                              if (!contact?.attributions) return null;
                              const attrs = contact.attributions as Array<{ utmCampaign?: string }>;
                              const campaign = attrs.find(a => a.utmCampaign)?.utmCampaign;
                              return campaign || null;
                            })();
                            const scopeOfWork = scopeFromOpportunity || scopeFromCustomField || scopeFromAttributions;
                            const stageText = opp.stage_name || "-";
                            
                            return scopeOfWork ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-help underline decoration-dotted underline-offset-2 truncate block">
                                    {stageText}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="max-w-xs whitespace-pre-wrap text-sm">
                                  <p className="font-semibold mb-1">Scope of Work:</p>
                                  <p>{scopeOfWork}</p>
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <span className="truncate block" title={stageText}>{stageText}</span>
                            );
                          })()}
                          <span className="font-mono text-emerald-500">{formatCurrency(opp.monetary_value)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <span className="text-muted-foreground truncate" title={contact?.source || "-"}>{contact?.source || "-"}</span>
                          <span className="text-muted-foreground whitespace-nowrap">
                            {contactDate ? new Date(contactDate).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "2-digit" }) : "-"}
                          </span>
                          <BadgePill intent={statusToIntent(opp.status)}>
                            {opp.status || "?"}
                          </BadgePill>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <span className="truncate"><span className="text-muted-foreground/70">Rep:</span> {salesRepName || "-"}</span>
                          <span className="whitespace-nowrap"><span className="text-muted-foreground/70">Edit:</span> {(() => { const d = getLastEditedDate(opp); return d ? new Date(d).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "2-digit" }) : "-"; })()}</span>
                          <span className="truncate"><span className="text-muted-foreground/70">Appt:</span> {latestAppt ? (
                            <>
                              {formatAppointmentDateTime(latestAppt.start_time)}
                              {oppAppointments.length > 1 && ` +${oppAppointments.length - 1}`}
                            </>
                          ) : "-"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        <div className="flex items-center gap-0.5 min-w-0">
                          {latestNote ? (
                            <div className="flex flex-col flex-1 min-w-0">
                              <span className="text-[10px]">
                                {latestNote.ghl_date_added ? new Date(latestNote.ghl_date_added).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit" }) : "-"}
                              </span>
                              {notePreview && (
                                <span className="text-[10px] text-muted-foreground/70 truncate" title={latestNote.body?.replace(/<[^>]*>/g, '') || ''}>
                                  {notePreview.slice(0, 20)}...
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="flex-1">-</span>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0 flex-shrink-0 hover:bg-primary/10"
                            onClick={(e) => openQuickNoteDialog(e, opp.contact_uuid || opp.contact_id, displayName)}
                            title="Add note"
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className={cn(
                        "text-xs",
                        overdueTask ? "text-destructive" : "text-muted-foreground"
                      )}>
                        <div className="flex items-center gap-0.5 min-w-0">
                          {latestTask ? (
                            <div className="flex flex-col flex-1 min-w-0">
                              <span className={cn("text-[10px]", overdueTask && "font-medium")}>
                                {latestTask.due_date 
                                  ? new Date(latestTask.due_date).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit" }) 
                                  : new Date(latestTask.created_at).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit" })}
                              </span>
                              <span className="text-[10px] text-muted-foreground/70 truncate" title={latestTask.title}>
                                {latestTask.title.slice(0, 15)}...
                              </span>
                            </div>
                          ) : (
                            <span className="flex-1">-</span>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0 flex-shrink-0 hover:bg-primary/10"
                            onClick={(e) => openQuickTaskDialog(e, opp.contact_uuid || opp.contact_id, displayName)}
                            title="Add task"
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>

        </div>

        {/* Pagination footer */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border/40">
            <span className="text-sm text-muted-foreground">
              Showing {startIndex + 1}-{Math.min(startIndex + ITEMS_PER_PAGE, totalItems)} of {totalItems}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground px-2">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <OpportunityDetailSheet
        opportunity={selectedOpportunity}
        appointments={appointments}
        contacts={contacts}
        users={users}
        conversations={conversations}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        allOpportunities={opportunities}
      />

      {/* Quick Add Task Dialog */}
      <Dialog open={quickTaskDialogOpen} onOpenChange={setQuickTaskDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListChecks className="h-5 w-5" />
              Add Task for {quickTaskContactName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="quick-task-title">Task Title *</Label>
              <Input
                id="quick-task-title"
                value={quickTaskTitle}
                onChange={(e) => setQuickTaskTitle(e.target.value)}
                placeholder="Enter task title"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quick-task-due">Due Date (Optional)</Label>
              <Input
                id="quick-task-due"
                type="date"
                value={quickTaskDueDate}
                onChange={(e) => setQuickTaskDueDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuickTaskDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateQuickTask} 
              disabled={isCreatingQuickTask || !quickTaskTitle.trim()}
            >
              {isCreatingQuickTask ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Task
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Add Note Dialog */}
      <Dialog open={quickNoteDialogOpen} onOpenChange={setQuickNoteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <StickyNote className="h-5 w-5" />
              Add Note for {quickNoteContactName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="quick-note-text">Note *</Label>
              <Textarea
                id="quick-note-text"
                value={quickNoteText}
                onChange={(e) => setQuickNoteText(e.target.value)}
                placeholder="Enter your note..."
                rows={4}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuickNoteDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateQuickNote} 
              disabled={isCreatingQuickNote || !quickNoteText.trim()}
            >
              {isCreatingQuickNote ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Note
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Appointment Detail Sheet */}
      <AppointmentDetailSheet
        appointment={selectedAppointment}
        opportunities={opportunities}
        appointments={appointments}
        contacts={contacts}
        users={users}
        open={appointmentSheetOpen}
        onOpenChange={setAppointmentSheetOpen}
      />

      {/* Quick Add Appointment Dialog */}
      <Dialog open={quickApptDialogOpen} onOpenChange={setQuickApptDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Schedule Appointment for {quickApptContactName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="quick-appt-title">Title *</Label>
              <Input
                id="quick-appt-title"
                value={quickApptTitle}
                onChange={(e) => setQuickApptTitle(e.target.value)}
                placeholder="Meeting title"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quick-appt-date">Date *</Label>
                <Input
                  id="quick-appt-date"
                  type="date"
                  value={quickApptDate}
                  onChange={(e) => setQuickApptDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quick-appt-time">Time *</Label>
                <Input
                  id="quick-appt-time"
                  type="time"
                  value={quickApptTime}
                  onChange={(e) => setQuickApptTime(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuickApptDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateQuickAppt} 
              disabled={isCreatingQuickAppt || !quickApptTitle.trim() || !quickApptDate}
            >
              {isCreatingQuickAppt ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Appointment
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
