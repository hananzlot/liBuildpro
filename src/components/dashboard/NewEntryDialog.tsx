import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Plus, Upload, Loader2, X, FileSpreadsheet, Download, AlertTriangle, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCompanyContext } from "@/hooks/useCompanyContext";

interface User {
  ghl_id: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
}

interface DuplicateContact {
  id: string;
  contact_name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  source: string | null;
}

interface NewEntryDialogProps {
  users: User[];
  onSuccess?: () => void;
  userId?: string;
}

interface CSVEntry {
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  address?: string;
  scope?: string;
  notes?: string;
  appointmentDate?: string;
  appointmentTime?: string;
  source?: string;
  assignedTo?: string;
  status: "pending" | "success" | "error";
  error?: string;
}

interface PipelineStage {
  pipeline_id: string;
  pipeline_name: string;
  pipeline_stage_id: string;
  stage_name: string;
}

interface GHLCalendar {
  ghl_id: string;
  name: string | null;
  is_active: boolean;
  team_members: string[];
}

interface GoogleCalendarConnection {
  id: string;
  calendar_id: string;
  calendar_name: string;
  is_company_calendar: boolean;
  is_active: boolean;
}


const PRIMARY_LOCATION_ID = "pVeFrqvtYWNIPRIi0Fmr";

