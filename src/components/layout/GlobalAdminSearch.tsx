import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, Briefcase, FolderKanban, FileText, CalendarCheck, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { useAppTabs } from "@/contexts/AppTabsContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getAddressFromContact, findContactByIdOrGhlId } from "@/lib/utils";

interface Opportunity {
  ghl_id: string;
  name: string | null;
  status: string | null;
  monetary_value: number | null;
  pipeline_stage_id: string | null;
  stage_name: string | null;
  contact_id: string | null;
  ghl_date_added: string | null;
  address: string | null;
}

interface Contact {
  id: string;
  ghl_id: string;
  contact_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  custom_fields?: unknown;
}

interface Appointment {
  ghl_id: string;
  contact_id: string | null;
  address?: string | null;
  start_time?: string | null;
}

interface Project {
  id: string;
  project_number: number;
  project_name: string;
  project_status: string | null;
  customer_first_name: string | null;
  customer_last_name: string | null;
  project_address: string | null;
  primary_salesperson: string | null;
  cell_phone: string | null;
}

interface Estimate {
  id: string;
  estimate_number: number | null;
  customer_name: string | null;
  job_address: string | null;
  status: string | null;
  total: number | null;
  created_at: string | null;
}

async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => Promise<T[] | null | undefined>,
  pageSize = 1000
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;

  while (true) {
    const page = await fetchPage(from, from + pageSize - 1);
    const items = page ?? [];
    all.push(...items);

    if (items.length < pageSize) break;
    from += pageSize;
  }

  return all;
}

