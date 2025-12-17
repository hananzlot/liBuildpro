import { useState, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DollarSign, Search, Calendar, User, Phone, ChevronLeft, ChevronRight } from "lucide-react";

interface OpportunitySale {
  id: string;
  opportunity_id: string;
  contact_id: string | null;
  sold_amount: number;
  sold_date: string;
  sold_to_name: string | null;
  sold_to_phone: string | null;
  sold_by: string | null;
}

interface GHLUser {
  ghl_id: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

interface Opportunity {
  ghl_id: string;
  name: string | null;
  contact_id: string | null;
}

interface Contact {
  ghl_id: string;
  contact_name: string | null;
  first_name: string | null;
  last_name: string | null;
}

interface OpportunitySalesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sales: OpportunitySale[];
  users: GHLUser[];
  opportunities: Opportunity[];
  contacts: Contact[];
  onOpportunityClick?: (opportunity: Opportunity) => void;
}

export function OpportunitySalesSheet({
  open,
  onOpenChange,
  sales,
  users,
  opportunities,
  contacts,
  onOpportunityClick,
}: OpportunitySalesSheetProps) {
  const [searchFilter, setSearchFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const getUserName = (ghlId: string | null) => {
    if (!ghlId) return "Unknown";
    const user = users.find(u => u.ghl_id === ghlId);
    if (!user) return "Unknown";
    return user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email || "Unknown";
  };

  const getOpportunityName = (oppId: string) => {
    const opp = opportunities.find(o => o.ghl_id === oppId);
    return opp?.name || "Unknown Opportunity";
  };

  const getContactName = (contactId: string | null) => {
    if (!contactId) return null;
    const contact = contacts.find(c => c.ghl_id === contactId);
    if (!contact) return null;
    return contact.contact_name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || null;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const filteredSales = useMemo(() => {
    if (!searchFilter.trim()) return sales;
    const search = searchFilter.toLowerCase();
    return sales.filter(sale => {
      const oppName = getOpportunityName(sale.opportunity_id).toLowerCase();
      const contactName = getContactName(sale.contact_id)?.toLowerCase() || "";
      const soldToName = sale.sold_to_name?.toLowerCase() || "";
      const soldByName = getUserName(sale.sold_by).toLowerCase();
      return oppName.includes(search) || contactName.includes(search) || 
             soldToName.includes(search) || soldByName.includes(search);
    });
  }, [sales, searchFilter, opportunities, contacts, users]);

  // Sort by sold_date descending
  const sortedSales = useMemo(() => {
    return [...filteredSales].sort((a, b) => 
      new Date(b.sold_date).getTime() - new Date(a.sold_date).getTime()
    );
  }, [filteredSales]);

  const totalPages = Math.ceil(sortedSales.length / itemsPerPage);
  const paginatedSales = sortedSales.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalAmount = sales.reduce((sum, s) => sum + (s.sold_amount || 0), 0);

  const handleOpportunityClick = (oppId: string) => {
    const opp = opportunities.find(o => o.ghl_id === oppId);
    if (opp && onOpportunityClick) {
      onOpportunityClick(opp);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-hidden flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Opportunity Sales ({sales.length})
          </SheetTitle>
        </SheetHeader>

        {/* Summary */}
        <div className="flex gap-4 mb-4">
          <div className="bg-emerald-500/10 rounded-lg p-4 flex-1">
            <div className="text-sm text-muted-foreground">Total Sales</div>
            <div className="text-2xl font-bold text-emerald-500">{formatCurrency(totalAmount)}</div>
          </div>
          <div className="bg-blue-500/10 rounded-lg p-4 flex-1">
            <div className="text-sm text-muted-foreground">Count</div>
            <div className="text-2xl font-bold text-blue-500">{sales.length}</div>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchFilter}
            onChange={(e) => {
              setSearchFilter(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search sales..."
            className="pl-10"
          />
        </div>

        {/* Sales List */}
        <ScrollArea className="flex-1">
          {paginatedSales.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchFilter ? "No sales match your search" : "No sales recorded"}
            </div>
          ) : (
            <div className="space-y-3">
              {paginatedSales.map((sale) => {
                const contactName = getContactName(sale.contact_id);
                return (
                  <div
                    key={sale.id}
                    className="border rounded-lg p-4 bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xl text-emerald-500">
                            {formatCurrency(sale.sold_amount)}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            <Calendar className="h-3 w-3 mr-1" />
                            {new Date(sale.sold_date).toLocaleDateString()}
                          </Badge>
                        </div>
                        
                        <button
                          onClick={() => handleOpportunityClick(sale.opportunity_id)}
                          className="text-sm font-medium text-primary hover:underline text-left"
                        >
                          {getOpportunityName(sale.opportunity_id)}
                        </button>
                        
                        {contactName && (
                          <div className="text-sm text-muted-foreground">
                            Contact: {contactName}
                          </div>
                        )}
                        
                        {sale.sold_to_name && (
                          <div className="text-sm flex items-center gap-1">
                            <User className="h-3 w-3" />
                            Sold to: {sale.sold_to_name}
                            {sale.sold_to_phone && (
                              <span className="text-muted-foreground">
                                <Phone className="h-3 w-3 inline ml-2 mr-1" />
                                {sale.sold_to_phone}
                              </span>
                            )}
                          </div>
                        )}
                        
                        <div className="text-sm text-muted-foreground">
                          Sold by: {getUserName(sale.sold_by)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
