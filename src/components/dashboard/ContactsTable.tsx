import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Phone, Mail, MapPin, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useUnifiedMode } from "@/hooks/useUnifiedMode";
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
  company_id?: string | null;
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
  const { isUnified, getCompanyName } = useUnifiedMode();
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 100;

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
    setCurrentPage(1);
  };

  const sortedContacts = useMemo(() => {
    // Sort
    return [...contacts].sort((a, b) => {
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
  }, [contacts, sortField, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedContacts.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedContacts = sortedContacts.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize);
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' 
      ? <ChevronUp className="h-4 w-4 ml-1" />
      : <ChevronDown className="h-4 w-4 ml-1" />;
  };

  return (
    <div className="space-y-4">
      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        {sortedContacts.length} contacts{totalPages > 1 && ` • Page ${safeCurrentPage} of ${totalPages}`}
      </div>

      {/* Desktop Table */}
      <div className="rounded-lg border bg-card hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              {isUnified && <TableHead className="w-[70px]">Co.</TableHead>}
              <TableHead 
                className="w-[22%] cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center">
                  Name
                  <SortIcon field="name" />
                </div>
              </TableHead>
              <TableHead 
                className="w-[24%] cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('email')}
              >
                <div className="flex items-center">
                  Email
                  <SortIcon field="email" />
                </div>
              </TableHead>
              <TableHead 
                className="w-[16%] cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('phone')}
              >
                <div className="flex items-center">
                  Phone
                  <SortIcon field="phone" />
                </div>
              </TableHead>
              <TableHead className="w-[18%]">Address</TableHead>
              <TableHead 
                className="w-[12%] cursor-pointer hover:bg-muted/50"
                onClick={() => handleSort('source')}
              >
                <div className="flex items-center">
                  Source
                  <SortIcon field="source" />
                </div>
              </TableHead>
              <TableHead className="w-[8%] text-right">Opps</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedContacts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isUnified ? 7 : 6} className="text-center py-8 text-muted-foreground">
                  No contacts found
                </TableCell>
              </TableRow>
            ) : (
              paginatedContacts.map((contact) => {
                const address = getAddress(contact);
                const oppCount = getOpportunityCount(contact.ghl_id);
                
                return (
                  <TableRow 
                    key={contact.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/contacts/${contact.id}`)}
                  >
                    {isUnified && (
                      <TableCell className="text-xs">
                        <Badge variant="outline" className="text-[9px] px-1 py-0 font-normal">
                          {getCompanyName(contact.company_id)}
                        </Badge>
                      </TableCell>
                    )}
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
                   <TableCell className="whitespace-nowrap">
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
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-3 border-t">
            <span className="text-xs text-muted-foreground">
              {(safeCurrentPage - 1) * pageSize + 1}–{Math.min(safeCurrentPage * pageSize, sortedContacts.length)} of {sortedContacts.length}
            </span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={safeCurrentPage <= 1} onClick={() => setCurrentPage(1)}>
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={safeCurrentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground px-2">{safeCurrentPage} / {totalPages}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={safeCurrentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={safeCurrentPage >= totalPages} onClick={() => setCurrentPage(totalPages)}>
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-2">
        {paginatedContacts.length === 0 ? (
          <p className="text-center py-8 text-sm text-muted-foreground">No contacts found</p>
        ) : (
          paginatedContacts.map((contact) => {
            const oppCount = getOpportunityCount(contact.ghl_id);
            return (
              <div
                key={contact.id}
                className="rounded-lg border border-border/60 bg-card p-3 space-y-1.5 active:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => navigate(`/contacts/${contact.id}`)}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{getContactName(contact)}</span>
                  {contact.source && <Badge variant="outline" className="text-[10px]">{contact.source}</Badge>}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {contact.email && (
                    <a href={`mailto:${contact.email}`} className="flex items-center gap-1 text-primary" onClick={(e) => e.stopPropagation()}>
                      <Mail className="h-3 w-3" /> {contact.email}
                    </a>
                  )}
                  {contact.phone && (
                    <a href={`tel:${contact.phone}`} className="flex items-center gap-1 text-primary" onClick={(e) => e.stopPropagation()}>
                      <Phone className="h-3 w-3" /> {contact.phone}
                    </a>
                  )}
                  {oppCount > 0 && (
                    <Badge variant="secondary" className="text-[10px] h-4">{oppCount} opp{oppCount > 1 ? 's' : ''}</Badge>
                  )}
                </div>
              </div>
            );
          })
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-muted-foreground">{safeCurrentPage} / {totalPages}</span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={safeCurrentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={safeCurrentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
