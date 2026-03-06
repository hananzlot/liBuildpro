import { useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, X } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency } from "@/lib/utils";

interface CommissionInvoiceData {
  salespersonName: string;
  commissionPct: number;
  commissionAmount: number;
  earnedToDate: number;
  paid: number;
  balanceToDate: number;
  balance: number;
}

interface CommissionInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  salesperson: CommissionInvoiceData | null;
  projectName?: string | null;
  projectAddress?: string | null;
  projectNumber?: number | null;
  totalContracts: number;
  totalPaymentsReceived: number;
  totalBillsPaid: number;
  leadCostPercent: number;
  commissionSplitPct: number;
}

export function CommissionInvoiceDialog({
  open,
  onOpenChange,
  salesperson,
  projectName,
  projectAddress,
  projectNumber,
  totalContracts,
  totalPaymentsReceived,
  totalBillsPaid,
  leadCostPercent,
  commissionSplitPct,
}: CommissionInvoiceDialogProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const { company } = useAuth();

  if (!salesperson) return null;

  const companyName = company?.name || "Company";
  const companyAddress = company?.address || "";
  const companyPhone = company?.phone || "";
  const companyEmail = company?.email || "";
  const companyLogo = company?.logo_url || "";

  const today = format(new Date(), "MMMM d, yyyy");
  const leadCostOnReceived = totalPaymentsReceived * (leadCostPercent / 100);
  const earnedProfit = totalPaymentsReceived - totalBillsPaid - leadCostOnReceived;

  const getHtml = () => {
    const el = printRef.current;
    if (!el) return null;
    return `<!DOCTYPE html>
<html>
<head>
  <title>Commission Invoice - ${salesperson.salespersonName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1a1a1a; background: #fff; }
    .page { max-width: 800px; margin: 0 auto; padding: 40px; }
    @media print {
      body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      .page { padding: 20px; }
    }
  </style>
</head>
<body>
  ${el.innerHTML}
</body>
</html>`;
  };

  const handlePrint = () => {
    const html = getHtml();
    if (!html) return;
    const w = window.open("", "_blank", "width=800,height=1100");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 250);
  };

  const tblRow = (label: string, value: string, opts?: { bold?: boolean; color?: string; indent?: boolean; border?: boolean }) => {
    const bg = opts?.bold ? "#f8fafc" : "transparent";
    const fw = opts?.bold ? "700" : "400";
    const c = opts?.color || "#333";
    const pl = opts?.indent ? "32px" : "16px";
    const bt = opts?.border ? "2px solid #2563eb" : "1px solid #eee";
    return `<tr style="border-bottom: ${bt}; background: ${bg};">
      <td style="padding: 10px 16px 10px ${pl}; font-size: 13px; font-weight: ${fw}; color: ${c};">${label}</td>
      <td style="padding: 10px 16px; font-size: 13px; font-weight: ${fw}; color: ${c}; text-align: right;">${value}</td>
    </tr>`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[95vh] overflow-y-auto p-0">
        {/* Toolbar */}
        <div className="sticky top-0 z-10 flex items-center justify-between bg-background border-b px-4 py-3">
          <DialogHeader className="p-0">
            <DialogTitle className="text-base">Commission Invoice</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="sm" className="text-xs gap-1.5" onClick={() => onOpenChange(false)}>
              <X className="h-3.5 w-3.5" />
              Close
            </Button>
            <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => { handlePrint(); onOpenChange(false); }}>
              <Printer className="h-3.5 w-3.5" />
              Print
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div ref={printRef}>
            <div className="page" style={{ maxWidth: 800, margin: "0 auto", fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif", color: "#1a1a1a" }}>
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 40 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#333", marginBottom: 4 }}>From:</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#111", marginBottom: 4 }}>{salesperson.salespersonName}</div>
                  <div style={{ fontSize: 12, color: "#888", marginTop: 8 }}>Commission Invoice</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "#2563eb", letterSpacing: 2, textTransform: "uppercase" as const }}>
                    INVOICE
                  </div>
                  <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>
                    Date: {today}
                  </div>
                </div>
              </div>

              {/* Bill To / Project */}
              <div style={{ display: "flex", gap: 40, marginBottom: 32 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: 1.5, color: "#2563eb", marginBottom: 8 }}>
                    Bill To
                  </div>
                  {companyLogo && (
                    <img src={companyLogo} alt={companyName} style={{ maxHeight: 40, maxWidth: 160, objectFit: "contain", marginBottom: 6, display: "block" }} />
                  )}
                  <div style={{ fontSize: 16, fontWeight: 600, color: "#111", marginBottom: 4 }}>{companyName}</div>
                  {companyAddress && <div style={{ fontSize: 12, color: "#666", lineHeight: 1.6 }}>{companyAddress}</div>}
                  {companyPhone && <div style={{ fontSize: 12, color: "#666", lineHeight: 1.6 }}>{companyPhone}</div>}
                  {companyEmail && <div style={{ fontSize: 12, color: "#666", lineHeight: 1.6 }}>{companyEmail}</div>}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: 1.5, color: "#2563eb", marginBottom: 8 }}>
                    Project Details
                  </div>
                  {projectNumber && (
                    <div style={{ marginBottom: 6 }}>
                      <div style={{ fontSize: 12, color: "#888" }}>Project #</div>
                      <div style={{ fontSize: 13, color: "#333", fontWeight: 500 }}>{projectNumber}</div>
                    </div>
                  )}
                  {projectName && (
                    <div style={{ marginBottom: 6 }}>
                      <div style={{ fontSize: 12, color: "#888" }}>Project</div>
                      <div style={{ fontSize: 13, color: "#333", fontWeight: 500 }}>{projectName}</div>
                    </div>
                  )}
                  {projectAddress && (
                    <div>
                      <div style={{ fontSize: 12, color: "#888" }}>Address</div>
                      <div style={{ fontSize: 13, color: "#333", fontWeight: 500 }}>{projectAddress}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Calculation Breakdown */}
              <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24 }}>
                <thead>
                  <tr>
                    <th style={{ background: "#2563eb", color: "#fff", fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: 1, padding: "10px 16px", textAlign: "left" }}>
                      Commission Calculation
                    </th>
                    <th style={{ background: "#2563eb", color: "#fff", fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: 1, padding: "10px 16px", textAlign: "right" }}>
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody
                  dangerouslySetInnerHTML={{
                    __html: [
                      tblRow("Total Contracts (Sold)", formatCurrency(totalContracts)),
                      tblRow("Collected to Date", formatCurrency(totalPaymentsReceived)),
                      tblRow("Less: Bills Paid", formatCurrency(-totalBillsPaid), { indent: true }),
                      tblRow(`Less: Lead Cost (${leadCostPercent}% of Collected)`, formatCurrency(-leadCostOnReceived), { indent: true }),
                      tblRow("Earned Profit (Collected − Bills − Lead Cost)", formatCurrency(earnedProfit), { bold: true }),
                      tblRow(`Commission Split (${commissionSplitPct}%)`, `× ${commissionSplitPct}%`, { indent: true }),
                      tblRow(`Salesperson Share (${salesperson.commissionPct}%)`, `× ${salesperson.commissionPct}%`, { indent: true }),
                      tblRow("Commission Earned to Date", formatCurrency(salesperson.earnedToDate), { bold: true, color: "#2563eb" }),
                      tblRow("Less: Payments Already Made", formatCurrency(-salesperson.paid), { indent: true }),
                      tblRow("Balance Due to Date", formatCurrency(salesperson.balanceToDate), { bold: true, color: salesperson.balanceToDate > 0 ? "#d97706" : "#16a34a", border: true }),
                    ].join(""),
                  }}
                />
              </table>

              {/* Summary Box */}
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 32 }}>
                <div style={{ width: 300, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13, color: "#555" }}>
                    <span>Commission (Full Project)</span>
                    <span style={{ fontWeight: 600, color: "#111" }}>{formatCurrency(salesperson.commissionAmount)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13, color: "#555" }}>
                    <span>Earned to Date</span>
                    <span style={{ fontWeight: 600, color: "#2563eb" }}>{formatCurrency(salesperson.earnedToDate)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13, color: "#555" }}>
                    <span>Paid to Date</span>
                    <span style={{ fontWeight: 600, color: "#16a34a" }}>{formatCurrency(salesperson.paid)}</span>
                  </div>
                  <div style={{
                    display: "flex", justifyContent: "space-between",
                    padding: "10px 0 4px", marginTop: 8,
                    borderTop: "2px solid #2563eb",
                    fontSize: 18, fontWeight: 700, color: salesperson.balanceToDate > 0 ? "#d97706" : "#16a34a"
                  }}>
                    <span>Amount Due</span>
                    <span>{formatCurrency(Math.max(0, salesperson.balanceToDate))}</span>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div style={{ textAlign: "center", paddingTop: 24, borderTop: "1px solid #eee" }}>
                <div style={{ fontSize: 12, color: "#888", lineHeight: 1.8 }}>
                  This invoice was generated on {today}.
                  {companyPhone && <><br />Questions? Contact {companyName} at {companyPhone}</>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
