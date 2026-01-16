import { useState, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BarChart3, TrendingUp, Users, Megaphone, ChevronLeft, MapPin, Briefcase, Mail, Phone as PhoneIcon, Download, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { extractCustomField, CUSTOM_FIELD_IDS } from "@/lib/utils";
import { toast } from "sonner";
import { OpportunityDetailSheet } from "./OpportunityDetailSheet";

interface Appointment {
  ghl_id: string;
  contact_id: string | null;
  appointment_status: string | null;
  assigned_user_id: string | null;
  salesperson_confirmed?: boolean;
  start_time?: string | null;
  title?: string | null;
  address?: string | null;
  notes?: string | null;
}

interface Contact {
  ghl_id: string;
  source: string | null;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
  custom_fields?: unknown;
}

interface Opportunity {
  ghl_id: string;
  contact_id: string | null;
  status: string | null;
  monetary_value: number | null;
  name?: string | null;
  stage_name?: string | null;
  scope_of_work?: string | null;
  address?: string | null;
}

interface User {
  ghl_id: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
}

type DetailView = 
  | { type: "status"; value: string }
  | { type: "oppStatus"; value: string }
  | { type: "source"; value: string }
  | { type: "rep"; value: string }
  | null;

interface AppointmentsAnalysisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointments: Appointment[];
  contacts: Contact[];
  opportunities: Opportunity[];
  users: User[];
  conversations?: Array<{
    ghl_id: string;
    contact_id: string | null;
  }>;
}

// Helper to format phone numbers
const formatPhoneNumber = (phone: string | null | undefined): string => {
  if (!phone) return "";
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, "");
  // Format as (XXX) XXX-XXXX for 10 digits, or +X (XXX) XXX-XXXX for 11+
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  } else if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return phone; // Return original if format doesn't match
};

