import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "lucide-react";
import { AppointmentDetailSheet } from "./AppointmentDetailSheet";

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
  custom_fields?: unknown;
}

interface GHLUser {
  ghl_id: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

interface AppointmentsTableProps {
  appointments: Appointment[];
  opportunities?: Opportunity[];
  contacts?: Contact[];
  users?: GHLUser[];
}

export function AppointmentsTable({ 
  appointments, 
  opportunities = [], 
  contacts = [], 
  users = [] 
}: AppointmentsTableProps) {
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
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

  const isUpcoming = (startTime: string | null) => {
    if (!startTime) return false;
    return new Date(startTime) > new Date();
  };

  const handleRowClick = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setSheetOpen(true);
  };

  return (
    <>
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader className="flex flex-row items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Recent Appointments</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-border/50 hover:bg-transparent">
                <TableHead className="text-muted-foreground">Title</TableHead>
                <TableHead className="text-muted-foreground">Start</TableHead>
                <TableHead className="text-muted-foreground">End</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {appointments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No appointments found
                  </TableCell>
                </TableRow>
              ) : (
                appointments.map((appt) => (
                  <TableRow 
                    key={appt.ghl_id} 
                    className="border-border/30 hover:bg-muted/30 cursor-pointer"
                    onClick={() => handleRowClick(appt)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {appt.title || 'Untitled'}
                        {isUpcoming(appt.start_time) && (
                          <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30 text-xs">
                            Upcoming
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(appt.start_time)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(appt.end_time)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getStatusColor(appt.appointment_status)}>
                        {appt.appointment_status || 'Unknown'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AppointmentDetailSheet
        appointment={selectedAppointment}
        opportunities={opportunities}
        contacts={contacts}
        users={users}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </>
  );
}