import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, User, FileText, DollarSign, Target, MapPin, Phone, Mail, Briefcase } from "lucide-react";

interface Appointment {
  ghl_id: string;
  title: string | null;
  appointment_status: string | null;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  contact_id: string | null;
  assigned_user_id: string | null;
  calendar_id: string | null;
}

interface Opportunity {
  ghl_id: string;
  name: string | null;
  status: string | null;
  monetary_value: number | null;
  pipeline_name: string | null;
  stage_name: string | null;
  contact_id: string | null;
}

interface CustomField {
  id: string;
  value?: string;
}

interface Contact {
  ghl_id: string;
  contact_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  custom_fields?: CustomField[] | unknown;
}

interface GHLUser {
  ghl_id: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

interface AppointmentDetailSheetProps {
  appointment: Appointment | null;
  opportunities: Opportunity[];
  contacts: Contact[];
  users: GHLUser[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CUSTOM_FIELD_IDS = {
  ADDRESS: 'b7oTVsUQrLgZt84bHpCn',
  SCOPE_OF_WORK: 'KwQRtJT0aMSHnq3mwR68',
  NOTES: '588ddQgiGEg3AWtTQB2i',
};

function extractCustomField(customFields: unknown, fieldId: string): string | null {
  if (!customFields || !Array.isArray(customFields)) return null;
  const field = customFields.find((f: CustomField) => f.id === fieldId);
  return field?.value || null;
}

export function AppointmentDetailSheet({
  appointment,
  opportunities,
  contacts,
  users,
  open,
  onOpenChange,
}: AppointmentDetailSheetProps) {
  if (!appointment) return null;

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    });
  };

  const formatTime = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', hour12: true,
    });
  };

  const getStatusColor = (status: string | null) => {
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

  const contact = contacts.find(c => c.ghl_id === appointment.contact_id);
  const relatedOpportunities = opportunities.filter(o => o.contact_id === appointment.contact_id);
  const primaryOpportunity = relatedOpportunities[0];
  const assignedUser = users.find(u => u.ghl_id === appointment.assigned_user_id);

  const contactName = contact?.contact_name || 
    (contact?.first_name && contact?.last_name 
      ? `${contact.first_name} ${contact.last_name}` 
      : contact?.first_name || contact?.last_name || 'Unknown');

  const userName = assignedUser?.name || 
    (assignedUser?.first_name && assignedUser?.last_name 
      ? `${assignedUser.first_name} ${assignedUser.last_name}` 
      : 'Unassigned');

  const address = contact ? extractCustomField(contact.custom_fields, CUSTOM_FIELD_IDS.ADDRESS) : null;
  const scopeOfWork = contact ? extractCustomField(contact.custom_fields, CUSTOM_FIELD_IDS.SCOPE_OF_WORK) : null;
  const contactNotes = contact ? extractCustomField(contact.custom_fields, CUSTOM_FIELD_IDS.NOTES) : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto p-0">
        {/* Header */}
        <div className="sticky top-0 bg-background border-b p-4">
          <SheetHeader className="space-y-1">
            <div className="flex items-start justify-between gap-3">
              <SheetTitle className="text-lg font-semibold leading-tight">
                {appointment.title || 'Untitled Appointment'}
              </SheetTitle>
              <Badge variant="outline" className={`shrink-0 text-xs ${getStatusColor(appointment.appointment_status)}`}>
                {appointment.appointment_status || 'Unknown'}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>{formatDateTime(appointment.start_time)}</span>
              <span>→</span>
              <span>{formatTime(appointment.end_time)}</span>
            </div>
          </SheetHeader>
        </div>

        <div className="p-4 space-y-4">
          {/* Pipeline Status (if opportunity exists) */}
          {primaryOpportunity && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">{primaryOpportunity.pipeline_name || 'Pipeline'}</span>
                </div>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-xs">
                  {primaryOpportunity.stage_name || 'Unknown'}
                </Badge>
              </div>
              <div className="text-xl font-bold text-emerald-400">
                {formatCurrency(primaryOpportunity.monetary_value)}
              </div>
            </div>
          )}

          {/* Key Info Grid */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-muted/40 rounded-md p-2.5">
              <div className="text-muted-foreground text-xs mb-0.5">Assigned To</div>
              <div className="font-medium truncate">{userName}</div>
            </div>
            <div className="bg-muted/40 rounded-md p-2.5">
              <div className="text-muted-foreground text-xs mb-0.5">Contact</div>
              <div className="font-medium truncate">{contactName}</div>
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

          {/* Appointment Notes */}
          {appointment.notes && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted/30 px-3 py-2 flex items-center gap-2 border-b">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Appointment Notes</span>
              </div>
              <div className="p-3">
                <p className="text-sm whitespace-pre-wrap">{appointment.notes}</p>
              </div>
            </div>
          )}

          {/* Contact Notes */}
          {contactNotes && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted/30 px-3 py-2 flex items-center gap-2 border-b">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Contact Notes</span>
              </div>
              <div className="p-3">
                <p className="text-sm whitespace-pre-wrap">{contactNotes}</p>
              </div>
            </div>
          )}

          {/* Related Opportunities */}
          {relatedOpportunities.length > 1 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted/30 px-3 py-2 flex items-center gap-2 border-b">
                <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Other Opportunities ({relatedOpportunities.length - 1})
                </span>
              </div>
              <div className="divide-y">
                {relatedOpportunities.slice(1, 4).map((opp) => (
                  <div key={opp.ghl_id} className="p-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{opp.name || 'Unnamed'}</div>
                      <div className="text-xs text-muted-foreground">{opp.stage_name || 'Unknown Stage'}</div>
                    </div>
                    <span className="text-sm font-semibold text-emerald-400 shrink-0">
                      {formatCurrency(opp.monetary_value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
