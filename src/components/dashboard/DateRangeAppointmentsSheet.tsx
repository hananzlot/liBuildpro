import { useState, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  CalendarCheck,
  MapPin,
  User,
  Phone,
  Clock,
  Search,
} from "lucide-react";
import { format } from "date-fns";
import { getAddressFromContact } from "@/lib/utils";

interface DBAppointment {
  id: string;
  ghl_id: string;
  contact_id: string | null;
  title: string | null;
  start_time: string | null;
  end_time: string | null;
  appointment_status: string | null;
  assigned_user_id: string | null;
  address?: string | null;
}

interface DBContact {
  id: string;
  ghl_id: string;
  contact_name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  custom_fields: unknown;
}

interface DBUser {
  ghl_id: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

interface DateRangeAppointmentsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointments: DBAppointment[];
  contacts: DBContact[];
  users: DBUser[];
  onAppointmentClick?: (appointment: DBAppointment) => void;
}

function capitalizeWords(str: string): string {
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function DateRangeAppointmentsSheet({
  open,
  onOpenChange,
  appointments,
  contacts,
  users,
  onAppointmentClick,
}: DateRangeAppointmentsSheetProps) {
  const [searchFilter, setSearchFilter] = useState("");

  const userMap = new Map<string, string>();
  users.forEach((u) => {
    const displayName = u.name || `${u.first_name || ""} ${u.last_name || ""}`.trim() || u.email || u.ghl_id;
    userMap.set(u.ghl_id, displayName);
  });

  const contactMap = new Map<string, DBContact>();
  contacts.forEach((c) => contactMap.set(c.ghl_id, c));

  // Filter out cancelled appointments and apply search
  const filteredAppointments = useMemo(() => {
    const nonCancelled = appointments.filter(
      (apt) => apt.appointment_status?.toLowerCase() !== "cancelled"
    );

    if (!searchFilter.trim()) return nonCancelled;

    const searchTerm = searchFilter.toLowerCase().trim();
    return nonCancelled.filter((apt) => {
      const contact = apt.contact_id ? contactMap.get(apt.contact_id) : null;
      const contactName = contact?.contact_name || `${contact?.first_name || ""} ${contact?.last_name || ""}`.trim();
      const title = apt.title || "";
      const rep = apt.assigned_user_id ? userMap.get(apt.assigned_user_id) || "" : "";
      
      return (
        contactName.toLowerCase().includes(searchTerm) ||
        title.toLowerCase().includes(searchTerm) ||
        rep.toLowerCase().includes(searchTerm)
      );
    });
  }, [appointments, searchFilter, contactMap, userMap]);

  // Sort by start_time
  const sortedAppointments = useMemo(() => {
    return [...filteredAppointments].sort((a, b) => {
      if (!a.start_time) return 1;
      if (!b.start_time) return -1;
      return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
    });
  }, [filteredAppointments]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-primary" />
            Appointments in Date Range
          </SheetTitle>
          <SheetDescription>
            {sortedAppointments.length} appointments (excluding cancelled)
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, title, rep..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>

        <ScrollArea className="h-[calc(100vh-180px)] mt-4 pr-4">
          <div className="space-y-3">
            {sortedAppointments.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {searchFilter ? "No appointments match the search" : "No appointments found"}
              </p>
            ) : (
              sortedAppointments.map((apt) => {
                const contact = apt.contact_id ? contactMap.get(apt.contact_id) : null;
                const salesPerson = apt.assigned_user_id ? userMap.get(apt.assigned_user_id) : null;
                const contactName = contact
                  ? capitalizeWords(
                      contact.contact_name ||
                      `${contact.first_name || ""} ${contact.last_name || ""}`.trim() ||
                      "Unknown"
                    )
                  : "Unknown Contact";
                
                const address = getAddressFromContact(contact, appointments, apt.contact_id);

                const statusColor = {
                  confirmed: "bg-blue-500/10 text-blue-500 border-blue-500/20",
                  showed: "bg-green-500/10 text-green-500 border-green-500/20",
                  "no show": "bg-red-500/10 text-red-500 border-red-500/20",
                  noshow: "bg-red-500/10 text-red-500 border-red-500/20",
                }[apt.appointment_status?.toLowerCase() || ""] || "bg-muted text-muted-foreground";

                return (
                  <Card 
                    key={apt.id} 
                    className={`border-border/50 ${onAppointmentClick ? 'cursor-pointer hover:bg-muted/50 transition-colors' : ''}`}
                    onClick={() => onAppointmentClick?.(apt)}
                  >
                    <CardContent className="pt-4 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-foreground truncate">
                            {contactName}
                          </h3>
                          <p className="text-sm text-muted-foreground truncate">
                            {apt.title || "No title"}
                          </p>
                        </div>
                        <Badge className={statusColor}>
                          {apt.appointment_status || "Unknown"}
                        </Badge>
                      </div>

                      <div className="grid gap-1.5 text-sm">
                        {apt.start_time && (
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="text-foreground">
                              {format(new Date(apt.start_time), "MMM d, yyyy 'at' h:mm a")}
                            </span>
                          </div>
                        )}

                        {address && (
                          <div className="flex items-start gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                            <span className="text-foreground">{address}</span>
                          </div>
                        )}

                        {contact?.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="text-foreground">{contact.phone}</span>
                          </div>
                        )}

                        {salesPerson && (
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="text-foreground">{salesPerson}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
