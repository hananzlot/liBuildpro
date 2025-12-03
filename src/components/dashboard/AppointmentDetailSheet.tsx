import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar, Clock, User, FileText, DollarSign, Target } from "lucide-react";

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

interface Contact {
  ghl_id: string;
  contact_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
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

  const getStatusColor = (status: string | null) => {
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
  const contact = contacts.find(c => c.ghl_id === appointment.contact_id);
  
  // Find related opportunities (same contact)
  const relatedOpportunities = opportunities.filter(
    o => o.contact_id === appointment.contact_id
  );

  // Find assigned user
  const assignedUser = users.find(u => u.ghl_id === appointment.assigned_user_id);

  const contactName = contact?.contact_name || 
    (contact?.first_name && contact?.last_name 
      ? `${contact.first_name} ${contact.last_name}` 
      : contact?.first_name || contact?.last_name || 'Unknown Contact');

  const userName = assignedUser?.name || 
    (assignedUser?.first_name && assignedUser?.last_name 
      ? `${assignedUser.first_name} ${assignedUser.last_name}` 
      : 'Unassigned');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-xl">
            {appointment.title || 'Untitled Appointment'}
          </SheetTitle>
          <Badge variant="outline" className={`w-fit ${getStatusColor(appointment.appointment_status)}`}>
            {appointment.appointment_status || 'Unknown'}
          </Badge>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Time Details */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Schedule
            </h3>
            <div className="bg-muted/30 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Start</span>
                <span className="text-sm font-medium">{formatDateTime(appointment.start_time)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">End</span>
                <span className="text-sm font-medium">{formatDateTime(appointment.end_time)}</span>
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
                <div className="text-sm text-muted-foreground">{contact.email}</div>
              )}
              {contact?.phone && (
                <div className="text-sm text-muted-foreground">{contact.phone}</div>
              )}
            </div>
          </div>

          <Separator />

          {/* Assigned To */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Assigned To
            </h3>
            <div className="bg-muted/30 rounded-lg p-4">
              <div className="font-medium">{userName}</div>
              {assignedUser?.email && (
                <div className="text-sm text-muted-foreground">{assignedUser.email}</div>
              )}
            </div>
          </div>

          {/* Notes */}
          {appointment.notes && (
            <>
              <Separator />
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Notes
                </h3>
                <div className="bg-muted/30 rounded-lg p-4">
                  <p className="text-sm whitespace-pre-wrap">{appointment.notes}</p>
                </div>
              </div>
            </>
          )}

          {/* Related Opportunities */}
          {relatedOpportunities.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Related Opportunities ({relatedOpportunities.length})
                </h3>
                <div className="space-y-3">
                  {relatedOpportunities.map((opp) => (
                    <div key={opp.ghl_id} className="bg-muted/30 rounded-lg p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-medium">{opp.name || 'Unnamed Opportunity'}</div>
                        <Badge variant="outline" className="shrink-0">
                          {opp.status || 'Unknown'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <DollarSign className="h-4 w-4 text-emerald-500" />
                        <span className="font-semibold text-emerald-500">
                          {formatCurrency(opp.monetary_value)}
                        </span>
                      </div>
                      {opp.pipeline_name && (
                        <div className="text-sm text-muted-foreground">
                          {opp.pipeline_name} → {opp.stage_name || 'Unknown Stage'}
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
