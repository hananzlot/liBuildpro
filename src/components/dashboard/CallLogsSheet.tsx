import { useState, useMemo } from "react";
import { Phone, PhoneIncoming, PhoneOutgoing, User, Calendar, Search, ExternalLink, ChevronDown, ChevronRight } from "lucide-react";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

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
  id: string;
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
  id: string;
  ghl_id: string;
  contact_id: string | null;
  contact_uuid?: string | null;
  name: string | null;
  status: string | null;
  stage_name: string | null;
  pipeline_name: string | null;
  monetary_value: number | null;
  assigned_to: string | null;
}

interface User {
  id: string;
  ghl_id: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
}

interface Appointment {
  id?: string;
  ghl_id: string;
  contact_id: string | null;
  contact_uuid?: string | null;
  title: string | null;
  start_time: string | null;
  end_time: string | null;
  appointment_status: string | null;
  notes?: string | null;
}

interface GroupedCall {
  contactId: string;
  date: string;
  calls: CallLog[];
  totalCalls: number;
  directions: { inbound: number; outbound: number };
  latestCall: CallLog;
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
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Get opportunities for selected contact
  const contactOpportunities = useMemo(() => {
    if (!selectedContact) return [];
    return opportunities.filter(o => 
      (o.contact_uuid && o.contact_uuid === selectedContact.id) ||
      (o.contact_id && (o.contact_id === selectedContact.ghl_id || o.contact_id === selectedContact.id))
    );
  }, [selectedContact, opportunities]);

  // Get appointments for selected contact
  const contactAppointments = useMemo(() => {
    if (!selectedContact) return [];
    return appointments.filter(a => 
      (a.contact_uuid && a.contact_uuid === selectedContact.id) ||
      (a.contact_id && (a.contact_id === selectedContact.ghl_id || a.contact_id === selectedContact.id))
    );
  }, [selectedContact, appointments]);

