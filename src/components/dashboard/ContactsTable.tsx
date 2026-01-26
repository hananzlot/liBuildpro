import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, Phone, Mail, MapPin, ChevronUp, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAddressFromContact, findContactByIdOrGhlId } from "@/lib/utils";

interface Contact {
  id: string;
  ghl_id: string | null;
  contact_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  custom_fields?: unknown;
  ghl_date_added?: string | null;
}

interface Opportunity {
  ghl_id: string;
  name: string | null;
  status: string | null;
  monetary_value: number | null;
  contact_id: string | null;
}

interface Appointment {
  ghl_id: string;
  title: string | null;
  start_time: string | null;
  contact_id: string | null;
  address?: string | null;
}

interface GHLUser {
  ghl_id: string;
  name: string | null;
}

interface ContactsTableProps {
  contacts: Contact[];
  opportunities: Opportunity[];
  appointments: Appointment[];
  users: GHLUser[];
}

type SortField = 'name' | 'email' | 'phone' | 'source' | 'date';
type SortDirection = 'asc' | 'desc';

export function ContactsTable({
  contacts,
  opportunities,
  appointments,
  users,
}: ContactsTableProps) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const getContactName = (contact: Contact) => {
    return contact.contact_name || 
      (contact.first_name && contact.last_name 
        ? `${contact.first_name} ${contact.last_name}` 
        : contact.first_name || contact.last_name || "Unknown");
  };

  const getAddress = (contact: Contact) => {
    return getAddressFromContact(contact, appointments, contact.ghl_id);
  };

  const getOpportunityCount = (contactId: string | null) => {
    if (!contactId) return 0;
    return opportunities.filter(o => o.contact_id === contactId).length;
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredAndSortedContacts = useMemo(() => {
    let filtered = contacts;

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = contacts.filter(contact => {
        const name = getContactName(contact).toLowerCase();
        const email = contact.email?.toLowerCase() || "";
        const phone = contact.phone?.replace(/\D/g, '') || "";
        const address = getAddress(contact)?.toLowerCase() || "";
        const queryDigits = searchQuery.replace(/\D/g, '');
        
        return name.includes(query) || 
               email.includes(query) || 
               address.includes(query) ||
               (queryDigits.length >= 3 && phone.includes(queryDigits));
      });
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';

      switch (sortField) {
        case 'name':
          aVal = getContactName(a).toLowerCase();
          bVal = getContactName(b).toLowerCase();
          break;
        case 'email':
          aVal = a.email?.toLowerCase() || '';
          bVal = b.email?.toLowerCase() || '';
          break;
        case 'phone':
          aVal = a.phone || '';
          bVal = b.phone || '';
          break;
        case 'source':
          aVal = a.source?.toLowerCase() || '';
          bVal = b.source?.toLowerCase() || '';
          break;
        case 'date':
          aVal = a.ghl_date_added || '';
          bVal = b.ghl_date_added || '';
          break;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [contacts, searchQuery, sortField, sortDirection, appointments]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' 
      ? <ChevronUp className="h-4 w-4 ml-1" />
      : <ChevronDown className="h-4 w-4 ml-1" />;
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, phone, or address..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 pr-9"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
            onClick={() => setSearchQuery("")}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        {filteredAndSortedContacts.length} contacts
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center">
                  Name
                  <SortIcon field="name" />
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('email')}
              >
                <div className="flex items-center">
                  Email
                  <SortIcon field="email" />
                </div>
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('phone')}
              >
                <div className="flex items-center">
                  Phone
                  <SortIcon field="phone" />
                </div>
              </TableHead>
              <TableHead>Address</TableHead>
              <TableHead 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('source')}
              >
                <div className="flex items-center">
                  Source
                  <SortIcon field="source" />
                </div>
              </TableHead>
              <TableHead className="text-right">Opportunities</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedContacts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No contacts found
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSortedContacts.slice(0, 100).map((contact) => {
                const address = getAddress(contact);
                const oppCount = getOpportunityCount(contact.ghl_id);
                
                return (
                  <TableRow 
                    key={contact.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/contacts/${contact.id}`)}
                  >
                    <TableCell className="font-medium">
                      {getContactName(contact)}
                    </TableCell>
                    <TableCell>
                      {contact.email ? (
                        <a 
                          href={`mailto:${contact.email}`}
                          className="flex items-center gap-1.5 text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Mail className="h-3.5 w-3.5" />
                          {contact.email}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {contact.phone ? (
                        <a 
                          href={`tel:${contact.phone}`}
                          className="flex items-center gap-1.5 text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Phone className="h-3.5 w-3.5" />
                          {contact.phone}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {address ? (
                        <div className="flex items-center gap-1.5 text-sm max-w-[200px] truncate">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          {address}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {contact.source ? (
                        <Badge variant="outline" className="text-xs">
                          {contact.source}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {oppCount > 0 ? (
                        <Badge variant="secondary">{oppCount}</Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        {filteredAndSortedContacts.length > 100 && (
          <div className="p-3 text-center text-sm text-muted-foreground border-t">
            Showing first 100 of {filteredAndSortedContacts.length} contacts
          </div>
        )}
      </div>
    </div>
  );
}
