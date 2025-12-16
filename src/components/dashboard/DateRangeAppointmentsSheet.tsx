import { useState, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Target,
  Mail,
  Pencil,
  Check,
  X,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { getAddressFromContact } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

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
  ghl_date_added?: string | null;
}

interface DBContact {
  id: string;
  ghl_id: string;
  contact_name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  source: string | null;
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
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [editAddressValue, setEditAddressValue] = useState("");
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [localAddressState, setLocalAddressState] = useState<Record<string, string>>({});

  const queryClient = useQueryClient();

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

  // Sort by ghl_date_added (desc)
  const sortedAppointments = useMemo(() => {
    return [...filteredAppointments].sort((a, b) => {
      const dateA = a.ghl_date_added ? new Date(a.ghl_date_added).getTime() : 0;
      const dateB = b.ghl_date_added ? new Date(b.ghl_date_added).getTime() : 0;
      if (dateA !== dateB) return dateB - dateA;

      // Fallback to start_time (asc) when created date is missing/equal
      if (!a.start_time) return 1;
      if (!b.start_time) return -1;
      return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
    });
  }, [filteredAppointments]);

  const startEditingAddress = (apt: DBAppointment, currentAddress: string | null, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingAddressId(apt.ghl_id);
    setEditAddressValue(localAddressState[apt.ghl_id] ?? apt.address ?? currentAddress ?? "");
  };

  const cancelEditingAddress = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingAddressId(null);
    setEditAddressValue("");
  };

  const saveAddress = async (apt: DBAppointment, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!apt.ghl_id) return;

    setIsSavingAddress(true);
    try {
      // Update in GHL
      const { error: ghlError } = await supabase.functions.invoke("update-ghl-appointment", {
        body: {
          ghl_id: apt.ghl_id,
          address: editAddressValue.trim() || null,
        },
      });

      if (ghlError) throw ghlError;

      // Update local state for immediate feedback
      setLocalAddressState((prev) => ({ ...prev, [apt.ghl_id]: editAddressValue.trim() }));
      
      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["ghl-contacts"] });
      
      toast.success("Address updated");
      setEditingAddressId(null);
      setEditAddressValue("");
    } catch (error) {
      console.error("Error updating address:", error);
      toast.error("Failed to update address");
    } finally {
      setIsSavingAddress(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-primary" />
            Appointments Created in Date Range
          </SheetTitle>
          <SheetDescription>
            {sortedAppointments.length} appointments created (excluding cancelled)
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
                
                // Address: local state > appointment address > fallback from contact
                const fallbackAddress = getAddressFromContact(contact, appointments, apt.contact_id);
                const displayAddress = localAddressState[apt.ghl_id] ?? apt.address ?? fallbackAddress;
                const isEditingThis = editingAddressId === apt.ghl_id;

                const statusColor = {
                  confirmed: "bg-blue-500/10 text-blue-500 border-blue-500/20",
                  showed: "bg-green-500/10 text-green-500 border-green-500/20",
                  "no show": "bg-red-500/10 text-red-500 border-red-500/20",
                  noshow: "bg-red-500/10 text-red-500 border-red-500/20",
                }[apt.appointment_status?.toLowerCase() || ""] || "bg-muted text-muted-foreground";

                return (
                  <Card 
                    key={apt.id} 
                    className={`border-border/50 ${onAppointmentClick && !isEditingThis ? 'cursor-pointer hover:bg-muted/50 transition-colors' : ''}`}
                    onClick={() => !isEditingThis && onAppointmentClick?.(apt)}
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
                        {apt.ghl_date_added && (
                          <div className="flex items-center gap-2">
                            <CalendarCheck className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="text-foreground">
                              Created {format(new Date(apt.ghl_date_added), "MMM d, yyyy 'at' h:mm a")}
                            </span>
                          </div>
                        )}

                        {apt.start_time && (
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="text-foreground">
                              Scheduled {format(new Date(apt.start_time), "MMM d, yyyy 'at' h:mm a")}
                            </span>
                          </div>
                        )}

                        {/* Address - editable */}
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                          {isEditingThis ? (
                            <div className="flex-1 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <Input
                                value={editAddressValue}
                                onChange={(e) => setEditAddressValue(e.target.value)}
                                placeholder="Enter address..."
                                className="h-7 text-sm flex-1"
                                autoFocus
                              />
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={(e) => saveAddress(apt, e)}
                                disabled={isSavingAddress}
                              >
                                {isSavingAddress ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Check className="h-3.5 w-3.5 text-green-500" />
                                )}
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={cancelEditingAddress}
                                disabled={isSavingAddress}
                              >
                                <X className="h-3.5 w-3.5 text-red-500" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 flex-1 group">
                              <span className="text-foreground flex-1">
                                {displayAddress || <span className="text-muted-foreground italic">No address</span>}
                              </span>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => startEditingAddress(apt, fallbackAddress, e)}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </div>

                        {/* Phone - clickable */}
                        {contact?.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                            <a
                              href={`tel:${contact.phone}`}
                              className="text-primary hover:underline"
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                const p = contact.phone?.trim();
                                if (!p) return;
                                const url = `tel:${p}`;
                                const win = window.open(url, "_blank", "noopener,noreferrer");
                                if (!win) window.location.href = url;
                              }}
                            >
                              {contact.phone}
                            </a>
                          </div>
                        )}

                        {/* Email - clickable */}
                        {contact?.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                            <a
                              href={`mailto:${contact.email}`}
                              target="_top"
                              rel="noreferrer"
                              className="text-primary hover:underline"
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {contact.email}
                            </a>
                            <a
                              href={`https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(contact.email)}&body=${encodeURIComponent(`Dear ${contact.first_name || ''} ${contact.last_name || ''}${displayAddress ? ` (${displayAddress})` : ''},\n\n\n\nBest regards,\nCA Pro Builders`)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-primary text-xs"
                              onPointerDown={(e) => e.stopPropagation()}
                              onClick={(e) => e.stopPropagation()}
                            >
                              (Gmail)
                            </a>
                          </div>
                        )}

                        {salesPerson && (
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="text-foreground">{salesPerson}</span>
                          </div>
                        )}

                        {contact?.source && (
                          <div className="flex items-center gap-2">
                            <Target className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="text-foreground capitalize">{contact.source}</span>
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
