import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { DollarSign, User, Target, Calendar, Clock, FileText, MapPin, Phone, Mail, Briefcase, StickyNote } from "lucide-react";

// Custom field IDs for extracting data
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
}

// Helper to extract custom field value by ID
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
}: OpportunityDetailSheetProps) {
  if (!opportunity) return null;

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStatusColor = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case 'won':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'lost':
      case 'abandoned':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'open':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default:
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    }
  };

  const getAppointmentStatusColor = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case 'confirmed':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'cancelled':
      case 'no_show':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'showed':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default:
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    }
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return '$0';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(value);
  };

  // Find related contact
  const contact = contacts.find(c => c.ghl_id === opportunity.contact_id);
  
  // Find related appointments (same contact)
  const relatedAppointments = appointments.filter(
    a => a.contact_id === opportunity.contact_id
  );

  // Find assigned user
  const assignedUser = users.find(u => u.ghl_id === opportunity.assigned_to);

  const contactName = contact?.contact_name || 
    (contact?.first_name && contact?.last_name 
      ? `${contact.first_name} ${contact.last_name}` 
      : contact?.first_name || contact?.last_name || 'Unknown Contact');

  const userName = assignedUser?.name || 
    (assignedUser?.first_name && assignedUser?.last_name 
      ? `${assignedUser.first_name} ${assignedUser.last_name}` 
      : 'Unassigned');

  // Extract custom fields from contact
  const address = extractCustomField(contact?.custom_fields, CUSTOM_FIELD_IDS.ADDRESS);
  const scopeOfWork = extractCustomField(contact?.custom_fields, CUSTOM_FIELD_IDS.SCOPE_OF_WORK);
  const contactNotes = extractCustomField(contact?.custom_fields, CUSTOM_FIELD_IDS.NOTES);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-xl">
            {opportunity.name || 'Unnamed Opportunity'}
          </SheetTitle>
          <Badge variant="outline" className={`w-fit ${getStatusColor(opportunity.status)}`}>
            {opportunity.status || 'Unknown'}
          </Badge>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Value */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Value
            </h3>
            <div className="bg-muted/30 rounded-lg p-4">
              <div className="text-2xl font-bold text-emerald-400">
                {formatCurrency(opportunity.monetary_value)}
              </div>
            </div>
          </div>

          <Separator />

          {/* Pipeline Info */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <Target className="h-4 w-4" />
              Pipeline
            </h3>
            <div className="bg-muted/30 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Pipeline</span>
                <span className="text-sm font-medium">{opportunity.pipeline_name || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Stage</span>
                <span className="text-sm font-medium">{opportunity.stage_name || '-'}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Contact Info */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <User className="h-4 w-4" />
              Contact
            </h3>
            <div className="bg-muted/30 rounded-lg p-4 space-y-2">
              <div className="font-medium">{contactName}</div>
              {contact?.email && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-3 w-3" />
                  {contact.email}
                </div>
              )}
              {contact?.phone && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-3 w-3" />
                  {contact.phone}
                </div>
              )}
              {address && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {address}
                </div>
              )}
            </div>
          </div>

          {/* Scope of Work */}
          {scopeOfWork && (
            <>
              <Separator />
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  Scope of Work
                </h3>
                <div className="bg-muted/30 rounded-lg p-4">
                  <p className="text-sm whitespace-pre-wrap">{scopeOfWork}</p>
                </div>
              </div>
            </>
          )}

          {/* Contact Notes */}
          {contactNotes && (
            <>
              <Separator />
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                  <StickyNote className="h-4 w-4" />
                  Notes
                </h3>
                <div className="bg-muted/30 rounded-lg p-4">
                  <p className="text-sm whitespace-pre-wrap">{contactNotes}</p>
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Assigned To */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <User className="h-4 w-4" />
              Assigned To
            </h3>
            <div className="bg-muted/30 rounded-lg p-4">
              <div className="font-medium">{userName}</div>
              {assignedUser?.email && (
                <div className="text-sm text-muted-foreground">{assignedUser.email}</div>
              )}
            </div>
          </div>

          <Separator />

          {/* Dates */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Timeline
            </h3>
            <div className="bg-muted/30 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Created</span>
                <span className="text-sm font-medium">{formatDate(opportunity.ghl_date_added)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Updated</span>
                <span className="text-sm font-medium">{formatDate(opportunity.ghl_date_updated)}</span>
              </div>
            </div>
          </div>

          {/* Related Appointments */}
          {relatedAppointments.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Related Appointments ({relatedAppointments.length})
                </h3>
                <div className="space-y-3">
                  {relatedAppointments.map((appt) => (
                    <div key={appt.ghl_id} className="bg-muted/30 rounded-lg p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-medium">{appt.title || 'Untitled'}</div>
                        <Badge variant="outline" className={`shrink-0 ${getAppointmentStatusColor(appt.appointment_status)}`}>
                          {appt.appointment_status || 'Unknown'}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatDateTime(appt.start_time)}
                      </div>
                      {appt.notes && (
                        <div className="text-sm text-muted-foreground mt-2 pt-2 border-t border-border/30">
                          <FileText className="h-3 w-3 inline mr-1" />
                          {appt.notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
