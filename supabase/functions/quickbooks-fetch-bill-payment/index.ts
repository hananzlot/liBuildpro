import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const QB_BASE_URL = "https://quickbooks.api.intuit.com/v3/company";

interface QBBillPayment {
  Id: string;
  TxnDate?: string;
  TotalAmt: number;
  VendorRef: { value: string; name?: string };
  PayType: "Check" | "CreditCard";
  CheckPayment?: {
    BankAccountRef?: { value: string; name?: string };
    PrintStatus?: string;
  };
  CreditCardPayment?: {
    CCAccountRef?: { value: string; name?: string };
  };
  DocNumber?: string;
  PrivateNote?: string;
  Line?: Array<{
    Amount: number;
    LinkedTxn?: Array<{
      TxnId: string;
      TxnType: string;
    }>;
  }>;
}

Deno.serve(async (req) => {
  const startTime = Date.now();
  const requestId = crypto.randomUUID().slice(0, 8);
  
  const log = (level: string, message: string, data?: unknown) => {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${requestId}] [${level.toUpperCase()}]`;
    if (data) {
      console.log(`${prefix} ${message}`, JSON.stringify(data, null, 2));
    } else {
      console.log(`${prefix} ${message}`);
    }
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { companyId, qbBillPaymentId, realmId, action } = await req.json();

    log("info", "QuickBooks fetch bill payment request", { companyId, qbBillPaymentId, realmId, action });

    if (!companyId) {
      return new Response(
        JSON.stringify({ error: "companyId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get QuickBooks tokens
    const { data: tokenData, error: tokenError } = await supabase.rpc("get_quickbooks_tokens", {
      p_company_id: companyId,
    });

    if (tokenError || !tokenData || tokenData.length === 0) {
      log("error", "No QuickBooks connection found");
      return new Response(
        JSON.stringify({ error: "QuickBooks not connected" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let { access_token, refresh_token, realm_id, token_expires_at } = tokenData[0];
    const effectiveRealmId = realmId || realm_id;

    // Check if token needs refresh
    if (new Date(token_expires_at) <= new Date()) {
      log("info", "Token expired, refreshing...");
      const refreshResult = await supabase.functions.invoke("quickbooks-auth", {
        body: { action: "refresh-token", companyId },
      });

      if (refreshResult.error || refreshResult.data?.error) {
        log("error", "Token refresh failed", refreshResult.error || refreshResult.data?.error);
        return new Response(
          JSON.stringify({ error: "Token refresh failed", needsReauth: true }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: newTokenData } = await supabase.rpc("get_quickbooks_tokens", {
        p_company_id: companyId,
      });
      access_token = newTokenData[0].access_token;
    }

    const qbHeaders = {
      "Authorization": `Bearer ${access_token}`,
      "Accept": "application/json",
      "Content-Type": "application/json",
    };

    if (action === "fetch-single") {
      if (!qbBillPaymentId) {
        return new Response(
          JSON.stringify({ error: "qbBillPaymentId is required for fetch-single" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      log("info", `Fetching bill payment ${qbBillPaymentId} from QB`);
      
      const billPaymentRes = await fetch(`${QB_BASE_URL}/${effectiveRealmId}/billpayment/${qbBillPaymentId}`, {
        headers: qbHeaders,
      });

      if (!billPaymentRes.ok) {
        const errText = await billPaymentRes.text();
        log("error", `Failed to fetch bill payment from QB`, { status: billPaymentRes.status, error: errText });
        return new Response(
          JSON.stringify({ error: "Failed to fetch bill payment from QuickBooks", details: errText }),
          { status: billPaymentRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const billPaymentData = await billPaymentRes.json();
      const qbBillPayment: QBBillPayment = billPaymentData.BillPayment;
      
      log("info", "Fetched bill payment from QB", { 
        id: qbBillPayment.Id, 
        docNumber: qbBillPayment.DocNumber,
        vendor: qbBillPayment.VendorRef?.name,
        amount: qbBillPayment.TotalAmt,
        payType: qbBillPayment.PayType,
        linkedBills: qbBillPayment.Line?.flatMap(l => l.LinkedTxn || [])
      });

      const vendorName = qbBillPayment.VendorRef?.name;
      
      let billId: string | null = null;
      let matchMethod: string | null = null;

      // Method 1: Try to match via linked bill
      const linkedBills = qbBillPayment.Line?.flatMap(l => 
        (l.LinkedTxn || []).filter(txn => txn.TxnType === "Bill")
      ) || [];

      if (linkedBills.length > 0) {
        const qbBillIds = linkedBills.map(lb => lb.TxnId);
        
        const { data: billSyncLog } = await supabase
          .from("quickbooks_sync_log")
          .select("record_id")
          .eq("company_id", companyId)
          .eq("record_type", "bill")
          .in("quickbooks_id", qbBillIds)
          .not("record_id", "is", null)
          .limit(1)
          .maybeSingle();

        if (billSyncLog?.record_id) {
          billId = billSyncLog.record_id;
          matchMethod = "linked_bill";
          log("info", "Matched via linked bill", { billId });
        }
      }

      // Method 2: If no linked bill found, try to find the most recent unpaid bill from this vendor
      if (!billId && vendorName) {
        const { data: recentBill } = await supabase
          .from("project_bills")
          .select("id")
          .eq("company_id", companyId)
          .ilike("installer_company", `%${vendorName}%`)
          .neq("status", "paid")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (recentBill) {
          billId = recentBill.id;
          matchMethod = "vendor_recent_bill";
          log("info", "Matched via recent unpaid bill from vendor", { vendorName, billId });
        }
      }

      if (!billId) {
        log("warn", "Could not match bill payment to a local bill", { vendorName });
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "No matching bill found",
            billPayment: {
              qb_id: qbBillPayment.Id,
              doc_number: qbBillPayment.DocNumber,
              vendor_name: vendorName,
              amount: qbBillPayment.TotalAmt,
            }
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if bill payment already exists in our DB
      const { data: existingBillPayment } = await supabase
        .from("quickbooks_sync_log")
        .select("record_id")
        .eq("company_id", companyId)
        .eq("record_type", "bill_payment")
        .eq("quickbooks_id", qbBillPayment.Id)
        .maybeSingle();

      if (existingBillPayment?.record_id) {
        log("info", "Bill payment already exists locally", { recordId: existingBillPayment.record_id });
        return new Response(
          JSON.stringify({ 
            success: true, 
            action: "already_exists",
            billPaymentId: existingBillPayment.record_id 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Map payment method
      let paymentMethod = "other";
      if (qbBillPayment.PayType === "Check") {
        paymentMethod = "check";
      } else if (qbBillPayment.PayType === "CreditCard") {
        paymentMethod = "credit_card";
      }

      // Get bank name
      const bankName = qbBillPayment.PayType === "Check" 
        ? qbBillPayment.CheckPayment?.BankAccountRef?.name 
        : qbBillPayment.CreditCardPayment?.CCAccountRef?.name;

      // Create the bill payment in our database
      const { data: newBillPayment, error: insertError } = await supabase
        .from("bill_payments")
        .insert({
          bill_id: billId,
          company_id: companyId,
          payment_amount: qbBillPayment.TotalAmt || 0,
          payment_date: qbBillPayment.TxnDate || new Date().toISOString().split("T")[0],
          payment_method: paymentMethod,
          payment_reference: qbBillPayment.DocNumber || null,
          bank_name: bankName || null,
        })
        .select()
        .single();

      if (insertError) {
        log("error", "Failed to create bill payment", { error: insertError.message });
        return new Response(
          JSON.stringify({ error: "Failed to create bill payment", details: insertError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update the bill status if fully paid
      const { data: bill } = await supabase
        .from("project_bills")
        .select("bill_amount")
        .eq("id", billId)
        .single();

      if (bill) {
        const { data: allPayments } = await supabase
          .from("bill_payments")
          .select("payment_amount")
          .eq("bill_id", billId);

        const totalPaid = (allPayments || []).reduce((sum, p) => sum + (p.payment_amount || 0), 0);
        
        if (totalPaid >= (bill.bill_amount || 0)) {
          await supabase
            .from("project_bills")
            .update({ status: "paid" })
            .eq("id", billId);
          log("info", "Bill marked as paid", { billId, totalPaid, billAmount: bill.bill_amount });
        }
      }

      // Create sync log entry
      await supabase.from("quickbooks_sync_log").insert({
        company_id: companyId,
        record_type: "bill_payment",
        record_id: newBillPayment.id,
        quickbooks_id: qbBillPayment.Id,
        sync_status: "synced",
        last_sync_at: new Date().toISOString(),
      });

      log("info", "Created bill payment successfully", { billPaymentId: newBillPayment.id, matchMethod, billId });

      const duration = Date.now() - startTime;
      return new Response(
        JSON.stringify({ 
          success: true, 
          action: "created",
          billPaymentId: newBillPayment.id,
          billId,
          matchMethod,
          duration: `${duration}ms`
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: process-pending
    if (action === "process-pending") {
      log("info", "Processing pending bill payments from sync log");

      const { data: pendingLogs } = await supabase
        .from("quickbooks_sync_log")
        .select("*")
        .eq("company_id", companyId)
        .eq("record_type", "bill_payment")
        .eq("sync_status", "created_in_qb")
        .is("record_id", null);

      if (!pendingLogs || pendingLogs.length === 0) {
        log("info", "No pending bill payments to process");
        return new Response(
          JSON.stringify({ success: true, processed: 0, failed: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      log("info", `Found ${pendingLogs.length} pending bill payments to process`);

      let processed = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const log_entry of pendingLogs) {
        try {
          const result = await supabase.functions.invoke("quickbooks-fetch-bill-payment", {
            body: {
              companyId,
              qbBillPaymentId: log_entry.quickbooks_id,
              action: "fetch-single"
            }
          });

          if (result.error || result.data?.error) {
            failed++;
            errors.push(`BillPayment ${log_entry.quickbooks_id}: ${result.data?.error || result.error}`);
            
            await supabase
              .from("quickbooks_sync_log")
              .update({ 
                sync_status: "import_failed",
                error_message: result.data?.error || String(result.error)
              })
              .eq("id", log_entry.id);
          } else {
            processed++;
            
            if (result.data?.billPaymentId) {
              await supabase
                .from("quickbooks_sync_log")
                .update({ 
                  record_id: result.data.billPaymentId,
                  sync_status: "synced",
                  last_sync_at: new Date().toISOString(),
                  error_message: null
                })
                .eq("id", log_entry.id);
            }
          }
        } catch (err) {
          failed++;
          errors.push(`BillPayment ${log_entry.quickbooks_id}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      const duration = Date.now() - startTime;
      log("info", `Processed ${processed} bill payments, ${failed} failed`, { duration: `${duration}ms` });

      return new Response(
        JSON.stringify({ success: true, processed, failed, errors }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use 'fetch-single' or 'process-pending'" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[${requestId}] Error after ${duration}ms:`, error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
