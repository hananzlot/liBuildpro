import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, Briefcase, FolderKanban, FileText, CalendarCheck, Users, DollarSign } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { useUnifiedMode } from "@/hooks/useUnifiedMode";
import { useAppTabs } from "@/contexts/AppTabsContext";
import { useAuth } from "@/contexts/AuthContext";
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
import { formatCurrencyWithDecimals as formatCurrencyUtil } from "@/lib/utils";

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
  opportunity_number: number | null;
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
  const { isAdmin, isProduction, isContractManager } = useAuth();
  const { openTab } = useAppTabs();
  const { isUnified, companyIds, queryKeySuffix } = useUnifiedMode();
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  // Helper to apply company filter - uses .in() for unified mode, .eq() otherwise
  const applyCompanyFilter = (query: any) => {
    if (isUnified && companyIds.length > 1) {
      return query.in("company_id", companyIds);
    }
    return query.eq("company_id", companyId);
  };
  
  // Determine which tabs are visible based on user role
  // Admin: all tabs
  // Dispatch (default): opportunities only
  // Production: projects only
  // Contract Manager: estimates only
  const canSeeOpportunities = isAdmin || (!isProduction && !isContractManager); // Dispatch or Admin
  const canSeeProjects = isAdmin || isProduction;
  const canSeeEstimates = isAdmin || isContractManager;
  const canSeeContacts = isAdmin;
  
  // Determine default tab based on role
  const getDefaultTab = () => {
    if (canSeeOpportunities) return "opportunities";
    if (canSeeProjects) return "projects";
    if (canSeeEstimates) return "estimates";
    return "opportunities";
  };
  
  const [activeTab, setActiveTab] = useState<"opportunities" | "projects" | "estimates" | "contacts">(getDefaultTab());
  
  // Update active tab if current tab becomes invisible due to role
  useEffect(() => {
    if (
      (activeTab === "opportunities" && !canSeeOpportunities) ||
      (activeTab === "projects" && !canSeeProjects) ||
      (activeTab === "estimates" && !canSeeEstimates) ||
      (activeTab === "contacts" && !canSeeContacts)
    ) {
      setActiveTab(getDefaultTab());
    }
  }, [activeTab, canSeeOpportunities, canSeeProjects, canSeeEstimates, canSeeContacts]);

  // Fetch opportunities for search
  const { data: opportunities = [] } = useQuery({
    queryKey: ["global-search-opportunities", queryKeySuffix],
    queryFn: async () => {
      return fetchAllPages<Opportunity>(async (from, to) => {
        let query = supabase
          .from("opportunities")
          .select(
            "ghl_id, name, status, monetary_value, pipeline_stage_id, stage_name, contact_id, ghl_date_added, address, opportunity_number"
          );
        query = applyCompanyFilter(query);
        const { data, error } = await query
          .order("ghl_date_added", { ascending: false })
          .range(from, to);

        if (error) throw error;
        return data as Opportunity[];
      });
    },
    enabled: (!!companyId || (isUnified && companyIds.length > 0)) && isOpen,
    staleTime: 60 * 1000,
  });

  // Fetch contacts for name lookups
  const { data: contacts = [] } = useQuery({
    queryKey: ["global-search-contacts", queryKeySuffix],
    queryFn: async () => {
      return fetchAllPages<Contact>(async (from, to) => {
        let query = supabase
          .from("contacts")
          .select("id, ghl_id, contact_name, first_name, last_name, email, phone, custom_fields");
        query = applyCompanyFilter(query);
        const { data, error } = await query
          .order("ghl_date_added", { ascending: false })
          .range(from, to);

        if (error) throw error;
        return data as Contact[];
      });
    },
    enabled: (!!companyId || (isUnified && companyIds.length > 0)) && isOpen,
    staleTime: 60 * 1000,
  });

  // Fetch appointments for address lookups and upcoming appointment checks
  const { data: appointments = [] } = useQuery({
    queryKey: ["global-search-appointments", queryKeySuffix],
    queryFn: async () => {
      let query = supabase
        .from("appointments")
        .select("ghl_id, contact_id, address, start_time");
      query = applyCompanyFilter(query);
      const { data, error } = await query.limit(1000);
      if (error) throw error;
      return data as Appointment[];
    },
    enabled: (!!companyId || (isUnified && companyIds.length > 0)) && isOpen,
    staleTime: 60 * 1000,
  });

  // Fetch projects for search (also used for opportunity address lookup)
  const { data: projects = [] } = useQuery({
    queryKey: ["global-search-projects", queryKeySuffix],
    queryFn: async () => {
      let query = supabase
        .from("projects")
        .select("id, project_number, project_name, project_status, customer_first_name, customer_last_name, project_address, primary_salesperson, cell_phone, opportunity_id");
      query = applyCompanyFilter(query);
      const { data, error } = await query
        .is("deleted_at", null)
        .order("project_number", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as (Project & { opportunity_id?: string | null })[];
    },
    enabled: (!!companyId || (isUnified && companyIds.length > 0)) && isOpen,
    staleTime: 60 * 1000,
  });

  // Fetch estimates for search
  const { data: estimates = [] } = useQuery({
    queryKey: ["global-search-estimates", queryKeySuffix],
    queryFn: async () => {
      let query = supabase
        .from("estimates")
        .select("id, estimate_number, customer_name, job_address, status, total, created_at");
      query = applyCompanyFilter(query);
      const { data, error } = await query
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as Estimate[];
    },
    enabled: (!!companyId || (isUnified && companyIds.length > 0)) && isOpen,
    staleTime: 60 * 1000,
  });

  // Detect if search query looks like a dollar amount (e.g., "1134.71", "$1,134.71")
  const parsedAmount = useMemo(() => {
    const cleaned = searchQuery.replace(/[$,\s]/g, "");
    const num = parseFloat(cleaned);
    if (!isNaN(num) && num > 0 && /^\d+(\.\d{1,2})?$/.test(cleaned)) {
      return num;
    }
    return null;
  }, [searchQuery]);

  // Fetch financial records matching dollar amount or reference number
  interface FinancialMatch {
    project_id: string;
    record_id: string;
    amount: number;
    type: 'bill' | 'invoice' | 'payment' | 'bill_payment';
    description: string;
    trx_date: string | null;
  }

  // Detect if search looks like a reference/check number (alphanumeric, not a pure dollar amount)
  const refSearchQuery = useMemo(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed || trimmed.length < 2) return null;
    // Strip common prefixes: "ref#", "ref #", "ref:", "check#", "check ", "chk#", "inv#", leading "#"
    let cleaned = trimmed.replace(/^(ref\s*#?\s*|check\s*#?\s*|chk\s*#?\s*|inv\s*#?\s*|#)/i, '').trim();
    if (!cleaned || cleaned.length < 1) return null;
    // Allow pure numbers too — they could be reference/check numbers
    return cleaned;
  }, [searchQuery]);

  const { data: financialMatches = [] } = useQuery({
    queryKey: ["global-search-financials", queryKeySuffix, parsedAmount],
    queryFn: async (): Promise<FinancialMatch[]> => {
      if (!parsedAmount) return [];
      const results: FinancialMatch[] = [];
      
      let billsQuery = supabase
        .from("project_bills")
        .select("id, project_id, bill_amount, installer_company, bill_ref, created_at");
      billsQuery = applyCompanyFilter(billsQuery);
      
      let invoicesQuery = supabase
        .from("project_invoices")
        .select("id, project_id, amount, invoice_number, invoice_date");
      invoicesQuery = applyCompanyFilter(invoicesQuery);
      
      let paymentsQuery = supabase
        .from("project_payments")
        .select("id, project_id, payment_amount, check_number, created_at");
      paymentsQuery = applyCompanyFilter(paymentsQuery);

      let billPaymentsQuery = supabase
        .from("bill_payments")
        .select("id, bill_id, payment_amount, payment_date, payment_reference");
      billPaymentsQuery = applyCompanyFilter(billPaymentsQuery);

      const [billsRes, invoicesRes, paymentsRes, billPaymentsRes] = await Promise.all([
        billsQuery.eq("is_voided", false).eq("bill_amount", parsedAmount).limit(20),
        invoicesQuery.eq("amount", parsedAmount).limit(20),
        paymentsQuery.eq("is_voided", false).eq("payment_amount", parsedAmount).limit(20),
        billPaymentsQuery.eq("payment_amount", parsedAmount).limit(20),
      ]);

      billsRes.data?.forEach(b => {
        if (b.project_id) results.push({
          project_id: b.project_id,
          record_id: b.id,
          amount: b.bill_amount!,
          type: 'bill',
          description: [b.installer_company, b.bill_ref].filter(Boolean).join(' • ') || 'Bill',
          trx_date: b.created_at,
        });
      });
      invoicesRes.data?.forEach(i => {
        if (i.project_id) results.push({
          project_id: i.project_id,
          record_id: i.id,
          amount: i.amount!,
          type: 'invoice',
          description: i.invoice_number ? `Invoice #${i.invoice_number}` : 'Invoice',
          trx_date: i.invoice_date,
        });
      });
      paymentsRes.data?.forEach(p => {
        if (p.project_id) results.push({
          project_id: p.project_id,
          record_id: p.id,
          amount: p.payment_amount!,
          type: 'payment',
          description: p.check_number ? `Check #${p.check_number}` : 'Payment',
          trx_date: p.created_at,
        });
      });

      // For bill payments, we need to resolve the project_id via the bill
      if (billPaymentsRes.data?.length) {
        const billIds = [...new Set(billPaymentsRes.data.map(bp => bp.bill_id))];
        const { data: bills } = await supabase
          .from("project_bills")
          .select("id, project_id")
          .in("id", billIds);
        const billProjectMap = new Map(bills?.map(b => [b.id, b.project_id]) || []);
        
        billPaymentsRes.data.forEach(bp => {
          const projectId = billProjectMap.get(bp.bill_id);
          if (projectId) results.push({
            project_id: projectId,
            record_id: bp.id,
            amount: bp.payment_amount!,
            type: 'bill_payment',
            description: bp.payment_reference ? `Bill Pmt Ref #${bp.payment_reference}` : 'Bill Payment',
            trx_date: bp.payment_date,
          });
        });
      }
      
      return results;
    },
    enabled: (!!companyId || (isUnified && companyIds.length > 0)) && isOpen && parsedAmount !== null,
    staleTime: 30 * 1000,
  });

  // Search financial records by reference/check number
  const { data: refFinancialMatches = [] } = useQuery({
    queryKey: ["global-search-financials-ref", queryKeySuffix, refSearchQuery],
    queryFn: async (): Promise<FinancialMatch[]> => {
      if (!refSearchQuery) return [];
      const results: FinancialMatch[] = [];

      let paymentsQuery = supabase
        .from("project_payments")
        .select("id, project_id, payment_amount, check_number, created_at");
      paymentsQuery = applyCompanyFilter(paymentsQuery);

      let billPaymentsQuery = supabase
        .from("bill_payments")
        .select("id, bill_id, payment_amount, payment_date, payment_reference");
      billPaymentsQuery = applyCompanyFilter(billPaymentsQuery);

      let invoicesQuery = supabase
        .from("project_invoices")
        .select("id, project_id, amount, invoice_number, invoice_date");
      invoicesQuery = applyCompanyFilter(invoicesQuery);

      let billsQuery = supabase
        .from("project_bills")
        .select("id, project_id, bill_amount, installer_company, bill_ref, created_at");
      billsQuery = applyCompanyFilter(billsQuery);

      const [paymentsRes, billPaymentsRes, invoicesRes, billsRes] = await Promise.all([
        paymentsQuery.eq("is_voided", false).eq("check_number", refSearchQuery).limit(20),
        billPaymentsQuery.eq("payment_reference", refSearchQuery).limit(20),
        invoicesQuery.eq("invoice_number", refSearchQuery).limit(20),
        billsQuery.eq("is_voided", false).eq("bill_ref", refSearchQuery).limit(20),
      ]);

      paymentsRes.data?.forEach(p => {
        if (p.project_id) results.push({
          project_id: p.project_id,
          record_id: p.id,
          amount: p.payment_amount!,
          type: 'payment',
          description: p.check_number ? `Check #${p.check_number}` : 'Payment',
          trx_date: p.created_at,
        });
      });

      invoicesRes.data?.forEach(i => {
        if (i.project_id) results.push({
          project_id: i.project_id,
          record_id: i.id,
          amount: i.amount!,
          type: 'invoice',
          description: `Invoice #${i.invoice_number}`,
          trx_date: i.invoice_date,
        });
      });

      billsRes.data?.forEach(b => {
        if (b.project_id) results.push({
          project_id: b.project_id,
          record_id: b.id,
          amount: b.bill_amount!,
          type: 'bill',
          description: [b.installer_company, b.bill_ref].filter(Boolean).join(' • ') || 'Bill',
          trx_date: b.created_at,
        });
      });

      // Resolve bill payments to projects
      if (billPaymentsRes.data?.length) {
        const billIds = [...new Set(billPaymentsRes.data.map(bp => bp.bill_id))];
        const { data: bills } = await supabase
          .from("project_bills")
          .select("id, project_id")
          .in("id", billIds);
        const billProjectMap = new Map(bills?.map(b => [b.id, b.project_id]) || []);
        
        billPaymentsRes.data.forEach(bp => {
          const projectId = billProjectMap.get(bp.bill_id);
          if (projectId) results.push({
            project_id: projectId,
            record_id: bp.id,
            amount: bp.payment_amount!,
            type: 'bill_payment',
            description: bp.payment_reference ? `Bill Pmt Ref #${bp.payment_reference}` : 'Bill Payment',
            trx_date: bp.payment_date,
          });
        });
      }

      return results;
    },
    enabled: (!!companyId || (isUnified && companyIds.length > 0)) && isOpen && refSearchQuery !== null,
    staleTime: 30 * 1000,
  });

  // Combine amount-based and ref-based financial matches
  const allFinancialMatches = useMemo(() => {
    const combined = [...financialMatches, ...refFinancialMatches];
    // Deduplicate by record_id
    const seen = new Set<string>();
    return combined.filter(m => {
      if (seen.has(m.record_id)) return false;
      seen.add(m.record_id);
      return true;
    });
  }, [financialMatches, refFinancialMatches]);

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
        const address = (getAddressWithFallback(opp.contact_id, opp.ghl_id, opp.address) || "").toLowerCase();
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

  // Build a map of project IDs to their financial matches
  const financialMatchesByProject = useMemo(() => {
    const map = new Map<string, FinancialMatch[]>();
    for (const match of allFinancialMatches) {
      const existing = map.get(match.project_id) || [];
      existing.push(match);
      map.set(match.project_id, existing);
    }
    return map;
  }, [allFinancialMatches]);

  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return [];
    
    const queryLower = searchQuery.toLowerCase().trim();
    const queryDigits = searchQuery.replace(/\D/g, "");
    const isPhoneSearch = /^\d+$/.test(queryLower.replace(/[\s\-\(\)]/g, ""));
    
    // Standard text/phone matches
    const textMatches = (projects as Project[])
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
      });

    // Financial amount matches — add projects not already in text matches
    const textMatchIds = new Set(textMatches.map(p => p.id));
    const financialProjectMatches = (projects as Project[])
      .filter(proj => financialMatchesByProject.has(proj.id) && !textMatchIds.has(proj.id));

    return [...textMatches, ...financialProjectMatches].slice(0, 12);
  }, [searchQuery, projects, financialMatchesByProject]);

  const filteredEstimates = useMemo(() => {
    if (!searchQuery.trim()) return [];
    
    const queryLower = searchQuery.toLowerCase().trim();
    
    return estimates
      .filter((est) => {
        const customerName = est.customer_name?.toLowerCase() || "";
        const address = est.job_address?.toLowerCase() || "";
        const estimateNum = est.estimate_number?.toString() || "";
        
        // Check if search matches estimate/proposal total (within rounding tolerance)
        const amountMatch = parsedAmount !== null && est.total !== null && Math.abs(est.total - parsedAmount) < 0.05;
        
        return (
          customerName.includes(queryLower) ||
          address.includes(queryLower) ||
          estimateNum.includes(searchQuery.trim()) ||
          amountMatch
        );
      })
      .slice(0, 8);
  }, [searchQuery, estimates, parsedAmount]);

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
        const address = (getAddressFromContact(contact, appointments, contact.ghl_id) || "").toLowerCase();
        
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
    const customerName = getContactName(opp.contact_id);
    const oppNum = opp.opportunity_number;
    const tabTitle = oppNum 
      ? `Opp ${oppNum}${customerName && customerName !== 'Unknown' ? ` (${customerName})` : ''}`
      : opp.name || 'Opportunity';
    openTab(`/opportunity/${opp.ghl_id}`, tabTitle);
    setIsOpen(false);
    setSearchQuery("");
  };

  const handleSelectProject = (proj: Project, financialMatch?: FinancialMatch) => {
    const customerName = [proj.customer_first_name, proj.customer_last_name].filter(Boolean).join(' ').trim();
    const tabTitle = customerName 
      ? `Project ${proj.project_number} (${customerName})`
      : `Project ${proj.project_number}`;
    
    let url = `/project/${proj.id}`;
    if (financialMatch) {
      if (financialMatch.type === 'bill') {
        url = `/project/${proj.id}?tab=finance&financeTab=bills&highlightBillId=${financialMatch.record_id}`;
      } else if (financialMatch.type === 'invoice') {
        url = `/project/${proj.id}?tab=finance&financeTab=invoices&highlightInvoice=${financialMatch.record_id}`;
      } else if (financialMatch.type === 'payment') {
        url = `/project/${proj.id}?tab=finance&financeTab=payments&highlightPaymentId=${financialMatch.record_id}`;
      } else if (financialMatch.type === 'bill_payment') {
        url = `/project/${proj.id}?tab=finance&financeTab=bills&highlightBillId=${financialMatch.record_id}`;
      }
    }
    
    openTab(url, tabTitle);
    setIsOpen(false);
    setSearchQuery("");
  };
  
  const handleSelectEstimate = (est: Estimate) => {
    const tabTitle = est.status && est.status !== 'draft' 
      ? `Prop ${est.customer_name} (#${est.estimate_number})` 
      : `Est ${est.customer_name} (#${est.estimate_number})`;
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
          <span className="text-muted-foreground truncate">Search for Anything</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-0" align="start">
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Name, address, phone, project #, $ amount, check #..."
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
              <TabsList className="grid w-full h-8" style={{ 
                gridTemplateColumns: `repeat(${[canSeeOpportunities, canSeeProjects, canSeeEstimates, canSeeContacts].filter(Boolean).length}, 1fr)` 
              }}>
                {canSeeOpportunities && (
                  <TabsTrigger value="opportunities" className="text-xs gap-1">
                    <Briefcase className="h-3 w-3" />
                    Opps ({filteredOpportunities.length})
                  </TabsTrigger>
                )}
                {canSeeProjects && (
                  <TabsTrigger value="projects" className="text-xs gap-1">
                    <FolderKanban className="h-3 w-3" />
                    Projects ({filteredProjects.length})
                  </TabsTrigger>
                )}
                {canSeeEstimates && (
                  <TabsTrigger value="estimates" className="text-xs gap-1">
                    <FileText className="h-3 w-3" />
                    Est ({filteredEstimates.length})
                  </TabsTrigger>
                )}
                {canSeeContacts && (
                  <TabsTrigger value="contacts" className="text-xs gap-1">
                    <Users className="h-3 w-3" />
                    Contacts ({filteredContacts.length})
                  </TabsTrigger>
                )}
              </TabsList>
            </div>

            {canSeeOpportunities && (
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
            )}

            {canSeeProjects && (
              <TabsContent value="projects" className="m-0">
                <div className="max-h-[280px] overflow-y-auto">
                  {filteredProjects.length > 0 ? (
                    <div className="p-2">
                      {filteredProjects.map((proj) => {
                        const finMatches = financialMatchesByProject.get(proj.id);
                        return (
                          <div
                            key={proj.id}
                            className="w-full text-left p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
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
                                {finMatches && finMatches.map((fm, i) => (
                                  <div
                                    key={i}
                                    className="flex items-center gap-1 mt-1 text-xs cursor-pointer hover:underline"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSelectProject(proj, fm);
                                    }}
                                  >
                                    <DollarSign className="h-3 w-3 text-primary" />
                                    <span className="font-medium text-primary">
                                      {formatCurrencyUtil(fm.amount)}
                                    </span>
                                    <span className="text-muted-foreground">
                                      — {fm.type === 'bill' ? 'Bill' : fm.type === 'invoice' ? 'Invoice' : fm.type === 'bill_payment' ? 'Bill Pmt' : 'Payment'}: {fm.description}
                                    </span>
                                    {fm.trx_date && (
                                      <span className="text-muted-foreground ml-1">
                                        ({new Date(fm.trx_date).toLocaleDateString()})
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${getProjectStatusColor(proj.project_status)}`}>
                                {proj.project_status || "Unknown"}
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-6 text-center text-muted-foreground text-sm">
                      No projects found
                    </div>
                  )}
                </div>
              </TabsContent>
            )}

            {canSeeEstimates && (
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
            )}

            {canSeeContacts && (
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
            )}
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
