import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, Phone, Calendar, DollarSign, User, Tag, Clock, MapPin, Briefcase, FileText, MessageSquare, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const CUSTOM_FIELD_IDS = {
  ADDRESS: 'b7oTVsUQrLgZt84bHpCn',
  SCOPE_OF_WORK: 'KwQRtJT0aMSHnq3mwR68',
  NOTES: '588ddQgiGEg3AWtTQB2i',
};

const APPOINTMENT_STATUSES = [
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'showed', label: 'Showed' },
  { value: 'noshow', label: 'No Show' },
  { value: 'cancelled', label: 'Cancelled' },
];

interface Contact {
  id: string;
  ghl_id: string;
  contact_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  source?: string | null;
  tags?: string[] | null;
  ghl_date_added?: string | null;
  assigned_to?: string | null;
  attributions?: any;
  custom_fields?: unknown;
}

interface Opportunity {
  id: string;
  ghl_id: string;
  name?: string | null;
  contact_id?: string | null;
  monetary_value?: number | null;
  status?: string | null;
  stage_name?: string | null;
  pipeline_name?: string | null;
  ghl_date_added?: string | null;
}

interface Appointment {
  id: string;
  ghl_id: string;
  title?: string | null;
  contact_id?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  appointment_status?: string | null;
  notes?: string | null;
  location_id?: string | null;
}

interface GHLUser {
  id: string;
  ghl_id: string;
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}

interface Conversation {
  id: string;
  ghl_id: string;
  contact_id?: string | null;
  type?: string | null;
  last_message_body?: string | null;
  last_message_date?: string | null;
  last_message_type?: string | null;
  last_message_direction?: string | null;
  unread_count?: number | null;
}

