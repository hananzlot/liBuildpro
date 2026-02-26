import { useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Download, X, Mail, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

interface InvoicePdfData {
  invoice_number: string | null;
  invoice_date: string | null;
  amount: number | null;
  open_balance?: number | null;
  payments_received?: number | null;
  agreement_number?: string | null;
  phase_name?: string | null;
  description_of_work?: string | null;
}

interface ProjectData {
  project_name?: string | null;
  customer_first_name?: string | null;
  customer_last_name?: string | null;
  job_address?: string | null;
  project_address?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  cell_phone?: string | null;
  home_phone?: string | null;
}

interface InvoicePdfDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: InvoicePdfData | null;
  project?: ProjectData | null;
}

export function InvoicePdfDialog({
  open,
  onOpenChange,
  invoice,
  project,
}: InvoicePdfDialogProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const { company } = useAuth();

  if (!invoice) return null;

  const companyName = company?.name || "Company";
  const companyAddress = company?.address || "";
  const companyPhone = company?.phone || "";
  const companyEmail = company?.email || "";
  const companyLogo = company?.logo_url || "";

  const customerName = project
    ? `${project.customer_first_name || ""} ${project.customer_last_name || ""}`.trim() || project.project_name || "Customer"
    : "Customer";
  const customerAddress = project?.job_address || project?.project_address || "";
  const customerEmail = project?.customer_email || "";
  const customerPhone = project?.customer_phone || project?.cell_phone || project?.home_phone || "";

  const invoiceDate = invoice.invoice_date
    ? format(new Date(invoice.invoice_date), "MMMM d, yyyy")
    : "-";

  const balanceDue = (invoice.amount || 0) - (invoice.payments_received || 0);

  const getInvoiceHtml = () => {
    const printContent = printRef.current;
    if (!printContent) return null;
    return `<!DOCTYPE html>
<html>
<head>
  <title>Invoice #${invoice.invoice_number || ""}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1a1a1a; background: #fff; }
    .invoice-page { max-width: 800px; margin: 0 auto; padding: 40px; }
    @media print {
      body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      .invoice-page { padding: 20px; }
    }
  </style>
</head>
<body>
  ${printContent.innerHTML}
</body>
</html>`;
  };

  const handlePrint = () => {
    const html = getInvoiceHtml();
    if (!html) return;
    const printWindow = window.open("", "_blank", "width=800,height=1100");
    if (!printWindow) return;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const handlePrintAndClose = () => {
    handlePrint();
    onOpenChange(false);
  };

  const handleDownloadAndClose = () => {
    const html = getInvoiceHtml();
    if (!html) return;
    const printWindow = window.open("", "_blank", "width=800,height=1100");
    if (!printWindow) return;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
    onOpenChange(false);
  };

  const handleEmailToCustomer = () => {
    const email = customerEmail;
    const subject = encodeURIComponent(`Invoice #${invoice.invoice_number || ""} - ${companyName}`);
    const body = encodeURIComponent(
      `Dear ${customerName},\n\nPlease find attached Invoice #${invoice.invoice_number || ""}.\n\n` +
      `Invoice Date: ${invoiceDate}\n` +
      `Amount: ${formatCurrency(invoice.amount || 0)}\n` +
      `Balance Due: ${formatCurrency(Math.max(0, balanceDue))}\n\n` +
      (invoice.phase_name ? `Payment Phase: ${invoice.phase_name}\n` : '') +
      (invoice.agreement_number ? `Agreement: #${invoice.agreement_number}\n` : '') +
      `\nThank you for your business!\n\n${companyName}` +
      (companyPhone ? `\n${companyPhone}` : '') +
      (companyEmail ? `\n${companyEmail}` : '')
    );
    
    if (email) {
      window.open(`mailto:${email}?subject=${subject}&body=${body}`, "_self");
    } else {
      window.open(`mailto:?subject=${subject}&body=${body}`, "_self");
      toast.info("No customer email on file — please enter the recipient manually.");
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[95vh] overflow-y-auto p-0">
        {/* Toolbar */}
        <div className="sticky top-0 z-10 flex items-center justify-between bg-background border-b px-4 py-3">
          <DialogHeader className="p-0">
            <DialogTitle className="text-base">Invoice Preview</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => onOpenChange(false)}>
              <CheckCircle className="h-3.5 w-3.5" />
              Save & Close
            </Button>
            <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={handlePrintAndClose}>
              <Printer className="h-3.5 w-3.5" />
              Print
            </Button>
            <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={handleDownloadAndClose}>
              <Download className="h-3.5 w-3.5" />
              Download
            </Button>
            <Button variant="default" size="sm" className="text-xs gap-1.5" onClick={handleEmailToCustomer}>
              <Mail className="h-3.5 w-3.5" />
              Email to Customer
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 ml-1" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Invoice Content */}
        <div className="p-6">
          <div ref={printRef}>
            <div className="invoice-page" style={{ maxWidth: 800, margin: "0 auto", fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif", color: "#1a1a1a" }}>
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 40 }}>
                <div style={{ flex: 1 }}>
                  {companyLogo && (
                    <img
                      src={companyLogo}
                      alt={companyName}
                      style={{ maxHeight: 60, maxWidth: 200, objectFit: "contain", marginBottom: 8, display: "block" }}
                    />
                  )}
                  <div style={{ fontSize: 22, fontWeight: 700, color: "#111", marginBottom: 4 }}>{companyName}</div>
                  {companyAddress && <div style={{ fontSize: 12, color: "#666", lineHeight: 1.6 }}>{companyAddress}</div>}
                  {companyPhone && <div style={{ fontSize: 12, color: "#666", lineHeight: 1.6 }}>{companyPhone}</div>}
                  {companyEmail && <div style={{ fontSize: 12, color: "#666", lineHeight: 1.6 }}>{companyEmail}</div>}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 32, fontWeight: 800, color: "#2563eb", letterSpacing: 2, textTransform: "uppercase" as const }}>
                    INVOICE
                  </div>
                  <div style={{ fontSize: 14, color: "#555", marginTop: 4 }}>
                    #{invoice.invoice_number}
                  </div>
                  <div style={{ fontSize: 13, color: "#888", marginTop: 2 }}>
                    Date: {invoiceDate}
                  </div>
                </div>
              </div>

              {/* Bill To / Project Info */}
              <div style={{ display: "flex", gap: 40, marginBottom: 32 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: 1.5, color: "#2563eb", marginBottom: 8 }}>
                    Bill To
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: "#111", marginBottom: 4 }}>{customerName}</div>
                  {customerAddress && <div style={{ fontSize: 12, color: "#666", lineHeight: 1.6 }}>{customerAddress}</div>}
                  {customerEmail && <div style={{ fontSize: 12, color: "#666", lineHeight: 1.6 }}>{customerEmail}</div>}
                  {customerPhone && <div style={{ fontSize: 12, color: "#666", lineHeight: 1.6 }}>{customerPhone}</div>}
                </div>
                {(invoice.agreement_number || invoice.phase_name || project?.project_name) && (
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: 1.5, color: "#2563eb", marginBottom: 8 }}>
                      Project Details
                    </div>
                    {project?.project_name && (
                      <div style={{ marginBottom: 6 }}>
                        <div style={{ fontSize: 12, color: "#888" }}>Project</div>
                        <div style={{ fontSize: 13, color: "#333", fontWeight: 500 }}>{project.project_name}</div>
                      </div>
                    )}
                    {invoice.agreement_number && (
                      <div style={{ marginBottom: 6 }}>
                        <div style={{ fontSize: 12, color: "#888" }}>Agreement</div>
                        <div style={{ fontSize: 13, color: "#333", fontWeight: 500 }}>#{invoice.agreement_number}</div>
                      </div>
                    )}
                    {invoice.phase_name && (
                      <div>
                        <div style={{ fontSize: 12, color: "#888" }}>Payment Phase</div>
                        <div style={{ fontSize: 13, color: "#333", fontWeight: 500 }}>{invoice.phase_name}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Line Items Table */}
              <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24 }}>
                <thead>
                  <tr>
                    <th style={{ background: "#2563eb", color: "#fff", fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: 1, padding: "10px 16px", textAlign: "left" }}>
                      Description
                    </th>
                    <th style={{ background: "#2563eb", color: "#fff", fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: 1, padding: "10px 16px", textAlign: "right" }}>
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: "14px 16px", fontSize: 13, borderBottom: "1px solid #eee", color: "#333" }}>
                      {invoice.description_of_work || invoice.phase_name || `Invoice #${invoice.invoice_number}`}
                      {invoice.phase_name && invoice.description_of_work && (
                        <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>
                          Phase: {invoice.phase_name}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "14px 16px", fontSize: 13, borderBottom: "1px solid #eee", color: "#333", textAlign: "right", fontWeight: 600 }}>
                      {formatCurrency(invoice.amount || 0)}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Totals */}
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 32 }}>
                <div style={{ width: 280 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 13, color: "#555" }}>
                    <span style={{ fontWeight: 500 }}>Subtotal</span>
                    <span style={{ fontWeight: 600, color: "#111" }}>{formatCurrency(invoice.amount || 0)}</span>
                  </div>
                  {(invoice.payments_received || 0) > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 13, color: "#16a34a" }}>
                      <span style={{ fontWeight: 500 }}>Payments Received</span>
                      <span style={{ fontWeight: 600 }}>-{formatCurrency(invoice.payments_received || 0)}</span>
                    </div>
                  )}
                  <div style={{
                    display: "flex", justifyContent: "space-between",
                    padding: "12px 0 8px", marginTop: 4,
                    borderTop: "2px solid #2563eb",
                    fontSize: 18, fontWeight: 700, color: "#2563eb"
                  }}>
                    <span>Balance Due</span>
                    <span>{formatCurrency(Math.max(0, balanceDue))}</span>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div style={{ textAlign: "center", paddingTop: 32, borderTop: "1px solid #eee" }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#2563eb", marginBottom: 8 }}>
                  Thank you for your business!
                </div>
                <div style={{ fontSize: 12, color: "#888", lineHeight: 1.8 }}>
                  {balanceDue > 0 && "Please remit payment at your earliest convenience."}
                  {companyPhone && <><br />Questions? Contact us at {companyPhone}</>}
                  {companyEmail && !companyPhone && <><br />Questions? Contact us at {companyEmail}</>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
