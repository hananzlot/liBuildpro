import { useState, useMemo } from "react";
import { Phone, PhoneIncoming, PhoneOutgoing, User, Calendar, Search, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ContactDetailSheet } from "./ContactDetailSheet";

interface CallLog {
  id: string;
  ghl_message_id: string;
  conversation_id: string;
  contact_id: string;
  direction: string | null;
  call_date: string | null;
  user_id: string | null;
  location_id: string;
}

interface Contact {
  ghl_id: string;
  contact_name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email?: string | null;
  source?: string | null;
  assigned_to?: string | null;
  custom_fields?: any;
  ghl_date_added?: string | null;
}

interface Opportunity {
  ghl_id: string;
  contact_id: string | null;
  name: string | null;
  status: string | null;
  stage_name: string | null;
  pipeline_name: string | null;
  monetary_value: number | null;
  assigned_to: string | null;
}

interface User {
  ghl_id: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
}

interface Appointment {
  ghl_id: string;
  contact_id: string | null;
  title: string | null;
  start_time: string | null;
  end_time: string | null;
  appointment_status: string | null;
  notes?: string | null;
}

interface CallLogsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  callLogs: CallLog[];
  contacts: Contact[];
  users: User[];
  opportunities?: Opportunity[];
  appointments?: Appointment[];
}

const PAGE_SIZE = 20;