interface ContactDetailSheetProps {
  contact: Contact | null;
  opportunities: Opportunity[];
  appointments: Appointment[];
  users: GHLUser[];
  conversations?: Conversation[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh?: () => void;
}

const extractCustomField = (customFields: unknown, fieldId: string): string | null => {
  if (!customFields || !Array.isArray(customFields)) return null;
  const field = customFields.find((f: any) => f.id === fieldId);
  return field?.value || null;
};

export function ContactDetailSheet({
  contact,
  opportunities,
  appointments,
  users,
  conversations = [],
  open,
  onOpenChange,
  onRefresh,
}: ContactDetailSheetProps) {
  const [updatingAppointmentId, setUpdatingAppointmentId] = useState<string | null>(null);

  const handleUpdateAppointmentStatus = async (appointmentGhlId: string, newStatus: string, locationId?: string) => {
    setUpdatingAppointmentId(appointmentGhlId);
    try {
      // Update in GHL
      const { error: ghlError } = await supabase.functions.invoke('update-ghl-appointment', {
        body: { ghl_id: appointmentGhlId, appointment_status: newStatus, location_id: locationId }
      });
      if (ghlError) throw ghlError;

      // Update in Supabase
      const { error: dbError } = await supabase
        .from('appointments')
        .update({ appointment_status: newStatus, ghl_date_updated: new Date().toISOString() })
        .eq('ghl_id', appointmentGhlId);
      if (dbError) throw dbError;

      toast({ title: "Status updated", description: `Appointment status changed to ${newStatus}` });
    } catch (error) {
      console.error('Error updating appointment status:', error);
      toast({ title: "Error", description: "Failed to update appointment status", variant: "destructive" });
    } finally {
      setUpdatingAppointmentId(null);
    }
  };

  if (!contact) return null;

  const formatDateTime = (dateString: string | null | undefined) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    });
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (value == null) return "$0";
    return new Intl.NumberFormat("en-US", {
      style: "currency", currency: "USD", minimumFractionDigits: 0,
    }).format(value);
  };

  const getStatusColor = (status: string | null | undefined) => {
    switch (status?.toLowerCase()) {
      case "won":
      case "confirmed": return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "lost":
      case "cancelled":
      case "no_show": return "bg-red-500/20 text-red-400 border-red-500/30";
      case "open":
      case "showed": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      default: return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    }
  };

  const contactName = contact.contact_name || 
    `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 
    "Unknown Contact";

  const assignedUser = users.find(u => u.ghl_id === contact.assigned_to);
  const assignedUserName = assignedUser?.name || 
    `${assignedUser?.first_name || ''} ${assignedUser?.last_name || ''}`.trim() || 
    null;

  const relatedOpportunities = opportunities.filter(opp => opp.contact_id === contact.ghl_id);
  const relatedAppointments = appointments.filter(apt => apt.contact_id === contact.ghl_id);

  const address = extractCustomField(contact.custom_fields, CUSTOM_FIELD_IDS.ADDRESS);
  // Get scope from custom_fields, or fall back to attributions.utmContent for Location 2 contacts
  const scopeFromCustomField = extractCustomField(contact.custom_fields, CUSTOM_FIELD_IDS.SCOPE_OF_WORK);
  const scopeFromAttributions = (() => {
    if (!contact?.attributions) return null;
    const attrs = contact.attributions as Array<{ utmContent?: string }> | null;
    if (Array.isArray(attrs) && attrs.length > 0) {
      return attrs[0]?.utmContent || null;
    }
    return null;
  })();
  const scopeOfWork = scopeFromCustomField || scopeFromAttributions;
  const contactNotes = extractCustomField(contact.custom_fields, CUSTOM_FIELD_IDS.NOTES);

  // Calculate total opportunity value
  const totalValue = relatedOpportunities.reduce((sum, opp) => sum + (opp.monetary_value || 0), 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl overflow-y-auto p-0">
        {/* Header */}
        <div className="sticky top-0 bg-background border-b p-4">
          <SheetHeader className="space-y-1">
            <div className="flex items-start justify-between gap-3">
              <SheetTitle className="text-lg font-semibold leading-tight">
                {contactName}
              </SheetTitle>
              <div className="flex items-center gap-2">
                {onRefresh && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRefresh}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                )}
                {contact.source && (
                  <Badge variant="outline" className="shrink-0 text-xs bg-primary/10 text-primary border-primary/30">
                    {contact.source}
                  </Badge>
                )}
              </div>
            </div>
            {totalValue > 0 && (
              <div className="text-2xl font-bold text-emerald-400">
                {formatCurrency(totalValue)}
              </div>
            )}
          </SheetHeader>
        </div>

        <div className="p-4 space-y-4">
          {/* Key Info Grid */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-muted/40 rounded-md p-2.5">
              <div className="text-muted-foreground text-xs mb-0.5">Added</div>
              <div className="font-medium truncate">{formatDate(contact.ghl_date_added)}</div>
            </div>
            <div className="bg-muted/40 rounded-md p-2.5">
              <div className="text-muted-foreground text-xs mb-0.5">Assigned To</div>
              <div className="font-medium truncate">{assignedUserName || 'Unassigned'}</div>
            </div>
          </div>

          {/* Contact Details */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-muted/30 px-3 py-2 flex items-center gap-2 border-b">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Contact Details</span>
            </div>
            <div className="p-3 grid gap-1.5 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 shrink-0" />
                {contact.phone ? (
                  <a
                    href={`tel:${contact.phone}`}
                    className="text-primary hover:underline truncate"
                  >
                    {contact.phone}
                  </a>
                ) : (
                  <span className="italic text-muted-foreground/60">No phone</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                {contact.email ? (
                  <>
                    <a
                      href={`mailto:${contact.email}`}
                      target="_top"
                      rel="noreferrer"
                      className="text-primary hover:underline truncate"
                    >
                      {contact.email}
                    </a>
                    <a
                      href={`https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(contact.email)}&body=${encodeURIComponent(`Dear ${contact.first_name || ''} ${contact.last_name || ''}${address ? ` (${address})` : ''},\n\n\n\nBest regards,\nCA Pro Builders`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-primary text-xs"
                    >
                      (Gmail)
                    </a>
                  </>
                ) : (
                  <span className="italic text-muted-foreground/60">No email</span>
                )}
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>{address || <span className="italic text-muted-foreground/60">No address</span>}</span>
              </div>
            </div>
          </div>

          {/* Tags */}
          {contact.tags && contact.tags.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted/30 px-3 py-2 flex items-center gap-2 border-b">
                <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tags</span>
              </div>
              <div className="p-3 flex flex-wrap gap-1.5">
                {contact.tags.map((tag, idx) => (
                  <Badge key={idx} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

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

          {/* Notes */}
          {contactNotes && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted/30 px-3 py-2 flex items-center gap-2 border-b">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Notes</span>
              </div>
              <div className="p-3">
                <p className="text-sm whitespace-pre-wrap">{contactNotes}</p>
              </div>
            </div>
          )}

          {/* Opportunities */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-muted/30 px-3 py-2 flex items-center gap-2 border-b">
              <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Opportunities ({relatedOpportunities.length})
              </span>
            </div>
            {relatedOpportunities.length > 0 ? (
              <div className="divide-y">
                {relatedOpportunities.slice(0, 5).map((opp) => (
                  <div key={opp.id} className="p-3 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{opp.name || "Unnamed"}</span>
                        <Badge variant="outline" className={`text-xs shrink-0 ${getStatusColor(opp.status)}`}>
                          {opp.status || "Unknown"}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {opp.pipeline_name || 'Pipeline'} → {opp.stage_name || 'Stage'}
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-emerald-400 shrink-0">
                      {formatCurrency(opp.monetary_value)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 text-sm text-muted-foreground/60 italic">No opportunities</div>
            )}
          </div>

          {/* Appointments */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-muted/30 px-3 py-2 flex items-center gap-2 border-b">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Appointments ({relatedAppointments.length})
              </span>
            </div>
            {relatedAppointments.length > 0 ? (
              <div className="divide-y">
                {relatedAppointments.slice(0, 5).map((apt) => (
                  <div key={apt.id} className="p-3 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm truncate">{apt.title || "Untitled"}</span>
                      <Select
                        value={apt.appointment_status || ''}
                        onValueChange={(value) => handleUpdateAppointmentStatus(apt.ghl_id, value, apt.location_id || undefined)}
                        disabled={updatingAppointmentId === apt.ghl_id}
                      >
                        <SelectTrigger className={`h-6 w-[100px] text-xs ${getStatusColor(apt.appointment_status)}`}>
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          {APPOINTMENT_STATUSES.map((status) => (
                            <SelectItem key={status.value} value={status.value} className="text-xs">
                              {status.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {formatDateTime(apt.start_time)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 text-sm text-muted-foreground/60 italic">No appointments</div>
            )}
          </div>

          {/* Conversations / SMS */}
          {(() => {
            const relatedConversations = conversations.filter(c => c.contact_id === contact.ghl_id);
            return (
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted/30 px-3 py-2 flex items-center gap-2 border-b">
                  <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Conversations ({relatedConversations.length})
                  </span>
                </div>
                {relatedConversations.length > 0 ? (
                  <div className="divide-y">
                    {relatedConversations.slice(0, 5).map((conv) => (
                      <div key={conv.id} className="p-3 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {conv.last_message_type || conv.type || 'Message'}
                            </Badge>
                            <Badge 
                              variant="secondary" 
                              className={`text-xs ${conv.last_message_direction === 'inbound' ? 'bg-blue-500/20 text-blue-400' : 'bg-emerald-500/20 text-emerald-400'}`}
                            >
                              {conv.last_message_direction === 'inbound' ? '← In' : '→ Out'}
                            </Badge>
                          </div>
                          {(conv.unread_count ?? 0) > 0 && (
                            <Badge className="bg-red-500 text-white text-xs">
                              {conv.unread_count} unread
                            </Badge>
                          )}
                        </div>
                        {conv.last_message_body && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {conv.last_message_body}
                          </p>
                        )}
                        <div className="text-xs text-muted-foreground/70">
                          {formatDateTime(conv.last_message_date)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 text-sm text-muted-foreground/60 italic">No conversations</div>
                )}
              </div>
            );
          })()}
        </div>
      </SheetContent>
    </Sheet>
  );
}