// Helper to capitalize names properly
const capitalizeName = (name: string | null | undefined): string => {
  if (!name) return "";
  return name
    .toLowerCase()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

export function AppointmentsAnalysisDialog({
  open,
  onOpenChange,
  appointments,
  contacts,
  opportunities,
  users,
  conversations = [],
}: AppointmentsAnalysisDialogProps) {
  const [detailView, setDetailView] = useState<DetailView>(null);
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null);
  const [opportunitySheetOpen, setOpportunitySheetOpen] = useState(false);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toLocaleString()}`;
  };

  // Helper to normalize source names
  const normalizeSourceName = (sourceName: string): string => {
    if (!sourceName) return "Direct";
    return sourceName
      .toLowerCase()
      .split(/[\s-_]+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Build contact map for lookups
  const contactMap = useMemo(() => {
    const map = new Map<string, Contact>();
    contacts.forEach(c => map.set(c.ghl_id, c));
    return map;
  }, [contacts]);

  // Build user map for lookups
  const userMap = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach(u => {
      const name = u.name || `${u.first_name || ""} ${u.last_name || ""}`.trim() || "Unknown";
      map.set(u.ghl_id, name);
    });
    return map;
  }, [users]);

  // Get opportunity for a contact
  const getOpportunityForContact = useMemo(() => {
    const oppMap = new Map<string, Opportunity>();
    opportunities.forEach(o => {
      if (o.contact_id && !oppMap.has(o.contact_id)) {
        oppMap.set(o.contact_id, o);
      }
    });
    return (contactId: string | null) => contactId ? oppMap.get(contactId) : undefined;
  }, [opportunities]);

  // Filter out cancelled appointments
  const nonCancelledAppointments = useMemo(() => {
    return appointments.filter(a => a.appointment_status?.toLowerCase() !== "cancelled");
  }, [appointments]);

  // Calculate total value of opportunities linked to these appointments
  const totalValue = useMemo(() => {
    const contactIds = new Set(nonCancelledAppointments.map(a => a.contact_id).filter(Boolean));
    let total = 0;
    opportunities.forEach(o => {
      if (o.contact_id && contactIds.has(o.contact_id)) {
        total += o.monetary_value || 0;
      }
    });
    return total;
  }, [nonCancelledAppointments, opportunities]);

  // By Status breakdown
  const byStatus = useMemo(() => {
    const statusMap = new Map<string, { count: number; total: number }>();
    
    nonCancelledAppointments.forEach(apt => {
      const status = apt.appointment_status?.toLowerCase() || "unknown";
      const opp = getOpportunityForContact(apt.contact_id);
      
      if (!statusMap.has(status)) {
        statusMap.set(status, { count: 0, total: 0 });
      }
      const stat = statusMap.get(status)!;
      stat.count++;
      stat.total++;
    });

    // Calculate unique contacts per status for the ratio
    const statusContacts = new Map<string, Set<string>>();
    nonCancelledAppointments.forEach(apt => {
      const status = apt.appointment_status?.toLowerCase() || "unknown";
      if (!statusContacts.has(status)) {
        statusContacts.set(status, new Set());
      }
      if (apt.contact_id) {
        statusContacts.get(status)!.add(apt.contact_id);
      }
    });

    return Array.from(statusMap.entries()).map(([status, data]) => ({
      status,
      count: data.count,
      uniqueContacts: statusContacts.get(status)?.size || 0,
    })).sort((a, b) => b.count - a.count);
  }, [nonCancelledAppointments, getOpportunityForContact]);

  // By Opportunity Status breakdown
  const byOppStatus = useMemo(() => {
    const statusMap = new Map<string, { count: number; value: number }>();
    const seenContacts = new Set<string>();

    nonCancelledAppointments.forEach(apt => {
      if (!apt.contact_id || seenContacts.has(apt.contact_id)) return;
      seenContacts.add(apt.contact_id);

      const opp = getOpportunityForContact(apt.contact_id);
      const status = opp?.status?.toLowerCase() || "no opportunity";
      const value = opp?.monetary_value || 0;

      if (!statusMap.has(status)) {
        statusMap.set(status, { count: 0, value: 0 });
      }
      const stat = statusMap.get(status)!;
      stat.count++;
      stat.value += value;
    });

    return Array.from(statusMap.entries())
      .filter(([status]) => status !== "no opportunity")
      .map(([status, data]) => ({
        status,
        count: data.count,
        value: data.value,
      }))
      .sort((a, b) => b.value - a.value);
  }, [nonCancelledAppointments, getOpportunityForContact]);

  // By Source breakdown
  const bySource = useMemo(() => {
    const sourceMap = new Map<string, { count: number; value: number }>();
    const seenContacts = new Set<string>();

    nonCancelledAppointments.forEach(apt => {
      if (!apt.contact_id || seenContacts.has(apt.contact_id)) return;
      seenContacts.add(apt.contact_id);

      const contact = contactMap.get(apt.contact_id);
      const source = normalizeSourceName(contact?.source || "Direct");
      const opp = getOpportunityForContact(apt.contact_id);
      const value = opp?.monetary_value || 0;

      if (!sourceMap.has(source)) {
        sourceMap.set(source, { count: 0, value: 0 });
      }
      const stat = sourceMap.get(source)!;
      stat.count++;
      stat.value += value;
    });

    return Array.from(sourceMap.entries())
      .map(([source, data]) => ({
        source,
        count: data.count,
        value: data.value,
      }))
      .sort((a, b) => b.value - a.value);
  }, [nonCancelledAppointments, contactMap, getOpportunityForContact]);

  // By Rep breakdown
  const byRep = useMemo(() => {
    const repMap = new Map<string, { count: number; value: number }>();

    nonCancelledAppointments.forEach(apt => {
      const repId = apt.assigned_user_id || "__unassigned__";
      const repName = repId === "__unassigned__" ? "Unassigned" : (userMap.get(repId) || "Unknown");
      const opp = getOpportunityForContact(apt.contact_id);
      const value = opp?.monetary_value || 0;

      if (!repMap.has(repName)) {
        repMap.set(repName, { count: 0, value: 0 });
      }
      const stat = repMap.get(repName)!;
      stat.count++;
      stat.value += value;
    });

    return Array.from(repMap.entries())
      .map(([rep, data]) => ({
        rep,
        count: data.count,
        value: data.value,
      }))
      .sort((a, b) => b.value - a.value);
  }, [nonCancelledAppointments, userMap, getOpportunityForContact]);

  // Get filtered appointments for detail view
  const detailAppointments = useMemo(() => {
    if (!detailView) return [];
    
    return nonCancelledAppointments.filter(apt => {
      switch (detailView.type) {
        case "status":
          return (apt.appointment_status?.toLowerCase() || "unknown") === detailView.value;
        case "oppStatus": {
          const opp = getOpportunityForContact(apt.contact_id);
          return (opp?.status?.toLowerCase() || "no opportunity") === detailView.value;
        }
        case "source": {
          const contact = contactMap.get(apt.contact_id || "");
          return normalizeSourceName(contact?.source || "Direct") === detailView.value;
        }
        case "rep": {
          const repId = apt.assigned_user_id || "__unassigned__";
          const repName = repId === "__unassigned__" ? "Unassigned" : (userMap.get(repId) || "Unknown");
          return repName === detailView.value;
        }
        default:
          return false;
      }
    });
  }, [detailView, nonCancelledAppointments, getOpportunityForContact, contactMap, userMap]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "showed": return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "cancelled": return "bg-red-500/20 text-red-400 border-red-500/30";
      case "noshow": return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      case "confirmed": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      default: return "bg-muted text-muted-foreground border-border";
    }
  };

  const getOppStatusColor = (status: string) => {
    switch (status) {
      case "won": return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "open": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "abandoned": return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      case "lost": return "bg-red-500/20 text-red-400 border-red-500/30";
      default: return "bg-muted text-muted-foreground border-border";
    }
  };

  // Show more/less state for sources
  const [showAllSources, setShowAllSources] = useState(false);
  const displayedSources = showAllSources ? bySource : bySource.slice(0, 4);
  const remainingSources = bySource.length - 4;

  // Reset detail view when dialog closes
  const handleOpenChange = (open: boolean) => {
    if (!open) setDetailView(null);
    onOpenChange(open);
  };

  const getDetailTitle = () => {
    if (!detailView) return "";
    switch (detailView.type) {
      case "status": return `Status: ${detailView.value}`;
      case "oppStatus": return `Opp. Status: ${detailView.value}`;
      case "source": return `Source: ${detailView.value}`;
      case "rep": return `Rep: ${detailView.value}`;
    }
  };

  // Generate PDF for download
  const handleDownloadPDF = useCallback(() => {
    const appointmentsToExport = detailView ? detailAppointments : nonCancelledAppointments;
    const title = detailView ? getDetailTitle() : "Appointments Analysis";
    
    // Build HTML content for PDF
    let tableRows = "";
    appointmentsToExport.forEach(apt => {
      const contact = contactMap.get(apt.contact_id || "");
      const opp = getOpportunityForContact(apt.contact_id);
      const repName = apt.assigned_user_id 
        ? userMap.get(apt.assigned_user_id) || "Unknown"
        : "Unassigned";
      
      const scopeFromOpp = opp?.scope_of_work;
      const scopeFromCustom = extractCustomField(contact?.custom_fields, CUSTOM_FIELD_IDS.SCOPE_OF_WORK);
      const scope = scopeFromOpp || scopeFromCustom || "-";
      
      const addressFromOpp = opp?.address;
      const addressFromCustom = extractCustomField(contact?.custom_fields, CUSTOM_FIELD_IDS.ADDRESS);
      const addressFromAppt = apt.address;
      const address = addressFromOpp || addressFromCustom || addressFromAppt || "-";
      
      const name = capitalizeName(contact?.contact_name || apt.title || "Unknown");
      const phone = formatPhoneNumber(contact?.phone) || "-";
      const email = contact?.email || "-";
      const status = apt.appointment_status || "Unknown";
      const oppStatus = opp ? `${opp.status} - $${(opp.monetary_value || 0).toLocaleString()}` : "-";
      const stage = opp?.stage_name || "-";
      const source = contact?.source ? normalizeSourceName(contact.source) : "-";
      const date = apt.start_time ? new Date(apt.start_time).toLocaleDateString() : "-";
      
      tableRows += `
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px;">${name}</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${phone}</td>
          <td style="border: 1px solid #ddd; padding: 8px; max-width: 150px; word-break: break-word;">${email}</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${scope}</td>
          <td style="border: 1px solid #ddd; padding: 8px; max-width: 180px;">${address}</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${status}</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${oppStatus}</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${stage}</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${source}</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${repName}</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${date}</td>
        </tr>
      `;
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { color: #333; margin-bottom: 5px; }
          .summary { color: #666; margin-bottom: 20px; }
          table { border-collapse: collapse; width: 100%; font-size: 11px; }
          th { background-color: #f4f4f4; border: 1px solid #ddd; padding: 10px; text-align: left; font-weight: bold; }
          td { border: 1px solid #ddd; padding: 8px; vertical-align: top; }
          tr:nth-child(even) { background-color: #f9f9f9; }
          .total { margin-top: 20px; font-weight: bold; font-size: 14px; }
          @media print { body { margin: 0; } }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <p class="summary">Generated on ${new Date().toLocaleDateString()} • ${appointmentsToExport.length} appointment(s) • Total Value: ${formatCurrency(totalValue)}</p>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Scope of Work</th>
              <th>Address</th>
              <th>Appt Status</th>
              <th>Opp Status</th>
              <th>Stage</th>
              <th>Source</th>
              <th>Rep</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </body>
      </html>
    `;

    // Open print dialog which allows saving as PDF
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 250);
      toast.success("PDF ready - use your browser's Save as PDF option");
    } else {
      toast.error("Please allow pop-ups to download PDF");
    }
  }, [detailView, detailAppointments, nonCancelledAppointments, contactMap, getOpportunityForContact, userMap, totalValue]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-xl">Appointments Analysis</DialogTitle>
                <DialogDescription>Executive summary for the selected date range</DialogDescription>
              </div>
            </div>
            {!detailView && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleDownloadPDF}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Download PDF
              </Button>
            )}
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[65vh] pr-4">
          {detailView ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setDetailView(null)}
                  className="gap-2"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back to Summary
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleDownloadPDF}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download PDF
                </Button>
              </div>
              
              <h3 className="font-semibold text-lg">{getDetailTitle()}</h3>
              <p className="text-sm text-muted-foreground">{detailAppointments.length} appointment(s)</p>
              
              <div className="space-y-2">
                {detailAppointments.map(apt => {
                  const contact = contactMap.get(apt.contact_id || "");
                  const opp = getOpportunityForContact(apt.contact_id);
                  const repName = apt.assigned_user_id 
                    ? userMap.get(apt.assigned_user_id) || "Unknown"
                    : "Unassigned";
                  
                  const scopeFromOpp = opp?.scope_of_work;
                  const scopeFromCustom = extractCustomField(contact?.custom_fields, CUSTOM_FIELD_IDS.SCOPE_OF_WORK);
                  const scope = scopeFromOpp || scopeFromCustom;
                  
                  const addressFromOpp = opp?.address;
                  const addressFromCustom = extractCustomField(contact?.custom_fields, CUSTOM_FIELD_IDS.ADDRESS);
                  const addressFromAppt = apt.address;
                  const address = addressFromOpp || addressFromCustom || addressFromAppt;

                  const handleCardClick = () => {
                    if (opp) {
                      setSelectedOpportunity(opp);
                      setOpportunitySheetOpen(true);
                    }
                  };

                  return (
                    <div 
                      key={apt.ghl_id} 
                      className={`p-4 rounded-lg border bg-card transition-colors ${opp ? 'cursor-pointer hover:bg-accent/50' : ''}`}
                      onClick={handleCardClick}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate text-base">
                            {capitalizeName(contact?.contact_name || apt.title || "Unknown Contact")}
                          </p>
                          
                          {/* Contact info row */}
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground mt-1">
                            {contact?.phone && (
                              <span className="flex items-center gap-1">
                                <PhoneIcon className="h-3 w-3" />
                                {formatPhoneNumber(contact.phone)}
                              </span>
                            )}
                            {contact?.email && (
                              <span className="flex items-center gap-1 truncate max-w-[200px]">
                                <Mail className="h-3 w-3" />
                                {contact.email}
                              </span>
                            )}
                          </div>
                          
                          {/* Scope of Work */}
                          {scope && (
                            <div className="flex items-start gap-1.5 text-sm mt-2">
                              <Briefcase className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                              <span className="text-primary font-medium">{scope}</span>
                            </div>
                          )}
                          
                          {/* Address */}
                          {address && (
                            <div className="flex items-start gap-1.5 text-xs text-muted-foreground mt-1">
                              <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                              <span className="truncate">{address}</span>
                            </div>
                          )}
                          
                          {/* Badges row */}
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <Badge variant="outline" className={`text-xs ${getStatusColor(apt.appointment_status?.toLowerCase() || "")}`}>
                              {apt.appointment_status || "Unknown"}
                            </Badge>
                            {opp && (
                              <>
                                <Badge variant="outline" className={`text-xs ${getOppStatusColor(opp.status?.toLowerCase() || "")}`}>
                                  {opp.status} - {formatCurrency(opp.monetary_value || 0)}
                                </Badge>
                                {opp.stage_name && (
                                  <Badge variant="outline" className="text-xs bg-slate-500/20 text-slate-400 border-slate-500/30">
                                    {opp.stage_name}
                                  </Badge>
                                )}
                              </>
                            )}
                            {contact?.source && (
                              <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-400 border-purple-500/30">
                                {normalizeSourceName(contact.source)}
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        {/* Right side - rep, date, and chevron */}
                        <div className="flex items-center gap-2">
                          <div className="text-right text-sm shrink-0">
                            <p className="text-muted-foreground font-medium">{repName}</p>
                            {apt.start_time && (
                              <p className="text-xs text-muted-foreground">
                                {new Date(apt.start_time).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                          {opp && (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Total Value */}
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">Total Value:</span>
                <Badge variant="outline" className="text-lg font-bold bg-primary/10 text-primary border-primary/30 px-3 py-1">
                  {formatCurrency(totalValue)}
                </Badge>
              </div>

              {/* By Status */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <TrendingUp className="h-4 w-4" />
                  By Status:
                </div>
                <div className="flex flex-wrap gap-2">
                  {byStatus.map(({ status, count, uniqueContacts }) => (
                    <Badge 
                      key={status} 
                      variant="outline" 
                      className={`${getStatusColor(status)} px-3 py-1 cursor-pointer hover:opacity-80 transition-opacity`}
                      onClick={() => setDetailView({ type: "status", value: status })}
                    >
                      {status}: {count}/{uniqueContacts}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* By Opp. Status */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  By Opp. Status:
                </div>
                <div className="flex flex-wrap gap-2">
                  {byOppStatus.map(({ status, count, value }) => (
                    <Badge 
                      key={status} 
                      variant="outline" 
                      className={`${getOppStatusColor(status)} px-3 py-1 cursor-pointer hover:opacity-80 transition-opacity`}
                      onClick={() => setDetailView({ type: "oppStatus", value: status })}
                    >
                      {status}: {count} ({formatCurrency(value)})
                    </Badge>
                  ))}
                </div>
              </div>

              {/* By Source */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Megaphone className="h-4 w-4" />
                  By Source:
                </div>
                <div className="flex flex-wrap gap-2">
                  {displayedSources.map(({ source, count, value }) => (
                    <Badge 
                      key={source} 
                      variant="outline" 
                      className="bg-card border-border px-3 py-1 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => setDetailView({ type: "source", value: source })}
                    >
                      {source}: {count} ({formatCurrency(value)})
                    </Badge>
                  ))}
                  {remainingSources > 0 && !showAllSources && (
                    <Badge 
                      variant="outline" 
                      className="bg-muted/50 border-border px-3 py-1 cursor-pointer hover:bg-muted"
                      onClick={() => setShowAllSources(true)}
                    >
                      +{remainingSources} more ▼
                    </Badge>
                  )}
                  {showAllSources && bySource.length > 4 && (
                    <Badge 
                      variant="outline" 
                      className="bg-muted/50 border-border px-3 py-1 cursor-pointer hover:bg-muted"
                      onClick={() => setShowAllSources(false)}
                    >
                      Show less ▲
                    </Badge>
                  )}
                </div>
              </div>

              {/* By Rep */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Users className="h-4 w-4" />
                  By Rep:
                </div>
                <div className="flex flex-wrap gap-2">
                  {byRep.map(({ rep, count, value }) => (
                    <Badge 
                      key={rep} 
                      variant="outline" 
                      className="bg-card border-border px-3 py-1 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => setDetailView({ type: "rep", value: rep })}
                    >
                      {rep}: {count} ({value > 0 ? formatCurrency(value) : "-"})
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}
        </ScrollArea>
      </DialogContent>

      {/* Opportunity Detail Sheet */}
      <OpportunityDetailSheet
        opportunity={selectedOpportunity as any}
        appointments={appointments as any}
        contacts={contacts as any}
        users={users as any}
        conversations={conversations as any}
        open={opportunitySheetOpen}
        onOpenChange={setOpportunitySheetOpen}
        allOpportunities={opportunities as any}
      />
    </Dialog>
  );
}