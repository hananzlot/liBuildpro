import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { DollarSign, User, Target, Calendar, Clock, FileText, MapPin, Phone, Mail, Briefcase, Megaphone, Pencil, Save, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const CUSTOM_FIELD_IDS = {
  ADDRESS: 'b7oTVsUQrLgZt84bHpCn',
  SCOPE_OF_WORK: 'KwQRtJT0aMSHnq3mwR68',
  NOTES: '588ddQgiGEg3AWtTQB2i',
};

interface Opportunity {
  ghl_id: string;
  name: string | null;
  status: string | null;
  monetary_value: number | null;
  pipeline_id: string | null;
  pipeline_name: string | null;
  pipeline_stage_id: string | null;
  stage_name: string | null;
  contact_id: string | null;
  assigned_to: string | null;
  ghl_date_added: string | null;
  ghl_date_updated: string | null;
}

interface Appointment {
  ghl_id: string;
  title: string | null;
  appointment_status: string | null;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  contact_id: string | null;
}

interface Contact {
  ghl_id: string;
  contact_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  custom_fields?: unknown;
}

interface GHLUser {
  ghl_id: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

interface OpportunityDetailSheetProps {
  opportunity: Opportunity | null;
  appointments: Appointment[];
  contacts: Contact[];
  users: GHLUser[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allOpportunities?: Opportunity[];
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
  open,
  onOpenChange,
  allOpportunities = [],
}: OpportunityDetailSheetProps) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editedStatus, setEditedStatus] = useState<string>("");
  const [editedStage, setEditedStage] = useState<string>("");
  const [editedMonetaryValue, setEditedMonetaryValue] = useState<string>("");
  const [editedAssignedTo, setEditedAssignedTo] = useState<string>("");

  // Get pipeline stages only from the same pipeline as the current opportunity
  const stageMap = new Map<string, string>();
  const currentPipelineId = opportunity?.pipeline_id;
  allOpportunities.forEach(o => {
    // Only include stages from the same pipeline
    if (o.stage_name && o.pipeline_stage_id && o.pipeline_id === currentPipelineId) {
      stageMap.set(o.stage_name, o.pipeline_stage_id);
    }
  });
  const availableStages = Array.from(stageMap.keys()).sort();

  const handleEditClick = () => {
    setEditedStatus(opportunity?.status?.toLowerCase() || "open");
    setEditedStage(opportunity?.stage_name || "");
    setEditedMonetaryValue(opportunity?.monetary_value?.toString() || "0");
    setEditedAssignedTo(opportunity?.assigned_to || "__unassigned__");
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedStatus("");
    setEditedStage("");
    setEditedMonetaryValue("");
    setEditedAssignedTo("");
  };

  const handleSave = async () => {
    if (!opportunity) return;
    
    setIsSaving(true);
    try {
      // Get the pipeline_stage_id for the selected stage
      const pipeline_stage_id = stageMap.get(editedStage) || opportunity.pipeline_stage_id;
      const monetaryValue = parseFloat(editedMonetaryValue) || 0;

      // Call edge function to update GHL first, then Supabase
      const { data, error } = await supabase.functions.invoke('update-ghl-opportunity', {
        body: {
          ghl_id: opportunity.ghl_id,
          status: editedStatus,
          stage_name: editedStage,
          pipeline_stage_id: pipeline_stage_id,
          monetary_value: monetaryValue,
          assigned_to: editedAssignedTo === "__unassigned__" ? null : editedAssignedTo,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Opportunity updated in GHL and database");
      setIsEditing(false);
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
    } catch (error) {
      console.error("Error updating opportunity:", error);
      toast.error("Failed to update opportunity in GHL");
    } finally {
      setIsSaving(false);
    }
  };

  if (!opportunity) return null;

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    });
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  };

  const getStatusColor = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case 'won': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'lost':
      case 'abandoned': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'open': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default: return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    }
  };

  const getAppointmentStatusColor = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case 'confirmed': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'cancelled':
      case 'no_show': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'showed': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default: return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    }
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return '$0';
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD', minimumFractionDigits: 0,
    }).format(value);
  };

  const contact = contacts.find(c => c.ghl_id === opportunity.contact_id);
  const relatedAppointments = appointments.filter(a => a.contact_id === opportunity.contact_id);
  const assignedUser = users.find(u => u.ghl_id === opportunity.assigned_to);

  const contactName = contact?.contact_name || 
    (contact?.first_name && contact?.last_name 
      ? `${contact.first_name} ${contact.last_name}` 
      : contact?.first_name || contact?.last_name || 'Unknown');

  const userName = assignedUser?.name || 
    (assignedUser?.first_name && assignedUser?.last_name 
      ? `${assignedUser.first_name} ${assignedUser.last_name}` 
      : 'Unassigned');

  const address = extractCustomField(contact?.custom_fields, CUSTOM_FIELD_IDS.ADDRESS);
  const scopeOfWork = extractCustomField(contact?.custom_fields, CUSTOM_FIELD_IDS.SCOPE_OF_WORK);
  const contactNotes = extractCustomField(contact?.custom_fields, CUSTOM_FIELD_IDS.NOTES);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto p-0">
        {/* Header */}
        <div className="sticky top-0 bg-background border-b p-4">
          <SheetHeader className="space-y-1">
            <div className="flex items-start justify-between gap-3">
              <SheetTitle className="text-lg font-semibold leading-tight">
                {opportunity.name || 'Unnamed Opportunity'}
              </SheetTitle>
              {!isEditing ? (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`shrink-0 text-xs ${getStatusColor(opportunity.status)}`}>
                    {opportunity.status || 'Unknown'}
                  </Badge>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleEditClick}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCancelEdit} disabled={isSaving}>
                    <X className="h-4 w-4" />
                  </Button>
                  <Button variant="default" size="icon" className="h-7 w-7" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              )}
            </div>
            {isEditing ? (
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-emerald-400">$</span>
                <Input
                  type="number"
                  value={editedMonetaryValue}
                  onChange={(e) => setEditedMonetaryValue(e.target.value)}
                  className="text-2xl font-bold h-10 w-40"
                  min="0"
                  step="100"
                />
              </div>
            ) : (
              <div className="text-2xl font-bold text-emerald-400">
                {formatCurrency(opportunity.monetary_value)}
              </div>
            )}
          </SheetHeader>
        </div>

        <div className="p-4 space-y-4">
          {/* Key Info Grid */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-muted/40 rounded-md p-2.5">
              <div className="text-muted-foreground text-xs mb-0.5">Pipeline</div>
              <div className="font-medium truncate">{opportunity.pipeline_name || '-'}</div>
            </div>
            <div className="bg-muted/40 rounded-md p-2.5">
              <div className="text-muted-foreground text-xs mb-0.5">Stage</div>
              {isEditing ? (
                <Select value={editedStage} onValueChange={setEditedStage}>
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue placeholder="Select stage" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableStages.map(stage => (
                      <SelectItem key={stage} value={stage} className="text-xs">
                        {stage}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="font-medium truncate">{opportunity.stage_name || '-'}</div>
              )}
            </div>
            <div className="bg-muted/40 rounded-md p-2.5">
              <div className="text-muted-foreground text-xs mb-0.5">Status</div>
              {isEditing ? (
                <Select value={editedStatus} onValueChange={setEditedStatus}>
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {OPPORTUNITY_STATUSES.map(status => (
                      <SelectItem key={status} value={status} className="text-xs capitalize">
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Badge variant="outline" className={`text-xs ${getStatusColor(opportunity.status)}`}>
                  {opportunity.status || 'Unknown'}
                </Badge>
              )}
            </div>
            <div className="bg-muted/40 rounded-md p-2.5">
              <div className="text-muted-foreground text-xs mb-0.5">Created</div>
              <div className="font-medium truncate">{formatDate(opportunity.ghl_date_added)}</div>
            </div>
            <div className="bg-muted/40 rounded-md p-2.5">
              <div className="text-muted-foreground text-xs mb-0.5">Assigned To</div>
              {isEditing ? (
                <Select value={editedAssignedTo} onValueChange={setEditedAssignedTo}>
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue placeholder="Select rep" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__unassigned__" className="text-xs">Unassigned</SelectItem>
                    {users.map(user => {
                      const name = user.name || 
                        (user.first_name && user.last_name 
                          ? `${user.first_name} ${user.last_name}` 
                          : user.first_name || user.last_name || user.email || 'Unknown');
                      return (
                        <SelectItem key={user.ghl_id} value={user.ghl_id} className="text-xs">
                          {name}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              ) : (
                <div className="font-medium truncate">{userName}</div>
              )}
            </div>
            <div className="bg-muted/40 rounded-md p-2.5">
              <div className="text-muted-foreground text-xs mb-0.5 flex items-center gap-1">
                <Megaphone className="h-3 w-3" />
                Source
              </div>
              <div className="font-medium truncate">{contact?.source || 'No source'}</div>
            </div>
          </div>

          {/* Contact Section */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-muted/30 px-3 py-2 flex items-center gap-2 border-b">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Contact</span>
            </div>
            <div className="p-3 space-y-2">
              <div className="font-medium">{contactName}</div>
              <div className="grid gap-1.5 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{contact?.phone || <span className="italic text-muted-foreground/60">No phone</span>}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{contact?.email || <span className="italic text-muted-foreground/60">No email</span>}</span>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>{address || <span className="italic text-muted-foreground/60">No address</span>}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Scope of Work */}
          {scopeOfWork && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted/30 px-3 py-2 flex items-center gap-2 border-b">
                <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Scope of Work</span>
              </div>
              <div className="p-3">
                <p className="text-sm whitespace-pre-wrap">{scopeOfWork}</p>
              </div>
            </div>
          )}

          {/* Notes/Comments */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-muted/30 px-3 py-2 flex items-center gap-2 border-b">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Notes & Comments</span>
            </div>
            <div className="p-3 space-y-3">
              {contactNotes ? (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Contact Notes</div>
                  <p className="text-sm whitespace-pre-wrap">{contactNotes}</p>
                </div>
              ) : null}
              
              {/* Appointment Notes */}
              {relatedAppointments.filter(a => a.notes).length > 0 && (
                <div className={contactNotes ? "border-t pt-3" : ""}>
                  <div className="text-xs text-muted-foreground mb-2">Appointment Notes</div>
                  <div className="space-y-2">
                    {relatedAppointments.filter(a => a.notes).map((appt) => (
                      <div key={appt.ghl_id} className="bg-muted/30 rounded p-2">
                        <div className="text-xs text-muted-foreground mb-1">{appt.title || 'Appointment'}</div>
                        <p className="text-sm whitespace-pre-wrap">{appt.notes}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {!contactNotes && relatedAppointments.filter(a => a.notes).length === 0 && (
                <p className="text-sm text-muted-foreground/60 italic">No notes or comments</p>
              )}
            </div>
          </div>

          {/* Related Appointments */}
          {relatedAppointments.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted/30 px-3 py-2 flex items-center gap-2 border-b">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Appointments ({relatedAppointments.length})
                </span>
              </div>
              <div className="divide-y">
                {relatedAppointments.slice(0, 3).map((appt) => (
                  <div key={appt.ghl_id} className="p-3 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm truncate">{appt.title || 'Untitled'}</span>
                      <Badge variant="outline" className={`text-xs shrink-0 ${getAppointmentStatusColor(appt.appointment_status)}`}>
                        {appt.appointment_status || 'Unknown'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatDateTime(appt.start_time)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
            <span>Updated: {formatDate(opportunity.ghl_date_updated)}</span>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