  // Create lookup maps
  const contactMap = useMemo(() => {
    const map = new Map<string, Contact>();
    contacts.forEach((c) => map.set(c.id, c));
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

  // Filter calls first
  const filteredCalls = useMemo(() => {
    return callLogs.filter((call) => {
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
    });
  }, [callLogs, directionFilter, userFilter, search, contactMap]);

  // Group calls by contact + date
  const groupedCalls = useMemo(() => {
    const groups = new Map<string, GroupedCall>();
    
    filteredCalls.forEach(call => {
      const dateKey = call.call_date 
        ? format(new Date(call.call_date), 'yyyy-MM-dd') 
        : 'unknown';
      const groupKey = `${call.contact_id}_${dateKey}`;
      
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          contactId: call.contact_id,
          date: dateKey,
          calls: [],
          totalCalls: 0,
          directions: { inbound: 0, outbound: 0 },
          latestCall: call,
        });
      }
      
      const group = groups.get(groupKey)!;
      group.calls.push(call);
      group.totalCalls++;
      if (call.direction === 'inbound') group.directions.inbound++;
      else if (call.direction === 'outbound') group.directions.outbound++;
      
      // Track latest call in group
      if (new Date(call.call_date || 0) > new Date(group.latestCall.call_date || 0)) {
        group.latestCall = call;
      }
    });
    
    return Array.from(groups.values())
      .sort((a, b) => new Date(b.latestCall.call_date || 0).getTime() - 
                      new Date(a.latestCall.call_date || 0).getTime());
  }, [filteredCalls]);

  // Pagination on grouped data
  const paginatedGroups = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return groupedCalls.slice(start, start + PAGE_SIZE);
  }, [groupedCalls, page]);

  const totalPages = Math.ceil(groupedCalls.length / PAGE_SIZE);

  // Stats
  const stats = useMemo(() => {
    const outbound = filteredCalls.filter((c) => c.direction === "outbound").length;
    const inbound = filteredCalls.filter((c) => c.direction === "inbound").length;
    const uniqueContacts = new Set(filteredCalls.map(c => c.contact_id)).size;
    return { total: filteredCalls.length, outbound, inbound, uniqueContacts };
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

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  };

  const handleContactClick = (contactId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const contact = contactMap.get(contactId);
    if (contact) {
      setSelectedContact(contact);
      setContactSheetOpen(true);
    }
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
            <p className="text-2xl font-bold">{stats.uniqueContacts}</p>
            <p className="text-xs text-muted-foreground">Unique Contacts</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total Calls</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1">
              <span className="text-lg font-bold text-green-600">{stats.outbound}↑</span>
              <span className="text-lg font-bold text-blue-600">{stats.inbound}↓</span>
            </div>
            <p className="text-xs text-muted-foreground">Out / In</p>
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
        {paginatedGroups.length === 0 ? (
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
                    <TableHead className="w-[200px]">Contact</TableHead>
                    <TableHead className="w-[80px]">Calls</TableHead>
                    <TableHead className="w-[100px]">Direction</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedGroups.map((group) => {
                    const groupKey = `${group.contactId}_${group.date}`;
                    const { name, phone } = getContactDisplay(group.contactId);
                    const isExpanded = expandedGroups.has(groupKey);

                    return (
                      <Collapsible key={groupKey} open={isExpanded}>
                        <TableRow 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => group.totalCalls > 1 && toggleGroup(groupKey)}
                        >
                          <TableCell>
                            <div 
                              className="flex items-center gap-2 cursor-pointer hover:text-primary"
                              onClick={(e) => handleContactClick(group.contactId, e)}
                            >
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
                            <CollapsibleTrigger asChild>
                              <Badge 
                                variant="secondary" 
                                className={`cursor-pointer ${group.totalCalls > 1 ? 'hover:bg-primary hover:text-primary-foreground' : ''}`}
                              >
                                {group.totalCalls > 1 && (
                                  isExpanded ? <ChevronDown className="h-3 w-3 mr-1" /> : <ChevronRight className="h-3 w-3 mr-1" />
                                )}
                                {group.totalCalls}
                              </Badge>
                            </CollapsibleTrigger>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-xs">
                              {group.directions.outbound > 0 && (
                                <span className="text-green-600 font-medium flex items-center">
                                  <PhoneOutgoing className="h-3 w-3 mr-0.5" />
                                  {group.directions.outbound}
                                </span>
                              )}
                              {group.directions.inbound > 0 && (
                                <span className="text-blue-600 font-medium flex items-center">
                                  <PhoneIncoming className="h-3 w-3 mr-0.5" />
                                  {group.directions.inbound}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-sm">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              {group.date !== 'unknown' 
                                ? format(new Date(group.date), "MMM d, yyyy")
                                : "Unknown"}
                            </div>
                          </TableCell>
                        </TableRow>
                        
                        {/* Expanded individual calls */}
                        <CollapsibleContent asChild>
                          <>
                            {group.calls
                              .sort((a, b) => new Date(b.call_date || 0).getTime() - new Date(a.call_date || 0).getTime())
                              .map((call) => {
                                const userName = call.user_id
                                  ? userMap.get(call.user_id) || "Unknown"
                                  : "Unknown";
                                const isOutbound = call.direction === "outbound";

                                return (
                                  <TableRow key={call.id} className="bg-muted/30">
                                    <TableCell className="pl-8">
                                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <User className="h-3 w-3" />
                                      {userName}
                                      </div>
                                    </TableCell>
                                    <TableCell></TableCell>
                                    <TableCell>
                                      <Badge
                                        variant="outline"
                                        className={`text-xs ${
                                          isOutbound
                                            ? "border-green-500/50 text-green-600 bg-green-500/10"
                                            : "border-blue-500/50 text-blue-600 bg-blue-500/10"
                                        }`}
                                      >
                                        {isOutbound ? (
                                          <PhoneOutgoing className="h-3 w-3 mr-1" />
                                        ) : (
                                          <PhoneIncoming className="h-3 w-3 mr-1" />
                                        )}
                                        {isOutbound ? "Out" : "In"}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      <span className="text-xs text-muted-foreground">
                                        {call.call_date
                                          ? format(new Date(call.call_date), "h:mm a")
                                          : "Unknown"}
                                      </span>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                          </>
                        </CollapsibleContent>
                      </Collapsible>
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
                  {Math.min(page * PAGE_SIZE, groupedCalls.length)} of{" "}
                  {groupedCalls.length} groups
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
        id: selectedContact.id,
        custom_fields: selectedContact.custom_fields 
      } : null}
      opportunities={contactOpportunities.map(o => ({ ...o, id: o.id || o.ghl_id }))}
      appointments={contactAppointments.map(a => ({ ...a, id: a.id || a.ghl_id }))}
      users={users.map(u => ({ ...u, id: u.id || u.ghl_id }))}
      open={contactSheetOpen}
      onOpenChange={setContactSheetOpen}
    />
    </>
  );
}