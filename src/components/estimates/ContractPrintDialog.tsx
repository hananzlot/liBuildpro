import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Loader2, Printer } from "lucide-react";
import { format } from "date-fns";

interface ContractPrintDialogProps {
  estimateId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface LineItem {
  id: string;
  group_id: string | null;
  item_type: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  line_total: number;
  sort_order: number;
}

interface Group {
  id: string;
  group_name: string;
  description: string | null;
  sort_order: number;
}

interface PaymentSchedule {
  id: string;
  phase_name: string;
  percent: number;
  sort_order: number;
}

interface Signature {
  id: string;
  signer_name: string;
  signer_email: string | null;
  signature_type: string;
  signature_data: string;
  signature_font: string | null;
  signed_at: string;
}

export function ContractPrintDialog({ estimateId, open, onOpenChange }: ContractPrintDialogProps) {
  const printRef = useRef<HTMLDivElement>(null);

  // Fetch all contract data
  const { data, isLoading } = useQuery({
    queryKey: ["contract-print", estimateId],
    queryFn: async () => {
      if (!estimateId) return null;

      const [estimateRes, groupsRes, itemsRes, scheduleRes, signatureRes, settingsRes] = await Promise.all([
        supabase.from("estimates").select("*").eq("id", estimateId).single(),
        supabase.from("estimate_groups").select("*").eq("estimate_id", estimateId).order("sort_order"),
        supabase.from("estimate_line_items").select("*").eq("estimate_id", estimateId).order("sort_order"),
        supabase.from("estimate_payment_schedule").select("*").eq("estimate_id", estimateId).order("sort_order"),
        supabase.from("estimate_signatures").select("*").eq("estimate_id", estimateId).maybeSingle(),
        supabase.from("app_settings").select("setting_key, setting_value").in("setting_key", ["company_name"]),
      ]);

      return {
        estimate: estimateRes.data,
        groups: groupsRes.data as Group[],
        lineItems: itemsRes.data as LineItem[],
        paymentSchedule: scheduleRes.data as PaymentSchedule[],
        signature: signatureRes.data as Signature | null,
        companyName: settingsRes.data?.find((s) => s.setting_key === "company_name")?.setting_value || "Company",
      };
    },
    enabled: !!estimateId && open,
  });

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow popups to print the contract");
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Contract - ${data?.estimate?.estimate_title || "Contract"}</title>
          <style>
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              line-height: 1.5;
              color: #1a1a1a;
              padding: 40px;
              max-width: 800px;
              margin: 0 auto;
            }
            .header {
              text-align: center;
              margin-bottom: 40px;
              padding-bottom: 20px;
              border-bottom: 3px solid #1a1a2e;
            }
            .header h1 {
              font-size: 28px;
              color: #1a1a2e;
              margin-bottom: 5px;
            }
            .header .contract-number {
              font-size: 14px;
              color: #666;
            }
            .section {
              margin-bottom: 30px;
            }
            .section-title {
              font-size: 14px;
              font-weight: 600;
              color: #666;
              text-transform: uppercase;
              letter-spacing: 1px;
              margin-bottom: 10px;
              padding-bottom: 5px;
              border-bottom: 1px solid #e5e5e5;
            }
            .info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 20px;
            }
            .info-item {
              margin-bottom: 10px;
            }
            .info-label {
              font-size: 12px;
              color: #666;
            }
            .info-value {
              font-size: 14px;
              font-weight: 500;
            }
            .scope-group {
              margin-bottom: 20px;
            }
            .scope-group-title {
              font-weight: 600;
              font-size: 16px;
              margin-bottom: 10px;
              padding: 8px 12px;
              background: #f5f5f5;
              border-radius: 4px;
            }
            .line-item {
              display: flex;
              justify-content: space-between;
              padding: 8px 12px;
              border-bottom: 1px solid #eee;
            }
            .line-item:last-child {
              border-bottom: none;
            }
            .line-item-desc {
              flex: 1;
            }
            .line-item-detail {
              font-size: 12px;
              color: #666;
            }
            .line-item-total {
              font-weight: 500;
              min-width: 100px;
              text-align: right;
            }
            .totals {
              margin-top: 20px;
              padding: 20px;
              background: #f9f9f9;
              border-radius: 8px;
            }
            .total-row {
              display: flex;
              justify-content: space-between;
              padding: 5px 0;
            }
            .total-row.grand-total {
              font-size: 18px;
              font-weight: bold;
              border-top: 2px solid #1a1a2e;
              margin-top: 10px;
              padding-top: 15px;
            }
            .payment-schedule {
              margin-top: 20px;
            }
            .payment-item {
              display: flex;
              justify-content: space-between;
              padding: 10px 0;
              border-bottom: 1px solid #eee;
            }
            .signature-section {
              margin-top: 40px;
              padding: 20px;
              border: 2px solid #22c55e;
              border-radius: 8px;
              background: #f0fdf4;
            }
            .signature-title {
              color: #16a34a;
              font-weight: 600;
              margin-bottom: 15px;
            }
            .signature-image {
              max-height: 80px;
              margin: 10px 0;
            }
            .signature-typed {
              font-family: 'Brush Script MT', cursive;
              font-size: 32px;
              margin: 10px 0;
            }
            .signature-info {
              font-size: 12px;
              color: #666;
              margin-top: 10px;
            }
            .terms {
              margin-top: 30px;
              padding: 20px;
              background: #f9f9f9;
              border-radius: 8px;
              font-size: 12px;
              color: #666;
            }
            .terms-title {
              font-weight: 600;
              color: #333;
              margin-bottom: 10px;
            }
            @media print {
              body {
                padding: 20px;
              }
              .no-print {
                display: none;
              }
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return "$0.00";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Print Contract</span>
            <Button onClick={handlePrint} disabled={isLoading}>
              <Printer className="h-4 w-4 mr-2" />
              Print / Save PDF
            </Button>
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : data?.estimate ? (
          <div ref={printRef} className="bg-white p-8">
            {/* Header */}
            <div className="header">
              <h1>{data.companyName}</h1>
              <p className="contract-number">
                Contract #{data.estimate.status === "accepted" ? "CNT" : "EST"}-{data.estimate.estimate_number}
              </p>
            </div>

            {/* Customer & Project Info */}
            <div className="section">
              <div className="info-grid">
                <div>
                  <div className="section-title">Customer Information</div>
                  <div className="info-item">
                    <div className="info-label">Name</div>
                    <div className="info-value">{data.estimate.customer_name}</div>
                  </div>
                  {data.estimate.customer_email && (
                    <div className="info-item">
                      <div className="info-label">Email</div>
                      <div className="info-value">{data.estimate.customer_email}</div>
                    </div>
                  )}
                  {data.estimate.customer_phone && (
                    <div className="info-item">
                      <div className="info-label">Phone</div>
                      <div className="info-value">{data.estimate.customer_phone}</div>
                    </div>
                  )}
                </div>
                <div>
                  <div className="section-title">Project Details</div>
                  <div className="info-item">
                    <div className="info-label">Project</div>
                    <div className="info-value">{data.estimate.estimate_title}</div>
                  </div>
                  {data.estimate.job_address && (
                    <div className="info-item">
                      <div className="info-label">Job Address</div>
                      <div className="info-value">{data.estimate.job_address}</div>
                    </div>
                  )}
                  <div className="info-item">
                    <div className="info-label">Date</div>
                    <div className="info-value">{format(new Date(data.estimate.estimate_date), "MMMM d, yyyy")}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Scope of Work */}
            <div className="section">
              <div className="section-title">Scope of Work</div>
              {data.groups?.map((group) => {
                const items = data.lineItems?.filter((item) => item.group_id === group.id) || [];
                return (
                  <div key={group.id} className="scope-group">
                    <div className="scope-group-title">{group.group_name}</div>
                    {items.map((item) => (
                      <div key={item.id} className="line-item">
                        <div className="line-item-desc">
                          <div>{item.description}</div>
                          <div className="line-item-detail">
                            {item.quantity} {item.unit} × {formatCurrency(item.unit_price)}
                          </div>
                        </div>
                        <div className="line-item-total">{formatCurrency(item.line_total)}</div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>

            {/* Totals */}
            <div className="totals">
              <div className="total-row">
                <span>Subtotal</span>
                <span>{formatCurrency(data.estimate.subtotal)}</span>
              </div>
              {(data.estimate.tax_amount || 0) > 0 && (
                <div className="total-row">
                  <span>Tax ({data.estimate.tax_rate}%)</span>
                  <span>{formatCurrency(data.estimate.tax_amount)}</span>
                </div>
              )}
              {(data.estimate.discount_amount || 0) > 0 && (
                <div className="total-row">
                  <span>Discount</span>
                  <span>-{formatCurrency(data.estimate.discount_amount)}</span>
                </div>
              )}
              <div className="total-row grand-total">
                <span>Total Contract Amount</span>
                <span>{formatCurrency(data.estimate.total)}</span>
              </div>
            </div>

            {/* Payment Schedule */}
            {data.paymentSchedule && data.paymentSchedule.length > 0 && (
              <div className="section payment-schedule">
                <div className="section-title">Payment Schedule</div>
                {data.paymentSchedule.map((phase) => (
                  <div key={phase.id} className="payment-item">
                    <span>{phase.phase_name}</span>
                    <span>
                      {phase.percent}% ({formatCurrency((data.estimate.total * phase.percent) / 100)})
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Terms and Conditions */}
            {data.estimate.terms_and_conditions && (
              <div className="terms">
                <div className="terms-title">Terms and Conditions</div>
                <div style={{ whiteSpace: "pre-wrap" }}>{data.estimate.terms_and_conditions}</div>
              </div>
            )}

            {/* Signature */}
            {data.signature && (
              <div className="signature-section">
                <div className="signature-title">✓ Customer Signature</div>
                {data.signature.signature_type === "drawn" ? (
                  <img
                    src={data.signature.signature_data}
                    alt="Customer signature"
                    className="signature-image"
                  />
                ) : (
                  <div
                    className="signature-typed"
                    style={{ fontFamily: data.signature.signature_font || "cursive" }}
                  >
                    {data.signature.signature_data}
                  </div>
                )}
                <div className="signature-info">
                  <div>Signed by: {data.signature.signer_name}</div>
                  {data.signature.signer_email && <div>Email: {data.signature.signer_email}</div>}
                  <div>Date: {format(new Date(data.signature.signed_at), "MMMM d, yyyy 'at' h:mm a")}</div>
                </div>
              </div>
            )}

            {/* Notes */}
            {data.estimate.notes && (
              <div className="section" style={{ marginTop: "30px" }}>
                <div className="section-title">Notes</div>
                <p style={{ whiteSpace: "pre-wrap", fontSize: "14px" }}>{data.estimate.notes}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">Contract not found</p>
        )}
      </DialogContent>
    </Dialog>
  );
}