export function NewEntryDialog({ users, onSuccess, userId }: NewEntryDialogProps) {
  const { companyId } = useCompanyContext();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("single");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Single entry form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [scope, setScope] = useState("");
  const [notes, setNotes] = useState("");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [appointmentTime, setAppointmentTime] = useState("09:00");
  const [source, setSource] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [phoneError, setPhoneError] = useState("");
  const [emailError, setEmailError] = useState("");

  // Pipeline/stage state
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>([]);
  const [selectedPipeline, setSelectedPipeline] = useState("");
  const [selectedStage, setSelectedStage] = useState("");

  // Calendar state
  const [calendars, setCalendars] = useState<GHLCalendar[]>([]);
  const [selectedCalendar, setSelectedCalendar] = useState("");
  const [googleCalendar, setGoogleCalendar] = useState<GoogleCalendarConnection | null>(null);

  // Available sources state
  const [availableSources, setAvailableSources] = useState<string[]>([]);

  // CSV upload state
  const [csvEntries, setCsvEntries] = useState<CSVEntry[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Duplicate detection state
  const [duplicateContacts, setDuplicateContacts] = useState<DuplicateContact[]>([]);
  const [isDuplicateCheckPending, setIsDuplicateCheckPending] = useState(false);
  const [duplicateWarningDismissed, setDuplicateWarningDismissed] = useState(false);
  const duplicateWarningRef = useRef<HTMLDivElement>(null);

  // Fetch pipelines/stages when dialog opens - admin config always wins over GHL
  // Priority: pipeline_stages table > company_settings > ghl_pipelines > opportunities > hardcoded defaults
  useEffect(() => {
    if (!open || !companyId) return;
    
    const fetchPipelineStages = async () => {
      // Priority 1: pipeline_stages table (UUID-based, new system)
      const { data: pipelineStagesData } = await supabase
        .from("pipeline_stages")
        .select("id, name, position")
        .eq("company_id", companyId)
        .order("position", { ascending: true });

      if (pipelineStagesData && pipelineStagesData.length > 0) {
        const pipelineId = `pipeline_${companyId}`;
        const stages: PipelineStage[] = pipelineStagesData.map((s) => ({
          pipeline_id: pipelineId,
          pipeline_name: "Main",
          pipeline_stage_id: s.id,
          stage_name: s.name,
        }));
        setPipelineStages(stages);
        setSelectedPipeline(stages[0].pipeline_id);
        setSelectedStage(stages[0].pipeline_stage_id);
        return;
      }

      // Priority 2: company_settings "pipeline_stages" key (legacy admin config)
      const { data: settingsData } = await supabase
        .from("company_settings")
        .select("setting_key, setting_value")
        .eq("company_id", companyId)
        .in("setting_key", ["default_pipeline_name", "pipeline_stages"]);

      const pipelineNameSetting = settingsData?.find(s => s.setting_key === "default_pipeline_name");
      const stagesSetting = settingsData?.find(s => s.setting_key === "pipeline_stages");

      if (stagesSetting?.setting_value) {
        try {
          const configuredStages = JSON.parse(stagesSetting.setting_value) as string[];
          const pipelineName = pipelineNameSetting?.setting_value || "Main";
          const pipelineId = `local_pipeline_${companyId}`;
          
          const stages: PipelineStage[] = configuredStages.map((stageName, index) => ({
            pipeline_id: pipelineId,
            pipeline_name: pipelineName,
            pipeline_stage_id: `local_stage_${index}`,
            stage_name: stageName,
          }));

          setPipelineStages(stages);
          if (stages.length > 0) {
            setSelectedPipeline(stages[0].pipeline_id);
            setSelectedStage(stages[0].pipeline_stage_id);
          }
          return;
        } catch (e) {
          console.error("Failed to parse pipeline_stages setting:", e);
        }
      }

      // Priority 3: ghl_pipelines table (only reached if NO admin config exists)
      const { data: pipelineData } = await supabase
        .from("ghl_pipelines")
        .select("ghl_id, name, stages")
        .eq("company_id", companyId);

      if (pipelineData && pipelineData.length > 0) {
        const stages: PipelineStage[] = [];
        pipelineData.forEach((pipeline: any) => {
          const sortedPipelineStages = [...(pipeline.stages || [])].sort((a: any, b: any) =>
            (a.position ?? 0) - (b.position ?? 0)
          );
          sortedPipelineStages.forEach((stage: any) => {
            stages.push({
              pipeline_id: pipeline.ghl_id,
              pipeline_name: pipeline.name,
              pipeline_stage_id: stage.id,
              stage_name: stage.name,
            });
          });
        });
        setPipelineStages(stages);
        if (stages.length > 0) {
          setSelectedPipeline(stages[0].pipeline_id);
          setSelectedStage(stages[0].pipeline_stage_id);
        }
        return;
      }

      // Fall back to deriving from opportunities scoped by company
      const { data } = await supabase
        .from("opportunities")
        .select("pipeline_id, pipeline_name, pipeline_stage_id, stage_name")
        .eq("company_id", companyId)
        .not("pipeline_id", "is", null)
        .not("pipeline_stage_id", "is", null);

      if (data && data.length > 0) {
        // Get unique pipeline/stage combinations
        const uniqueStages = data.reduce((acc: PipelineStage[], curr) => {
          const exists = acc.find(
            (s) => s.pipeline_id === curr.pipeline_id && s.pipeline_stage_id === curr.pipeline_stage_id,
          );
          if (!exists && curr.pipeline_id && curr.pipeline_name && curr.pipeline_stage_id && curr.stage_name) {
            acc.push({
              pipeline_id: curr.pipeline_id,
              pipeline_name: curr.pipeline_name,
              pipeline_stage_id: curr.pipeline_stage_id,
              stage_name: curr.stage_name,
            });
          }
          return acc;
        }, []);
        setPipelineStages(uniqueStages);

        // Set default to first stage
        if (uniqueStages.length > 0) {
          setSelectedPipeline(uniqueStages[0].pipeline_id);
          setSelectedStage(uniqueStages[0].pipeline_stage_id);
        }
        return;
      }

      // Final fallback: use hardcoded default stages
      const defaultStageNames = ["Lead", "Contacted", "Appointment Set", "2nd Appointment", "Estimate Prepared", "Proposal Sent", "Close to Sale", "Won", "Lost/DNC"];
      const pipelineId = `local_pipeline_${companyId}`;
      const fallbackStages: PipelineStage[] = defaultStageNames.map((stageName, index) => ({
        pipeline_id: pipelineId,
        pipeline_name: "Main",
        pipeline_stage_id: `local_stage_${index}`,
        stage_name: stageName,
      }));
      
      setPipelineStages(fallbackStages);
      setSelectedPipeline(fallbackStages[0].pipeline_id);
      setSelectedStage(fallbackStages[0].pipeline_stage_id);
    };
    fetchPipelineStages();
  }, [open, companyId]);

  // Fetch company Google Calendar first, fallback to GHL calendars
  useEffect(() => {
    if (!companyId) return;
    const fetchCalendars = async () => {
      // First try to get a company Google Calendar
      const { data: googleData } = await supabase
        .from("google_calendar_connections")
        .select("id, calendar_id, calendar_name, is_company_calendar, is_active")
        .eq("company_id", companyId)
        .eq("is_company_calendar", true)
        .eq("is_active", true)
        .limit(1);

      if (googleData && googleData.length > 0) {
        setGoogleCalendar(googleData[0] as GoogleCalendarConnection);
        // Clear GHL calendars since we're using Google
        setCalendars([]);
        return;
      }

      // Fallback to GHL calendars if no Google Calendar
      setGoogleCalendar(null);
      const { data } = await supabase
        .from("ghl_calendars")
        .select("ghl_id, name, is_active, team_members")
        .eq("is_active", true)
        .eq("company_id", companyId);

      if (data) {
        setCalendars(data as GHLCalendar[]);
      }
    };
    fetchCalendars();
  }, [companyId]);

  // Fetch available sources from contacts table + custom sources from localStorage (scoped by company)
  useEffect(() => {
    if (!companyId) return;
    const fetchSources = async () => {
      // Fetch sources and archived sources in parallel
      const [sourcesResult, archivedResult] = await Promise.all([
        supabase
          .from("contacts")
          .select("source")
          .eq("company_id", companyId)
          .not("source", "is", null),
        supabase
          .from("archived_sources")
          .select("source_name")
          .eq("company_id", companyId)
      ]);

      // Normalize to title case and get unique sources
      const normalizeSource = (s: string): string => {
        return s.trim().toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
      };
      
      // Build set of archived source names (lowercase for comparison)
      const archivedSet = new Set(
        (archivedResult.data || []).map(a => a.source_name.toLowerCase())
      );
      
      const normalizedSources = new Set<string>();
      
      // Add sources from database (excluding archived)
      if (sourcesResult.data) {
        sourcesResult.data.forEach((c) => {
          if (c.source) {
            const normalized = normalizeSource(c.source);
            if (!archivedSet.has(normalized.toLowerCase())) {
              normalizedSources.add(normalized);
            }
          }
        });
      }
      
      // Add custom sources from localStorage (excluding archived)
      const customSources = JSON.parse(localStorage.getItem("customSources") || "[]");
      customSources.forEach((s: string) => {
        const normalized = normalizeSource(s);
        if (!archivedSet.has(normalized.toLowerCase())) {
          normalizedSources.add(normalized);
        }
      });
      
      const uniqueSources = [...normalizedSources];
      uniqueSources.sort((a, b) => a.localeCompare(b));
      setAvailableSources(uniqueSources);
    };
    fetchSources();
  }, [companyId]);

  // Auto-select first calendar when rep is selected (or clear if no calendars)
  useEffect(() => {
    if (assignedTo && calendars.length > 0) {
      // Try to find a calendar that has this user as a team member
      const userCalendar = calendars.find((c) => c.team_members?.includes(assignedTo));
      if (userCalendar) {
        setSelectedCalendar(userCalendar.ghl_id);
      } else if (calendars.length === 1) {
        // If only one calendar, auto-select it
        setSelectedCalendar(calendars[0].ghl_id);
      } else {
        // Clear selection to force user to pick
        setSelectedCalendar("");
      }
    } else {
      setSelectedCalendar("");
    }
  }, [assignedTo, calendars]);

  // Check if there are active calendars available (Google or GHL)
  const hasActiveCalendars = useMemo(() => {
    return googleCalendar !== null || calendars.length > 0;
  }, [googleCalendar, calendars]);

  // Get unique pipelines and stages for current pipeline
  const uniquePipelines = pipelineStages.reduce((acc: { id: string; name: string }[], curr) => {
    if (!acc.find((p) => p.id === curr.pipeline_id)) {
      acc.push({ id: curr.pipeline_id, name: curr.pipeline_name });
    }
    return acc;
  }, []);

  const stagesForPipeline = pipelineStages.filter((s) => s.pipeline_id === selectedPipeline);

  const resetForm = () => {
    setFirstName("");
    setLastName("");
    setPhone("");
    setEmail("");
    setAddress("");
    setScope("");
    setNotes("");
    setAppointmentDate("");
    setAppointmentTime("09:00");
    setSource("");
    setAssignedTo("");
    setSelectedCalendar("");
    setPhoneError("");
    setEmailError("");
    setDuplicateContacts([]);
    setDuplicateWarningDismissed(false);
    // Reset to default pipeline/stage
    const defaultStage = pipelineStages.find((s) => s.stage_name === "New Lead (No Contacted Yet)");
    if (defaultStage) {
      setSelectedPipeline(defaultStage.pipeline_id);
      setSelectedStage(defaultStage.pipeline_stage_id);
    }
  };

  const getUserName = (userId: string): string => {
    const user = users.find((u) => u.ghl_id === userId);
    return user?.name || `${user?.first_name || ""} ${user?.last_name || ""}`.trim() || "Unknown";
  };

  const validatePhone = (value: string): boolean => {
    if (!value.trim()) return true; // Optional field
    // Accept various phone formats: (555) 123-4567, 555-123-4567, 5551234567, +1 555 123 4567
    const phoneRegex = /^[\+]?[(]?[0-9]{1,3}[)]?[-\s\.]?[(]?[0-9]{1,3}[)]?[-\s\.]?[0-9]{3,4}[-\s\.]?[0-9]{4}$/;
    const digitsOnly = value.replace(/\D/g, "");
    return phoneRegex.test(value) || (digitsOnly.length >= 10 && digitsOnly.length <= 15);
  };

  const validateEmail = (value: string): boolean => {
    if (!value.trim()) return true; // Optional field
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  };

  const checkForDuplicates = useCallback(async (phoneValue: string, emailValue: string) => {
    if (!companyId) return;
    const trimmedPhone = phoneValue.trim();
    const trimmedEmail = emailValue.trim();
    if (!trimmedPhone && !trimmedEmail) return;

    setIsDuplicateCheckPending(true);
    try {
      let query = supabase
        .from("contacts")
        .select("id, contact_name, first_name, last_name, phone, email, source")
        .eq("company_id", companyId)
        .limit(5);

      if (trimmedPhone && trimmedEmail) {
        query = query.or(`phone.eq.${trimmedPhone},email.ilike.${trimmedEmail}`);
      } else if (trimmedPhone) {
        query = query.eq("phone", trimmedPhone);
      } else {
        query = query.ilike("email", trimmedEmail);
      }

      const { data } = await query;
      setDuplicateContacts(data || []);
    } catch (e) {
      console.error("Duplicate check failed:", e);
    } finally {
      setIsDuplicateCheckPending(false);
    }
  }, [companyId]);

  const handlePhoneChange = (value: string) => {
    setPhone(value);
    setDuplicateWarningDismissed(false);
    if (value.trim() && !validatePhone(value)) {
      setPhoneError("Please enter a valid phone number");
    } else {
      setPhoneError("");
    }
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    setDuplicateWarningDismissed(false);
    if (value.trim() && !validateEmail(value)) {
      setEmailError("Please enter a valid email address");
    } else {
      setEmailError("");
    }
  };

  const handlePhoneBlur = () => {
    if (phone.trim() && validatePhone(phone)) {
      setDuplicateContacts([]);
      checkForDuplicates(phone, email);
    }
  };

  const handleEmailBlur = () => {
    if (email.trim() && validateEmail(email)) {
      setDuplicateContacts([]);
      checkForDuplicates(phone, email);
    }
  };

  const buildAppointmentDateTime = (date: string, time: string): string | null => {
    if (!date) return null;
    const pstOffset = -8; // PST offset
    const [year, month, day] = date.split("-").map(Number);
    const [hours, minutes] = time.split(":").map(Number);
    const utcHours = hours - pstOffset;
    const dateObj = new Date(Date.UTC(year, month - 1, day, utcHours, minutes, 0));
    return dateObj.toISOString();
  };

  const handleSubmitSingle = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      toast.error("First name and last name are required");
      return;
    }

    // Validate phone and email
    if (phone.trim() && !validatePhone(phone)) {
      toast.error("Please enter a valid phone number");
      return;
    }
    if (email.trim() && !validateEmail(email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    // Guard: unreviewed duplicates must be acknowledged first
    if (duplicateContacts.length > 0 && !duplicateWarningDismissed) {
      duplicateWarningRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      toast.warning("Potential duplicate found — please review before proceeding.");
      return;
    }

    setIsSubmitting(true);
    try {
      const appointmentDateTime = buildAppointmentDateTime(appointmentDate, appointmentTime);

      const { data, error } = await supabase.functions.invoke("create-ghl-entry", {
        body: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
          address: address.trim() || null,
          scope: scope.trim() || null,
          notes: notes.trim() || null,
          appointmentDateTime,
          source: source || null,
          assignedTo: assignedTo || null,
          enteredBy: userId || null,
          pipelineId: selectedPipeline || null,
          pipelineStageId: selectedStage || null,
          calendarId: googleCalendar ? googleCalendar.id : (selectedCalendar || null),
          googleCalendarId: googleCalendar ? googleCalendar.calendar_id : null,
          skipGHLAppointmentSync: true, // Default to local-only appointments
          locationId: PRIMARY_LOCATION_ID,
          companyId: companyId,
        },
      });

      if (error) throw error;

      toast.success(`Entry created for ${firstName} ${lastName}`);
      resetForm();
      setOpen(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error creating entry:", error);
      toast.error("Failed to create entry");
    } finally {
      setIsSubmitting(false);
    }
  };

  const parseCSV = (text: string): CSVEntry[] => {
    const lines = text.split("\n").filter((line) => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/['"]/g, ""));
    const entries: CSVEntry[] = [];

    for (let i = 1; i < lines.length; i++) {
      // Parse CSV line handling quoted values
      const values: string[] = [];
      let current = "";
      let inQuotes = false;

      for (const char of lines[i]) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          values.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      values.push(current.trim());

      const entry: CSVEntry = {
        firstName: "",
        lastName: "",
        status: "pending",
      };

      headers.forEach((header, index) => {
        const value = values[index]?.replace(/^["']|["']$/g, "") || "";

        switch (header) {
          case "firstname":
          case "first_name":
          case "first name":
            entry.firstName = value;
            break;
          case "lastname":
          case "last_name":
          case "last name":
            entry.lastName = value;
            break;
          case "phone":
          case "phone number":
            entry.phone = value;
            break;
          case "email":
          case "email address":
            entry.email = value;
            break;
          case "address":
          case "street address":
            entry.address = value;
            break;
          case "scope":
          case "scope of work":
            entry.scope = value;
            break;
          case "notes":
          case "note":
            entry.notes = value;
            break;
          case "appointmentdate":
          case "appointment_date":
          case "appointment date":
          case "date":
            entry.appointmentDate = value;
            break;
          case "appointmenttime":
          case "appointment_time":
          case "appointment time":
          case "time":
            entry.appointmentTime = value || "09:00";
            break;
          case "source":
          case "lead source":
            entry.source = value;
            break;
          case "assignedto":
          case "assigned_to":
          case "assigned to":
          case "rep":
          case "sales rep":
            entry.assignedTo = value;
            break;
        }
      });

      if (entry.firstName || entry.lastName) {
        entries.push(entry);
      }
    }

    return entries;
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const entries = parseCSV(text);
      setCsvEntries(entries);
      if (entries.length === 0) {
        toast.error("No valid entries found in CSV");
      } else {
        toast.success(`Found ${entries.length} entries in CSV`);
      }
    };
    reader.readAsText(file);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleUploadCSV = async () => {
    if (csvEntries.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);

    const updatedEntries = [...csvEntries];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < updatedEntries.length; i++) {
      const entry = updatedEntries[i];

      try {
        // Find assigned user by name if provided
        let assignedToId = entry.assignedTo;
        if (assignedToId && !assignedToId.match(/^[a-zA-Z0-9]{20,}$/)) {
          // Looks like a name, not an ID - try to find the user
          const matchedUser = users.find((u) => {
            const fullName = u.name || `${u.first_name || ""} ${u.last_name || ""}`.trim();
            return fullName.toLowerCase().includes(assignedToId!.toLowerCase());
          });
          assignedToId = matchedUser?.ghl_id || null;
        }

        // Parse appointment date if provided
        let appointmentDateTime: string | null = null;
        if (entry.appointmentDate) {
          // Try to parse various date formats
          let dateStr = entry.appointmentDate;
          if (dateStr.includes("/")) {
            const parts = dateStr.split("/");
            if (parts.length === 3) {
              // Assume MM/DD/YYYY or M/D/YYYY
              const month = parts[0].padStart(2, "0");
              const day = parts[1].padStart(2, "0");
              const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
              dateStr = `${year}-${month}-${day}`;
            }
          }
          appointmentDateTime = buildAppointmentDateTime(dateStr, entry.appointmentTime || "09:00");
        }

        const { error } = await supabase.functions.invoke("create-ghl-entry", {
          body: {
            firstName: entry.firstName.trim(),
            lastName: entry.lastName.trim(),
            phone: entry.phone?.trim() || null,
            email: entry.email?.trim() || null,
            address: entry.address?.trim() || null,
            scope: entry.scope?.trim() || null,
            notes: entry.notes?.trim() || null,
            appointmentDateTime,
            source: entry.source?.trim() || null,
            assignedTo: assignedToId || null,
            enteredBy: userId || null,
            pipelineId: selectedPipeline || null,
            pipelineStageId: selectedStage || null,
            locationId: PRIMARY_LOCATION_ID,
            companyId: companyId,
          },
        });

        if (error) throw error;

        updatedEntries[i] = { ...entry, status: "success" };
        successCount++;
      } catch (error) {
        console.error(`Error creating entry for ${entry.firstName} ${entry.lastName}:`, error);
        updatedEntries[i] = {
          ...entry,
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        };
        errorCount++;
      }

      setCsvEntries([...updatedEntries]);
      setUploadProgress(Math.round(((i + 1) / updatedEntries.length) * 100));

      // Small delay between requests to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    setIsUploading(false);

    if (successCount > 0) {
      toast.success(`Created ${successCount} entries successfully`);
      onSuccess?.();
    }
    if (errorCount > 0) {
      toast.error(`Failed to create ${errorCount} entries`);
    }
  };

  const downloadCSVTemplate = () => {
    const headers = [
      "FirstName",
      "LastName",
      "Phone",
      "Email",
      "Address",
      "Scope",
      "Notes",
      "AppointmentDate",
      "AppointmentTime",
      "Source",
      "AssignedTo",
    ];
    const sampleRow = [
      "John",
      "Doe",
      "(555) 123-4567",
      "john@example.com",
      "123 Main St, City, CA 90210",
      "Kitchen remodel",
      "Initial consultation",
      "12/15/2024",
      "09:00",
      "Google",
      "Sales Rep Name",
    ];

    const csvContent = [headers.join(","), sampleRow.join(",")].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "new_entries_template.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const clearCSV = () => {
    setCsvEntries([]);
    setUploadProgress(0);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          New Entry
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Add New Entry</DialogTitle>
          <DialogDescription>Create a new contact with opportunity and appointment</DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="single">Single Entry</TabsTrigger>
            <TabsTrigger value="csv">CSV Upload</TabsTrigger>
          </TabsList>

          <TabsContent value="single" className="flex-1 overflow-auto">
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="John"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Doe"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    onBlur={handlePhoneBlur}
                    placeholder="(555) 123-4567"
                    className={phoneError ? "border-destructive" : ""}
                  />
                  {phoneError && <p className="text-xs text-destructive">{phoneError}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    onBlur={handleEmailBlur}
                    placeholder="john@example.com"
                    className={emailError ? "border-destructive" : ""}
                  />
                  {emailError && <p className="text-xs text-destructive">{emailError}</p>}
                </div>
              </div>

              {/* Duplicate contact warning */}
              {isDuplicateCheckPending && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Checking for duplicate contacts…
                </div>
              )}
              {!isDuplicateCheckPending && duplicateContacts.length > 0 && !duplicateWarningDismissed && (
                <Alert ref={duplicateWarningRef} className="border-warning/50 bg-warning/10">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  <AlertDescription>
                    <div className="font-medium text-warning mb-2">
                      Potential duplicate{duplicateContacts.length > 1 ? "s" : ""} found
                    </div>
                    <div className="space-y-2 mb-3">
                      {duplicateContacts.map((c) => (
                        <div key={c.id} className="flex items-start gap-2 text-sm">
                          <UserCheck className="h-4 w-4 mt-0.5 text-warning flex-shrink-0" />
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-foreground">
                            <span className="font-medium">
                              {c.contact_name || `${c.first_name || ""} ${c.last_name || ""}`.trim() || "Unknown"}
                            </span>
                            {c.phone && <span className="text-muted-foreground">{c.phone}</span>}
                            {c.email && <span className="text-muted-foreground">{c.email}</span>}
                            {c.source && (
                              <Badge variant="outline" className="text-xs h-5">
                                {c.source}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs border-warning/50 hover:bg-warning/10"
                        onClick={() => setDuplicateWarningDismissed(true)}
                      >
                        Proceed Anyway
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => {
                          setDuplicateContacts([]);
                          setDuplicateWarningDismissed(false);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="123 Main St, City, CA 90210"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="scope">Scope of Work</Label>
                <Input
                  id="scope"
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                  placeholder="Kitchen remodel, ADU construction..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional notes..."
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="appointmentDate">Appointment Date</Label>
                  <Input
                    id="appointmentDate"
                    type="date"
                    value={appointmentDate}
                    onChange={(e) => setAppointmentDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="appointmentTime">Appointment Time (PST)</Label>
                  <Input
                    id="appointmentTime"
                    type="time"
                    value={appointmentTime}
                    onChange={(e) => setAppointmentTime(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="source">Source</Label>
                  <Select value={source} onValueChange={setSource}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select source" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSources.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="assignedTo">Assigned Rep</Label>
                  <Select value={assignedTo} onValueChange={setAssignedTo}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select rep" />
                    </SelectTrigger>
                    <SelectContent>
                      {[...users]
                        .sort((a, b) => {
                          const nameA = (
                            a.name ||
                            `${a.first_name || ""} ${a.last_name || ""}`.trim() ||
                            "Unknown"
                          ).toLowerCase();
                          const nameB = (
                            b.name ||
                            `${b.first_name || ""} ${b.last_name || ""}`.trim() ||
                            "Unknown"
                          ).toLowerCase();
                          return nameA.localeCompare(nameB);
                        })
                        .map((user) => (
                          <SelectItem key={user.ghl_id} value={user.ghl_id}>
                            {user.name || `${user.first_name || ""} ${user.last_name || ""}`.trim() || "Unknown"}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Calendar info - auto-selected for Google, selector for GHL */}
              {assignedTo && (
                <div className="space-y-2">
                  <Label htmlFor="calendar">Calendar</Label>
                  {googleCalendar ? (
                    <div className="flex items-center gap-2 p-3 rounded-md bg-muted border">
                      <span className="text-sm text-muted-foreground">
                        Using: <span className="font-medium text-foreground">{googleCalendar.calendar_name}</span>
                      </span>
                    </div>
                  ) : !hasActiveCalendars ? (
                    <div className="flex items-center gap-2 p-3 rounded-md bg-warning/10 border border-warning/30 text-warning">
                      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                      <span className="text-sm">
                        No active calendars available. Connect a Google Calendar in Admin Settings.
                      </span>
                    </div>
                  ) : (
                    <Select value={selectedCalendar} onValueChange={setSelectedCalendar}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select calendar" />
                      </SelectTrigger>
                      <SelectContent>
                        {[...calendars]
                          .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
                          .map((cal) => (
                          <SelectItem key={cal.ghl_id} value={cal.ghl_id}>
                            {cal.name || "Unnamed Calendar"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pipeline">Pipeline *</Label>
                  <Select
                    value={selectedPipeline}
                    onValueChange={(val) => {
                      setSelectedPipeline(val);
                      // Reset stage when pipeline changes
                      const firstStage = pipelineStages.find((s) => s.pipeline_id === val);
                      setSelectedStage(firstStage?.pipeline_stage_id || "");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select pipeline" />
                    </SelectTrigger>
                    <SelectContent>
                      {uniquePipelines.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stage">Stage *</Label>
                  <Select value={selectedStage} onValueChange={setSelectedStage}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select stage" />
                    </SelectTrigger>
                    <SelectContent>
                      {stagesForPipeline.map((s) => (
                        <SelectItem key={s.pipeline_stage_id} value={s.pipeline_stage_id}>
                          {s.stage_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <DialogFooter className="flex-col items-stretch sm:items-center gap-2">
              {duplicateContacts.length > 0 && !duplicateWarningDismissed && (
                <p className="text-xs text-warning text-center sm:text-left">
                  ⚠ Duplicate found — review above before submitting.
                </p>
              )}
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmitSingle}
                  disabled={isSubmitting || !firstName.trim() || !lastName.trim() || !!phoneError || !!emailError}
                >
                  {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create Entry
                </Button>
              </div>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="csv" className="flex-1 overflow-hidden flex flex-col">
            <div className="space-y-4 py-4 flex-1 overflow-hidden flex flex-col">
              {csvEntries.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8">
                  <FileSpreadsheet className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground text-center mb-4">
                    Upload a CSV file with columns: FirstName, LastName, Phone, Email, Address, Scope, Notes,
                    AppointmentDate, AppointmentTime, Source, AssignedTo
                  </p>
                  <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileSelect} className="hidden" />
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={downloadCSVTemplate}>
                      <Download className="h-4 w-4 mr-2" />
                      Download Template
                    </Button>
                    <Button onClick={() => fileInputRef.current?.click()}>
                      <Upload className="h-4 w-4 mr-2" />
                      Select CSV File
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{csvEntries.length} entries</Badge>
                      <Badge variant="outline" className="text-primary">
                        {csvEntries.filter((e) => e.status === "success").length} success
                      </Badge>
                      <Badge variant="outline" className="text-destructive">
                        {csvEntries.filter((e) => e.status === "error").length} errors
                      </Badge>
                    </div>
                    <Button variant="ghost" size="sm" onClick={clearCSV}>
                      <X className="h-4 w-4 mr-1" />
                      Clear
                    </Button>
                  </div>

                  {isUploading && (
                    <div className="space-y-2">
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <p className="text-sm text-muted-foreground text-center">Uploading... {uploadProgress}%</p>
                    </div>
                  )}

                  <ScrollArea className="flex-1 border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Appointment</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {csvEntries.map((entry, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">
                              {entry.firstName} {entry.lastName}
                            </TableCell>
                            <TableCell>{entry.phone || "-"}</TableCell>
                            <TableCell>{entry.email || "-"}</TableCell>
                            <TableCell>
                              {entry.appointmentDate ? `${entry.appointmentDate} ${entry.appointmentTime || ""}` : "-"}
                            </TableCell>
                            <TableCell>
                              {entry.status === "pending" && <Badge variant="secondary">Pending</Badge>}
                              {entry.status === "success" && (
                                <Badge variant="default" className="bg-primary">
                                  Success
                                </Badge>
                              )}
                              {entry.status === "error" && (
                                <Badge variant="destructive" title={entry.error}>
                                  Error
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleUploadCSV}
                disabled={isUploading || csvEntries.length === 0 || csvEntries.every((e) => e.status !== "pending")}
              >
                {isUploading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Upload {csvEntries.filter((e) => e.status === "pending").length} Entries
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
