import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Mail, Phone, Calendar, DollarSign, User, Tag, Clock, MapPin, Briefcase, StickyNote } from "lucide-react";

// Custom field IDs for extracting data
const CUSTOM_FIELD_IDS = {
  ADDRESS: 'b7oTVsUQrLgZt84bHpCn',
  SCOPE_OF_WORK: 'KwQRtJT0aMSHnq3mwR68',
  NOTES: '588ddQgiGEg3AWtTQB2i',
};

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
}

interface GHLUser {
  id: string;
  ghl_id: string;
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}

interface ContactDetailSheetProps {
  contact: Contact | null;
  opportunities: Opportunity[];
  appointments: Appointment[];
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

export function ContactDetailSheet({
  contact,
  opportunities,
  appointments,
  users,
  open,
  onOpenChange,
}: ContactDetailSheetProps) {
  if (!contact) return null;

  const formatDateTime = (dateString: string | null | undefined) => {
    if (!dateString) return "N/A";
    return format(new Date(dateString), "MMM d, yyyy h:mm a");
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "N/A";
    return format(new Date(dateString), "MMM d, yyyy");
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (value == null) return "$0";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const getStatusColor = (status: string | null | undefined) => {
    switch (status?.toLowerCase()) {
      case "won":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "lost":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      case "open":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "confirmed":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "cancelled":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  const contactName = contact.contact_name || 
    `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 
    "Unknown Contact";

  const assignedUser = users.find(u => u.ghl_id === contact.assigned_to);
  const assignedUserName = assignedUser?.name || 
    `${assignedUser?.first_name || ''} ${assignedUser?.last_name || ''}`.trim() || 
    null;

  // Find related opportunities and appointments by contact's ghl_id
  const relatedOpportunities = opportunities.filter(
    opp => opp.contact_id === contact.ghl_id
  );
  const relatedAppointments = appointments.filter(
    apt => apt.contact_id === contact.ghl_id
  );

  // Extract custom fields
  const address = extractCustomField(contact.custom_fields, CUSTOM_FIELD_IDS.ADDRESS);
  const scopeOfWork = extractCustomField(contact.custom_fields, CUSTOM_FIELD_IDS.SCOPE_OF_WORK);
  const contactNotes = extractCustomField(contact.custom_fields, CUSTOM_FIELD_IDS.NOTES);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="space-y-1">
          <SheetTitle className="text-xl">{contactName}</SheetTitle>
          {contact.source && (
            <Badge variant="outline" className="w-fit bg-primary/10 text-primary border-primary/20">
              {contact.source}
            </Badge>
          )}
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Contact Info */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Contact Information
            </h4>
            <div className="space-y-2">
              {contact.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{contact.email}</span>
                </div>
              )}
              {contact.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{contact.phone}</span>
                </div>
              )}
              {address && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{address}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>Added: {formatDate(contact.ghl_date_added)}</span>
              </div>
              {assignedUserName && (
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>Assigned to: {assignedUserName}</span>
                </div>
              )}
            </div>
          </div>

          {/* Scope of Work */}
          {scopeOfWork && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                Scope of Work
              </h4>
              <div className="p-3 rounded-lg border border-border/50 bg-muted/30">
                <p className="text-sm whitespace-pre-wrap">{scopeOfWork}</p>
              </div>
            </div>
          )}

          {/* Contact Notes */}
          {contactNotes && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <StickyNote className="h-4 w-4" />
                Notes
              </h4>
              <div className="p-3 rounded-lg border border-border/50 bg-muted/30">
                <p className="text-sm whitespace-pre-wrap">{contactNotes}</p>
              </div>
            </div>
          )}

          {/* Tags */}
          {contact.tags && contact.tags.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Tags
              </h4>
              <div className="flex flex-wrap gap-2">
                {contact.tags.map((tag, idx) => (
                  <Badge key={idx} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Opportunities */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Opportunities ({relatedOpportunities.length})
            </h4>
            {relatedOpportunities.length > 0 ? (
              <div className="space-y-2">
                {relatedOpportunities.map((opp) => (
                  <div
                    key={opp.id}
                    className="p-3 rounded-lg border border-border/50 bg-muted/30 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-sm">{opp.name || "Unnamed Opportunity"}</span>
                      <Badge variant="outline" className={getStatusColor(opp.status)}>
                        {opp.status || "Unknown"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{opp.pipeline_name} → {opp.stage_name}</span>
                      <span className="font-semibold text-foreground">
                        {formatCurrency(opp.monetary_value)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No opportunities found</p>
            )}
          </div>

          {/* Appointments */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Appointments ({relatedAppointments.length})
            </h4>
            {relatedAppointments.length > 0 ? (
              <div className="space-y-2">
                {relatedAppointments.map((apt) => (
                  <div
                    key={apt.id}
                    className="p-3 rounded-lg border border-border/50 bg-muted/30 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-sm">{apt.title || "Untitled Appointment"}</span>
                      <Badge variant="outline" className={getStatusColor(apt.appointment_status)}>
                        {apt.appointment_status || "Unknown"}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDateTime(apt.start_time)}
                    </div>
                    {apt.notes && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{apt.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No appointments found</p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