export function GlobalAdminSearch() {
  const navigate = useNavigate();
  const { companyId } = useCompanyContext();
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"opportunities" | "projects" | "estimates" | "contacts">("opportunities");

  // Fetch opportunities for search
  const { data: opportunities = [] } = useQuery({
    queryKey: ["global-search-opportunities", companyId],
    queryFn: async () => {
      // IMPORTANT: Supabase defaults to 1000 rows per query.
      // For large tenants, pagination is required or older opps will never appear in search.
      return fetchAllPages<Opportunity>(async (from, to) => {
        const { data, error } = await supabase
          .from("opportunities")
          .select(
            "ghl_id, name, status, monetary_value, pipeline_stage_id, stage_name, contact_id, ghl_date_added, address"
          )
          .eq("company_id", companyId)
          .order("ghl_date_added", { ascending: false })
          .range(from, to);

        if (error) throw error;
        return data as Opportunity[];
      });
    },
    enabled: !!companyId && isOpen,
    staleTime: 60 * 1000,
  });

  // Fetch contacts for name lookups
  const { data: contacts = [] } = useQuery({
    queryKey: ["global-search-contacts", companyId],
    queryFn: async () => {
      return fetchAllPages<Contact>(async (from, to) => {
        const { data, error } = await supabase
          .from("contacts")
          .select("id, ghl_id, contact_name, first_name, last_name, email, phone, custom_fields")
          .eq("company_id", companyId)
          .order("ghl_date_added", { ascending: false })
          .range(from, to);

        if (error) throw error;
        return data as Contact[];
      });
    },
    enabled: !!companyId && isOpen,
    staleTime: 60 * 1000,
  });

  // Fetch appointments for address lookups and upcoming appointment checks
  const { data: appointments = [] } = useQuery({
    queryKey: ["global-search-appointments", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("ghl_id, contact_id, address, start_time")
        .eq("company_id", companyId)
        .limit(1000);
      if (error) throw error;
      return data as Appointment[];
    },
    enabled: !!companyId && isOpen,
    staleTime: 60 * 1000,
  });

  // Fetch projects for search (also used for opportunity address lookup)
  const { data: projects = [] } = useQuery({
    queryKey: ["global-search-projects", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, project_number, project_name, project_status, customer_first_name, customer_last_name, project_address, primary_salesperson, cell_phone, opportunity_id")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .order("project_number", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as (Project & { opportunity_id?: string | null })[];
    },
    enabled: !!companyId && isOpen,
    staleTime: 60 * 1000,
  });

  // Fetch estimates for search
  const { data: estimates = [] } = useQuery({
    queryKey: ["global-search-estimates", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estimates")
        .select("id, estimate_number, customer_name, job_address, status, total, created_at")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as Estimate[];
    },
    enabled: !!companyId && isOpen,
    staleTime: 60 * 1000,
  });

  const normalizePhone = (phone: string | null | undefined): string => {
    if (!phone) return "";
    return phone.replace(/\D/g, "");
  };

  // Enhanced address lookup: opportunity address → contact custom_fields → appointment address → project address
  const getAddressWithFallback = (contactId: string | null, oppGhlId?: string | null, oppAddress?: string | null): string => {
    // 1. Try opportunity's own address field first (most direct source)
    if (oppAddress) return oppAddress;
    
    // 2. Try contact custom_fields
    if (contactId) {
      const contact = findContactByIdOrGhlId(contacts, undefined, contactId);
      const contactAddress = getAddressFromContact(contact, appointments, contactId);
      if (contactAddress) return contactAddress;
    }
    
    // 3. Try linked project address (by opportunity_id matching ghl_id)
    if (oppGhlId) {
      const linkedProject = projects.find(p => p.opportunity_id === oppGhlId);
      if (linkedProject?.project_address) return linkedProject.project_address;
    }
    
    return "";
  };

  // Check if contact has an upcoming appointment (today or future)
  const hasUpcomingAppointment = (contactId: string | null): boolean => {
    if (!contactId) return false;
    const now = new Date();
    return appointments.some(apt => 
      apt.contact_id === contactId && 
      apt.start_time && 
      new Date(apt.start_time) >= now
    );
  };

  const filteredOpportunities = useMemo(() => {
    if (!searchQuery.trim()) return [];
    
    const queryLower = searchQuery.toLowerCase().trim();
    const queryDigits = searchQuery.replace(/\D/g, "");
    const isPhoneSearch = /^\d+$/.test(queryLower.replace(/[\s\-\(\)]/g, ""));
    
    return opportunities
      .filter((opp) => {
        const name = opp.name?.toLowerCase() || "";
        const contact = findContactByIdOrGhlId(contacts, undefined, opp.contact_id);
        const contactName =
          contact?.contact_name?.toLowerCase() ||
          `${contact?.first_name || ""} ${contact?.last_name || ""}`.toLowerCase();
        const address = getAddressWithFallback(opp.contact_id, opp.ghl_id, opp.address).toLowerCase();
        const phone = normalizePhone(contact?.phone);

        let phoneMatch = false;
        if (isPhoneSearch && queryDigits.length >= 3 && phone.length > 0) {
          phoneMatch = phone.includes(queryDigits) || phone.endsWith(queryDigits);
        }

        return (
          name.includes(queryLower) ||
          contactName.includes(queryLower) ||
          address.includes(queryLower) ||
          phoneMatch
        );
      })
      .slice(0, 8);
  }, [searchQuery, opportunities, contacts, projects, appointments]);

  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return [];
    
    const queryLower = searchQuery.toLowerCase().trim();
    const queryDigits = searchQuery.replace(/\D/g, "");
    const isPhoneSearch = /^\d+$/.test(queryLower.replace(/[\s\-\(\)]/g, ""));
    
    return (projects as Project[])
      .filter((proj) => {
        const name = proj.project_name?.toLowerCase() || "";
        const customerName = `${proj.customer_first_name || ""} ${proj.customer_last_name || ""}`.toLowerCase();
        const address = proj.project_address?.toLowerCase() || "";
        const projectNum = proj.project_number?.toString() || "";
        const salesperson = proj.primary_salesperson?.toLowerCase() || "";
        const phone = normalizePhone(proj.cell_phone);

        let phoneMatch = false;
        if (isPhoneSearch && queryDigits.length >= 3 && phone.length > 0) {
          phoneMatch = phone.includes(queryDigits) || phone.endsWith(queryDigits);
        }

        return (
          name.includes(queryLower) ||
          customerName.includes(queryLower) ||
          address.includes(queryLower) ||
          projectNum.includes(queryLower) ||
          salesperson.includes(queryLower) ||
          phoneMatch
        );
      })
      .slice(0, 8);
  }, [searchQuery, projects]);

  const filteredEstimates = useMemo(() => {
    if (!searchQuery.trim()) return [];
    
    const queryLower = searchQuery.toLowerCase().trim();
    
    return estimates
      .filter((est) => {
        const customerName = est.customer_name?.toLowerCase() || "";
        const address = est.job_address?.toLowerCase() || "";
        const estimateNum = est.estimate_number?.toString() || "";
        
        return (
          customerName.includes(queryLower) ||
          address.includes(queryLower) ||
          estimateNum.includes(searchQuery.trim())
        );
      })
      .slice(0, 8);
  }, [searchQuery, estimates]);

  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return [];
    
    const queryLower = searchQuery.toLowerCase().trim();
    const queryDigits = searchQuery.replace(/\D/g, "");
    const isPhoneSearch = /^\d+$/.test(queryLower.replace(/[\s\-\(\)]/g, ""));
    
    return contacts
      .filter((contact) => {
        const name = (contact.contact_name || 
          `${contact.first_name || ""} ${contact.last_name || ""}`).toLowerCase();
        const email = contact.email?.toLowerCase() || "";
        const phone = normalizePhone(contact.phone);
        const address = getAddressFromContact(contact, appointments, contact.ghl_id).toLowerCase();
        
        let phoneMatch = false;
        if (isPhoneSearch && queryDigits.length >= 3 && phone.length > 0) {
          phoneMatch = phone.includes(queryDigits) || phone.endsWith(queryDigits);
        }
        
        return (
          name.includes(queryLower) ||
          email.includes(queryLower) ||
          address.includes(queryLower) ||
          phoneMatch
        );
      })
      .slice(0, 8);
  }, [searchQuery, contacts, appointments]);

  const getContactName = (contactId: string | null) => {
    if (!contactId) return "Unknown";
    const contact = findContactByIdOrGhlId(contacts, undefined, contactId);
    return (
      contact?.contact_name ||
      (contact?.first_name && contact?.last_name
        ? `${contact.first_name} ${contact.last_name}`
        : contact?.first_name || contact?.last_name || "Unknown")
    );
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return "$0";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const getStatusColor = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case "won":
        return "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
      case "lost":
      case "abandoned":
        return "bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30";
      case "open":
        return "bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30";
      default:
        return "bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30";
    }
  };

  const getProjectStatusColor = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case "completed":
        return "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
      case "active":
      case "in progress":
        return "bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30";
      case "pending":
        return "bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  const getEstimateStatusColor = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case "signed":
      case "accepted":
        return "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
      case "sent":
      case "pending":
        return "bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30";
      case "draft":
        return "bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30";
      case "declined":
      case "expired":
        return "bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  const handleSelectOpportunity = (opp: Opportunity) => {
    // Open as a tab using the full-page opportunity route
    const address = getAddressWithFallback(opp.contact_id, opp.ghl_id, opp.address);
    const tabTitle = address || getContactName(opp.contact_id) || 'Opportunity';
    openTab(`/opportunity/${opp.ghl_id}`, tabTitle);
    setIsOpen(false);
    setSearchQuery("");
  };

  const handleSelectProject = (proj: Project) => {
    navigate(`/production/${proj.id}`);
    setIsOpen(false);
    setSearchQuery("");
  };

  const { openTab } = useAppTabs();
  
  const handleSelectEstimate = (est: Estimate) => {
    const tabTitle = est.status && est.status !== 'draft' 
      ? `Edit Proposal - ${est.estimate_number}` 
      : `Estimate #${est.estimate_number}`;
    openTab(`/estimate/${est.id}`, tabTitle);
    setIsOpen(false);
    setSearchQuery("");
  };

  const handleSelectContact = (contact: Contact) => {
    navigate(`/contacts/${contact.id}`);
    setIsOpen(false);
    setSearchQuery("");
  };

  const getContactDisplayName = (contact: Contact) => {
    return contact.contact_name || 
      (contact.first_name && contact.last_name 
        ? `${contact.first_name} ${contact.last_name}` 
        : contact.first_name || contact.last_name || "Unknown");
  };

  const totalResults = filteredOpportunities.length + filteredProjects.length + filteredEstimates.length + filteredContacts.length;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="w-[200px] sm:w-[280px] justify-start gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground truncate">Search App Database</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-0" align="start">
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, address, phone, project #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9"
              autoFocus
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
        </div>

        {searchQuery.trim() ? (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "opportunities" | "projects" | "estimates" | "contacts")}>
            <div className="border-b px-3 py-2">
              <TabsList className="grid w-full grid-cols-4 h-8">
                <TabsTrigger value="opportunities" className="text-xs gap-1">
                  <Briefcase className="h-3 w-3" />
                  Opps ({filteredOpportunities.length})
                </TabsTrigger>
                <TabsTrigger value="projects" className="text-xs gap-1">
                  <FolderKanban className="h-3 w-3" />
                  Projects ({filteredProjects.length})
                </TabsTrigger>
                <TabsTrigger value="estimates" className="text-xs gap-1">
                  <FileText className="h-3 w-3" />
                  Est ({filteredEstimates.length})
                </TabsTrigger>
                <TabsTrigger value="contacts" className="text-xs gap-1">
                  <Users className="h-3 w-3" />
                  Contacts ({filteredContacts.length})
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="opportunities" className="m-0">
              <div className="max-h-[280px] overflow-y-auto">
                {filteredOpportunities.length > 0 ? (
                  <div className="p-2">
                    {filteredOpportunities.map((opp) => (
                      <button
                        key={opp.ghl_id}
                        className="w-full text-left p-3 rounded-lg hover:bg-muted/50 transition-colors"
                        onClick={() => handleSelectOpportunity(opp)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium truncate text-sm">
                                {getAddressWithFallback(opp.contact_id, opp.ghl_id, opp.address) || "No address"}
                              </span>
                              {hasUpcomingAppointment(opp.contact_id) && (
                                <CalendarCheck className="h-3.5 w-3.5 text-primary shrink-0" />
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {getContactName(opp.contact_id)}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400 text-xs">
                              {formatCurrency(opp.monetary_value)}
                            </span>
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${getStatusColor(opp.status)}`}>
                              {opp.status || "Unknown"}
                            </Badge>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center text-muted-foreground text-sm">
                    No opportunities found
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="projects" className="m-0">
              <div className="max-h-[280px] overflow-y-auto">
                {filteredProjects.length > 0 ? (
                  <div className="p-2">
                    {filteredProjects.map((proj) => (
                      <button
                        key={proj.id}
                        className="w-full text-left p-3 rounded-lg hover:bg-muted/50 transition-colors"
                        onClick={() => handleSelectProject(proj)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="font-medium truncate text-sm">
                              #{proj.project_number} - {proj.project_address || proj.project_name}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {proj.customer_first_name} {proj.customer_last_name}
                              {proj.primary_salesperson && ` • ${proj.primary_salesperson}`}
                            </div>
                          </div>
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${getProjectStatusColor(proj.project_status)}`}>
                            {proj.project_status || "Unknown"}
                          </Badge>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center text-muted-foreground text-sm">
                    No projects found
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="estimates" className="m-0">
              <div className="max-h-[280px] overflow-y-auto">
                {filteredEstimates.length > 0 ? (
                  <div className="p-2">
                    {filteredEstimates.map((est) => (
                      <button
                        key={est.id}
                        className="w-full text-left p-3 rounded-lg hover:bg-muted/50 transition-colors"
                        onClick={() => handleSelectEstimate(est)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="font-medium truncate text-sm">
                              {est.job_address || est.customer_name || "No address"}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {est.estimate_number && `#${est.estimate_number} • `}
                              {est.customer_name}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400 text-xs">
                              {formatCurrency(est.total)}
                            </span>
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${getEstimateStatusColor(est.status)}`}>
                              {est.status || "Draft"}
                            </Badge>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center text-muted-foreground text-sm">
                    No estimates found
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="contacts" className="m-0">
              <div className="max-h-[280px] overflow-y-auto">
                {filteredContacts.length > 0 ? (
                  <div className="p-2">
                    {filteredContacts.map((contact) => {
                      const address = getAddressFromContact(contact, appointments, contact.ghl_id);
                      return (
                        <button
                          key={contact.id}
                          className="w-full text-left p-3 rounded-lg hover:bg-muted/50 transition-colors"
                          onClick={() => handleSelectContact(contact)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="font-medium truncate text-sm">
                                {getContactDisplayName(contact)}
                              </div>
                              <div className="text-xs text-muted-foreground truncate">
                                {contact.email || contact.phone || "No contact info"}
                              </div>
                              {address && (
                                <div className="text-xs text-muted-foreground truncate mt-0.5">
                                  {address}
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-6 text-center text-muted-foreground text-sm">
                    No contacts found
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="p-6 text-center text-muted-foreground text-sm">
            Start typing to search
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
