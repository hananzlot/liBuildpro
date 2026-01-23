import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  const [hasPrinted, setHasPrinted] = useState(false);

  // Fetch all contract data
  const { data, isLoading } = useQuery({
    queryKey: ["contract-print", estimateId],
    queryFn: async () => {
      if (!estimateId) return null;

      // First get the estimate to get company_id
      const { data: estimate, error: estimateError } = await supabase
        .from("estimates")
        .select("*")
        .eq("id", estimateId)
        .single();

      if (estimateError) throw estimateError;

      const settingKeys = [
        "company_name", "company_address", "company_phone", "company_email",
        "license_number", "license_type", "license_holder_name"
      ];

      // Fetch remaining data in parallel
      const [groupsRes, itemsRes, scheduleRes, signatureRes, companySettingsRes, appSettingsRes] = await Promise.all([
        supabase.from("estimate_groups").select("*").eq("estimate_id", estimateId).order("sort_order"),
        supabase.from("estimate_line_items").select("*").eq("estimate_id", estimateId).order("sort_order"),
        supabase.from("estimate_payment_schedule").select("*").eq("estimate_id", estimateId).order("sort_order"),
        supabase.from("estimate_signatures").select("*").eq("estimate_id", estimateId).maybeSingle(),
        // Try company_settings first
        estimate.company_id 
          ? supabase.from("company_settings").select("setting_key, setting_value")
              .eq("company_id", estimate.company_id).in("setting_key", settingKeys)
          : Promise.resolve({ data: [] }),
        // Fall back to app_settings
        supabase.from("app_settings").select("setting_key, setting_value").in("setting_key", settingKeys),
      ]);

      // Merge settings: company_settings override app_settings
      const settingsMap: Record<string, string> = {};
      appSettingsRes.data?.forEach((s) => {
        if (s.setting_value) settingsMap[s.setting_key] = s.setting_value;
      });
      companySettingsRes.data?.forEach((s) => {
        if (s.setting_value) settingsMap[s.setting_key] = s.setting_value;
      });

      const getSetting = (key: string) => settingsMap[key] || "";
      
      return {
        estimate,
        groups: groupsRes.data as Group[],
        lineItems: itemsRes.data as LineItem[],
        paymentSchedule: scheduleRes.data as PaymentSchedule[],
        signature: signatureRes.data as Signature | null,
        companyName: getSetting("company_name") || "Company",
        companyAddress: getSetting("company_address"),
        companyPhone: getSetting("company_phone"),
        companyEmail: getSetting("company_email"),
        licenseNumber: getSetting("license_number"),
        licenseType: getSetting("license_type"),
        licenseHolderName: getSetting("license_holder_name"),
      };
    },
    enabled: !!estimateId && open,
  });

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return "$0.00";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const buildPrintContent = () => {
    if (!data?.estimate) return "";

    const showLineItems = data.estimate.show_line_items_to_customer ?? false;
    const showDetails = data.estimate.show_details_to_customer ?? false;

    const groupsHtml = showLineItems ? (data.groups?.map((group) => {
      const items = data.lineItems?.filter((item) => item.group_id === group.id) || [];
      const itemsHtml = items.map((item) => `
        <div class="line-item">
          <div class="line-item-desc">
            <div>${item.description}</div>
            ${showDetails ? `
              <div class="line-item-detail">
                ${item.quantity} ${item.unit} × <span class="unit-price">${formatCurrency(item.unit_price)}</span>
              </div>
            ` : ""}
          </div>
          ${showDetails ? `<div class="line-item-total">${formatCurrency(item.line_total)}</div>` : ""}
        </div>
      `).join("");
      
      return `
        <div class="scope-group">
          <div class="scope-group-title">${group.group_name}</div>
          ${itemsHtml}
        </div>
      `;
    }).join("") || "") : "";

    const paymentHtml = data.paymentSchedule?.map((phase) => `
      <div class="payment-item">
        <span>${phase.phase_name}</span>
        <span class="payment-amount">${phase.percent}% (${formatCurrency((data.estimate.total * phase.percent) / 100)})</span>
      </div>
    `).join("") || "";

    const signatureHtml = data.signature ? `
      <div class="signature-section">
        <div class="signature-title">✓ Customer Signature</div>
        ${data.signature.signature_type === "drawn" 
          ? `<img src="${data.signature.signature_data}" alt="Customer signature" class="signature-image" />`
          : `<div class="signature-typed" style="font-family: ${data.signature.signature_font || 'cursive'}">${data.signature.signature_data}</div>`
        }
        <div class="signature-info">
          <div>Signed by: ${data.signature.signer_name}</div>
          ${data.signature.signer_email ? `<div>Email: ${data.signature.signer_email}</div>` : ""}
          <div>Date: ${format(new Date(data.signature.signed_at), "MMMM d, yyyy 'at' h:mm a")}</div>
        </div>
      </div>
    ` : "";

    const licenseInfo = data.licenseNumber 
      ? `<p class="company-license">${data.licenseType || 'License'} #${data.licenseNumber}${data.licenseHolderName ? ` - ${data.licenseHolderName}` : ''}</p>`
      : '';
    
    return `
      <div class="header">
        <h1>${data.companyName}</h1>
        ${data.companyAddress ? `<p class="company-info">${data.companyAddress}</p>` : ''}
        ${data.companyPhone || data.companyEmail ? `<p class="company-info">${[data.companyPhone, data.companyEmail].filter(Boolean).join(' • ')}</p>` : ''}
        ${licenseInfo}
        <p class="contract-number">
          Contract #${data.estimate.status === "accepted" ? "CNT" : "EST"}-${data.estimate.estimate_number}
        </p>
      </div>

      <div class="section">
        <div class="info-grid">
          <div>
            <div class="section-title">Customer Information</div>
            <div class="info-item">
              <div class="info-label">Name</div>
              <div class="info-value">${data.estimate.customer_name}</div>
            </div>
            ${data.estimate.customer_email ? `
              <div class="info-item">
                <div class="info-label">Email</div>
                <div class="info-value">${data.estimate.customer_email}</div>
              </div>
            ` : ""}
            ${data.estimate.customer_phone ? `
              <div class="info-item">
                <div class="info-label">Phone</div>
                <div class="info-value">${data.estimate.customer_phone}</div>
              </div>
            ` : ""}
          </div>
          <div>
            <div class="section-title">Project Details</div>
            <div class="info-item">
              <div class="info-label">Project</div>
              <div class="info-value">${data.estimate.estimate_title}</div>
            </div>
            ${data.estimate.job_address ? `
              <div class="info-item">
                <div class="info-label">Job Address</div>
                <div class="info-value">${data.estimate.job_address}</div>
              </div>
            ` : ""}
            <div class="info-item">
              <div class="info-label">Date</div>
              <div class="info-value">${format(new Date(data.estimate.estimate_date), "MMMM d, yyyy")}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Scope of Work</div>
        ${data.estimate.show_scope_to_customer && data.estimate.work_scope_description ? `
          <div class="work-scope-description">${data.estimate.work_scope_description}</div>
        ` : ""}
        ${groupsHtml}
      </div>

      <div class="totals">
        <div class="total-row">
          <span>Subtotal</span>
          <span>${formatCurrency(data.estimate.subtotal)}</span>
        </div>
        ${(data.estimate.tax_amount || 0) > 0 ? `
          <div class="total-row">
            <span>Tax (${data.estimate.tax_rate}%)</span>
            <span>${formatCurrency(data.estimate.tax_amount)}</span>
          </div>
        ` : ""}
        ${(data.estimate.discount_amount || 0) > 0 ? `
          <div class="total-row">
            <span>Discount</span>
            <span>-${formatCurrency(data.estimate.discount_amount)}</span>
          </div>
        ` : ""}
        <div class="total-row grand-total">
          <span>Total Contract Amount</span>
          <span>${formatCurrency(data.estimate.total)}</span>
        </div>
      </div>

      ${data.paymentSchedule && data.paymentSchedule.length > 0 ? `
        <div class="section payment-schedule">
          <div class="section-title">Payment Schedule</div>
          ${paymentHtml}
        </div>
      ` : ""}

      ${data.estimate.terms_and_conditions ? (() => {
        // Skip the first line if it's just "TERMS AND CONDITIONS" to avoid duplication
        let termsText = data.estimate.terms_and_conditions;
        const firstLine = termsText.split('\n')[0]?.trim().toUpperCase();
        if (firstLine === 'TERMS AND CONDITIONS') {
          termsText = termsText.split('\n').slice(1).join('\n').trim();
        }
        return `
          <div class="terms">
            <div class="terms-title">Terms and Conditions</div>
            <div style="white-space: pre-wrap">${termsText}</div>
          </div>
        `;
      })() : ""}

      ${signatureHtml}
    `;
  };

  const handlePrint = () => {
    if (!data?.estimate) return;

    const printContent = buildPrintContent();

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow popups to print the contract");
      onOpenChange(false);
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Contract - ${data.estimate.estimate_title}</title>
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
            .header .company-info {
              font-size: 13px;
              color: #444;
              margin: 2px 0;
            }
            .header .company-license {
              font-size: 12px;
              color: #666;
              margin: 5px 0;
            }
            .header .contract-number {
              font-size: 14px;
              color: #666;
              margin-top: 10px;
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
            .work-scope-description {
              white-space: pre-wrap;
              font-size: 14px;
              line-height: 1.6;
              margin-bottom: 20px;
              padding: 12px;
              background: #fafafa;
              border-left: 3px solid #1a1a2e;
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
            .line-item-detail .unit-price {
              font-family: 'Courier New', monospace;
            }
            .line-item-total {
              font-weight: 500;
              min-width: 100px;
              text-align: right;
              font-family: 'Courier New', monospace;
            }
            .totals {
              margin-top: 20px;
              margin-left: auto;
              max-width: 350px;
              padding: 20px;
              background: #f9f9f9;
              border-radius: 8px;
            }
            .total-row {
              display: flex;
              justify-content: space-between;
              padding: 5px 0;
              gap: 40px;
            }
            .total-row span:last-child {
              text-align: right;
              min-width: 120px;
              font-family: 'Courier New', monospace;
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
            .payment-item .payment-amount {
              text-align: right;
              font-family: 'Courier New', monospace;
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
            }
          </style>
        </head>
        <body>
          ${printContent}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
      onOpenChange(false);
    }, 250);
  };

  // Auto-print when data is ready
  useEffect(() => {
    if (open && data?.estimate && !isLoading && !hasPrinted) {
      setHasPrinted(true);
      handlePrint();
    }
  }, [open, data, isLoading, hasPrinted]);

  // Reset hasPrinted when dialog closes
  useEffect(() => {
    if (!open) {
      setHasPrinted(false);
    }
  }, [open]);

  // This component doesn't render anything visible - it just triggers print
  return null;
}
