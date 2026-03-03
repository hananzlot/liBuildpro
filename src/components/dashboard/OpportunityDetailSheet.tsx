import { useState, useEffect, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { DollarSign, User, Target, Calendar, Clock, FileText, MapPin, Phone, Mail, Briefcase, Megaphone, Pencil, Save, X, Loader2, MessageSquare, RefreshCw, Send, CheckSquare, Plus, Trash2, Check, ExternalLink, ChevronDown, ChevronUp, Copy, Receipt, AlertTriangle, FolderOpen, Trophy, Eye } from "lucide-react";
import { EmailSyncDialog } from "@/components/shared/EmailSyncDialog";
import { useNavigate, useLocation } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { stripHtml, findContactByIdOrGhlId, findUserByIdOrGhlId } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { useCompanyPipelineSettings } from "@/hooks/useCompanyPipelineSettings";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { OpportunitySalesDialog } from "./OpportunitySalesDialog";
import { AppointmentEditDialog } from "./AppointmentEditDialog";
// EstimateBuilderDialog removed - now opens as a tab via navigation
import { EstimatePreviewDialog } from "@/components/estimates/EstimatePreviewDialog";
import { useAppTabs } from "@/contexts/AppTabsContext";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";

// Helper to get PST/PDT offset in hours (uses UTC methods for correctness)
const getPSTOffset = (utcDate: Date): number => {
  // DST in US: second Sunday of March to first Sunday of November
  const year = utcDate.getUTCFullYear();
  const marchSecondSunday = new Date(Date.UTC(year, 2, 8 + (7 - new Date(Date.UTC(year, 2, 1)).getUTCDay()) % 7, 10)); // 2 AM PST = 10 AM UTC
  const novFirstSunday = new Date(Date.UTC(year, 10, 1 + (7 - new Date(Date.UTC(year, 10, 1)).getUTCDay()) % 7, 9)); // 2 AM PDT = 9 AM UTC
  const isDST = utcDate >= marchSecondSunday && utcDate < novFirstSunday;
  return isDST ? 7 : 8; // PDT is UTC-7, PST is UTC-8
};
const CUSTOM_FIELD_IDS = {
  ADDRESS: "b7oTVsUQrLgZt84bHpCn",
  SCOPE_OF_WORK: "KwQRtJT0aMSHnq3mwR68",
  NOTES: "588ddQgiGEg3AWtTQB2i"
};
interface Opportunity {
  id?: string;
  ghl_id: string;
  name: string | null;
  status: string | null;
  monetary_value: number | null;
  pipeline_id: string | null;
  pipeline_name: string | null;
  pipeline_stage_id: string | null;
  stage_name: string | null;
  contact_id: string | null;
  contact_uuid?: string | null;
  assigned_to: string | null;
  ghl_date_added: string | null;
  ghl_date_updated: string | null;
  location_id?: string;
  company_id?: string | null;
  won_at?: string | null;
  scope_of_work?: string | null;
  address?: string | null;
  proposal_link?: string | null;
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
  address?: string | null;
}
interface Contact {
  id: string;
  ghl_id: string;
  contact_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  custom_fields?: unknown;
  location_id?: string;
  attributions?: unknown;
}
interface GHLUser {
  id?: string;
  ghl_id: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  location_id?: string;
}
const PRIMARY_LOCATION_ID = "pVeFrqvtYWNIPRIi0Fmr";
interface Message {
  id: string;
  body: string;
  direction: string;
  status: string;
  type: string;
  dateAdded: string;
  attachments?: any[];
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
  messages?: Message[];
}
interface ContactNote {
  id: string;
  body: string;
  userId: string | null;
  dateAdded: string;
  enteredBy: string | null;
  enteredByName: string | null;
}
interface GHLTask {
  id: string;
  ghl_id: string;
  contact_id: string;
  title: string;
  body: string | null;
  due_date: string | null;
  completed: boolean;
  assigned_to: string | null;
  created_at: string;
}
interface DisplayTask {
  id: string;
  ghl_id: string;
  title: string;
  notes: string | null;
  body?: string | null;
  status: string;
  due_date: string | null;
  assigned_to: string | null;
  created_at: string;
}
interface OpportunityDetailSheetProps {
  opportunity: Opportunity | null;
  appointments: Appointment[];
  contacts: Contact[];
  users: GHLUser[];
  conversations?: Conversation[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Explicit close handler for page mode (called when user clicks close button) */
  onClose?: () => void;
  allOpportunities?: Opportunity[];
  initialTaskGhlId?: string | null;
  /** Render mode: 'sheet' (default) shows in a slide-over, 'page' renders inline content */
  mode?: 'sheet' | 'page';
}
const OPPORTUNITY_STATUSES = ["open", "won", "lost", "abandoned"];
const extractCustomField = (customFields: unknown, fieldId: string): string | null => {
  if (!customFields || !Array.isArray(customFields)) return null;
  const field = customFields.find((f: any) => f.id === fieldId);
  return field?.value || null;
};
export function OpportunityDetailSheet({
  opportunity,
  appointments,
  contacts,
  users,
  conversations = [],
  open,
  onOpenChange,
  onClose,
  allOpportunities = [],
  initialTaskGhlId = null,
  mode = 'sheet'
}: OpportunityDetailSheetProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    user,
    profile,
    isAdmin,
    isProduction,
    isSuperAdmin
  } = useAuth();
  const { companyId } = useCompanyContext();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editedStatus, setEditedStatus] = useState<string>("");
  const [editedStage, setEditedStage] = useState<string>("");
  const [editedPipeline, setEditedPipeline] = useState<string>("");
  const [editedMonetaryValue, setEditedMonetaryValue] = useState<string>("");
  const [editedAssignedTo, setEditedAssignedTo] = useState<string>("");
  const [editedSource, setEditedSource] = useState<string>("");
  const [customSourceInput, setCustomSourceInput] = useState<string>("");
  const [showCustomSourceInput, setShowCustomSourceInput] = useState(false);

  // Track saved values to display immediately after save (before query refresh)
  const [savedValues, setSavedValues] = useState<{
    status?: string;
    stage_name?: string;
    pipeline_name?: string;
    pipeline_id?: string;
    monetary_value?: number;
    assigned_to?: string | null;
    source?: string | null;
  }>({});

  // Real-time conversation fetching
  const [liveConversations, setLiveConversations] = useState<Conversation[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);

  // Contact notes
  const [contactNotesList, setContactNotesList] = useState<ContactNote[]>([]);
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);
  const [newNoteText, setNewNoteText] = useState("");
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [isDeletingNote, setIsDeletingNote] = useState<string | null>(null);
  const [deleteNoteDialogOpen, setDeleteNoteDialogOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);

  // Tasks
  const [tasks, setTasks] = useState<DisplayTask[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskNotes, setTaskNotes] = useState("");
  const [taskAssignee, setTaskAssignee] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskDueTime, setTaskDueTime] = useState("09:00");
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [editingTask, setEditingTask] = useState<DisplayTask | null>(null);
  const [isDeletingTask, setIsDeletingTask] = useState<string | null>(null);
  const [isUpdatingTaskStatus, setIsUpdatingTaskStatus] = useState<string | null>(null);

  // Appointment creation/editing
  const [appointmentDialogOpen, setAppointmentDialogOpen] = useState(false);
  const [appointmentTitle, setAppointmentTitle] = useState("");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [appointmentTime, setAppointmentTime] = useState("09:00");
  const [appointmentAssignee, setAppointmentAssignee] = useState("");
  const [appointmentNotes, setAppointmentNotes] = useState("");
  const [appointmentAddress, setAppointmentAddress] = useState("");
  const [isCreatingAppointment, setIsCreatingAppointment] = useState(false);

  // Estimated cost
  const [estimatedCost, setEstimatedCost] = useState<string>("");
  const [isEditingCost, setIsEditingCost] = useState(false);
  const [isSavingCost, setIsSavingCost] = useState(false);
  const [costError, setCostError] = useState<string | null>(null);

  // Inline Opp Value editing
  const [isEditingOppValue, setIsEditingOppValue] = useState(false);
  const [editedOppValue, setEditedOppValue] = useState("");
  const [isSavingOppValue, setIsSavingOppValue] = useState(false);

  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [appointmentEditDialogOpen, setAppointmentEditDialogOpen] = useState(false);
  const [originalAppointmentDate, setOriginalAppointmentDate] = useState("");
  const [originalAppointmentTime, setOriginalAppointmentTime] = useState("");
  const [updateAppointmentTime, setUpdateAppointmentTime] = useState(false);

  // Delete state
  const [isDeletingOpportunity, setIsDeletingOpportunity] = useState(false);
  const [isDeletingAppointment, setIsDeletingAppointment] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deletePasswordError, setDeletePasswordError] = useState("");

  // Sales dialog state
  const [salesDialogOpen, setSalesDialogOpen] = useState(false);

  // Decline proposals dialog (shown when opp is marked lost)
  const [declineProposalsDialogOpen, setDeclineProposalsDialogOpen] = useState(false);
  const [proposalsToDecline, setProposalsToDecline] = useState<{ id: string; estimate_number: number | null; estimate_title: string | null; customer_name: string | null }[]>([]);
  const [isDecliningProposals, setIsDecliningProposals] = useState(false);

  // Delete project dialog (shown when opp is marked lost and project is in early status)
  const [deleteProjectDialogOpen, setDeleteProjectDialogOpen] = useState(false);
  const [projectsToDelete, setProjectsToDelete] = useState<{ id: string; project_name: string | null; project_address: string | null; status: string | null }[]>([]);
  const [isDeletingProject, setIsDeletingProject] = useState(false);

  // Won project dialog — prompt user before auto-creating a project
  const [wonProjectDialogOpen, setWonProjectDialogOpen] = useState(false);
  const [wonProjectExisting, setWonProjectExisting] = useState<{ id: string; project_name: string | null; project_address: string | null; project_status: string | null }[]>([]);
  const [pendingWonOppGhlId, setPendingWonOppGhlId] = useState<string | null>(null);
  const [isCreatingWonProject, setIsCreatingWonProject] = useState(false);

  // Scope of Work editing
  const [isEditingScope, setIsEditingScope] = useState(false);
  const [editedScope, setEditedScope] = useState("");
  const [isScopeExpanded, setIsScopeExpanded] = useState(false);
  const [isSavingScope, setIsSavingScope] = useState(false);

  // Address editing
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [editedAddress, setEditedAddress] = useState("");
  const [isSavingAddress, setIsSavingAddress] = useState(false);

  // Phone editing
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [editedPhone, setEditedPhone] = useState("");
  const [isSavingPhone, setIsSavingPhone] = useState(false);
  const [savedPhone, setSavedPhone] = useState<string | null>(null);

  // Email editing
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [editedEmail, setEditedEmail] = useState("");
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [savedEmail, setSavedEmail] = useState<string | null>(null);
  const [emailValidationError, setEmailValidationError] = useState<string | null>(null);
  const [emailSyncDialogOpen, setEmailSyncDialogOpen] = useState(false);
  const [pendingEmailChange, setPendingEmailChange] = useState<{ oldEmail: string | null; newEmail: string } | null>(null);

  // Contact name editing
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedFirstName, setEditedFirstName] = useState("");
  const [editedLastName, setEditedLastName] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);
  const [savedContactName, setSavedContactName] = useState<string | null>(null);

  // Opportunity name editing
  const [isEditingOppName, setIsEditingOppName] = useState(false);
  const [editedOppName, setEditedOppName] = useState("");
  const [isSavingOppName, setIsSavingOppName] = useState(false);
  const [savedOppName, setSavedOppName] = useState<string | null>(null);

  // Track if sheet was previously closed, to reset savedValues only on fresh open
  const [wasOpen, setWasOpen] = useState(false);

  // Inline editing states for pipeline, stage, status, and assigned to
  const [isInlineEditingPipeline, setIsInlineEditingPipeline] = useState(false);
  const [isInlineEditingStage, setIsInlineEditingStage] = useState(false);
  const [isInlineEditingStatus, setIsInlineEditingStatus] = useState(false);
  const [isHeaderEditingStatus, setIsHeaderEditingStatus] = useState(false);
  const [isInlineEditingAssignedTo, setIsInlineEditingAssignedTo] = useState(false);
  const [isInlineEditingSource, setIsInlineEditingSource] = useState(false);
  const [isSavingInline, setIsSavingInline] = useState(false);

  // Won date editing (admin only)
  const [isEditingWonAt, setIsEditingWonAt] = useState(false);
  const [editedWonAtDate, setEditedWonAtDate] = useState("");
  const [editedWonAtTime, setEditedWonAtTime] = useState("");
  const [isSavingWonAt, setIsSavingWonAt] = useState(false);
  const [savedWonAt, setSavedWonAt] = useState<string | null>(null);

  // Created date editing (super admin only)
  const [isEditingCreatedAt, setIsEditingCreatedAt] = useState(false);
  const [editedCreatedAtDate, setEditedCreatedAtDate] = useState("");
  const [isSavingCreatedAt, setIsSavingCreatedAt] = useState(false);
  const [savedCreatedAt, setSavedCreatedAt] = useState<string | null>(null);

  // Associated project for production link
  const [associatedProjectId, setAssociatedProjectId] = useState<string | null>(null);
  const [associatedProjects, setAssociatedProjects] = useState<{ id: string; project_name: string | null }[]>([]);
  const [projectsRefreshTick, setProjectsRefreshTick] = useState(0);

  // Portal link for same contact
  const [portalLink, setPortalLink] = useState<string | null>(null);
  
  // Create portal state
  const [isCreatingPortal, setIsCreatingPortal] = useState(false);
  
  // Send thank you email state
  const [isSendingThankYou, setIsSendingThankYou] = useState(false);
  const [showThankYouPreview, setShowThankYouPreview] = useState(false);

  // Linked estimates
  const [linkedEstimates, setLinkedEstimates] = useState<{
    id: string;
    estimate_number: number;
    estimate_title: string;
    status: string;
    total: number;
    created_at: string;
  }[]>([]);

  // Use tabs for estimate builder navigation
  const { openTab } = useAppTabs();
  
  // Estimate preview dialog state
  const [previewEstimateId, setPreviewEstimateId] = useState<string | null>(null);

  // Reset saved values only when sheet opens fresh (was closed, now open)
  useEffect(() => {
    if (open && !wasOpen) {
      setSavedValues({});
      setSavedContactName(null);
      setSavedOppName(null);
      setSavedPhone(null);
      setSavedEmail(null);
      setAssociatedProjectId(null);
      setAssociatedProjects([]);
      setPortalLink(null);
      setSavedWonAt(null);
      setIsEditingWonAt(false);
      setSavedCreatedAt(null);
      setIsEditingCreatedAt(false);
      setLinkedEstimates([]);
      setIsEditingPhone(false);
      setIsEditingAddress(false);
      setIsEditingEmail(false);
    }
    setWasOpen(open);
  }, [open]);

  // Fetch associated project, portal link, and estimates when sheet opens
  useEffect(() => {
    if (!open || !opportunity?.ghl_id) {
      setAssociatedProjectId(null);
      setAssociatedProjects([]);
      setPortalLink(null);
      setLinkedEstimates([]);
      return;
    }
    
    const fetchProjectAndEstimates = async () => {
      // Fetch projects - prefer UUID, fallback to ghl_id
      let projectsQuery = supabase
        .from("projects")
        .select("id, project_name")
        .eq("company_id", companyId)
        .is("deleted_at", null);
      
      if (opportunity.id) {
        projectsQuery = projectsQuery.or(`opportunity_uuid.eq.${opportunity.id}${opportunity.ghl_id ? `,opportunity_id.eq.${opportunity.ghl_id}` : ''}`);
      } else if (opportunity.ghl_id) {
        projectsQuery = projectsQuery.eq("opportunity_id", opportunity.ghl_id);
      }
      
      const { data: projectsData } = await projectsQuery.order("created_at", { ascending: false });
      
      setAssociatedProjects(projectsData || []);
      setAssociatedProjectId(projectsData?.[0]?.id ?? null);

      // Fetch linked estimates (by opportunity_uuid or opportunity_id)
      const oppUuid = opportunity.id || 'none';
      const oppGhlId = opportunity.ghl_id || 'none';
      const { data: estimatesData } = await supabase
        .from("estimates")
        .select("id, estimate_number, estimate_title, status, total, created_at")
        .or(`opportunity_uuid.eq.${oppUuid},opportunity_id.eq.${oppGhlId}`)
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      
      setLinkedEstimates(estimatesData || []);

      // Fetch portal link - check by opportunity first, then by contact
      let foundPortalToken: string | null = null;

      // First: Check for projects linked to this opportunity
      const { data: oppProjects } = await supabase
        .from("projects")
        .select("id")
        .eq("company_id", companyId)
        .or(`opportunity_uuid.eq.${oppUuid},opportunity_id.eq.${oppGhlId}`);

      if (oppProjects && oppProjects.length > 0) {
        const projectIds = oppProjects.map(p => p.id);
        const { data: portalToken } = await supabase
          .from("client_portal_tokens")
          .select("token")
          .in("project_id", projectIds)
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (portalToken?.token) {
          foundPortalToken = portalToken.token;
        }
      }

      // Second: If no portal found, check by contact
      if (!foundPortalToken && (opportunity.contact_id || opportunity.contact_uuid)) {
        let projectsQuery = supabase
          .from("projects")
          .select("id")
          .eq("company_id", companyId);
        
        if (opportunity.contact_uuid) {
          projectsQuery = projectsQuery.eq("contact_uuid", opportunity.contact_uuid);
        } else if (opportunity.contact_id) {
          projectsQuery = projectsQuery.eq("contact_id", opportunity.contact_id);
        }

        const { data: contactProjects } = await projectsQuery;
        
        if (contactProjects && contactProjects.length > 0) {
          const projectIds = contactProjects.map(p => p.id);
          const { data: portalToken } = await supabase
            .from("client_portal_tokens")
            .select("token")
            .in("project_id", projectIds)
            .eq("is_active", true)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (portalToken?.token) {
            foundPortalToken = portalToken.token;
          }
        }
      }

      // Set the portal link if found
      if (foundPortalToken) {
        const { data: baseUrlSetting } = await supabase
          .from("company_settings")
          .select("setting_value")
          .eq("company_id", companyId)
          .eq("setting_key", "app_base_url")
          .maybeSingle();
        
        const baseUrl = baseUrlSetting?.setting_value || window.location.origin;
        setPortalLink(`${baseUrl}/portal/${foundPortalToken}`);
      }
    };
    
    fetchProjectAndEstimates();
  }, [open, opportunity?.ghl_id, opportunity?.id, opportunity?.contact_id, opportunity?.contact_uuid, companyId, projectsRefreshTick, location.pathname]);

  // Fetch active salespeople for the assignment dropdown
  const { data: activeSalespeople = [] } = useQuery({
    queryKey: ["active-salespeople-for-assignment", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("salespeople")
        .select("id, name, ghl_user_id")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });

  // Filter users to primary location only and deduplicate by ghl_id
  const filteredUsers = useMemo(() => {
    const seen = new Set<string>();
    return users.filter(u => {
      if (u.location_id && u.location_id !== PRIMARY_LOCATION_ID) return false;
      if (seen.has(u.ghl_id)) return false;
      seen.add(u.ghl_id);
      return true;
    }).sort((a, b) => {
      const nameA = (a.name || `${a.first_name || ''} ${a.last_name || ''}`.trim() || a.email || 'Unknown').toLowerCase();
      const nameB = (b.name || `${b.first_name || ''} ${b.last_name || ''}`.trim() || b.email || 'Unknown').toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [users]);

  // Pipeline data from ghl_pipelines table
  const [pipelineData, setPipelineData] = useState<{
    ghl_id: string;
    name: string;
    stages: {
      id: string;
      name: string;
      position: number;
    }[];
  }[]>([]);

  // Admin Settings pipeline config (single source of truth when configured)
  const pipelineSettings = useCompanyPipelineSettings(companyId, open);
  const hasAdminPipelineConfig = pipelineSettings.isConfigured;
  const adminPipelineId = pipelineSettings.data?.pipelineId;
  const adminPipelineName = pipelineSettings.data?.pipelineName;
  const adminStageNames = pipelineSettings.data?.stageNames ?? [];
  const adminStageIdByName = pipelineSettings.data?.stageIdByName ?? {};


  // Fetch pipelines when sheet opens
  useEffect(() => {
    // If Admin Settings provides pipeline_stages, we do not use GHL pipelines for options.
    if (!open || !companyId || hasAdminPipelineConfig) return;
    const fetchPipelines = async () => {
      const {
        data
      } = await supabase.from("ghl_pipelines").select("ghl_id, name, stages").eq("company_id", companyId);
      if (data) {
        console.log('Fetched pipeline data:', data);
        setPipelineData(data as {
          ghl_id: string;
          name: string;
          stages: {
            id: string;
            name: string;
            position: number;
          }[];
        }[]);
      }
    };
    fetchPipelines();
  }, [open, companyId, hasAdminPipelineConfig]);

  // Fetch conversations and notes from GHL when sheet opens
  useEffect(() => {
    if (open && opportunity?.contact_id) {
      // Fetch conversations
      const fetchConversations = async () => {
        setIsLoadingConversations(true);
        try {
          const {
            data,
            error
          } = await supabase.functions.invoke("fetch-contact-conversations", {
            body: {
              contact_id: opportunity.contact_id
            }
          });
          if (error) {
            console.error("Error fetching conversations:", error);
          } else if (data?.conversations) {
            setLiveConversations(data.conversations);
          }
        } catch (err) {
          console.error("Failed to fetch conversations:", err);
        } finally {
          setIsLoadingConversations(false);
        }
      };

      // Fetch contact notes
      const fetchNotes = async () => {
        setIsLoadingNotes(true);
        try {
          const {
            data,
            error
          } = await supabase.functions.invoke("fetch-contact-notes", {
            body: {
              contact_id: opportunity.contact_id
            }
          });
          if (error) {
            console.error("Error fetching notes:", error);
          } else if (data?.notes) {
            setContactNotesList(data.notes);
          }
        } catch (err) {
          console.error("Failed to fetch notes:", err);
        } finally {
          setIsLoadingNotes(false);
        }
      };
      // Fetch tasks from tasks table (stored locally, optionally synced with GHL)
      const fetchTasks = async () => {
        setIsLoadingTasks(true);
        try {
          // Optionally sync task status from GHL if connected
          if (opportunity.contact_id) {
            try {
              await supabase.functions.invoke("sync-ghl-tasks", {
                body: {
                  contact_id: opportunity.contact_id
                }
              });
            } catch (syncErr) {
              console.error("Failed to sync tasks:", syncErr);
            }
          }

          // Fetch from tasks table (ghl_tasks) - scoped to company
          // Use OR filter to match tasks by contact_uuid OR contact_id, since locally-created
          // tasks may store the UUID in contact_id instead of contact_uuid
          let tasksQuery = supabase.from("ghl_tasks").select("*");
          const contactRef = opportunity.contact_uuid || opportunity.contact_id;
          if (contactRef) {
            tasksQuery = tasksQuery.or(`contact_uuid.eq.${contactRef},contact_id.eq.${contactRef}`);
          } else {
            tasksQuery = tasksQuery.eq("contact_id", opportunity.contact_id);
          }
          if (companyId) {
            tasksQuery = tasksQuery.eq("company_id", companyId);
          }
          const {
            data,
            error
          } = await tasksQuery.order("due_date", { ascending: true });
          if (error) throw error;
          const tasks: DisplayTask[] = (data || []).map((t: GHLTask) => ({
            id: t.id,
            ghl_id: t.ghl_id,
            title: t.title,
            notes: t.body,
            status: t.completed ? "completed" : "pending",
            due_date: t.due_date,
            assigned_to: t.assigned_to,
            created_at: t.created_at
          }));
          setTasks(tasks);
        } catch (err) {
          console.error("Failed to fetch tasks:", err);
        } finally {
          setIsLoadingTasks(false);
        }
      };

      // Fetch estimated cost - scoped to company
      const fetchEstimatedCost = async () => {
        try {
          const oppKey = opportunity.id || opportunity.ghl_id;
          let costQuery = supabase
            .from("project_costs")
            .select("estimated_cost")
            .eq("opportunity_id", oppKey);
          if (companyId) {
            costQuery = costQuery.eq("company_id", companyId);
          }
          const { data, error } = await costQuery.maybeSingle();
          if (error) throw error;
          if (data) {
            setEstimatedCost(data.estimated_cost?.toString() || "");
          } else {
            setEstimatedCost("");
          }
        } catch (err) {
          console.error("Failed to fetch estimated cost:", err);
        }
      };
      fetchConversations();
      fetchNotes();
      fetchTasks();
      fetchEstimatedCost();
    } else {
      setLiveConversations([]);
      setContactNotesList([]);
      setTasks([]);
      setEstimatedCost("");
    }
  }, [open, opportunity?.contact_id, opportunity?.ghl_id]);

  // Auto-open task edit dialog when initialTaskGhlId is provided and tasks are loaded
  // initialTaskGhlId can be a ghl_id OR a task UUID (for locally-created tasks)
  useEffect(() => {
    if (initialTaskGhlId && tasks.length > 0 && open) {
      const taskToEdit = tasks.find(t => t.ghl_id === initialTaskGhlId || t.id === initialTaskGhlId);
      if (taskToEdit) {
        openEditTaskDialog(taskToEdit);
      }
    }
  }, [initialTaskGhlId, tasks, open]);
  const handleRefreshConversations = async () => {
    if (!opportunity?.contact_id) {
      toast.info("No contact linked to this opportunity");
      return;
    }
    setIsLoadingConversations(true);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke("fetch-contact-conversations", {
        body: {
          contact_id: opportunity.contact_id
        }
      });
      if (error) {
        toast.error("Failed to refresh conversations");
      } else if (data?.conversations) {
        setLiveConversations(data.conversations);
        toast.success(`Found ${data.conversations.length} conversations`);
      }
    } catch (err) {
      toast.error("Failed to refresh conversations");
    } finally {
      setIsLoadingConversations(false);
    }
  };
  const handleCreateNote = async () => {
    if (!opportunity?.contact_id || !newNoteText.trim()) return;
    setIsCreatingNote(true);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke("create-contact-note", {
        body: {
          contactId: opportunity.contact_id,
          body: newNoteText.trim(),
          enteredBy: user?.id || null
        }
      });
      if (error) {
        toast.error("Failed to create note");
        console.error("Error creating note:", error);
      } else if (data?.success) {
        toast.success("Note created");
        setNewNoteText("");

        // Refresh notes list
        const {
          data: refreshData
        } = await supabase.functions.invoke("fetch-contact-notes", {
          body: {
            contact_id: opportunity.contact_id
          }
        });
        if (refreshData?.notes) {
          setContactNotesList(refreshData.notes);
        }
      }
    } catch (err) {
      toast.error("Failed to create note");
      console.error("Failed to create note:", err);
    } finally {
      setIsCreatingNote(false);
    }
  };

  // Delete note handler (admin only)
  const handleDeleteNote = async (noteId: string) => {
    if (!opportunity?.contact_id) return;
    setIsDeletingNote(noteId);
    try {
      // Delete from local database
      const { error } = await supabase
        .from("contact_notes")
        .delete()
        .eq("id", noteId);
      
      if (error) {
        toast.error("Failed to delete note");
        console.error("Error deleting note:", error);
      } else {
        toast.success("Note deleted");
        // Remove from local state
        setContactNotesList(prev => prev.filter(n => n.id !== noteId));
      }
    } catch (err) {
      toast.error("Failed to delete note");
      console.error("Failed to delete note:", err);
    } finally {
      setIsDeletingNote(null);
      setDeleteNoteDialogOpen(false);
      setNoteToDelete(null);
    }
  };

  const refreshTasksList = async () => {
    if (!opportunity?.contact_id) return;
    const {
      data,
      error
    } = await supabase.from("ghl_tasks").select("*").eq("contact_id", opportunity.contact_id).order("due_date", {
      ascending: true
    });
    if (error) {
      console.error("Failed to refresh tasks:", error);
      return;
    }
    const tasks: DisplayTask[] = (data || []).map((t: GHLTask) => ({
      id: t.id,
      ghl_id: t.ghl_id,
      title: t.title,
      notes: t.body,
      status: t.completed ? "completed" : "pending",
      due_date: t.due_date,
      assigned_to: t.assigned_to,
      created_at: t.created_at
    }));
    setTasks(tasks);
  };
  const openTaskDialog = () => {
    const contact = findContactByIdOrGhlId(contacts, opportunity?.contact_uuid, opportunity?.contact_id);
    const contactName = contact?.contact_name || `${contact?.first_name || ""} ${contact?.last_name || ""}`.trim() || "";
    setTaskTitle(`Follow up: ${opportunity?.name || contactName || "Opportunity"}`);
    setTaskNotes("");
    // Auto-assign to current user (with option to reassign in the dialog)
    const currentUserGhlId = profile?.ghl_user_id;
    setTaskAssignee(currentUserGhlId || "__unassigned__");
    setTaskDueDate("");
    setTaskDueTime("09:00");
    setTaskDialogOpen(true);
  };
  const handleCreateTask = async () => {
    if (!opportunity || !taskTitle.trim()) {
      toast.error("Please enter a task title");
      return;
    }
    setIsCreatingTask(true);
    try {
      const contact = findContactByIdOrGhlId(contacts, opportunity.contact_uuid, opportunity.contact_id);
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
      const ghlResponse = await supabase.functions.invoke("create-ghl-task", {
        body: {
          title: taskTitle.trim(),
          body: taskNotes.trim() || null,
          dueDate: dueDateValue,
          assignedTo: assignedToValue,
          contactId: opportunity.contact_id,
          contactUuid: opportunity.contact_uuid || null,
          locationId: locationId,
          enteredBy: user?.id || null,
          companyId: opportunity.company_id || companyId || null,
        }
      });
      if (ghlResponse.error) {
        console.error("Task creation error:", ghlResponse.error);
        toast.error("Failed to create task");
        return;
      }
      toast.success("Task created");

      // Refresh tasks list (local state)
      await refreshTasksList();
      
      // Invalidate global tasks query so OpportunitiesTable updates
      queryClient.invalidateQueries({ queryKey: ["ghl_tasks"] });
      
      setTaskDialogOpen(false);
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
  const openEditTaskDialog = (task: DisplayTask) => {
    setEditingTask(task);
    setTaskTitle(task.title);
    setTaskNotes(task.notes || "");
    setTaskAssignee(task.assigned_to || "__unassigned__");
    if (task.due_date) {
      // Convert UTC to PST for display
      const utcDate = new Date(task.due_date);
      const pstOffset = getPSTOffset(utcDate);
      const pstDate = new Date(utcDate.getTime() - pstOffset * 60 * 60 * 1000);
      setTaskDueDate(pstDate.toISOString().split("T")[0]);
      setTaskDueTime(pstDate.toISOString().split("T")[1].substring(0, 5));
    } else {
      setTaskDueDate("");
      setTaskDueTime("09:00");
    }
    setTaskDialogOpen(true);
  };
  const handleUpdateTask = async () => {
    if (!editingTask || !taskTitle.trim()) {
      toast.error("Please enter a task title");
      return;
    }
    setIsCreatingTask(true);
    try {
      const assignedToValue = taskAssignee && taskAssignee !== "__unassigned__" ? taskAssignee : null;
      let dueDateValue: string | null = null;
      if (taskDueDate) {
        const timeStr = taskDueTime || "09:00";
        // Treat input as PST: parse as UTC then add PST offset to get actual UTC
        const pstOffset = getPSTOffset(new Date(`${taskDueDate}T12:00:00Z`));
        const tempUtcDate = new Date(`${taskDueDate}T${timeStr}:00.000Z`);
        const utcDate = new Date(tempUtcDate.getTime() + pstOffset * 60 * 60 * 1000);
        dueDateValue = utcDate.toISOString();
      }

      // Update ghl_tasks table with edited_by and edited_at
      const {
        error
      } = await supabase.from("ghl_tasks").update({
        title: taskTitle.trim(),
        body: taskNotes.trim() || null,
        assigned_to: assignedToValue,
        due_date: dueDateValue,
        edited_by: user?.id || null,
        edited_at: new Date().toISOString()
      }).eq("id", editingTask.id);
      if (error) throw error;

      // Record edits in task_edits table for each changed field
      const editsToInsert: {
        task_ghl_id: string;
        contact_ghl_id: string | null;
        field_name: string;
        old_value: string | null;
        new_value: string | null;
        edited_by: string | null;
        location_id: string | null;
        company_id: string | null;
      }[] = [];
      if (editingTask.ghl_id) {
        if (editingTask.title !== taskTitle.trim()) {
          editsToInsert.push({
            task_ghl_id: editingTask.ghl_id,
            contact_ghl_id: opportunity?.contact_id || null,
            field_name: "title",
            old_value: editingTask.title || null,
            new_value: taskTitle.trim(),
            edited_by: user?.id || null,
            location_id: opportunity?.location_id || null,
            company_id: companyId,
          });
        }
        if ((editingTask.body || "") !== (taskNotes.trim() || "")) {
          editsToInsert.push({
            task_ghl_id: editingTask.ghl_id,
            contact_ghl_id: opportunity?.contact_id || null,
            field_name: "body",
            old_value: editingTask.body || null,
            new_value: taskNotes.trim() || null,
            edited_by: user?.id || null,
            location_id: opportunity?.location_id || null,
            company_id: companyId,
          });
        }
        if (editingTask.assigned_to !== assignedToValue) {
          editsToInsert.push({
            task_ghl_id: editingTask.ghl_id,
            contact_ghl_id: opportunity?.contact_id || null,
            field_name: "assigned_to",
            old_value: editingTask.assigned_to || null,
            new_value: assignedToValue || null,
            edited_by: user?.id || null,
            location_id: opportunity?.location_id || null,
            company_id: companyId,
          });
        }
        if (editingTask.due_date !== dueDateValue) {
          editsToInsert.push({
            task_ghl_id: editingTask.ghl_id,
            contact_ghl_id: opportunity?.contact_id || null,
            field_name: "due_date",
            old_value: editingTask.due_date || null,
            new_value: dueDateValue || null,
            edited_by: user?.id || null,
            location_id: opportunity?.location_id || null,
            company_id: companyId,
          });
        }
        if (editsToInsert.length > 0) {
          await supabase.from("task_edits").insert(editsToInsert);
        }
      }

      // Sync to GHL
      if (editingTask.ghl_id && opportunity?.contact_id) {
        try {
          await supabase.functions.invoke("update-ghl-task", {
            body: {
              contactId: opportunity.contact_id,
              taskId: editingTask.ghl_id,
              title: taskTitle.trim(),
              body: taskNotes.trim() || null,
              dueDate: dueDateValue,
              assignedTo: assignedToValue
            }
          });
        } catch (ghlErr) {
          console.error("Failed to update in GHL:", ghlErr);
        }
      }
      toast.success("Task updated");

      // Refresh tasks list (local state)
      await refreshTasksList();
      
      // Invalidate global queries so OpportunitiesTable updates
      queryClient.invalidateQueries({ queryKey: ["ghl_tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task_edits"] });
      
      setTaskDialogOpen(false);
      setEditingTask(null);
      setTaskTitle("");
      setTaskNotes("");
      setTaskAssignee("");
      setTaskDueDate("");
      setTaskDueTime("");
    } catch (err) {
      console.error("Error updating task:", err);
      toast.error("Failed to update task");
    } finally {
      setIsCreatingTask(false);
    }
  };
  const handleDeleteTask = async (task: DisplayTask) => {
    setIsDeletingTask(task.id);
    try {
      // Delete from ghl_tasks table
      const {
        error
      } = await supabase.from("ghl_tasks").delete().eq("id", task.id);
      if (error) throw error;

      // Also delete from GHL API
      if (task.ghl_id && opportunity?.contact_id) {
        try {
          await supabase.functions.invoke("delete-ghl-task", {
            body: {
              contactId: opportunity.contact_id,
              taskId: task.ghl_id
            }
          });
        } catch (ghlErr) {
          console.error("Failed to delete from GHL:", ghlErr);
        }
      }
      setTasks(prev => prev.filter(t => t.id !== task.id));
      
      // Invalidate global tasks query so OpportunitiesTable updates
      queryClient.invalidateQueries({ queryKey: ["ghl_tasks"] });
      
      toast.success("Task deleted");
    } catch (err) {
      console.error("Error deleting task:", err);
      toast.error("Failed to delete task");
    } finally {
      setIsDeletingTask(null);
    }
  };
  const handleToggleTaskStatus = async (task: DisplayTask) => {
    setIsUpdatingTaskStatus(task.id);
    const newStatus = task.status === "completed" ? "pending" : "completed";
    const isCompleted = newStatus === "completed";
    const oldCompleted = task.status === "completed";
    try {
      // Update ghl_tasks table with edit tracking
      const {
        error
      } = await supabase.from("ghl_tasks").update({
        completed: isCompleted,
        edited_by: user?.id || null,
        edited_at: new Date().toISOString()
      }).eq("id", task.id);
      if (error) throw error;

      // Record edit in task_edits table
      if (task.ghl_id) {
        await supabase.from("task_edits").insert({
          task_ghl_id: task.ghl_id,
          contact_ghl_id: opportunity?.contact_id || null,
          field_name: "completed",
          old_value: String(oldCompleted),
          new_value: String(isCompleted),
          edited_by: user?.id || null,
          location_id: opportunity?.location_id || null,
          company_id: companyId,
        });
      }

      // Sync completion status to GHL
      if (task.ghl_id && opportunity?.contact_id) {
        try {
          await supabase.functions.invoke("update-ghl-task", {
            body: {
              contactId: opportunity.contact_id,
              taskId: task.ghl_id,
              completed: isCompleted
            }
          });
        } catch (ghlErr) {
          console.error("Failed to sync status to GHL:", ghlErr);
        }
      }
      setTasks(prev => prev.map(t => t.id === task.id ? {
        ...t,
        status: newStatus
      } : t));
      
      // Invalidate global queries so OpportunitiesTable updates
      queryClient.invalidateQueries({ queryKey: ["ghl_tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task_edits"] });
      
      toast.success(newStatus === "completed" ? "Task completed" : "Task reopened");
    } catch (err) {
      console.error("Error updating task status:", err);
      toast.error("Failed to update task status");
    } finally {
      setIsUpdatingTaskStatus(null);
    }
  };

  // Appointment creation handlers
  const openAppointmentDialog = () => {
    const contact = findContactByIdOrGhlId(contacts, opportunity?.contact_uuid, opportunity?.contact_id);
    const contactName = contact?.contact_name || `${contact?.first_name || ""} ${contact?.last_name || ""}`.trim() || "";
    setAppointmentTitle(`Appointment - ${contactName || opportunity?.name || "Contact"}`);
    setAppointmentDate("");
    setAppointmentTime("09:00");
    setAppointmentAssignee(opportunity?.assigned_to || "__unassigned__");
    setAppointmentNotes("");
    // Prefill address from contact's custom_fields
    const contactAddress = contact?.custom_fields ? (Array.isArray(contact.custom_fields) ? contact.custom_fields.find((f: {
      id?: string;
    }) => f.id === CUSTOM_FIELD_IDS.ADDRESS)?.value : null) || "" : "";
    setAppointmentAddress(contactAddress);
    setAppointmentDialogOpen(true);
  };
  const handleCreateAppointment = async () => {
    if (!opportunity || !appointmentDate || !appointmentTitle.trim()) {
      toast.error("Please enter appointment title and date");
      return;
    }

    setIsCreatingAppointment(true);
    try {
      const contact = findContactByIdOrGhlId(contacts, opportunity.contact_uuid, opportunity.contact_id);
      const locationId = contact?.location_id || "pVeFrqvtYWNIPRIi0Fmr";
      
      // Get the selected salesperson (if any) and extract both IDs
      const selectedSalesperson = appointmentAssignee && appointmentAssignee !== "__unassigned__"
        ? activeSalespeople.find(sp => sp.id === appointmentAssignee)
        : null;
      // Use internal salesperson UUID
      const assignedToUuid = selectedSalesperson?.id || null;

      // Treat input as PST
      const timeStr = appointmentTime || "09:00";
      const pstOffset = getPSTOffset(new Date(`${appointmentDate}T12:00:00Z`));
      const tempUtcDate = new Date(`${appointmentDate}T${timeStr}:00.000Z`);
      const utcDate = new Date(tempUtcDate.getTime() + pstOffset * 60 * 60 * 1000);

      // Always create locally (Supabase-first approach) - no GHL calendar dependency
      const response = await supabase.functions.invoke("create-ghl-appointment", {
        body: {
          contactId: opportunity.contact_id,
          contactUuid: opportunity.contact_uuid || null,
          locationId,
          title: appointmentTitle.trim(),
          startTime: utcDate.toISOString(),
          calendarId: null,
          assignedUserId: assignedToUuid,
          salespersonId: assignedToUuid, // Internal UUID for database
          address: appointmentAddress.trim() || null,
          notes: appointmentNotes.trim() || null,
          enteredBy: user?.id || null,
          companyId: opportunity.company_id || companyId || null,
          skipGHLSync: true // Always local-first
        }
      });

      if (response.error) {
        console.error("Appointment creation error:", response.error);
        const apiError = (response.data as any)?.error as string | undefined;
        toast.error(apiError || "Failed to create appointment");
        return;
      }

      toast.success("Appointment created");

      // Invalidate queries to refresh appointment data
      queryClient.invalidateQueries({
        queryKey: ["appointments"]
      });
      setAppointmentDialogOpen(false);
      setEditingAppointment(null);
      setAppointmentTitle("");
      setAppointmentDate("");
      setAppointmentTime("09:00");
      setAppointmentAssignee("");
      setAppointmentNotes("");
      setAppointmentAddress("");
    } catch (err) {
      console.error("Error creating appointment:", err);
      toast.error("Failed to create appointment");
    } finally {
      setIsCreatingAppointment(false);
    }
  };
  const openEditAppointmentDialog = (appt: Appointment) => {
    // Extend the appointment with assigned_user_id if available from the appointments list
    const relatedAppts = appointments.filter(a => a.ghl_id === appt.ghl_id);
    const apptWithUser = relatedAppts[0];
    const extendedAppt = {
      ...appt,
      assigned_user_id: (apptWithUser as any)?.assigned_user_id || null
    };
    setEditingAppointment(extendedAppt);
    setAppointmentEditDialogOpen(true);
  };
  const handleUpdateAppointment = async () => {
    if (!editingAppointment || !appointmentDate || !appointmentTitle.trim()) {
      toast.error("Please enter appointment title and date");
      return;
    }
    setIsCreatingAppointment(true);
    try {
      const assignedToValue = appointmentAssignee && appointmentAssignee !== "__unassigned__" ? appointmentAssignee : null;

      // Build update payload - only include startTime if date/time actually changed
      const updateBody: Record<string, unknown> = {
        ghl_id: editingAppointment.ghl_id,
        title: appointmentTitle.trim(),
        assignedUserId: assignedToValue,
        address: appointmentAddress.trim() || null,
        notes: appointmentNotes.trim() || null
      };

      // Only send startTime if:
      // - Creating new appointment (not editing), OR
      // - Editing AND user explicitly checked "Reschedule appointment" checkbox
      const shouldUpdateTime = editingAppointment ? updateAppointmentTime : true;
      console.log("DateTime check:", {
        isEditing: !!editingAppointment,
        updateAppointmentTime,
        shouldUpdateTime
      });
      if (shouldUpdateTime) {
        const timeStr = appointmentTime || "09:00";
        const pstOffset = getPSTOffset(new Date(`${appointmentDate}T12:00:00Z`));
        const tempUtcDate = new Date(`${appointmentDate}T${timeStr}:00.000Z`);
        const utcDate = new Date(tempUtcDate.getTime() + pstOffset * 60 * 60 * 1000);

        // Check if the new time is in the past - GHL won't allow past time slots
        if (utcDate < new Date()) {
          toast.error("Cannot reschedule to a past date/time. GHL requires future time slots.");
          setIsCreatingAppointment(false);
          return;
        }
        updateBody.startTime = utcDate.toISOString();
      }
      // Note: If checkbox is unchecked, we don't send startTime at all
      // This allows editing title/notes/assignee without triggering GHL slot validation

      console.log("Appointment update payload:", JSON.stringify(updateBody));
      const response = await supabase.functions.invoke("update-ghl-appointment", {
        body: updateBody
      });
      if (response.error) {
        console.error("Appointment update error:", response.error);
        console.log("Response data:", response.data);
        // The error message from edge function is in response.data
        const errorData = response.data as {
          error?: string;
        } | null;
        const errorMsg = errorData?.error || "";
        if (errorMsg.includes("slot") || errorMsg.includes("available")) {
          toast.error("This time slot is not available in GHL. Try a time on the hour/half-hour, or only update title/notes.");
        } else if (errorMsg) {
          toast.error(errorMsg);
        } else {
          toast.error("Failed to update appointment");
        }
        return;
      }
      toast.success("Appointment updated");

      // Invalidate queries to refresh appointment data
      queryClient.invalidateQueries({
        queryKey: ["appointments"]
      });
      setAppointmentDialogOpen(false);
      setEditingAppointment(null);
      setAppointmentTitle("");
      setAppointmentDate("");
      setAppointmentTime("09:00");
      setAppointmentAssignee("");
      setAppointmentNotes("");
      
      setOriginalAppointmentDate("");
      setOriginalAppointmentTime("");
    } catch (err) {
      console.error("Error updating appointment:", err);
      toast.error("Failed to update appointment");
    } finally {
      setIsCreatingAppointment(false);
    }
  };

  // Build pipeline list (Admin Settings ONLY when configured)
  const availablePipelines = hasAdminPipelineConfig && adminPipelineId ? [{
    id: adminPipelineId,
    name: adminPipelineName || "Main"
  }] : pipelineData.length > 0 ? pipelineData.map(p => ({
    id: p.ghl_id,
    name: p.name
  })).sort((a, b) => a.name.localeCompare(b.name)) : Array.from(allOpportunities.reduce((map, o) => {
    if (o.pipeline_id && o.pipeline_name) map.set(o.pipeline_id, o.pipeline_name);
    return map;
  }, new Map<string, string>())).map(([id, name]) => ({
    id,
    name
  })).sort((a, b) => a.name.localeCompare(b.name));

  // Build stages for the currently selected/edited pipeline
  const activePipelineId = hasAdminPipelineConfig && adminPipelineId
    ? adminPipelineId
    : (isEditing ? editedPipeline : savedValues.pipeline_id ?? opportunity?.pipeline_id);
  const activePipeline = pipelineData.find(p => p.ghl_id === activePipelineId);

  // Build stage map (Admin Settings ONLY when configured)
  const stageMap = new Map<string, string>();
  if (hasAdminPipelineConfig) {
    adminStageNames.forEach((name) => {
      stageMap.set(name, adminStageIdByName[name] || "");
    });
  } else if (activePipeline && activePipeline.stages?.length > 0) {
    // Use stages from ghl_pipelines table (sorted by position)
    const sortedStages = [...activePipeline.stages].sort((a, b) => (a.position || 0) - (b.position || 0));
    sortedStages.forEach(s => stageMap.set(s.name, s.id));
  } else {
    // Fall back to deriving from opportunities
    allOpportunities.forEach(o => {
      if (o.stage_name && o.pipeline_stage_id && o.pipeline_id === activePipelineId) {
        stageMap.set(o.stage_name, o.pipeline_stage_id);
      }
    });
  }
  const availableStages = hasAdminPipelineConfig ? adminStageNames : Array.from(stageMap.keys());

  // Build unique sources list from all contacts (properly capitalized) + custom sources from localStorage
  const normalizeSourceName = (sourceName: string): string => {
    if (!sourceName) return "Direct";
    return sourceName.toLowerCase().split(/[\s-_]+/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };
  const { data: archivedSourcesData = [] } = useQuery({
    queryKey: ["archived-sources", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase
        .from("archived_sources")
        .select("source_name")
        .eq("company_id", companyId);
      return data || [];
    },
    enabled: !!companyId,
  });

  const availableSources = useMemo(() => {
    const archivedSet = new Set(
      archivedSourcesData.map(a => a.source_name.toLowerCase())
    );
    const sourceSet = new Set<string>();
    // Add sources from contacts (excluding archived)
    contacts.forEach(c => {
      if (c.source) {
        const normalized = normalizeSourceName(c.source);
        if (!archivedSet.has(normalized.toLowerCase())) {
          sourceSet.add(normalized);
        }
      }
    });
    // Add custom sources from localStorage (excluding archived)
    try {
      const customSources = JSON.parse(localStorage.getItem("customSources") || "[]");
      customSources.forEach((s: string) => {
        const normalized = normalizeSourceName(s);
        if (!archivedSet.has(normalized.toLowerCase())) {
          sourceSet.add(normalized);
        }
      });
    } catch (e) {
      console.error("Error parsing custom sources:", e);
    }
    return Array.from(sourceSet).sort();
  }, [contacts, archivedSourcesData]);
  const handleEditClick = () => {
    // Use savedValues if available (for re-editing without closing), otherwise use opportunity prop
    setEditedStatus(savedValues.status ?? opportunity?.status?.toLowerCase() ?? "open");

    const pipelineIdToUse = hasAdminPipelineConfig && adminPipelineId
      ? adminPipelineId
      : (savedValues.pipeline_id ?? opportunity?.pipeline_id ?? "");

    const currentStage = savedValues.stage_name ?? opportunity?.stage_name ?? "";
    const stageToUse = hasAdminPipelineConfig
      ? (adminStageNames.includes(currentStage) ? currentStage : (adminStageNames[0] || ""))
      : currentStage;

    setEditedPipeline(pipelineIdToUse);
    setEditedStage(stageToUse);
    setEditedMonetaryValue((savedValues.monetary_value ?? opportunity?.monetary_value)?.toString() ?? "0");
    
    // Find matching salesperson for the assigned_to value and use internal ID
    const rawAssignedTo = savedValues.assigned_to ?? opportunity?.assigned_to;
    const matchingSalesperson = activeSalespeople.find(
      sp => sp.id === rawAssignedTo || sp.ghl_user_id === rawAssignedTo
    );
    // Always use internal salesperson ID for the dropdown value
    const assignedToValue = matchingSalesperson?.id || "__unassigned__";
    setEditedAssignedTo(assignedToValue);
    const contact = findContactByIdOrGhlId(contacts, opportunity?.contact_uuid, opportunity?.contact_id);
    const contactSource = contact?.source ? normalizeSourceName(contact.source) : "";
    setEditedSource(savedValues.source ?? contactSource);
    setShowCustomSourceInput(false);
    setCustomSourceInput("");
    setIsEditing(true);
  };
  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedStatus("");
    setEditedPipeline("");
    setEditedStage("");
    setEditedMonetaryValue("");
    setEditedAssignedTo("");
    setEditedSource("");
    setShowCustomSourceInput(false);
    setCustomSourceInput("");
  };
  const handlePipelineChange = (newPipelineId: string) => {
    setEditedPipeline(newPipelineId);
    // Reset stage when pipeline changes
    if (hasAdminPipelineConfig) {
      setEditedStage(adminStageNames[0] || "");
      return;
    }
    const stagesForNewPipeline = allOpportunities
      .filter(o => o.pipeline_id === newPipelineId && o.stage_name && o.pipeline_stage_id)
      .map(o => o.stage_name!)
      .filter((v, i, a) => a.indexOf(v) === i)
      .sort();
    setEditedStage(stagesForNewPipeline[0] || "");
  };

  // Inline save for pipeline change (without entering full edit mode)
  const handleInlinePipelineChange = async (newPipelineId: string) => {
    if (!opportunity) return;
    setIsSavingInline(true);
    try {
      const pipelineIdToUse = hasAdminPipelineConfig && adminPipelineId ? adminPipelineId : newPipelineId;
      const newPipelineName = hasAdminPipelineConfig
        ? (adminPipelineName || "Main")
        : (pipelineData.find(p => p.ghl_id === newPipelineId)?.name || allOpportunities.find(o => o.pipeline_id === newPipelineId)?.pipeline_name || "");

      let newStageName = opportunity.stage_name || "";
      let newStageId = opportunity.pipeline_stage_id || "";

      if (hasAdminPipelineConfig) {
        newStageName = adminStageNames[0] || newStageName;
        newStageId = adminStageIdByName[newStageName] || newStageId;
      } else {
        // Get first stage for new pipeline from ghl_pipelines
        const pipelineForStages = pipelineData.find(p => p.ghl_id === newPipelineId);
        let stagesForNewPipeline: {
          name: string;
          id: string;
        }[] = [];
        if (pipelineForStages && pipelineForStages.stages?.length > 0) {
          stagesForNewPipeline = [...pipelineForStages.stages].sort((a, b) => (a.position || 0) - (b.position || 0)).map(s => ({
            name: s.name,
            id: s.id
          }));
        } else {
          stagesForNewPipeline = allOpportunities
            .filter(o => o.pipeline_id === newPipelineId && o.stage_name && o.pipeline_stage_id)
            .map(o => ({
              name: o.stage_name!,
              id: o.pipeline_stage_id!
            }))
            .filter((v, i, a) => a.findIndex(x => x.name === v.name) === i)
            .sort((a, b) => a.name.localeCompare(b.name));
        }
        newStageName = stagesForNewPipeline[0]?.name || newStageName;
        newStageId = stagesForNewPipeline[0]?.id || newStageId;
      }
      const {
        data,
        error
      } = await supabase.functions.invoke("update-ghl-opportunity", {
        body: {
          ghl_id: opportunity.ghl_id,
          opportunity_uuid: opportunity.id,
          pipeline_id: pipelineIdToUse,
          pipeline_name: newPipelineName,
          stage_name: newStageName,
          pipeline_stage_id: newStageId,
          edited_by: user?.id || null
        }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setSavedValues(prev => ({
        ...prev,
        pipeline_name: newPipelineName,
        pipeline_id: pipelineIdToUse,
        stage_name: newStageName
      }));
      toast.success("Pipeline updated");
      setIsInlineEditingPipeline(false);
      queryClient.invalidateQueries({
        queryKey: ["opportunities"]
      });
      queryClient.invalidateQueries({
        queryKey: ["opportunity_edits"]
      });
    } catch (error) {
      console.error("Error updating pipeline:", error);
      toast.error("Failed to update pipeline");
    } finally {
      setIsSavingInline(false);
    }
  };

  // Inline save for stage change (without entering full edit mode)
  const handleInlineStageChange = async (newStageName: string) => {
    if (!opportunity) return;
    setIsSavingInline(true);
    try {
      const newStageId = hasAdminPipelineConfig
        ? (adminStageIdByName[newStageName] || "")
        : (stageMap.get(newStageName) || "");
      const {
        data,
        error
      } = await supabase.functions.invoke("update-ghl-opportunity", {
        body: {
          ghl_id: opportunity.ghl_id,
          opportunity_uuid: opportunity.id,
          stage_name: newStageName,
          pipeline_stage_id: newStageId,
          edited_by: user?.id || null
        }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setSavedValues(prev => ({
        ...prev,
        stage_name: newStageName
      }));
      toast.success("Stage updated");
      setIsInlineEditingStage(false);
      queryClient.invalidateQueries({
        queryKey: ["opportunities"]
      });
      queryClient.invalidateQueries({
        queryKey: ["opportunity_edits"]
      });
    } catch (error) {
      console.error("Error updating stage:", error);
      toast.error("Failed to update stage");
    } finally {
      setIsSavingInline(false);
    }
  };

  // Inline save for assigned_to change (without entering full edit mode)
  const handleInlineAssignedToChange = async (newAssignedTo: string) => {
    if (!opportunity) return;
    setIsSavingInline(true);
    try {
      // Convert "__unassigned__" to null
      const assignedToValue = newAssignedTo === "__unassigned__" ? null : newAssignedTo;
      
      const { data, error } = await supabase.functions.invoke("update-ghl-opportunity", {
        body: {
          ghl_id: opportunity.ghl_id,
          opportunity_uuid: opportunity.id,
          assigned_to: assignedToValue,
          edited_by: user?.id || null
        }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      setSavedValues(prev => ({
        ...prev,
        assigned_to: assignedToValue
      }));
      toast.success("Assignment updated");
      setIsInlineEditingAssignedTo(false);
      queryClient.invalidateQueries({
        queryKey: ["opportunities"]
      });
      queryClient.invalidateQueries({
        queryKey: ["opportunity_edits"]
      });
    } catch (error) {
      console.error("Error updating assigned to:", error);
      toast.error("Failed to update assignment");
    } finally {
      setIsSavingInline(false);
    }
  };

  // Inline save for source change (without entering full edit mode)
  const handleInlineSourceChange = async (newSource: string) => {
    if (!opportunity || newSource === "__placeholder__" || newSource === "__custom__") return;
    setIsSavingInline(true);
    try {
      const contact = findContactByIdOrGhlId(contacts, opportunity.contact_uuid, opportunity.contact_id);
      const originalSource = contact?.source || "";
      if (newSource !== originalSource && (opportunity.contact_id || opportunity.contact_uuid)) {
        await supabase.functions.invoke("update-contact-source", {
          body: {
            contactId: opportunity.contact_id,
            contactUuid: opportunity.contact_uuid,
            source: newSource,
            editedBy: user?.id || null,
            opportunityGhlId: opportunity.ghl_id,
          },
        });
      }
      setSavedValues(prev => ({ ...prev, source: newSource }));
      toast.success("Source updated");
      setIsInlineEditingSource(false);
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
    } catch (error) {
      console.error("Error updating source:", error);
      toast.error("Failed to update source");
    } finally {
      setIsSavingInline(false);
    }
  };

  // Check for existing contact projects and prompt user before creating a new one
  const checkAndOfferCreateProject = async (opportunityIdentifier: string) => {
    try {
      const opp = opportunity;
      if (!opp) return;

      // Fetch all non-deleted projects for this contact
      let projectsQuery = supabase
        .from("projects")
        .select("id, project_name, project_address, project_status")
        .eq("company_id", companyId)
        .is("deleted_at", null);

      if (opp.contact_uuid) {
        projectsQuery = projectsQuery.eq("contact_uuid", opp.contact_uuid);
      } else if (opp.contact_id) {
        projectsQuery = projectsQuery.eq("contact_id", opp.contact_id);
      }

      const { data: existingProjects } = await projectsQuery;

      // Store pending opp and show dialog regardless (0 or more existing projects)
      setPendingWonOppGhlId(opportunityIdentifier);
      setWonProjectExisting((existingProjects || []).map(p => ({
        id: p.id,
        project_name: p.project_name,
        project_address: p.project_address,
        project_status: p.project_status,
      })));
      setWonProjectDialogOpen(true);
    } catch (err) {
      console.error("Error in checkAndOfferCreateProject:", err);
    }
  };

  // Actually create the project after user confirms
  const handleCreateWonProject = async () => {
    if (!pendingWonOppGhlId) return;
    setIsCreatingWonProject(true);
    try {
      // Look up opportunity by UUID first, fallback to ghl_id
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(pendingWonOppGhlId);
      let oppQuery = supabase
        .from("opportunities")
        .select("*, contact_id, contact_uuid, location_id, name, monetary_value, assigned_to");
      
      if (isUUID) {
        oppQuery = oppQuery.or(`id.eq.${pendingWonOppGhlId},ghl_id.eq.${pendingWonOppGhlId}`);
      } else {
        oppQuery = oppQuery.eq("ghl_id", pendingWonOppGhlId);
      }
      
      const { data: oppData } = await oppQuery.maybeSingle();

      if (!oppData) throw new Error("Opportunity not found");

      const contact = findContactByIdOrGhlId(contacts, oppData.contact_uuid, oppData.contact_id);
      const address = contact ? extractCustomField(contact.custom_fields, CUSTOM_FIELD_IDS.ADDRESS) : null;
      const assignedUser = findUserByIdOrGhlId(users, undefined, oppData.assigned_to);

      const { error: createError } = await supabase
        .from("projects")
        .insert({
          opportunity_id: oppData.ghl_id || null,
          opportunity_uuid: oppData.id,
          location_id: oppData.location_id || "pVeFrqvtYWNIPRIi0Fmr",
          project_name: oppData.name || "Untitled Project",
          customer_first_name: contact?.first_name || null,
          customer_last_name: contact?.last_name || null,
          customer_email: contact?.email || null,
          cell_phone: contact?.phone || null,
          project_address: address,
          primary_salesperson: assignedUser?.name || assignedUser?.first_name || null,
          estimated_cost: oppData.monetary_value || null,
          sold_dispatch_value: oppData.monetary_value || null,
          project_status: "New Job",
          contact_id: oppData.contact_id || null,
          contact_uuid: oppData.contact_uuid || null,
          created_by: user?.id || null,
          lead_source: contact?.source || null,
          company_id: companyId,
        });

      if (createError) throw createError;
      toast.success("Project created from won opportunity!");
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["production-projects"] });
      setProjectsRefreshTick(t => t + 1);
    } catch (err) {
      console.error("Error creating project:", err);
      toast.error("Failed to create project");
    } finally {
      setIsCreatingWonProject(false);
      setWonProjectDialogOpen(false);
      setPendingWonOppGhlId(null);
      setWonProjectExisting([]);
    }
  };

  // After marking an opportunity as lost, check for sent proposals and early-stage projects
  const checkAndOfferDeclineProposals = async (contactId: string | null, contactUuid: string | null) => {
    if (!contactId && !contactUuid) return;
    try {
      let query = supabase
        .from("estimates")
        .select("id, estimate_number, estimate_title, customer_name")
        .eq("company_id", companyId)
        .in("status", ["sent", "viewed"]);
      
      if (contactUuid) {
        query = query.eq("contact_uuid", contactUuid);
      } else if (contactId) {
        query = query.eq("contact_id", contactId);
      }

      const { data } = await query;
      if (data && data.length > 0) {
        setProposalsToDecline(data);
        setDeclineProposalsDialogOpen(true);
      } else {
        // No proposals — go straight to project check
        await checkAndOfferDeleteProject(contactId, contactUuid);
      }
    } catch (err) {
      console.error("Error checking proposals:", err);
    }
  };

  // Check for related projects in early statuses
  const checkAndOfferDeleteProject = async (contactId: string | null, contactUuid: string | null) => {
    if (!contactId && !contactUuid) return;
    try {
      let query = supabase
        .from("projects")
        .select("id, project_name, project_address, project_status")
        .eq("company_id", companyId)
        .is("deleted_at", null);
      
      if (contactUuid) {
        query = query.eq("contact_uuid", contactUuid);
      } else if (contactId) {
        query = query.eq("contact_id", contactId);
      }

      const { data } = await query;
      const earlyStatusKeywords = ["pre-estimate", "estimate", "proposal"];
      const filtered = (data || []).filter(p =>
        p.project_status && earlyStatusKeywords.some(k => p.project_status!.toLowerCase().includes(k))
      );
      if (filtered.length > 0) {
        setProjectsToDelete(filtered.map(p => ({
          id: p.id,
          project_name: p.project_name,
          project_address: p.project_address,
          status: p.project_status,
        })));
        setDeleteProjectDialogOpen(true);
      }
    } catch (err) {
      console.error("Error checking projects:", err);
    }
  };

  const handleDeclineProposals = async () => {
    if (proposalsToDecline.length === 0) return;
    setIsDecliningProposals(true);
    try {
      const ids = proposalsToDecline.map(p => p.id);
      const { error } = await supabase
        .from("estimates")
        .update({ status: "declined" })
        .in("id", ids);
      if (error) throw error;
      toast.success(`${ids.length} proposal${ids.length > 1 ? "s" : ""} marked as declined`);
      queryClient.invalidateQueries({ queryKey: ["estimates"] });
      queryClient.invalidateQueries({ queryKey: ["salesperson-portal-proposals"] });
    } catch (err) {
      console.error("Error declining proposals:", err);
      toast.error("Failed to decline proposals");
    } finally {
      setIsDecliningProposals(false);
      setDeclineProposalsDialogOpen(false);
      setProposalsToDecline([]);
      // After handling proposals, check for projects
      await checkAndOfferDeleteProject(opportunity?.contact_id ?? null, opportunity?.contact_uuid ?? null);
    }
  };

  const handleDeleteProjects = async () => {
    if (projectsToDelete.length === 0) return;
    setIsDeletingProject(true);
    try {
      // Use a SECURITY DEFINER function so any authenticated user (any role) can
      // soft-delete early-stage projects from the "mark as lost" workflow.
      const results = await Promise.all(
        projectsToDelete.map(p =>
          supabase.rpc("soft_delete_early_stage_project", { p_project_id: p.id })
        )
      );
      const errors = results.filter(r => r.error);
      if (errors.length > 0) throw errors[0].error;
      toast.success(`${projectsToDelete.length} project${projectsToDelete.length > 1 ? "s" : ""} deleted`);
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["production-projects"] });
    } catch (err) {
      console.error("Error deleting projects:", err);
      toast.error("Failed to delete project");
    } finally {
      setIsDeletingProject(false);
      setDeleteProjectDialogOpen(false);
      setProjectsToDelete([]);
    }
  };

  const handleInlineStatusChange = async (newStatus: string) => {
    if (!opportunity) return;
    setIsSavingInline(true);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke("update-ghl-opportunity", {
        body: {
          ghl_id: opportunity.ghl_id,
          opportunity_uuid: opportunity.id,
          status: newStatus,
          edited_by: user?.id || null
        }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setSavedValues(prev => ({
        ...prev,
        status: newStatus
      }));
      toast.success("Status updated");
      setIsInlineEditingStatus(false);
      queryClient.invalidateQueries({
        queryKey: ["opportunities"]
      });
      queryClient.invalidateQueries({
        queryKey: ["opportunity_edits"]
      });

      // Prompt user before creating project if status changed to "won"
      if (newStatus.toLowerCase() === "won") {
        await checkAndOfferCreateProject(opportunity.id || opportunity.ghl_id);
      }
      // Check for proposals to decline if status changed to "lost"
      if (newStatus.toLowerCase() === "lost") {
        await checkAndOfferDeclineProposals(opportunity.contact_id, opportunity.contact_uuid);
      }
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    } finally {
      setIsSavingInline(false);
    }
  };
  const handleSave = async () => {
    if (!opportunity) return;
    setIsSaving(true);
    try {
      // Get the pipeline_stage_id for the selected stage
      const pipeline_stage_id = stageMap.get(editedStage) || opportunity.pipeline_stage_id;
      const pipeline_name = hasAdminPipelineConfig
        ? (adminPipelineName || "Main")
        : (pipelineData.find(p => p.ghl_id === editedPipeline)?.name || allOpportunities.find(o => o.pipeline_id === editedPipeline)?.pipeline_name || opportunity.pipeline_name);
      const monetaryValue = parseFloat(editedMonetaryValue) || 0;

      // Use internal salesperson UUID for assigned_to
      let assignedToUuid: string | null = null;
      if (editedAssignedTo && editedAssignedTo !== "__unassigned__") {
        assignedToUuid = editedAssignedTo; // Always use internal salesperson UUID
      }

      const {
        data,
        error
      } = await supabase.functions.invoke("update-ghl-opportunity", {
        body: {
          ghl_id: opportunity.ghl_id,
          opportunity_uuid: opportunity.id,
          status: editedStatus,
          stage_name: editedStage,
          pipeline_id: editedPipeline,
          pipeline_name: pipeline_name,
          pipeline_stage_id: pipeline_stage_id,
          monetary_value: monetaryValue,
          assigned_to: assignedToUuid,
          edited_by: user?.id || null
        }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // If source was changed, update contact source separately
      const contact = findContactByIdOrGhlId(contacts, opportunity.contact_uuid, opportunity.contact_id);
      const originalSource = contact?.source || "";
      if (editedSource !== originalSource && (opportunity.contact_id || opportunity.contact_uuid)) {
        try {
          await supabase.functions.invoke("update-contact-source", {
            body: {
              contactId: opportunity.contact_id,
              contactUuid: opportunity.contact_uuid,
              source: editedSource,
              editedBy: user?.id || null,
              opportunityGhlId: opportunity.ghl_id
            }
          });
        } catch (sourceError) {
          console.error("Error updating source:", sourceError);
          // Don't fail the whole save if source update fails
        }
      }

      // Store saved values to display immediately (before query refresh)
      // Store the internal salesperson ID for display, but GHL gets the ghl_user_id for sync
      const newSavedValues = {
        status: editedStatus,
        stage_name: editedStage,
        pipeline_name: pipeline_name,
        pipeline_id: editedPipeline,
        monetary_value: monetaryValue,
        assigned_to: editedAssignedTo === "__unassigned__" ? null : editedAssignedTo, // Keep internal ID for display matching
        source: editedSource || null
      };
      console.log("Saving values:", newSavedValues);
      setSavedValues(newSavedValues);
      toast.success("Opportunity updated in GHL and database");
      setIsEditing(false);

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({
        queryKey: ["opportunities"]
      });
      queryClient.invalidateQueries({
        queryKey: ["contacts"]
      });
      queryClient.invalidateQueries({
        queryKey: ["opportunity_edits"]
      });

      // Prompt user before creating project if status changed to "won"
      if (editedStatus.toLowerCase() === "won") {
        await checkAndOfferCreateProject(opportunity.id || opportunity.ghl_id);
      }
      // Check for proposals to decline if status changed to "lost"
      if (editedStatus.toLowerCase() === "lost") {
        await checkAndOfferDeclineProposals(opportunity.contact_id, opportunity.contact_uuid);
      }
    } catch (error) {
      console.error("Error updating opportunity:", error);
      toast.error("Failed to update opportunity in GHL");
    } finally {
      setIsSaving(false);
    }
  };
  const handleSaveOppValue = async () => {
    if (!opportunity) return;
    setIsSavingOppValue(true);
    try {
      const newValue = parseFloat(editedOppValue) || 0;
      const { data, error } = await supabase.functions.invoke("update-ghl-opportunity", {
        body: {
          ghl_id: opportunity.ghl_id,
          opportunity_uuid: opportunity.id,
          monetary_value: newValue,
          edited_by: user?.id || null,
          company_id: companyId,
        }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setSavedValues(prev => ({ ...prev, monetary_value: newValue }));
      toast.success("Opportunity value updated");
      setIsEditingOppValue(false);
      setCostError(null);
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["opportunity_edits"] });
    } catch (error) {
      console.error("Error saving opp value:", error);
      toast.error("Failed to update opportunity value");
    } finally {
      setIsSavingOppValue(false);
    }
  };

  const handleSaveEstimatedCost = async () => {
    if (!opportunity) return;
    const costValue = parseFloat(estimatedCost) || 0;
    const oppValue = savedValues.monetary_value ?? opportunity.monetary_value ?? 0;

    if (costValue > oppValue) {
      setCostError(`Est. Cost ($${costValue.toLocaleString()}) cannot exceed Opp Value ($${oppValue.toLocaleString()})`);
      return;
    }
    setCostError(null);
    setIsSavingCost(true);
    try {
      // Upsert the estimated cost - use uuid if available, else use ghl_id
      const oppKey = opportunity.id || opportunity.ghl_id;
      const {
        error
      } = await supabase.from("project_costs").upsert({
        opportunity_id: oppKey,
        estimated_cost: costValue,
        entered_by: user?.id || null,
        company_id: companyId
      }, {
        onConflict: "opportunity_id"
      });
      if (error) throw error;
      toast.success("Estimated cost saved");
      setIsEditingCost(false);
    } catch (error) {
      console.error("Error saving estimated cost:", error);
      toast.error("Failed to save estimated cost");
    } finally {
      setIsSavingCost(false);
    }
  };
  const handleSaveScope = async () => {
    if (!opportunity?.ghl_id && !opportunity?.id) return;
    setIsSavingScope(true);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke("update-opportunity-scope", {
        body: {
          opportunityGhlId: opportunity.ghl_id || null,
          opportunityId: opportunity.id,
          scopeOfWork: editedScope.trim(),
          editedBy: user?.id || null,
          companyId: opportunity.company_id || companyId || null,
        }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Scope of work saved");
      setIsEditingScope(false);
      // Refresh opportunities to get updated scope_of_work
      queryClient.invalidateQueries({
        queryKey: ["opportunities"]
      });
      queryClient.invalidateQueries({
        queryKey: ["opportunity_edits"]
      });
    } catch (error) {
      console.error("Error saving scope of work:", error);
      toast.error("Failed to save scope of work");
    } finally {
      setIsSavingScope(false);
    }
  };
  const handleSaveAddress = async () => {
    if (!opportunity?.ghl_id && !opportunity?.id) return;
    setIsSavingAddress(true);
    try {
      // Save to opportunity (primary)
      const { data: oppData, error: oppError } = await supabase.functions.invoke("update-opportunity-address", {
        body: {
          opportunityGhlId: opportunity.ghl_id || null,
          opportunityId: opportunity.id,
          address: editedAddress.trim(),
          editedBy: user?.id || null,
          companyId: opportunity.company_id || companyId || null,
        }
      });
      if (oppError) throw oppError;
      if (oppData?.error) throw new Error(oppData.error);

      // Also update contact custom_fields for legacy compatibility
      if (opportunity.contact_id || opportunity.contact_uuid) {
        await supabase.functions.invoke("update-contact-address", {
          body: {
            contactId: opportunity.contact_id,
            contactUuid: opportunity.contact_uuid,
            address: editedAddress.trim(),
            editedBy: user?.id || null,
            opportunityGhlId: opportunity.ghl_id
          }
        });
      }

      toast.success("Address saved");
      setIsEditingAddress(false);
      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["opportunity_edits"] });
    } catch (error) {
      console.error("Error saving address:", error);
      toast.error("Failed to save address");
    } finally {
      setIsSavingAddress(false);
    }
  };

  const handleSavePhone = async () => {
    if (!opportunity?.contact_id && !opportunity?.contact_uuid) return;
    setIsSavingPhone(true);
    try {
      const { data, error } = await supabase.functions.invoke("update-contact-phone", {
        body: {
          contactId: opportunity.contact_id,
          contactUuid: opportunity.contact_uuid,
          phone: editedPhone.trim(),
          editedBy: user?.id || null,
          opportunityGhlId: opportunity.ghl_id,
          companyId,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Phone updated");
      setIsEditingPhone(false);
      setSavedPhone(editedPhone.trim() || null);
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
    } catch (error) {
      console.error("Error saving phone:", error);
      toast.error("Failed to save phone");
    } finally {
      setIsSavingPhone(false);
    }
  };

  const handleSaveEmail = async () => {
    if (!opportunity?.contact_id && !opportunity?.contact_uuid) return;
    const trimmedEmailCheck = editedEmail.trim();
    if (trimmedEmailCheck && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmailCheck)) {
      setEmailValidationError("Please enter a valid email address");
      return;
    }
    setEmailValidationError(null);
    
    const contact = findContactByIdOrGhlId(contacts, opportunity.contact_uuid, opportunity.contact_id);
    const currentEmail = savedEmail ?? contact?.email ?? null;
    const newEmail = editedEmail.trim();
    
    // If email hasn't changed, just close editing
    if (newEmail === (currentEmail ?? "")) {
      setIsEditingEmail(false);
      return;
    }
    
    // Show sync dialog to let user choose whether to sync across all records
    setPendingEmailChange({ oldEmail: currentEmail, newEmail });
    setEmailSyncDialogOpen(true);
  };

  // Called when user chooses "Update Here Only" in EmailSyncDialog
  const handleEmailUpdateLocalOnly = async () => {
    if (!opportunity?.contact_id && !opportunity?.contact_uuid) return;
    if (!pendingEmailChange) return;
    
    setIsSavingEmail(true);
    try {
      const { data, error } = await supabase.functions.invoke("update-contact-email", {
        body: {
          contactId: opportunity.contact_id,
          contactUuid: opportunity.contact_uuid,
          email: pendingEmailChange.newEmail,
          editedBy: user?.id || null,
          opportunityGhlId: opportunity.ghl_id,
          companyId,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Email updated");
      setIsEditingEmail(false);
      setSavedEmail(pendingEmailChange.newEmail || null);
      setPendingEmailChange(null);
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
    } catch (error) {
      console.error("Error saving email:", error);
      toast.error("Failed to save email");
    } finally {
      setIsSavingEmail(false);
    }
  };

  // Called when user confirms sync in EmailSyncDialog
  const handleEmailSyncConfirmed = () => {
    if (!pendingEmailChange) return;
    setIsEditingEmail(false);
    setSavedEmail(pendingEmailChange.newEmail || null);
    setPendingEmailChange(null);
    queryClient.invalidateQueries({ queryKey: ["contacts"] });
    queryClient.invalidateQueries({ queryKey: ["opportunities"] });
    queryClient.invalidateQueries({ queryKey: ["projects"] });
    queryClient.invalidateQueries({ queryKey: ["estimates"] });
  };
  const handleSaveName = async () => {
    if (!opportunity?.contact_id && !opportunity?.contact_uuid) return;
    setIsSavingName(true);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke("update-contact-name", {
        body: {
          contactId: opportunity.contact_id,
          contactUuid: opportunity.contact_uuid,
          firstName: editedFirstName.trim(),
          lastName: editedLastName.trim(),
          editedBy: user?.id || null,
          opportunityGhlId: opportunity.ghl_id
        }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Name updated");
      setIsEditingName(false);
      setSavedContactName(data.newName || `${editedFirstName.trim()} ${editedLastName.trim()}`.trim());
      queryClient.invalidateQueries({
        queryKey: ["contacts"]
      });
      queryClient.invalidateQueries({
        queryKey: ["opportunity_edits"]
      });
    } catch (error) {
      console.error("Error saving name:", error);
      toast.error("Failed to save name");
    } finally {
      setIsSavingName(false);
    }
  };

  // Save opportunity name
  const handleSaveOppName = async () => {
    if (!opportunity || (!opportunity.ghl_id && !opportunity.id) || !editedOppName.trim()) return;
    setIsSavingOppName(true);
    try {
      const { data, error } = await supabase.functions.invoke("update-ghl-opportunity", {
        body: {
          ghl_id: opportunity.ghl_id,
          opportunity_uuid: opportunity.id,
          name: editedOppName.trim(),
          edited_by: user?.id || null
        }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Opportunity name updated");
      setIsEditingOppName(false);
      setSavedOppName(editedOppName.trim());
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["opportunity_edits"] });
    } catch (error) {
      console.error("Error saving opportunity name:", error);
      toast.error("Failed to save opportunity name");
    } finally {
      setIsSavingOppName(false);
    }
  };
  
  // Admin-only: Save won_at date (date only, no time)
  const handleSaveWonAt = async () => {
    if (!opportunity || !isAdmin) return;
    setIsSavingWonAt(true);
    try {
      // Build the won_at timestamp from date input only (use noon PST as default time)
      let wonAtValue: string | null = null;
      if (editedWonAtDate) {
        // Use noon PST as default time for date-only storage
        const timeStr = "12:00";
        // Treat input as PST: parse as UTC then add PST offset to get actual UTC
        const pstOffset = getPSTOffset(new Date(`${editedWonAtDate}T12:00:00Z`));
        const tempUtcDate = new Date(`${editedWonAtDate}T${timeStr}:00.000Z`);
        const utcDate = new Date(tempUtcDate.getTime() + pstOffset * 60 * 60 * 1000);
        wonAtValue = utcDate.toISOString();
      }

      const { data, error } = await supabase.functions.invoke("update-ghl-opportunity", {
        body: {
          ghl_id: opportunity.ghl_id,
          opportunity_uuid: opportunity.id,
          won_at: wonAtValue,
          edited_by: user?.id || null
        }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setSavedWonAt(wonAtValue);
      toast.success("Won date updated");
      setIsEditingWonAt(false);
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["won-opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["opportunity_edits"] });
    } catch (error) {
      console.error("Error saving won date:", error);
      toast.error("Failed to save won date");
    } finally {
      setIsSavingWonAt(false);
    }
  };

  // Super Admin only: Save ghl_date_added (created date)
  const handleSaveCreatedAt = async () => {
    if (!opportunity || !isSuperAdmin) return;
    setIsSavingCreatedAt(true);
    try {
      let createdAtValue: string | null = null;
      if (editedCreatedAtDate) {
        // Use noon PST as default time for date-only storage
        const timeStr = "12:00";
        const pstOffset = getPSTOffset(new Date(`${editedCreatedAtDate}T12:00:00Z`));
        const tempUtcDate = new Date(`${editedCreatedAtDate}T${timeStr}:00.000Z`);
        const utcDate = new Date(tempUtcDate.getTime() + pstOffset * 60 * 60 * 1000);
        createdAtValue = utcDate.toISOString();
      }

      const { data, error } = await supabase.functions.invoke("update-ghl-opportunity", {
        body: {
          ghl_id: opportunity.ghl_id,
          opportunity_uuid: opportunity.id,
          ghl_date_added: createdAtValue,
          edited_by: user?.id || null
        }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setSavedCreatedAt(createdAtValue);
      toast.success("Created date updated");
      setIsEditingCreatedAt(false);
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["opportunity_edits"] });
    } catch (error) {
      console.error("Error saving created date:", error);
      toast.error("Failed to save created date");
    } finally {
      setIsSavingCreatedAt(false);
    }
  };

  const handleDeleteOpportunity = async () => {
    if (!opportunity) return;
    setIsDeletingOpportunity(true);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke("delete-ghl-opportunity", {
        body: {
          opportunityId: opportunity.ghl_id || null,
          opportunityUuid: opportunity.id || null,
        }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Opportunity deleted");
      // Close sheet first, then refetch data
      onOpenChange(false);
      await queryClient.invalidateQueries({
        queryKey: ["opportunities"]
      });
      // Also invalidate the combined metrics query used by the Opportunities page
      await queryClient.refetchQueries({
        queryKey: ["opportunities"]
      });
    } catch (error) {
      console.error("Error deleting opportunity:", error);
      toast.error("Failed to delete opportunity");
    } finally {
      setIsDeletingOpportunity(false);
    }
  };
  const handleDeleteAppointmentFromDialog = async () => {
    if (!editingAppointment) return;
    setIsDeletingAppointment(true);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke("delete-ghl-appointment", {
        body: {
          appointmentId: editingAppointment.ghl_id,
          appointmentUuid: editingAppointment.id
        }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Appointment deleted");
      setAppointmentDialogOpen(false);
      setEditingAppointment(null);
      queryClient.invalidateQueries({
        queryKey: ["appointments"]
      });
    } catch (error) {
      console.error("Error deleting appointment:", error);
      toast.error("Failed to delete appointment");
    } finally {
      setIsDeletingAppointment(false);
    }
  };
  if (!opportunity) return null;
  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });
  };
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleString("en-US", {
      timeZone: "America/Los_Angeles",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    }) + " PST";
  };
  const formatDateOnly = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleString("en-US", {
      timeZone: "America/Los_Angeles",
      month: "short",
      day: "numeric",
      year: "numeric"
    });
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
  const getAppointmentStatusColor = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case "confirmed":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "cancelled":
      case "no_show":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      case "showed":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      default:
        return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    }
  };
  const formatCurrency = (value: number | null) => {
    if (!value) return "$0";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0
    }).format(value);
  };
  const contact = findContactByIdOrGhlId(contacts, opportunity.contact_uuid, opportunity.contact_id);
  const relatedAppointments = appointments.filter(a => 
    (a.contact_uuid && a.contact_uuid === contact?.id) ||
    (a.contact_id && (a.contact_id === opportunity.contact_id))
  );
  const effectiveAssignedTo = savedValues.assigned_to !== undefined ? savedValues.assigned_to : opportunity.assigned_to;
  
  // Find assigned salesperson - check salespeople first (by ghl_user_id or id), then fallback to GHL users
  // Guard: only match if effectiveAssignedTo is actually set (not null/undefined)
  const assignedSalesperson = effectiveAssignedTo
    ? activeSalespeople.find(sp => sp.ghl_user_id === effectiveAssignedTo || sp.id === effectiveAssignedTo)
    : null;
  const assignedUser = assignedSalesperson ? null : (effectiveAssignedTo ? findUserByIdOrGhlId(users, undefined, effectiveAssignedTo) : null);
  const contactName = savedContactName || contact?.contact_name || (contact?.first_name && contact?.last_name ? `${contact.first_name} ${contact.last_name}` : contact?.first_name || contact?.last_name || "Unknown");
  const userName = assignedSalesperson?.name || assignedUser?.name || (assignedUser?.first_name && assignedUser?.last_name ? `${assignedUser.first_name} ${assignedUser.last_name}` : "Unassigned");
  // Get address from opportunity first, fallback to contact custom_fields, then appointment address
  const addressFromOpportunity = opportunity?.address;
  const contactAddress = extractCustomField(contact?.custom_fields, CUSTOM_FIELD_IDS.ADDRESS);
  const apptAddressFallback = relatedAppointments.find(a => a.address)?.address || null;
  const address = addressFromOpportunity || contactAddress || apptAddressFallback;
  // Get scope from opportunity directly, with fallback to contact custom_fields for legacy data
  const scopeFromOpportunity = opportunity?.scope_of_work;
  const scopeFromCustomField = extractCustomField(contact?.custom_fields, CUSTOM_FIELD_IDS.SCOPE_OF_WORK);
  const scopeFromAttributions = (() => {
    if (!contact?.attributions) return null;
    const attrs = contact.attributions as Array<{
      utmContent?: string;
    }> | null;
    if (Array.isArray(attrs) && attrs.length > 0) {
      return attrs[0]?.utmContent || null;
    }
    return null;
  })();
  // Prefer opportunity scope, fallback to contact custom field, then attributions
  const scopeOfWork = scopeFromOpportunity || scopeFromCustomField || scopeFromAttributions;
  const contactNotes = extractCustomField(contact?.custom_fields, CUSTOM_FIELD_IDS.NOTES);

  // Create a pre-estimate project and portal for this opportunity
  const handleCreatePortal = async () => {
    if (!opportunity || !companyId) return;
    setIsCreatingPortal(true);
    try {
      // Build customer info from contact
      const customerFirstName = contact?.first_name || (contact?.contact_name?.split(" ")[0]) || "";
      const customerLastName = contact?.last_name || (contact?.contact_name?.split(" ").slice(1).join(" ")) || "";
      const customerEmail = contact?.email || "";
      const customerPhone = contact?.phone || "";
      
      // Get address from opportunity or contact
      const projectAddress = opportunity.address || extractCustomField(contact?.custom_fields, CUSTOM_FIELD_IDS.ADDRESS) || "";
      
      // Create project with "Pre-Estimate" status
      const { data: newProject, error: projectError } = await supabase
        .from("projects")
        .insert({
          opportunity_id: opportunity.ghl_id,
          opportunity_uuid: opportunity.id,
          contact_id: opportunity.contact_id,
          contact_uuid: opportunity.contact_uuid || contact?.id,
          location_id: opportunity.location_id,
          project_name: opportunity.name || contactName || "New Project",
          project_status: "Pre-Estimate",
          customer_first_name: customerFirstName,
          customer_last_name: customerLastName,
          customer_email: customerEmail,
          cell_phone: customerPhone,
          project_address: projectAddress,
          scope_of_work: scopeOfWork,
          lead_source: contact?.source || null,
          company_id: companyId,
          created_by: user?.id,
        })
        .select("id")
        .single();
      
      if (projectError) throw projectError;
      
      // Create a portal token for this project
      const clientFullName = `${customerFirstName} ${customerLastName}`.trim() || contactName || "Customer";
      const { error: tokenError } = await supabase
        .from("client_portal_tokens")
        .insert({
          project_id: newProject.id,
          client_name: clientFullName,
          client_email: customerEmail || null,
          company_id: companyId,
          created_by: user?.id,
          is_active: true,
        });
      
      if (tokenError) throw tokenError;
      
      // Fetch the new portal link
      const { data: portalToken } = await supabase
        .from("client_portal_tokens")
        .select("token")
        .eq("project_id", newProject.id)
        .eq("is_active", true)
        .maybeSingle();
      
      if (portalToken?.token) {
        const { data: baseUrlSetting } = await supabase
          .from("company_settings")
          .select("setting_value")
          .eq("company_id", companyId)
          .eq("setting_key", "app_base_url")
          .maybeSingle();
        
        const baseUrl = baseUrlSetting?.setting_value || window.location.origin;
        setPortalLink(`${baseUrl}/portal/${portalToken.token}`);
      }
      
      setAssociatedProjectId(newProject.id);
      
      toast.success("Portal created successfully");
      
      // Invalidate queries to reflect changes
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    } catch (error) {
      console.error("Error creating portal:", error);
      toast.error("Failed to create portal");
    } finally {
      setIsCreatingPortal(false);
    }
  };

  // Send thank-you email handler
  const handleSendThankYouEmail = async () => {
    if (!opportunity || !companyId || !portalLink) return;
    
    const customerEmail = contact?.email;
    if (!customerEmail) {
      toast.error("No email address found for this contact");
      return;
    }
    
    setIsSendingThankYou(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-thank-you-email", {
        body: {
          to: customerEmail,
          customerName: contactName || "Customer",
          portalLink,
          companyId,
        },
      });
      
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      toast.success(`Thank-you email sent to ${customerEmail}`);
    } catch (error) {
      console.error("Error sending thank-you email:", error);
      toast.error(error instanceof Error ? error.message : "Failed to send email");
    } finally {
      setIsSendingThankYou(false);
    }
  };

  const isPageMode = mode === 'page';

  return (
    <Sheet open={open} modal={!isPageMode} onOpenChange={isPageMode ? undefined : onOpenChange}>
      <SheetContent 
        className={`${isPageMode ? 'w-full h-full' : 'w-full sm:max-w-3xl'} overflow-y-auto p-0`}
        disablePortal={isPageMode}
      >
        {/* Header */}
        <div className="sticky top-0 bg-background border-b p-4">
          <SheetHeader>
            <SheetTitle className="text-sm font-medium text-muted-foreground">Opportunity Details</SheetTitle>
            {/* Opportunity Name + right-side value strip */}
            <div className="mt-1 flex items-start justify-between gap-4">
              {/* Left: name + status + sales rep */}
              <div className="min-w-0 flex-1">
                {isEditingOppName ? (
                  <div className="flex items-center gap-1">
                    <Input
                      value={editedOppName}
                      onChange={e => setEditedOppName(e.target.value)}
                      placeholder="Opportunity name"
                      className="h-8 text-base font-semibold"
                      autoFocus
                    />
                    <Button variant="ghost" size="sm" className="h-8 px-2" onClick={handleSaveOppName} disabled={isSavingOppName || !editedOppName.trim()}>
                      {isSavingOppName ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => setIsEditingOppName(false)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => {
                        setEditedOppName(savedOppName || opportunity.name || "");
                        setIsEditingOppName(true);
                      }}
                      className="text-base font-semibold text-foreground hover:underline text-left"
                    >
                      {savedOppName || opportunity.name || "Untitled Opportunity"}
                    </button>
                    {!isHeaderEditingStatus ? (
                      <button className="cursor-pointer" onClick={() => setIsHeaderEditingStatus(true)}>
                        <Badge variant="outline" className={`text-xs hover:underline ${getStatusColor(savedValues.status ?? opportunity.status)}`}>
                          {savedValues.status ?? opportunity.status ?? "Unknown"}
                        </Badge>
                      </button>
                    ) : (
                      <Select
                        value={savedValues.status ?? opportunity.status ?? ""}
                        onValueChange={(val) => {
                          setIsHeaderEditingStatus(false);
                          handleInlineStatusChange(val);
                        }}
                        disabled={isSavingInline}
                        onOpenChange={open => { if (!open && !isSavingInline) setIsHeaderEditingStatus(false); }}
                        defaultOpen
                      >
                        <SelectTrigger className="h-6 text-xs w-32">
                          {isSavingInline ? <Loader2 className="h-3 w-3 animate-spin" /> : <SelectValue placeholder="Select status" />}
                        </SelectTrigger>
                        <SelectContent className="bg-popover z-[200]">
                          {OPPORTUNITY_STATUSES.map(status => (
                            <SelectItem key={status} value={status} className="text-xs capitalize">{status}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}
                {/* Sales rep directly below opp name */}
                {userName && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <User className="h-3 w-3" />
                    {userName}
                  </p>
                )}
              </div>
              {/* Right: Debug (super admin) + Opp Value + Est Cost */}
              <div className="flex flex-col items-end gap-1 shrink-0">
                <div className="flex items-center gap-2">
                  {/* Debug button — super admin only, placed left of opp value */}
                  {isSuperAdmin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-muted-foreground"
                      onClick={() => {
                        const debugInfo = `UUID: ${opportunity.id}\nGHL ID: ${opportunity.ghl_id}\nContact ID: ${opportunity.contact_id}\nContact UUID: ${opportunity.contact_uuid}`;
                        navigator.clipboard.writeText(debugInfo);
                        toast.success("Debug info copied to clipboard");
                      }}
                    >
                      <Copy className="h-3.5 w-3.5 mr-1" />
                      Debug
                    </Button>
                  )}
                  {/* Opp Value */}
                  {isEditingOppValue ? (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">Opp Value:</span>
                      <span className="text-lg font-bold text-emerald-400">$</span>
                      <Input type="text" inputMode="decimal" value={editedOppValue} onChange={e => { const val = e.target.value; if (val === '' || /^\d*\.?\d*$/.test(val)) setEditedOppValue(val); }} className="text-lg font-bold h-8 w-28" autoFocus />
                      <Button size="sm" className="h-7 px-2 text-xs" onClick={handleSaveOppValue} disabled={isSavingOppValue}>
                        {isSavingOppValue ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 px-1.5 text-xs" onClick={() => setIsEditingOppValue(false)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : isEditing ? (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">Opp Value:</span>
                      <span className="text-lg font-bold text-emerald-400">$</span>
                      <Input type="text" inputMode="decimal" value={editedMonetaryValue} onChange={e => { const val = e.target.value; if (val === '' || /^\d*\.?\d*$/.test(val)) setEditedMonetaryValue(val); }} className="text-lg font-bold h-8 w-28" />
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">Opp Value:</span>
                      <button onClick={() => { setEditedOppValue(((savedValues.monetary_value ?? opportunity.monetary_value) || 0).toString()); setIsEditingOppValue(true); }} className="text-lg font-bold text-emerald-400 hover:underline cursor-pointer">
                        {formatCurrency(savedValues.monetary_value ?? opportunity.monetary_value)}
                      </button>
                    </div>
                  )}
                </div>
                {/* Est. Cost */}
                <div className="flex flex-col items-end gap-0.5">
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-muted-foreground">Est. Cost:</span>
                    {isEditingCost ? (
                      <div className="flex items-center gap-1">
                        <span className="text-destructive">$</span>
                        <Input type="text" inputMode="decimal" value={estimatedCost} onChange={e => { const val = e.target.value; if (val === '' || /^\d*\.?\d*$/.test(val)) { setEstimatedCost(val); setCostError(null); } }} className={`h-6 w-20 text-xs ${costError ? 'border-destructive' : ''}`} />
                        <Button size="sm" className="h-6 px-2 text-xs" onClick={handleSaveEstimatedCost} disabled={isSavingCost}>
                          {isSavingCost ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-6 px-1.5 text-xs" onClick={() => { setIsEditingCost(false); setCostError(null); }}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <button onClick={() => setIsEditingCost(true)} className="text-destructive font-medium hover:underline">
                        {estimatedCost ? `$${parseFloat(estimatedCost).toLocaleString()}` : "Set cost"}
                      </button>
                    )}
                  </div>
                  {costError && (
                    <span className="text-[10px] text-destructive max-w-[220px] text-right">{costError}</span>
                  )}
                </div>
              </div>
            </div>
          </SheetHeader>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {/* +Task — first button */}
            <Button variant="outline" size="sm" className="h-7" onClick={openTaskDialog}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Task
            </Button>
            <AlertDialog onOpenChange={isOpen => {
            if (!isOpen) {
              setDeletePassword("");
              setDeletePasswordError("");
            }
          }}>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-destructive hover:text-destructive border-destructive/30 hover:border-destructive/50">
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Delete
                </Button>
              </AlertDialogTrigger>
            <Button variant="outline" size="sm" className="h-7" onClick={() => setSalesDialogOpen(true)}>
              <Receipt className="h-3.5 w-3.5 mr-1" />
              Sales
            </Button>
            {(isAdmin || isProduction) && associatedProjects.length === 1 && (
              <Button 
                variant="outline" 
                size="sm" 
                className="h-7" 
                onClick={() => {
                  onOpenChange(false);
                  navigate(`/production/${associatedProjects[0].id}?returnTo=${encodeURIComponent(location.pathname)}`);
                }}
              >
                <FolderOpen className="h-3.5 w-3.5 mr-1" />
                Project
              </Button>
            )}
            {(isAdmin || isProduction) && associatedProjects.length > 1 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7">
                    <FolderOpen className="h-3.5 w-3.5 mr-1" />
                    Project
                    <ChevronDown className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="z-[200] bg-popover">
                  {associatedProjects.map((proj) => (
                    <DropdownMenuItem
                      key={proj.id}
                      onClick={() => { onOpenChange(false); navigate(`/production/${proj.id}?returnTo=${encodeURIComponent(location.pathname)}`); }}
                    >
                      {proj.project_name || `Project ${proj.id.slice(0, 8)}`}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {/* Debug removed from here — now in header next to opp value */}
            {/* Customer Portal inline buttons */}
            {portalLink ? (
              <>
                <a
                  href={portalLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-xs font-medium"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Portal
                </a>
                {isAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1"
                    onClick={() => setShowThankYouPreview(true)}
                    disabled={isSendingThankYou || !contact?.email}
                    title={!contact?.email ? "No email on file" : "Send Thank-You Email"}
                  >
                    {isSendingThankYou ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Mail className="h-3.5 w-3.5" />
                    )}
                    Thank-You
                  </Button>
                )}
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1"
                onClick={handleCreatePortal}
                disabled={isCreatingPortal}
              >
                {isCreatingPortal ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                Portal
              </Button>
            )}
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Opportunity</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete this opportunity? This will also remove it from GoHighLevel. This
                    action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="py-2">
                  <Label htmlFor="delete-password" className="text-sm font-medium">
                    Enter password to confirm
                  </Label>
                  <Input id="delete-password" type="password" placeholder="Enter password" value={deletePassword} onChange={e => {
                  setDeletePassword(e.target.value);
                  setDeletePasswordError("");
                }} className="mt-1.5" />
                  {deletePasswordError && <p className="text-sm text-destructive mt-1">{deletePasswordError}</p>}
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={e => {
                  if (deletePassword !== "121867") {
                    e.preventDefault();
                    setDeletePasswordError("Incorrect password");
                    return;
                  }
                  handleDeleteOpportunity();
                }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={isDeletingOpportunity}>
                    {isDeletingOpportunity ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
            </div>

        <div className="p-4 space-y-4">
          {/* Thank-You Email Preview Dialog */}
          <Dialog open={showThankYouPreview} onOpenChange={setShowThankYouPreview}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Preview Thank-You Email</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="rounded-lg border bg-muted/40 p-3 space-y-1 text-sm">
                  <div className="flex gap-2">
                    <span className="font-medium w-14 shrink-0 text-muted-foreground">To:</span>
                    <span>{contact?.email}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-medium w-14 shrink-0 text-muted-foreground">Subject:</span>
                    <span>Thank You for Meeting With Us</span>
                  </div>
                </div>
                <div className="rounded-lg border bg-background p-4 space-y-4 text-sm">
                  <p>Dear {contactName || "Customer"},</p>
                  <p>
                    Thank you so much for taking the time to meet with us and considering our services!
                    We truly appreciate the opportunity to learn about your project and discuss how we can help.
                  </p>
                  <p>We've set up a personalized customer portal for you where you can:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li><strong>Upload any documents</strong> we discussed (plans, photos, permits, etc.)</li>
                    <li><strong>Ask questions</strong> directly to our team</li>
                    <li><strong>Track progress</strong> as we prepare your proposal</li>
                  </ul>
                  <div className="text-center py-2">
                    <span className="inline-block bg-foreground text-background px-5 py-2 rounded-lg font-semibold text-sm">
                      Access Your Portal
                    </span>
                  </div>
                  <p className="text-muted-foreground text-xs break-all">
                    Portal link: {portalLink}
                  </p>
                  <p>If you have any questions or need anything at all, please don't hesitate to reach out.</p>
                  <p>We look forward to working with you.</p>
                  <p className="font-medium">Best regards,<br />Your Team</p>
                </div>
              </div>
              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={() => setShowThankYouPreview(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    setShowThankYouPreview(false);
                    handleSendThankYouEmail();
                  }}
                  disabled={isSendingThankYou}
                >
                  {isSendingThankYou ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" />Sending…</>
                  ) : (
                    <><Mail className="h-4 w-4 mr-2" />Send Email</>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Contact Section */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-muted/30 px-3 py-2 border-b">
              <span className="text-xs font-medium text-muted-foreground">Contact Address, Phone and Email</span>
            </div>
            <div className="p-3 space-y-2">
              <div className="grid gap-1.5 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                  {isEditingPhone ? (
                    <div className="flex-1 flex items-center gap-2">
                      <Input
                        value={editedPhone}
                        onChange={(e) => setEditedPhone(e.target.value)}
                        placeholder="Enter phone..."
                        className="h-7 text-sm flex-1"
                        autoFocus
                      />
                      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={handleSavePhone} disabled={isSavingPhone}>
                        {isSavingPhone ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setIsEditingPhone(false)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setEditedPhone(savedPhone ?? contact?.phone ?? "");
                          setIsEditingPhone(true);
                        }}
                        className="hover:underline text-left"
                      >
                        {(savedPhone ?? contact?.phone) ? (
                          <span className="text-primary">{(() => {
                            const raw = (savedPhone ?? contact?.phone ?? "").replace(/\D/g, '');
                            const digits = raw.startsWith('1') && raw.length === 11 ? raw.slice(1) : raw;
                            if (digits.length === 10) return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
                            return savedPhone ?? contact?.phone;
                          })()}</span>
                        ) : (
                          <span className="italic text-muted-foreground/60">No phone - click to add</span>
                        )}
                      </button>
                      {(savedPhone ?? contact?.phone) && (
                        <>
                          <a href={`tel:${savedPhone ?? contact?.phone}`} className="text-muted-foreground hover:text-primary p-0.5" title="Call">
                            <Phone className="h-3 w-3" />
                          </a>
                          <button
                            className="text-muted-foreground hover:text-primary p-0.5"
                            onClick={() => {
                              navigator.clipboard.writeText(savedPhone ?? contact?.phone ?? "");
                              toast.success("Phone copied");
                            }}
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>

                <div className="flex items-start gap-2">
                  <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  {isEditingAddress ? <div className="flex-1 flex items-center gap-2">
                      <Input value={editedAddress} onChange={e => setEditedAddress(e.target.value)} placeholder="Enter address..." className="h-7 text-sm flex-1" />
                      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={handleSaveAddress} disabled={isSavingAddress}>
                        {isSavingAddress ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setIsEditingAddress(false)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div> : <>
                      <button onClick={() => {
                    setEditedAddress(address || "");
                    setIsEditingAddress(true);
                  }} className="flex-1 text-left hover:underline">
                        {address || <span className="italic text-muted-foreground/60">No address - click to add</span>}
                      </button>
                      {address && <a href={`https://propwire.com/search?q=${encodeURIComponent(address)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center h-5 w-5 shrink-0 rounded-sm hover:bg-muted transition-colors" title="Look up on Propwire">
                          <ExternalLink className="h-3 w-3" />
                        </a>}
                    </>}
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  {isEditingEmail ? (
                    <div className="flex-1 flex items-center gap-2">
                      <Input
                        value={editedEmail}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditedEmail(val);
                          if (val.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim())) {
                            setEmailValidationError("Please enter a valid email address");
                          } else {
                            setEmailValidationError(null);
                          }
                        }}
                        placeholder="Enter email..."
                        className="h-7 text-sm flex-1"
                        autoFocus
                        type="email"
                      />
                      {emailValidationError && (
                        <p className="text-xs text-destructive mt-0.5 w-full">{emailValidationError}</p>
                      )}
                      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={handleSaveEmail} disabled={isSavingEmail}>
                        {isSavingEmail ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setIsEditingEmail(false)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setEditedEmail(savedEmail ?? contact?.email ?? "");
                          setIsEditingEmail(true);
                        }}
                        className="hover:underline text-left truncate"
                      >
                        {(savedEmail ?? contact?.email) ? (
                          <span className="text-primary">{savedEmail ?? contact?.email}</span>
                        ) : (
                          <span className="italic text-muted-foreground/60">No email - click to add</span>
                        )}
                      </button>
                      {(savedEmail ?? contact?.email) && (
                        <>
                          <button
                            className="text-muted-foreground hover:text-primary p-0.5"
                            onClick={() => {
                              navigator.clipboard.writeText(savedEmail ?? contact?.email ?? "");
                              toast.success("Email copied");
                            }}
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                          <a
                            href={`mailto:${savedEmail ?? contact?.email}`}
                            target="_top"
                            rel="noreferrer"
                            className="text-muted-foreground hover:text-primary p-0.5"
                            title="Send email"
                          >
                            <Mail className="h-3 w-3" />
                          </a>
                          <a
                            href={`https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(savedEmail ?? contact?.email ?? "")}&body=${encodeURIComponent(`Dear ${(contact?.first_name || '').charAt(0).toUpperCase() + (contact?.first_name || '').slice(1).toLowerCase()} ${(contact?.last_name || '').charAt(0).toUpperCase() + (contact?.last_name || '').slice(1).toLowerCase()},${contactAddress ? `\n${contactAddress}` : ''}\n\n\n\nBest regards,\nCA Pro Builders`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-primary text-xs"
                          >
                            (Gmail)
                          </a>
                        </>
                      )}
                    </>
                  )}
                </div>

                {/* Scope of Work */}
                <div className="border rounded-lg overflow-hidden mt-2">
                  <div className="bg-muted/30 px-3 py-2 flex items-center justify-between border-b">
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Scope of Work
                      </span>
                      {!scopeOfWork && !isEditingScope && <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
                          Missing
                        </Badge>}
                    </div>
                    {!isEditingScope && <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => {
                    setEditedScope(scopeOfWork || "");
                    setIsEditingScope(true);
                  }}>
                        <Pencil className="h-3 w-3 mr-1" />
                        {scopeOfWork ? "Edit" : "Add"}
                      </Button>}
                  </div>
                  <div className="p-3">
                    {isEditingScope ? <div className="space-y-2">
                        <Textarea value={editedScope} onChange={e => setEditedScope(e.target.value)} placeholder="Enter scope of work..." className="min-h-[80px] text-sm resize-none" disabled={isSavingScope} />
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="ghost" className="h-7" onClick={() => setIsEditingScope(false)} disabled={isSavingScope}>
                            Cancel
                          </Button>
                          <Button size="sm" className="h-7" onClick={handleSaveScope} disabled={isSavingScope}>
                            {isSavingScope ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                            Save
                          </Button>
                        </div>
                      </div> : scopeOfWork ? (
                        <div>
                          <p className={`text-sm whitespace-pre-wrap${!isScopeExpanded ? ' line-clamp-4' : ''}`}>{scopeOfWork}</p>
                          {(() => {
                            const lineCount = (scopeOfWork.match(/\n/g) || []).length;
                            const needsToggle = scopeOfWork.length > 300 || lineCount >= 4;
                            return needsToggle ? (
                              <button
                                onClick={() => setIsScopeExpanded(e => !e)}
                                className="mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                              >
                                {isScopeExpanded ? <><ChevronUp className="h-3 w-3" /> Show less</> : <><ChevronDown className="h-3 w-3" /> Show more</>}
                              </button>
                            ) : null;
                          })()}
                        </div>
                      ) : <p className="text-sm text-muted-foreground/60 italic">No scope of work defined</p>}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Key Info - Compact Two-Line Wrap */}
          <div className="flex flex-wrap gap-2 text-sm">
            {/* Pipeline + Stage */}
            <div className="bg-muted/40 rounded-md px-2.5 py-[3px] min-w-[100px] flex-1">
              <div className="text-muted-foreground text-xs mb-[1px]">Pipeline</div>
              {isEditing ? <Select value={hasAdminPipelineConfig && adminPipelineId ? adminPipelineId : editedPipeline} onValueChange={handlePipelineChange}>
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue placeholder="Select pipeline" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {availablePipelines.map(p => <SelectItem key={p.id} value={p.id} className="text-xs">
                        {p.name}
                      </SelectItem>)}
                  </SelectContent>
                </Select> : isInlineEditingPipeline ? <Select value={hasAdminPipelineConfig && adminPipelineId ? adminPipelineId : (savedValues.pipeline_id ?? opportunity.pipeline_id ?? "")} onValueChange={handleInlinePipelineChange} disabled={isSavingInline} onOpenChange={open => {
              if (!open && !isSavingInline) setIsInlineEditingPipeline(false);
            }} defaultOpen>
                  <SelectTrigger className="h-7 text-xs">
                    {isSavingInline ? <Loader2 className="h-3 w-3 animate-spin" /> : <SelectValue placeholder="Select pipeline" />}
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {availablePipelines.map(p => <SelectItem key={p.id} value={p.id} className="text-xs">
                        {p.name}
                      </SelectItem>)}
                  </SelectContent>
                 </Select> : isInlineEditingStage ? <Select value={savedValues.stage_name ?? opportunity.stage_name ?? ""} onValueChange={handleInlineStageChange} disabled={isSavingInline} onOpenChange={open => {
              if (!open && !isSavingInline) setIsInlineEditingStage(false);
            }} defaultOpen>
                  <SelectTrigger className="h-7 text-xs">
                    {isSavingInline ? <Loader2 className="h-3 w-3 animate-spin" /> : <SelectValue placeholder="Select stage" />}
                  </SelectTrigger>
                   <SelectContent className="bg-popover z-50">
                    {availableStages.map(stage => <SelectItem key={stage} value={stage} className="text-xs">
                        {stage}
                      </SelectItem>)}
                  </SelectContent>
                </Select> : <span className="flex items-center gap-1 flex-wrap">
                  <button className="font-medium hover:underline text-left cursor-pointer" onClick={() => setIsInlineEditingPipeline(true)}>
                    {hasAdminPipelineConfig ? (adminPipelineName || "Main") : (savedValues.pipeline_name ?? opportunity.pipeline_name ?? "-")}
                  </button>
                  {(savedValues.stage_name ?? opportunity.stage_name) && (
                    <>
                      <span className="text-muted-foreground">›</span>
                      <button className="text-muted-foreground font-normal hover:underline hover:text-foreground cursor-pointer" onClick={() => setIsInlineEditingStage(true)}>
                        {savedValues.stage_name ?? opportunity.stage_name}
                      </button>
                    </>
                  )}
                </span>}
            </div>


            {/* Won Date - Only show when status is 'won' */}
            {(savedValues.status ?? opportunity.status)?.toLowerCase() === "won" && (
              <div className="bg-emerald-500/10 rounded-md px-2.5 py-[3px] min-w-[110px] border border-emerald-500/20">
                <div className="text-emerald-500/80 text-xs mb-[1px] flex items-center gap-1">
                  <Trophy className="h-3 w-3" />
                  Won Date
                </div>
                {isEditingWonAt && isAdmin ? (
                  <div className="flex items-center gap-1">
                    <Input
                      type="date"
                      value={editedWonAtDate}
                      onChange={(e) => setEditedWonAtDate(e.target.value)}
                      className="h-6 text-xs w-28 px-1"
                    />
                    <Button variant="ghost" size="sm" className="h-6 px-1" onClick={handleSaveWonAt} disabled={isSavingWonAt}>
                      {isSavingWonAt ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-6 px-1" onClick={() => setIsEditingWonAt(false)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <button
                    className={`font-medium truncate text-emerald-500 ${isAdmin ? "hover:underline cursor-pointer" : ""}`}
                    onClick={() => {
                      if (!isAdmin) return;
                      const currentWonAt = savedWonAt ?? opportunity.won_at;
                      if (currentWonAt) {
                        const d = new Date(currentWonAt);
                        // Convert to PST for editing
                        const pstOffset = getPSTOffset(d);
                        const pstDate = new Date(d.getTime() - pstOffset * 60 * 60 * 1000);
                        setEditedWonAtDate(pstDate.toISOString().split("T")[0]);
                      } else {
                        // Default to now
                        const now = new Date();
                        const pstOffset = getPSTOffset(now);
                        const pstNow = new Date(now.getTime() - pstOffset * 60 * 60 * 1000);
                        setEditedWonAtDate(pstNow.toISOString().split("T")[0]);
                      }
                      setIsEditingWonAt(true);
                    }}
                    disabled={!isAdmin}
                  >
                    {formatDateOnly(savedWonAt ?? opportunity.won_at)}
                    {isAdmin && <Pencil className="h-2.5 w-2.5 inline ml-1 opacity-50" />}
                  </button>
                )}
              </div>
            )}

            {/* Created */}
            <div className="bg-muted/40 rounded-md px-2.5 py-[3px] min-w-[90px]">
              <div className="text-muted-foreground text-xs mb-[1px]">Created</div>
              {isEditingCreatedAt && isSuperAdmin ? (
                <div className="flex items-center gap-1">
                  <Input
                    type="date"
                    value={editedCreatedAtDate}
                    onChange={(e) => setEditedCreatedAtDate(e.target.value)}
                    className="h-6 text-xs w-28 px-1"
                  />
                  <Button
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={handleSaveCreatedAt}
                    disabled={isSavingCreatedAt}
                  >
                    {isSavingCreatedAt ? "..." : "Save"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs"
                    onClick={() => setIsEditingCreatedAt(false)}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <button
                  className={`font-medium truncate ${isSuperAdmin ? "hover:underline cursor-pointer" : ""}`}
                  onClick={() => {
                    if (!isSuperAdmin) return;
                    const currentCreated = savedCreatedAt ?? opportunity.ghl_date_added;
                    if (currentCreated) {
                      const d = new Date(currentCreated);
                      const yyyy = d.getFullYear();
                      const mm = String(d.getMonth() + 1).padStart(2, "0");
                      const dd = String(d.getDate()).padStart(2, "0");
                      setEditedCreatedAtDate(`${yyyy}-${mm}-${dd}`);
                    } else {
                      setEditedCreatedAtDate("");
                    }
                    setIsEditingCreatedAt(true);
                  }}
                  disabled={!isSuperAdmin}
                >
                  {formatDate(savedCreatedAt ?? opportunity.ghl_date_added)}
                  {isSuperAdmin && <Pencil className="h-2.5 w-2.5 inline ml-1 opacity-50" />}
                </button>
              )}
            </div>

            {/* Assigned To */}
            <div className="bg-muted/40 rounded-md px-2.5 py-[3px] min-w-[110px] flex-1">
              <div className="text-muted-foreground text-xs mb-[1px]">Assigned To</div>
              {isEditing ? <Select value={editedAssignedTo} onValueChange={setEditedAssignedTo}>
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue placeholder="Select rep" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__unassigned__" className="text-xs">
                      Unassigned
                    </SelectItem>
                    {activeSalespeople.map(sp => (
                      <SelectItem 
                        key={sp.id} 
                        value={sp.id} 
                        className="text-xs"
                      >
                        {sp.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select> : isInlineEditingAssignedTo ? <Select 
                  value={effectiveAssignedTo || "__unassigned__"} 
                  onValueChange={handleInlineAssignedToChange} 
                  disabled={isSavingInline} 
                  onOpenChange={open => {
                    if (!open && !isSavingInline) setIsInlineEditingAssignedTo(false);
                  }} 
                  defaultOpen
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue placeholder="Select rep" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__unassigned__" className="text-xs">
                      Unassigned
                    </SelectItem>
                    {activeSalespeople.map(sp => (
                      <SelectItem 
                        key={sp.id} 
                        value={sp.id} 
                        className="text-xs"
                      >
                        {sp.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select> : <button 
                  className="font-medium truncate hover:underline text-left w-full cursor-pointer" 
                  onClick={() => setIsInlineEditingAssignedTo(true)}
                >
                  {userName}
                </button>}
            </div>

            {/* Source */}
            <div className="bg-muted/40 rounded-md px-2.5 py-[3px] min-w-[90px]">
              <div className="text-muted-foreground text-xs mb-[1px] flex items-center gap-1">
                <Megaphone className="h-3 w-3" /> Source
              </div>
              {isEditing ? showCustomSourceInput ? <div className="flex gap-1">
                    <Input value={customSourceInput} onChange={e => setCustomSourceInput(e.target.value)} className="h-7 text-xs flex-1" placeholder="Enter new source" autoFocus onKeyDown={e => {
                if (e.key === "Enter" && customSourceInput.trim()) {
                  setEditedSource(customSourceInput.trim());
                  setShowCustomSourceInput(false);
                } else if (e.key === "Escape") {
                  setShowCustomSourceInput(false);
                  setCustomSourceInput("");
                }
              }} />
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => {
                if (customSourceInput.trim()) {
                  const newSource = customSourceInput.trim();
                  setEditedSource(newSource);
                  setShowCustomSourceInput(false);
                  setCustomSourceInput("");
                }
              }}>
                      <Check className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => {
                setShowCustomSourceInput(false);
                setCustomSourceInput("");
              }}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div> : <Select value={editedSource || "__placeholder__"} onValueChange={val => {
              if (val === "__custom__") {
                setShowCustomSourceInput(true);
                setCustomSourceInput("");
              } else if (val !== "__placeholder__") {
                setEditedSource(val);
              }
            }}>
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue placeholder="Select source">
                        {editedSource || "Select source"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      {/* Show current edited source if it's not in availableSources */}
                      {editedSource && !availableSources.includes(editedSource) && <SelectItem key={editedSource} value={editedSource} className="text-xs font-medium">
                          {editedSource} (new)
                        </SelectItem>}
                      {availableSources.map(source => <SelectItem key={source} value={source} className="text-xs">
                          {source}
                        </SelectItem>)}
                      <SelectItem value="__custom__" className="text-xs text-primary">
                        + Add New Source
                      </SelectItem>
                    </SelectContent>
                  </Select> : isAdmin && isInlineEditingSource ? <Select
                    value={(savedValues.source ?? (contact?.source ? normalizeSourceName(contact.source) : "")) || "__placeholder__"}
                    onValueChange={handleInlineSourceChange}
                    disabled={isSavingInline}
                    onOpenChange={open => {
                      if (!open && !isSavingInline) setIsInlineEditingSource(false);
                    }}
                    defaultOpen
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue placeholder="Select source" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      {availableSources.map(source => (
                        <SelectItem key={source} value={source} className="text-xs">
                          {source}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select> : <button
                    className={`font-medium truncate text-left w-full ${isAdmin ? "hover:underline cursor-pointer" : ""}`}
                    onClick={() => { if (isAdmin) setIsInlineEditingSource(true); }}
                    disabled={!isAdmin}
                  >
                    {savedValues.source ?? (contact?.source ? normalizeSourceName(contact.source) : "No source")}
                    {isAdmin && <Pencil className="h-2.5 w-2.5 inline ml-1 opacity-50" />}
                  </button>}
            </div>
          </div>

          {/* Notes/Comments */}
          <Collapsible className="border rounded-lg overflow-hidden" defaultOpen={false}>
            <CollapsibleTrigger asChild>
              <div className="bg-muted/30 px-3 py-2 flex items-center justify-between border-b cursor-pointer">
                <div className="flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Notes & Comments {contactNotesList.length > 0 && `(${contactNotesList.length})`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {isLoadingNotes && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                  <ChevronDown className="h-3 w-3 text-muted-foreground transition-transform data-[state=open]:rotate-180" />
                </div>
              </div>
            </CollapsibleTrigger>

            <CollapsibleContent>
              {/* body stays the same as before */}
              <div className="p-3 space-y-3 max-h-80 overflow-y-auto">
                {/* Timeline Notes from GHL */}
                {contactNotesList.length > 0 && <div className="space-y-2">
                    <div className="text-xs text-muted-foreground mb-2">Activity Notes</div>
                    {contactNotesList.sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime()).map(note => {
                  // Prefer entered_by (app user) over userId (GHL user)
                  let noteUserName = note.enteredByName;
                  if (!noteUserName && note.userId) {
                    const noteUser = users.find(u => u.ghl_id === note.userId);
                    noteUserName = noteUser?.name || (noteUser?.first_name && noteUser?.last_name ? `${noteUser.first_name} ${noteUser.last_name}` : null);
                  }
                  return <div key={note.id} className="bg-muted/30 rounded p-2">
                            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                              <span>{noteUserName || "GHL User"}</span>
                              <div className="flex items-center gap-2">
                                <span>
                                  {new Date(note.dateAdded).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric"
                                  })}
                                </span>
                                {(isAdmin || isSuperAdmin) && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5 text-muted-foreground hover:text-destructive"
                                    onClick={() => {
                                      setNoteToDelete(note.id);
                                      setDeleteNoteDialogOpen(true);
                                    }}
                                    disabled={isDeletingNote === note.id}
                                  >
                                    {isDeletingNote === note.id ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-3 w-3" />
                                    )}
                                  </Button>
                                )}
                              </div>
                            </div>
                            <p className="text-sm whitespace-pre-wrap">{stripHtml(note.body)}</p>
                          </div>;
                })}
                  </div>}

                {/* Contact Custom Field Notes */}
                {contactNotes && <div className={contactNotesList.length > 0 ? "border-t pt-3" : ""}>
                    <div className="text-xs text-muted-foreground mb-1">Custom Field Notes</div>
                    <p className="text-sm whitespace-pre-wrap">{contactNotes}</p>
                  </div>}

                {/* Appointment Notes */}
                {relatedAppointments.filter(a => a.notes).length > 0 && <div className={contactNotes || contactNotesList.length > 0 ? "border-t pt-3" : ""}>
                    <div className="text-xs text-muted-foreground mb-2">Appointment Notes</div>
                    <div className="space-y-2">
                      {relatedAppointments.filter(a => a.notes).map(appt => <div key={appt.ghl_id} className="bg-muted/30 rounded p-2">
                            <div className="text-xs text-muted-foreground mb-1">{appt.title || "Appointment"}</div>
                            <p className="text-sm whitespace-pre-wrap">{appt.notes}</p>
                          </div>)}
                    </div>
                  </div>}

                {!contactNotes && contactNotesList.length === 0 && relatedAppointments.filter(a => a.notes).length === 0 && <p className="text-sm text-muted-foreground/60 italic">
                      {isLoadingNotes ? "Loading notes..." : "No notes or comments yet"}
                    </p>}
              </div>

              {/* Add New Note Form */}
              <div className="border-t p-3">
                <Textarea placeholder="Add a note..." value={newNoteText} onChange={e => setNewNoteText(e.target.value)} className="min-h-[60px] text-sm resize-none mb-2" disabled={isCreatingNote} />
                <div className="flex justify-end">
                  <Button size="sm" onClick={handleCreateNote} disabled={isCreatingNote || !newNoteText.trim()}>
                    {isCreatingNote ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Send className="h-3.5 w-3.5 mr-1" />}
                    Add Note
                  </Button>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Conversations - fetched live from GHL */}
          {(() => {
          const formatConvDate = (dateStr: string | null | number) => {
            if (!dateStr) return "";
            const date = typeof dateStr === "number" ? new Date(dateStr) : new Date(dateStr);
            return date.toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
              hour12: true
            });
          };
          const getTypeIcon = (type: string | null) => {
            switch (type?.toLowerCase()) {
              case "type_sms":
              case "sms":
                return "💬";
              case "type_email":
              case "email":
                return "📧";
              case "type_call":
              case "call":
                return "📞";
              case "type_facebook":
              case "facebook":
                return "📘";
              case "type_instagram":
              case "instagram":
                return "📸";
              default:
                return "💬";
            }
          };

          // Flatten all messages from all conversations and sort by date
          // When messages array is empty but conversation has last_message_body, create a synthetic message
          const allMessages = liveConversations.flatMap(conv => {
            const messages = conv.messages || [];
            if (messages.length > 0) {
              return messages.map(msg => ({
                ...msg,
                conversationType: conv.type
              }));
            }
            // Fallback: show last_message_body as a synthetic message if available
            if (conv.last_message_body) {
              return [{
                id: `synthetic-${conv.ghl_id || conv.contact_id}`,
                body: conv.last_message_body,
                direction: conv.last_message_direction || 'inbound',
                status: 'delivered',
                type: conv.last_message_type || conv.type || 'SMS',
                dateAdded: conv.last_message_date || new Date().toISOString(),
                conversationType: conv.type,
              }];
            }
            return [];
          }).sort((a, b) => {
            const dateA = new Date(a.dateAdded).getTime();
            const dateB = new Date(b.dateAdded).getTime();
            return dateB - dateA; // Most recent first
          });
          return <Collapsible className="border rounded-lg overflow-hidden" defaultOpen={false}>
                <CollapsibleTrigger asChild>
                  <button className="bg-muted/30 px-3 py-2 w-full flex items-center justify-between border-b cursor-pointer">
                    <div className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Conversation History {allMessages.length > 0 && `(${allMessages.length} messages)`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isLoadingNotes && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                      <ChevronDown className="h-3 w-3 text-muted-foreground" />
                    </div>
                  </button>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  {/* body stays the same as before */}
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-muted/30 px-3 py-2 flex items-center justify-between border-b">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <Button variant="ghost" size="sm" className="h-6 px-2" onClick={handleRefreshConversations} disabled={isLoadingConversations}>
                        <RefreshCw className={`h-3 w-3 ${isLoadingConversations ? "animate-spin" : ""}`} />
                      </Button>
                    </div>

                    {isLoadingConversations ? <div className="p-4 flex items-center justify-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Loading conversation history...</span>
                      </div> : allMessages.length === 0 ? <div className="p-4 text-center text-sm text-muted-foreground/60 italic">
                        No conversation history found
                      </div> : <div className="max-h-80 overflow-y-auto p-3 space-y-3">
                        {allMessages.slice(0, 50).map(msg => <div key={msg.id} className={`flex flex-col ${msg.direction === "inbound" ? "items-start" : "items-end"}`}>
                            <div className={`max-w-[85%] rounded-lg px-3 py-2 ${msg.direction === "inbound" ? "bg-muted/60 text-foreground" : "bg-primary/20 text-foreground"}`}>
                              <p className="text-sm whitespace-pre-wrap break-words">{msg.body || "(No content)"}</p>
                            </div>
                            <div className="flex items-center gap-1.5 mt-1 text-[10px] text-muted-foreground">
                              <span>{getTypeIcon(msg.type)}</span>
                              <span>{msg.direction === "inbound" ? "Received" : "Sent"}</span>
                              <span>•</span>
                              <span>{formatConvDate(msg.dateAdded)}</span>
                            </div>
                          </div>)}
                        {allMessages.length > 50 && <div className="text-center text-xs text-muted-foreground py-2">
                            Showing 50 of {allMessages.length} messages
                          </div>}
                      </div>}
                  </div>
                </CollapsibleContent>
              </Collapsible>;
        })()}

          {/* Related Appointments */}
          <Collapsible className="border rounded-lg overflow-hidden" defaultOpen={false}>
            <CollapsibleTrigger asChild>
              <button className="bg-muted/30 px-3 py-2 w-full flex items-center justify-between border-b cursor-pointer">
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Appointment History ({relatedAppointments.length})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="h-6 px-2" onClick={e => {
                  e.stopPropagation();
                  openAppointmentDialog();
                }}>
                    <Plus className="h-3 w-3 mr-1" />
                    <span className="text-xs">Add</span>
                  </Button>
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </div>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              {relatedAppointments.length === 0 ? <div className="p-4 text-center text-sm text-muted-foreground/60 italic">No appointments found</div> : <div className="divide-y max-h-60 overflow-y-auto">
                  {relatedAppointments.sort((a, b) => new Date(b.start_time || 0).getTime() - new Date(a.start_time || 0).getTime()).map(appt => <div key={appt.ghl_id} className="p-3 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-sm truncate">{appt.title || "Untitled"}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditAppointmentDialog(appt)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Badge variant="outline" className={`text-xs ${getAppointmentStatusColor(appt.appointment_status)}`}>
                              {appt.appointment_status || "Unknown"}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatDateTime(appt.start_time)}
                        </div>
                        {appt.notes && <div className="text-xs text-muted-foreground mt-2 p-2 bg-muted/30 rounded whitespace-pre-wrap">
                            {appt.notes}
                          </div>}
                      </div>)}
                </div>}
            </CollapsibleContent>
          </Collapsible>

          {/* Tasks */}
          <Collapsible className="border rounded-lg overflow-hidden" defaultOpen={false}>
            <CollapsibleTrigger asChild>
              <button className="bg-muted/30 px-3 py-2 w-full flex items-center justify-between border-b cursor-pointer">
                <div className="flex items-center gap-2">
                  <CheckSquare className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Tasks ({tasks.length})
                  </span>
                  {isLoadingTasks && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="h-6 px-2" onClick={e => {
                  e.stopPropagation();
                  openTaskDialog();
                }}>
                    <Plus className="h-3 w-3 mr-1" />
                    <span className="text-xs">Add</span>
                  </Button>
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </div>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              {tasks.length === 0 ? <div className="p-4 text-center text-sm text-muted-foreground/60 italic">
                  {isLoadingTasks ? "Loading tasks..." : "No tasks created yet"}
                </div> : <div className="divide-y max-h-60 overflow-y-auto">
                  {tasks.map(task => {
                const taskUser = users.find(u => u.ghl_id === task.assigned_to);
                const taskUserName = taskUser?.name || (taskUser?.first_name && taskUser?.last_name ? `${taskUser.first_name} ${taskUser.last_name}` : "Unassigned");
                return <div key={task.id} className="p-3 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => handleToggleTaskStatus(task)} disabled={isUpdatingTaskStatus === task.id}>
                              {isUpdatingTaskStatus === task.id ? <Loader2 className="h-3 w-3 animate-spin" /> : task.status === "completed" ? <Check className="h-3 w-3 text-emerald-400" /> : <div className="h-3 w-3 rounded-sm border border-muted-foreground" />}
                            </Button>
                            <span className={`font-medium text-sm truncate ${task.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
                              {task.title}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditTaskDialog(task)}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => handleDeleteTask(task)} disabled={isDeletingTask === task.id}>
                              {isDeletingTask === task.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                            </Button>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground pl-7">
                          <span>{taskUserName}</span>
                          {task.due_date && <>
                              <span>•</span>
                              <span>
                                Due:{" "}
                                {new Date(task.due_date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit"
                        })}
                              </span>
                            </>}
                        </div>
                        {task.notes && <div className="text-xs text-muted-foreground mt-1 p-2 bg-muted/30 rounded whitespace-pre-wrap ml-7">
                            {stripHtml(task.notes)}
                          </div>}
                      </div>;
              })}
                </div>}
            </CollapsibleContent>
          </Collapsible>

          {/* Estimates & Proposals */}
          <Collapsible className="border rounded-lg overflow-hidden" defaultOpen={linkedEstimates.length > 0}>
            <CollapsibleTrigger asChild>
              <button className="bg-muted/30 px-3 py-2 w-full flex items-center justify-between border-b cursor-pointer">
                <div className="flex items-center gap-2">
                  <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Estimates & Proposals ({linkedEstimates.length})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      // Build URL params for estimate builder
                      const params = new URLSearchParams();
                      if (opportunity?.id) params.set('opportunityId', opportunity.id);
                      if (opportunity?.ghl_id) params.set('opportunityGhlId', opportunity.ghl_id);
                      if (opportunity?.name) params.set('name', opportunity.name);
                      const contactName = contact?.contact_name || (contact?.first_name && contact?.last_name ? `${contact.first_name} ${contact.last_name}`.trim() : null);
                      if (contactName) params.set('contactName', contactName);
                      if (contact?.email) params.set('contactEmail', contact.email);
                      if (contact?.phone) params.set('contactPhone', contact.phone);
                      if (opportunity?.address) params.set('address', opportunity.address);
                      if (opportunity?.scope_of_work) params.set('scope', opportunity.scope_of_work);
                      if (contact?.id) params.set('contactUuid', contact.id);
                      if (contact?.ghl_id) params.set('contactId', contact.ghl_id);
                      if (contact?.source) params.set('leadSource', contact.source);
                      
                      const url = `/estimate/new?${params.toString()}`;
                      openTab(url, `New Estimate - ${opportunity?.name || 'Opportunity'}`);
                    }}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    <span className="text-xs">Create</span>
                  </Button>
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </div>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              {linkedEstimates.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground/60 italic">
                  No estimates linked to this opportunity
                </div>
              ) : (
                <div className="divide-y max-h-60 overflow-y-auto">
                  {linkedEstimates.map((est) => {
                    const statusColors: Record<string, string> = {
                      draft: "bg-muted text-muted-foreground",
                      sent: "bg-blue-100 text-blue-700",
                      viewed: "bg-purple-100 text-purple-700",
                      needs_changes: "bg-amber-100 text-amber-700",
                      accepted: "bg-green-100 text-green-700",
                      declined: "bg-red-100 text-red-700",
                    };
                    const statusLabels: Record<string, string> = {
                      draft: "Draft",
                      sent: "Sent",
                      viewed: "Viewed",
                      needs_changes: "Needs Changes",
                      accepted: "Accepted",
                      declined: "Declined",
                    };
                    return (
                      <div key={est.id} className="p-3 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono text-xs text-muted-foreground">
                              {est.status === 'accepted' ? `CNT-${est.estimate_number}` : `EST-${est.estimate_number}`}
                            </span>
                            <span className="font-medium text-sm truncate">
                              {est.estimate_title || "Untitled"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge className={`text-xs ${statusColors[est.status] || "bg-muted"}`}>
                              {statusLabels[est.status] || est.status}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => setPreviewEstimateId(est.id)}
                              title={est.status === 'accepted' ? "Preview Contract" : "Preview Proposal"}
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground">
                            {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(est.total || 0)}
                          </span>
                          <span>•</span>
                          <span>
                            {new Date(est.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* Proposal Link */}
          {opportunity.proposal_link && (
            <div className="flex items-center justify-between p-3 rounded-lg border bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-green-600 dark:text-green-400" />
                <span className="text-sm font-medium text-green-800 dark:text-green-200">
                  Signed Proposal Available
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-green-300 hover:bg-green-100 dark:border-green-700 dark:hover:bg-green-900"
                onClick={() => window.open(opportunity.proposal_link!, '_blank')}
              >
                <ExternalLink className="h-3 w-3 mr-1.5" />
                View Proposal
              </Button>
            </div>
          )}

          {/* Timeline */}
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
            <span>Updated: {formatDate(opportunity.ghl_date_updated)}</span>
          </div>
        </div>
      </SheetContent>

      {/* Create/Edit Task Dialog */}
      <Dialog open={taskDialogOpen} onOpenChange={open => {
      setTaskDialogOpen(open);
      if (!open) {
        setEditingTask(null);
        setTaskTitle("");
        setTaskNotes("");
        setTaskAssignee("");
        setTaskDueDate("");
        setTaskDueTime("09:00");
      }
    }}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5" />
              {editingTask ? "Edit Task" : "Create Task"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="oppTaskTitle">Task Title</Label>
              <Input id="oppTaskTitle" value={taskTitle} onChange={e => setTaskTitle(e.target.value)} placeholder="Enter task title..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="oppTaskNotes">Notes</Label>
              <Textarea id="oppTaskNotes" value={taskNotes} onChange={e => setTaskNotes(e.target.value)} placeholder="Add notes for this task..." rows={3} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="oppTaskAssignee">Assign To</Label>
              <Select value={taskAssignee} onValueChange={setTaskAssignee}>
                <SelectTrigger>
                  <SelectValue placeholder="Select team member..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__unassigned__">Unassigned</SelectItem>
                  {filteredUsers.map(user => <SelectItem key={user.ghl_id} value={user.ghl_id}>
                        {user.name || `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.email || "Unknown"}
                      </SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Due Date & Time (PST) - Optional</Label>
              <div className="flex gap-2">
                <Input id="oppTaskDueDate" type="date" value={taskDueDate} onChange={e => setTaskDueDate(e.target.value)} className="flex-1" />
                <Input id="oppTaskDueTime" type="time" value={taskDueTime} onChange={e => setTaskDueTime(e.target.value)} className="w-28" />
              </div>
              <p className="text-xs text-muted-foreground">Times are in Pacific Standard Time (PST/PDT)</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTaskDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={editingTask ? handleUpdateTask : handleCreateTask} disabled={isCreatingTask}>
              {isCreatingTask ? editingTask ? "Saving..." : "Creating..." : editingTask ? "Save Changes" : "Create Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Appointment Dialog - local-first, no GHL calendar dependency */}
      <Dialog open={appointmentDialogOpen} onOpenChange={open => {
      setAppointmentDialogOpen(open);
      if (!open) {
        setAppointmentTitle("");
        setAppointmentDate("");
        setAppointmentTime("09:00");
        setAppointmentAssignee("");
        setAppointmentNotes("");
        setAppointmentAddress("");
      }
    }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Add Appointment
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 overflow-y-auto flex-1 pr-2">
            <div className="space-y-2">
              <Label htmlFor="oppApptTitle">Appointment Title</Label>
              <Input id="oppApptTitle" value={appointmentTitle} onChange={e => setAppointmentTitle(e.target.value)} placeholder="Enter appointment title..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="oppApptAddress">Address</Label>
              <Input id="oppApptAddress" value={appointmentAddress} onChange={e => setAppointmentAddress(e.target.value)} placeholder="Enter appointment address..." />
              <p className="text-xs text-muted-foreground">Prefilled from contact address if available</p>
            </div>
            <div className="space-y-2">
              <Label>Date & Time (PST)</Label>
              <div className="flex gap-2">
                <Input type="date" value={appointmentDate} onChange={e => setAppointmentDate(e.target.value)} className="flex-1" />
                <Input type="time" value={appointmentTime} onChange={e => setAppointmentTime(e.target.value)} className="w-28" />
              </div>
              <p className="text-xs text-muted-foreground">
                Times are in Pacific Standard Time (PST/PDT)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="oppApptAssignee">Assign To</Label>
              <Select value={appointmentAssignee} onValueChange={setAppointmentAssignee}>
                <SelectTrigger>
                  <SelectValue placeholder="Select salesperson..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__unassigned__">Unassigned</SelectItem>
                  {[...activeSalespeople].sort((a, b) => (a.name || "").localeCompare(b.name || "")).map(sp => (
                    <SelectItem key={sp.id} value={sp.id}>
                      {sp.name || "Unknown"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* Warning when assignee differs from opportunity owner */}
              {appointmentAssignee && 
               appointmentAssignee !== "__unassigned__" && 
               opportunity?.assigned_to && (() => {
                 // Check if the selected salesperson matches the opportunity owner
                 const selectedSp = activeSalespeople.find(sp => sp.id === appointmentAssignee);
                 const ownerSp = activeSalespeople.find(sp => sp.id === opportunity.assigned_to || sp.ghl_user_id === opportunity.assigned_to);
                 // Show warning only if we found both and they differ
                 if (!selectedSp || !ownerSp || selectedSp.id === ownerSp.id) return null;
                 const selectedName = selectedSp.name || "Selected user";
                 const ownerName = ownerSp.name || "Opportunity owner";
                 return (
                   <Alert className="mt-2 bg-amber-500/10 border-amber-500/30 py-2 px-3">
                     <AlertTriangle className="h-4 w-4 text-amber-500" />
                     <AlertDescription className="text-amber-600 dark:text-amber-400 text-xs">
                       Assigning to <strong>{selectedName}</strong>, but opportunity owner is <strong>{ownerName}</strong>.
                     </AlertDescription>
                   </Alert>
                 );
               })()}
            </div>
            <div className="space-y-2">
              <Label htmlFor="oppApptNotes">Notes (optional)</Label>
              <Textarea id="oppApptNotes" value={appointmentNotes} onChange={e => setAppointmentNotes(e.target.value)} placeholder="Add notes for this appointment..." rows={3} />
            </div>

            {/* Sync status indicator */}
            <div className="pt-2 border-t border-border/50">
              <p className="text-xs text-muted-foreground">
                ✓ Will be saved locally
              </p>
            </div>
          </div>
          <DialogFooter className="flex-shrink-0 pt-4 border-t">
            <Button variant="outline" onClick={() => setAppointmentDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateAppointment} disabled={isCreatingAppointment || !appointmentDate}>
              {isCreatingAppointment ? "Creating..." : "Create Appointment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Appointment Edit Dialog - using shared component */}
      <AppointmentEditDialog 
        appointment={editingAppointment} 
        open={appointmentEditDialogOpen} 
        onOpenChange={open => {
          setAppointmentEditDialogOpen(open);
          if (!open) {
            setEditingAppointment(null);
          }
        }} 
        salespeople={activeSalespeople}
        contactId={opportunity?.contact_id} 
        locationId={opportunity?.location_id || "pVeFrqvtYWNIPRIi0Fmr"} 
        showRescheduleCheckbox 
        onSuccess={() => {
          setEditingAppointment(null);
        }} 
        onDelete={() => {
          setEditingAppointment(null);
        }} 
      />

      {/* Sales Dialog */}
      {opportunity && (
        <OpportunitySalesDialog 
          open={salesDialogOpen} 
          onOpenChange={setSalesDialogOpen} 
          opportunityId={opportunity.ghl_id} 
          contactId={opportunity.contact_id} 
          locationId="pVeFrqvtYWNIPRIi0Fmr" 
          userId={user?.id} 
          currentSalespersonId={assignedSalesperson?.id || null}
          onSalesUpdated={() => queryClient.invalidateQueries({
            queryKey: ["opportunity_sales"]
          })} 
        />
      )}

      {/* Estimate Builder removed - now opens as a tab via navigation */}

      {/* Estimate Preview Dialog */}
      <EstimatePreviewDialog
        estimateId={previewEstimateId}
        open={!!previewEstimateId}
        onOpenChange={(open) => !open && setPreviewEstimateId(null)}
      />

      {/* Delete Note Confirmation Dialog */}
      <AlertDialog open={deleteNoteDialogOpen} onOpenChange={setDeleteNoteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Note?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The note will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setNoteToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => noteToDelete && handleDeleteNote(noteToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!!isDeletingNote}
            >
              {isDeletingNote && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Email Sync Dialog */}
      <EmailSyncDialog
        open={emailSyncDialogOpen}
        onOpenChange={setEmailSyncDialogOpen}
        contactUuid={opportunity?.contact_uuid}
        oldEmail={pendingEmailChange?.oldEmail}
        newEmail={pendingEmailChange?.newEmail ?? ""}
        onSyncConfirmed={handleEmailSyncConfirmed}
        onUpdateLocalOnly={handleEmailUpdateLocalOnly}
      />

      {/* Decline Proposals Dialog */}
      <AlertDialog open={declineProposalsDialogOpen} onOpenChange={setDeclineProposalsDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-destructive" />
              Mark Proposals as Declined?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  This opportunity was marked as <strong>Lost</strong>. The following pending proposal{proposalsToDecline.length > 1 ? "s" : ""} from this contact will be removed from the sales rep portal and pending proposals:
                </p>
                <ul className="space-y-1.5 border rounded-md p-3 bg-muted/50">
                  {proposalsToDecline.map(p => (
                    <li key={p.id} className="text-sm flex items-start gap-2">
                      <FileText className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                      <span>
                        <span className="font-medium">{p.estimate_title || `Estimate #${p.estimate_number}`}</span>
                        {p.customer_name && <span className="text-muted-foreground"> — {p.customer_name}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDecliningProposals}>
              Keep as Is
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeclineProposals}
              disabled={isDecliningProposals}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDecliningProposals && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Mark as Declined
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Delete Project Dialog */}
      <AlertDialog open={deleteProjectDialogOpen} onOpenChange={setDeleteProjectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-destructive" />
              Delete Related Project{projectsToDelete.length > 1 ? "s" : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  This opportunity was marked as <strong>Lost</strong>. The following project{projectsToDelete.length > 1 ? "s" : ""} linked to this contact {projectsToDelete.length > 1 ? "are" : "is"} in an early stage and can be removed:
                </p>
                <ul className="space-y-1.5 border rounded-md p-3 bg-muted/50">
                  {projectsToDelete.map(p => (
                    <li key={p.id} className="text-sm flex items-start gap-2">
                      <FolderOpen className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                      <span>
                        <span className="font-medium">{p.project_name || "Unnamed Project"}</span>
                        {p.project_address && <span className="text-muted-foreground"> — {p.project_address}</span>}
                        {p.status && <span className="ml-1 text-xs text-muted-foreground">({p.status})</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingProject}>Keep Project</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteProjects}
              disabled={isDeletingProject}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingProject && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete Project{projectsToDelete.length > 1 ? "s" : ""}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Won — Create Project Dialog */}
      <Dialog open={wonProjectDialogOpen} onOpenChange={open => { if (!open && !isCreatingWonProject) { setWonProjectDialogOpen(false); setPendingWonOppGhlId(null); setWonProjectExisting([]); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-emerald-500" />
              Opportunity Marked as Won
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            {wonProjectExisting.length > 0 ? (
              <>
                <p className="text-sm text-muted-foreground">
                  This contact already has {wonProjectExisting.length} existing project{wonProjectExisting.length > 1 ? "s" : ""}. Do you want to create a new project for this won opportunity, or skip?
                </p>
                <ul className="space-y-1.5 border rounded-md p-3 bg-muted/50">
                  {wonProjectExisting.map(p => (
                    <li key={p.id} className="text-sm flex items-start gap-2">
                      <FolderOpen className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                      <span>
                        <span className="font-medium">{p.project_name || "Unnamed Project"}</span>
                        {p.project_address && <span className="text-muted-foreground"> — {p.project_address}</span>}
                        {p.project_status && <span className="ml-1 text-xs text-muted-foreground">({p.project_status})</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Would you like to create a new project for this won opportunity?
              </p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => { setWonProjectDialogOpen(false); setPendingWonOppGhlId(null); setWonProjectExisting([]); }}
              disabled={isCreatingWonProject}
            >
              Skip — No New Project
            </Button>
            <Button
              onClick={handleCreateWonProject}
              disabled={isCreatingWonProject}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isCreatingWonProject ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Create New Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}