export function CallLogsSheet({
  open,
  onOpenChange,
  callLogs,
  contacts,
  users,
  opportunities = [],
  appointments = [],
}: CallLogsSheetProps) {
  const [search, setSearch] = useState("");
  const [directionFilter, setDirectionFilter] = useState<string>("all");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [contactSheetOpen, setContactSheetOpen] = useState(false);

  // Get opportunities for selected contact
  const contactOpportunities = useMemo(() => {
    if (!selectedContact) return [];
    return opportunities.filter(o => o.contact_id === selectedContact.ghl_id);
  }, [selectedContact, opportunities]);

  // Get appointments for selected contact
  const contactAppointments = useMemo(() => {
    if (!selectedContact) return [];
    return appointments.filter(a => a.contact_id === selectedContact.ghl_id);
  }, [selectedContact, appointments]);

  // Create lookup maps
  const contactMap = useMemo(() => {
    const map = new Map<string, Contact>();
    contacts.forEach((c) => map.set(c.ghl_id, c));
    return map;
  }, [contacts]);

  const userMap = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((u) => {
      const displayName =
        u.name || `${u.first_name || ""} ${u.last_name || ""}`.trim() || "Unknown";
      map.set(u.ghl_id, displayName);
    });
    return map;
  }, [users]);

  // Get unique users who made calls
  const callUsers = useMemo(() => {
    const userIds = new Set<string>();
    callLogs.forEach((c) => {
      if (c.user_id) userIds.add(c.user_id);
    });
    return Array.from(userIds)
      .map((id) => ({ id, name: userMap.get(id) || id }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [callLogs, userMap]);

  // Filter and search
  const filteredCalls = useMemo(() => {
    return callLogs
      .filter((call) => {
        // Direction filter
        if (directionFilter !== "all" && call.direction !== directionFilter) {
          return false;
        }
        // User filter
        if (userFilter !== "all" && call.user_id !== userFilter) {
          return false;
        }
        // Search filter (contact name or phone)
        if (search) {
          const contact = contactMap.get(call.contact_id);
          const contactName = contact
            ? `${contact.first_name || ""} ${contact.last_name || ""}`.trim() ||
              contact.contact_name ||
              ""
            : "";
          const phone = contact?.phone || "";
          const searchLower = search.toLowerCase();
          if (
            !contactName.toLowerCase().includes(searchLower) &&
            !phone.includes(search)
          ) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        const dateA = a.call_date ? new Date(a.call_date).getTime() : 0;
        const dateB = b.call_date ? new Date(b.call_date).getTime() : 0;
        return dateB - dateA;
      });
  }, [callLogs, directionFilter, userFilter, search, contactMap]);

  // Pagination
  const paginatedCalls = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredCalls.slice(start, start + PAGE_SIZE);
  }, [filteredCalls, page]);

  const totalPages = Math.ceil(filteredCalls.length / PAGE_SIZE);

  // Stats
  const stats = useMemo(() => {
    const outbound = filteredCalls.filter((c) => c.direction === "outbound").length;
    const inbound = filteredCalls.filter((c) => c.direction === "inbound").length;
    return { total: filteredCalls.length, outbound, inbound };
  }, [filteredCalls]);

  const getContactDisplay = (contactId: string) => {
    const contact = contactMap.get(contactId);
    if (!contact) return { name: "Unknown Contact", phone: "" };
    const name =
      `${contact.first_name || ""} ${contact.last_name || ""}`.trim() ||
      contact.contact_name ||
      "Unknown";
    return { name, phone: contact.phone || "" };
  };

  // Reset page when filters change
  const handleFilterChange = (setter: (value: string) => void, value: string) => {
    setter(value);
    setPage(1);
  };

  return (
    <>
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Call History
          </SheetTitle>
        </SheetHeader>

        {/* Stats Summary */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total Calls</p>
          </div>
          <div className="bg-green-500/10 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-green-600">{stats.outbound}</p>
            <p className="text-xs text-muted-foreground">Outbound</p>
          </div>
          <div className="bg-blue-500/10 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-blue-600">{stats.inbound}</p>
            <p className="text-xs text-muted-foreground">Inbound</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by contact name or phone..."
              value={search}
              onChange={(e) => handleFilterChange(setSearch, e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={directionFilter}
            onValueChange={(v) => handleFilterChange(setDirectionFilter, v)}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Direction" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Directions</SelectItem>
              <SelectItem value="outbound">Outbound</SelectItem>
              <SelectItem value="inbound">Inbound</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={userFilter}
            onValueChange={(v) => handleFilterChange(setUserFilter, v)}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Team Member" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Team Members</SelectItem>
              {callUsers.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Call Logs Table */}
        {paginatedCalls.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Phone className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No calls found</p>
            <p className="text-sm">
              {callLogs.length === 0
                ? "Sync GHL data to populate call logs"
                : "Try adjusting your filters"}
            </p>
          </div>
        ) : (
          <>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Direction</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Team Member</TableHead>
                    <TableHead>Date & Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedCalls.map((call) => {
                    const contact = contactMap.get(call.contact_id);
                    const { name, phone } = getContactDisplay(call.contact_id);
                    const userName = call.user_id
                      ? userMap.get(call.user_id) || "Unknown"
                      : "Unknown";
                    const isOutbound = call.direction === "outbound";

                    const handleRowClick = () => {
                      if (contact) {
                        setSelectedContact(contact);
                        setContactSheetOpen(true);
                      }
                    };

                    return (
                      <TableRow 
                        key={call.id} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={handleRowClick}
                      >
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              isOutbound
                                ? "border-green-500/50 text-green-600 bg-green-500/10"
                                : "border-blue-500/50 text-blue-600 bg-blue-500/10"
                            }
                          >
                            {isOutbound ? (
                              <PhoneOutgoing className="h-3 w-3 mr-1" />
                            ) : (
                              <PhoneIncoming className="h-3 w-3 mr-1" />
                            )}
                            {isOutbound ? "Outbound" : "Inbound"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="flex flex-col">
                              <span className="font-medium">{name}</span>
                              {phone && (
                                <span className="text-xs text-muted-foreground">
                                  {phone}
                                </span>
                              )}
                            </div>
                            <ExternalLink className="h-3 w-3 text-muted-foreground" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{userName}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">
                              {call.call_date
                                ? format(
                                    new Date(call.call_date),
                                    "MMM d, yyyy h:mm a"
                                  )
                                : "Unknown"}
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Showing {(page - 1) * PAGE_SIZE + 1}-
                  {Math.min(page * PAGE_SIZE, filteredCalls.length)} of{" "}
                  {filteredCalls.length}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
    
    {/* Contact Detail Sheet */}
    <ContactDetailSheet
      contact={selectedContact ? { 
        ...selectedContact, 
        id: selectedContact.ghl_id,
        custom_fields: selectedContact.custom_fields 
      } : null}
      opportunities={contactOpportunities.map(o => ({ ...o, id: o.ghl_id }))}
      appointments={contactAppointments.map(a => ({ ...a, id: a.ghl_id }))}
      users={users.map(u => ({ ...u, id: u.ghl_id }))}
      open={contactSheetOpen}
      onOpenChange={setContactSheetOpen}
    />
    </>
  );
}
