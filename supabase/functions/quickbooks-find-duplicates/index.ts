import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const QB_BASE_URL = "https://quickbooks.api.intuit.com/v3/company";

/**
 * Find potential duplicate records in QuickBooks before syncing.
 * Supports: bill_payment, bill
 *
 * Request body:
 *   companyId: string
 *   recordType: "bill_payment" | "bill"
 *   amount: number
 *   date: string (YYYY-MM-DD)
 *   reference?: string (check #, doc number)
 *   vendorName?: string
 *   paymentMethod?: string (e.g. "Credit Card", "Check", "ACH")
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { companyId, recordType, amount, date, reference, vendorName, paymentMethod } = await req.json();

    if (!companyId || !recordType) {
      return new Response(
        JSON.stringify({ error: "companyId and recordType are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get QuickBooks tokens
    const { data: tokenData, error: tokenError } = await supabase.rpc("get_quickbooks_tokens", {
      p_company_id: companyId,
    });

    if (tokenError || !tokenData || tokenData.length === 0) {
      return new Response(
        JSON.stringify({ error: "QuickBooks not connected", duplicates: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let { access_token, refresh_token, realm_id, token_expires_at } = tokenData[0];

    // Check if token needs refresh
    if (new Date(token_expires_at) <= new Date()) {
      console.log("Token expired, refreshing...");
      const refreshResult = await supabase.functions.invoke("quickbooks-auth", {
        body: { action: "refresh-token", companyId },
      });

      if (refreshResult.error || refreshResult.data?.error) {
        return new Response(
          JSON.stringify({ error: "Token refresh failed", duplicates: [] }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: newTokenData } = await supabase.rpc("get_quickbooks_tokens", {
        p_company_id: companyId,
      });
      access_token = newTokenData[0].access_token;
      realm_id = newTokenData[0].realm_id;
    }

    const qbHeaders = {
      "Authorization": `Bearer ${access_token}`,
      "Accept": "application/json",
      "Content-Type": "application/json",
    };

    if (recordType === "bill_payment") {
      const duplicates = await findBillPaymentDuplicates(
        qbHeaders, realm_id, { amount, date, reference, vendorName, paymentMethod }
      );

      return new Response(
        JSON.stringify({ success: true, duplicates }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (recordType === "bill") {
      const duplicates = await findBillDuplicates(
        qbHeaders, realm_id, { amount, date, reference, vendorName }
      );

      return new Response(
        JSON.stringify({ success: true, duplicates }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (recordType === "payment") {
      const duplicates = await findPaymentDuplicates(
        qbHeaders, realm_id, { amount, date, reference }
      );

      return new Response(
        JSON.stringify({ success: true, duplicates }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (recordType === "invoice") {
      const duplicates = await findInvoiceDuplicates(
        qbHeaders, realm_id, { amount, date, reference }
      );

      return new Response(
        JSON.stringify({ success: true, duplicates }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (recordType === "refund") {
      const duplicates = await findRefundReceiptDuplicates(
        qbHeaders, realm_id, { amount, date, reference }
      );

      return new Response(
        JSON.stringify({ success: true, duplicates }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, duplicates: [], message: `Record type '${recordType}' not yet supported` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error finding duplicates:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message, duplicates: [] }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

interface DuplicateCandidate {
  qbId: string;
  qbSyncToken: string;
  amount: number;
  date: string;
  reference: string | null;
  vendorName: string | null;
  vendorId: string | null;
  payType: string | null;
  confidence: "high" | "medium" | "low";
  matchReasons: string[];
}

async function findBillPaymentDuplicates(
  qbHeaders: Record<string, string>,
  realmId: string,
  criteria: { amount?: number; date?: string; reference?: string; vendorName?: string; paymentMethod?: string }
): Promise<DuplicateCandidate[]> {
  const { amount, date, reference, vendorName, paymentMethod } = criteria;

  // Determine expected PayType based on payment method
  const isCreditCard = paymentMethod?.toLowerCase() === "credit card";

  // Build QB query - search for bill payments within a date range
  // QB BillPayment query supports TxnDate, VendorRef, TotalAmt
  const conditions: string[] = [];

  // Date range: ±7 days from the target date
  if (date) {
    const targetDate = new Date(date);
    const startDate = new Date(targetDate);
    startDate.setDate(startDate.getDate() - 7);
    const endDate = new Date(targetDate);
    endDate.setDate(endDate.getDate() + 7);

    conditions.push(`TxnDate >= '${startDate.toISOString().split("T")[0]}'`);
    conditions.push(`TxnDate <= '${endDate.toISOString().split("T")[0]}'`);
  }

  let query = "SELECT * FROM BillPayment";
  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(" AND ")}`;
  }
  query += " MAXRESULTS 100";

  console.log("QB duplicate search query:", query);

  const url = `https://quickbooks.api.intuit.com/v3/company/${realmId}/query?query=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: qbHeaders });

  if (!res.ok) {
    const errText = await res.text();
    console.error("QB query error:", errText);
    return [];
  }

  const data = await res.json();
  const billPayments = data.QueryResponse?.BillPayment || [];
  console.log(`Found ${billPayments.length} bill payments in QB within date range`);

  // Score each result
  const candidates: DuplicateCandidate[] = [];

  for (const bp of billPayments) {
    // Filter by PayType if payment method was specified
    if (isCreditCard && bp.PayType !== "CreditCard") continue;
    if (!isCreditCard && paymentMethod && bp.PayType === "CreditCard") continue;

    const matchReasons: string[] = [];
    let score = 0;

    // Amount match (exact)
    if (amount && Math.abs(bp.TotalAmt - amount) < 0.01) {
      score += 40;
      matchReasons.push(`Amount matches: $${bp.TotalAmt.toFixed(2)}`);
    }

    // Date proximity
    if (date && bp.TxnDate) {
      const daysDiff = Math.abs(
        (new Date(bp.TxnDate).getTime() - new Date(date).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysDiff === 0) {
        score += 30;
        matchReasons.push("Exact date match");
      } else if (daysDiff <= 1) {
        score += 20;
        matchReasons.push(`Date within 1 day (${bp.TxnDate})`);
      } else if (daysDiff <= 3) {
        score += 10;
        matchReasons.push(`Date within 3 days (${bp.TxnDate})`);
      } else {
        matchReasons.push(`Date: ${bp.TxnDate}`);
      }
    }

    // Reference/DocNumber match
    if (reference && bp.DocNumber) {
      if (bp.DocNumber === reference) {
        score += 30;
        matchReasons.push(`Reference matches: ${bp.DocNumber}`);
      } else if (bp.DocNumber.includes(reference) || reference.includes(bp.DocNumber)) {
        score += 15;
        matchReasons.push(`Reference partial match: ${bp.DocNumber}`);
      }
    }

    // Vendor match
    const bpVendorName = bp.VendorRef?.name || null;
    if (vendorName && bpVendorName) {
      const normalizedVendor = vendorName.toLowerCase().trim();
      const normalizedBpVendor = bpVendorName.toLowerCase().trim();
      if (normalizedVendor === normalizedBpVendor) {
        score += 20;
        matchReasons.push(`Vendor matches: ${bpVendorName}`);
      } else if (normalizedBpVendor.includes(normalizedVendor) || normalizedVendor.includes(normalizedBpVendor)) {
        score += 10;
        matchReasons.push(`Vendor partial match: ${bpVendorName}`);
      }
    }

    // Only include if there's at least some match
    if (score >= 30) {
      let confidence: "high" | "medium" | "low" = "low";
      if (score >= 70) confidence = "high";
      else if (score >= 50) confidence = "medium";

      candidates.push({
        qbId: bp.Id,
        qbSyncToken: bp.SyncToken,
        amount: bp.TotalAmt,
        date: bp.TxnDate,
        reference: bp.DocNumber || null,
        vendorName: bpVendorName,
        vendorId: bp.VendorRef?.value || null,
        payType: bp.PayType || null,
        confidence,
        matchReasons,
      });
    }
  }

  // Sort by confidence (high first), then by score
  candidates.sort((a, b) => {
    const confOrder = { high: 0, medium: 1, low: 2 };
    return confOrder[a.confidence] - confOrder[b.confidence];
  });

  console.log(`Found ${candidates.length} potential duplicates`);
  return candidates;
}

async function findBillDuplicates(
  qbHeaders: Record<string, string>,
  realmId: string,
  criteria: { amount?: number; date?: string; reference?: string; vendorName?: string }
): Promise<DuplicateCandidate[]> {
  const { amount, date, reference, vendorName } = criteria;

  const conditions: string[] = [];

  // Date range: ±7 days from the target date
  if (date) {
    const targetDate = new Date(date);
    const startDate = new Date(targetDate);
    startDate.setDate(startDate.getDate() - 7);
    const endDate = new Date(targetDate);
    endDate.setDate(endDate.getDate() + 7);

    conditions.push(`TxnDate >= '${startDate.toISOString().split("T")[0]}'`);
    conditions.push(`TxnDate <= '${endDate.toISOString().split("T")[0]}'`);
  }

  let query = "SELECT * FROM Bill";
  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(" AND ")}`;
  }
  query += " MAXRESULTS 100";

  console.log("QB bill duplicate search query:", query);

  const url = `https://quickbooks.api.intuit.com/v3/company/${realmId}/query?query=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: qbHeaders });

  if (!res.ok) {
    const errText = await res.text();
    console.error("QB bill query error:", errText);
    return [];
  }

  const data = await res.json();
  const bills = data.QueryResponse?.Bill || [];
  console.log(`Found ${bills.length} bills in QB within date range`);

  const candidates: DuplicateCandidate[] = [];

  for (const bill of bills) {
    const matchReasons: string[] = [];
    let score = 0;

    // Amount match (exact)
    if (amount && Math.abs(bill.TotalAmt - amount) < 0.01) {
      score += 40;
      matchReasons.push(`Amount matches: $${bill.TotalAmt.toFixed(2)}`);
    }

    // Date proximity
    if (date && bill.TxnDate) {
      const daysDiff = Math.abs(
        (new Date(bill.TxnDate).getTime() - new Date(date).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysDiff === 0) {
        score += 30;
        matchReasons.push("Exact date match");
      } else if (daysDiff <= 1) {
        score += 20;
        matchReasons.push(`Date within 1 day (${bill.TxnDate})`);
      } else if (daysDiff <= 3) {
        score += 10;
        matchReasons.push(`Date within 3 days (${bill.TxnDate})`);
      } else {
        matchReasons.push(`Date: ${bill.TxnDate}`);
      }
    }

    // Reference/DocNumber match
    if (reference && bill.DocNumber) {
      if (bill.DocNumber === reference) {
        score += 30;
        matchReasons.push(`Reference matches: ${bill.DocNumber}`);
      } else if (bill.DocNumber.includes(reference) || reference.includes(bill.DocNumber)) {
        score += 15;
        matchReasons.push(`Reference partial match: ${bill.DocNumber}`);
      }
    }

    // Vendor match
    const billVendorName = bill.VendorRef?.name || null;
    if (vendorName && billVendorName) {
      const normalizedVendor = vendorName.toLowerCase().trim();
      const normalizedBillVendor = billVendorName.toLowerCase().trim();
      if (normalizedVendor === normalizedBillVendor) {
        score += 20;
        matchReasons.push(`Vendor matches: ${billVendorName}`);
      } else if (normalizedBillVendor.includes(normalizedVendor) || normalizedVendor.includes(normalizedBillVendor)) {
        score += 10;
        matchReasons.push(`Vendor partial match: ${billVendorName}`);
      }
    }

    if (score >= 30) {
      let confidence: "high" | "medium" | "low" = "low";
      if (score >= 70) confidence = "high";
      else if (score >= 50) confidence = "medium";

      candidates.push({
        qbId: bill.Id,
        qbSyncToken: bill.SyncToken,
        amount: bill.TotalAmt,
        date: bill.TxnDate,
        reference: bill.DocNumber || null,
        vendorName: billVendorName,
        vendorId: bill.VendorRef?.value || null,
        payType: null,
        confidence,
        matchReasons,
      });
    }
  }

  candidates.sort((a, b) => {
    const confOrder = { high: 0, medium: 1, low: 2 };
    return confOrder[a.confidence] - confOrder[b.confidence];
  });

  console.log(`Found ${candidates.length} potential bill duplicates`);
  return candidates;
}

async function findPaymentDuplicates(
  qbHeaders: Record<string, string>,
  realmId: string,
  criteria: { amount?: number; date?: string; reference?: string }
): Promise<DuplicateCandidate[]> {
  const { amount, date, reference } = criteria;

  const conditions: string[] = [];

  if (date) {
    const targetDate = new Date(date);
    const startDate = new Date(targetDate);
    startDate.setDate(startDate.getDate() - 7);
    const endDate = new Date(targetDate);
    endDate.setDate(endDate.getDate() + 7);

    conditions.push(`TxnDate >= '${startDate.toISOString().split("T")[0]}'`);
    conditions.push(`TxnDate <= '${endDate.toISOString().split("T")[0]}'`);
  }

  let query = "SELECT * FROM Payment";
  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(" AND ")}`;
  }
  query += " MAXRESULTS 100";

  console.log("QB payment duplicate search query:", query);

  const url = `https://quickbooks.api.intuit.com/v3/company/${realmId}/query?query=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: qbHeaders });

  if (!res.ok) {
    const errText = await res.text();
    console.error("QB payment query error:", errText);
    return [];
  }

  const data = await res.json();
  const payments = data.QueryResponse?.Payment || [];
  console.log(`Found ${payments.length} payments in QB within date range`);

  const candidates: DuplicateCandidate[] = [];

  for (const pmt of payments) {
    const matchReasons: string[] = [];
    let score = 0;

    // Amount match (exact)
    if (amount && Math.abs(pmt.TotalAmt - amount) < 0.01) {
      score += 40;
      matchReasons.push(`Amount matches: $${pmt.TotalAmt.toFixed(2)}`);
    }

    // Date proximity
    if (date && pmt.TxnDate) {
      const daysDiff = Math.abs(
        (new Date(pmt.TxnDate).getTime() - new Date(date).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysDiff === 0) {
        score += 30;
        matchReasons.push("Exact date match");
      } else if (daysDiff <= 1) {
        score += 20;
        matchReasons.push(`Date within 1 day (${pmt.TxnDate})`);
      } else if (daysDiff <= 3) {
        score += 10;
        matchReasons.push(`Date within 3 days (${pmt.TxnDate})`);
      } else {
        matchReasons.push(`Date: ${pmt.TxnDate}`);
      }
    }

    // Reference/PaymentRefNum match
    const pmtRef = pmt.PaymentRefNum || null;
    if (reference && pmtRef) {
      if (pmtRef === reference) {
        score += 30;
        matchReasons.push(`Reference matches: ${pmtRef}`);
      } else if (pmtRef.includes(reference) || reference.includes(pmtRef)) {
        score += 15;
        matchReasons.push(`Reference partial match: ${pmtRef}`);
      }
    }

    // Customer match
    const customerName = pmt.CustomerRef?.name || null;
    if (customerName) {
      matchReasons.push(`Customer: ${customerName}`);
    }

    if (score >= 30) {
      let confidence: "high" | "medium" | "low" = "low";
      if (score >= 70) confidence = "high";
      else if (score >= 50) confidence = "medium";

      candidates.push({
        qbId: pmt.Id,
        qbSyncToken: pmt.SyncToken,
        amount: pmt.TotalAmt,
        date: pmt.TxnDate,
        reference: pmtRef,
        vendorName: customerName,
        vendorId: pmt.CustomerRef?.value || null,
        payType: pmt.PaymentMethodRef?.name || null,
        confidence,
        matchReasons,
      });
    }
  }

  candidates.sort((a, b) => {
    const confOrder = { high: 0, medium: 1, low: 2 };
    return confOrder[a.confidence] - confOrder[b.confidence];
  });

  console.log(`Found ${candidates.length} potential payment duplicates`);
  return candidates;
}

async function findInvoiceDuplicates(
  qbHeaders: Record<string, string>,
  realmId: string,
  criteria: { amount?: number; date?: string; reference?: string }
): Promise<DuplicateCandidate[]> {
  const { amount, date, reference } = criteria;

  const conditions: string[] = [];

  if (date) {
    const targetDate = new Date(date);
    const startDate = new Date(targetDate);
    startDate.setDate(startDate.getDate() - 7);
    const endDate = new Date(targetDate);
    endDate.setDate(endDate.getDate() + 7);

    conditions.push(`TxnDate >= '${startDate.toISOString().split("T")[0]}'`);
    conditions.push(`TxnDate <= '${endDate.toISOString().split("T")[0]}'`);
  }

  let query = "SELECT * FROM Invoice";
  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(" AND ")}`;
  }
  query += " MAXRESULTS 100";

  console.log("QB invoice duplicate search query:", query);

  const url = `https://quickbooks.api.intuit.com/v3/company/${realmId}/query?query=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: qbHeaders });

  if (!res.ok) {
    const errText = await res.text();
    console.error("QB invoice query error:", errText);
    return [];
  }

  const data = await res.json();
  const invoices = data.QueryResponse?.Invoice || [];
  console.log(`Found ${invoices.length} invoices in QB within date range`);

  const candidates: DuplicateCandidate[] = [];

  for (const inv of invoices) {
    const matchReasons: string[] = [];
    let score = 0;

    // Amount match (exact)
    if (amount && Math.abs(inv.TotalAmt - amount) < 0.01) {
      score += 40;
      matchReasons.push(`Amount matches: $${inv.TotalAmt.toFixed(2)}`);
    }

    // Date proximity
    if (date && inv.TxnDate) {
      const daysDiff = Math.abs(
        (new Date(inv.TxnDate).getTime() - new Date(date).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysDiff === 0) {
        score += 30;
        matchReasons.push("Exact date match");
      } else if (daysDiff <= 1) {
        score += 20;
        matchReasons.push(`Date within 1 day (${inv.TxnDate})`);
      } else if (daysDiff <= 3) {
        score += 10;
        matchReasons.push(`Date within 3 days (${inv.TxnDate})`);
      } else {
        matchReasons.push(`Date: ${inv.TxnDate}`);
      }
    }

    // Reference/DocNumber match
    const invRef = inv.DocNumber || null;
    if (reference && invRef) {
      if (invRef === reference) {
        score += 30;
        matchReasons.push(`Invoice # matches: ${invRef}`);
      } else if (invRef.includes(reference) || reference.includes(invRef)) {
        score += 15;
        matchReasons.push(`Invoice # partial match: ${invRef}`);
      }
    }

    // Customer info
    const customerName = inv.CustomerRef?.name || null;
    if (customerName) {
      matchReasons.push(`Customer: ${customerName}`);
    }

    if (score >= 30) {
      let confidence: "high" | "medium" | "low" = "low";
      if (score >= 70) confidence = "high";
      else if (score >= 50) confidence = "medium";

      candidates.push({
        qbId: inv.Id,
        qbSyncToken: inv.SyncToken,
        amount: inv.TotalAmt,
        date: inv.TxnDate,
        reference: invRef,
        vendorName: customerName,
        vendorId: inv.CustomerRef?.value || null,
        payType: null,
        confidence,
        matchReasons,
      });
    }
  }

  candidates.sort((a, b) => {
    const confOrder = { high: 0, medium: 1, low: 2 };
    return confOrder[a.confidence] - confOrder[b.confidence];
  });

  console.log(`Found ${candidates.length} potential invoice duplicates`);
  return candidates;
}

async function findRefundReceiptDuplicates(
  qbHeaders: Record<string, string>,
  realmId: string,
  criteria: { amount?: number; date?: string; reference?: string }
): Promise<DuplicateCandidate[]> {
  const { amount, date, reference } = criteria;

  const conditions: string[] = [];

  if (date) {
    const targetDate = new Date(date);
    const startDate = new Date(targetDate);
    startDate.setDate(startDate.getDate() - 7);
    const endDate = new Date(targetDate);
    endDate.setDate(endDate.getDate() + 7);

    conditions.push(`TxnDate >= '${startDate.toISOString().split("T")[0]}'`);
    conditions.push(`TxnDate <= '${endDate.toISOString().split("T")[0]}'`);
  }

  let query = "SELECT * FROM RefundReceipt";
  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(" AND ")}`;
  }
  query += " MAXRESULTS 100";

  console.log("QB refund receipt duplicate search query:", query);

  const url = `https://quickbooks.api.intuit.com/v3/company/${realmId}/query?query=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: qbHeaders });

  if (!res.ok) {
    const errText = await res.text();
    console.error("QB refund receipt query error:", errText);
    return [];
  }

  const data = await res.json();
  const refundReceipts = data.QueryResponse?.RefundReceipt || [];
  console.log(`Found ${refundReceipts.length} refund receipts in QB within date range`);

  const candidates: DuplicateCandidate[] = [];

  for (const rr of refundReceipts) {
    const matchReasons: string[] = [];
    let score = 0;

    // Amount match (exact)
    if (amount && Math.abs(rr.TotalAmt - amount) < 0.01) {
      score += 40;
      matchReasons.push(`Amount matches: $${rr.TotalAmt.toFixed(2)}`);
    }

    // Date proximity
    if (date && rr.TxnDate) {
      const daysDiff = Math.abs(
        (new Date(rr.TxnDate).getTime() - new Date(date).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysDiff === 0) {
        score += 30;
        matchReasons.push("Exact date match");
      } else if (daysDiff <= 1) {
        score += 20;
        matchReasons.push(`Date within 1 day (${rr.TxnDate})`);
      } else if (daysDiff <= 3) {
        score += 10;
        matchReasons.push(`Date within 3 days (${rr.TxnDate})`);
      } else {
        matchReasons.push(`Date: ${rr.TxnDate}`);
      }
    }

    // Reference/DocNumber match
    const rrRef = rr.DocNumber || null;
    if (reference && rrRef) {
      if (rrRef === reference) {
        score += 30;
        matchReasons.push(`Reference matches: ${rrRef}`);
      } else if (rrRef.includes(reference) || reference.includes(rrRef)) {
        score += 15;
        matchReasons.push(`Reference partial match: ${rrRef}`);
      }
    }

    // Customer info
    const customerName = rr.CustomerRef?.name || null;
    if (customerName) {
      matchReasons.push(`Customer: ${customerName}`);
    }

    // Payment method info
    const payMethod = rr.PaymentMethodRef?.name || null;
    if (payMethod) {
      matchReasons.push(`Payment method: ${payMethod}`);
    }

    if (score >= 30) {
      let confidence: "high" | "medium" | "low" = "low";
      if (score >= 70) confidence = "high";
      else if (score >= 50) confidence = "medium";

      candidates.push({
        qbId: rr.Id,
        qbSyncToken: rr.SyncToken,
        amount: rr.TotalAmt,
        date: rr.TxnDate,
        reference: rrRef,
        vendorName: customerName,
        vendorId: rr.CustomerRef?.value || null,
        payType: payMethod,
        confidence,
        matchReasons,
      });
    }
  }

  candidates.sort((a, b) => {
    const confOrder = { high: 0, medium: 1, low: 2 };
    return confOrder[a.confidence] - confOrder[b.confidence];
  });

  console.log(`Found ${candidates.length} potential refund receipt duplicates`);
  return candidates;
}
