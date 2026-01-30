import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const QB_BASE_URL = "https://quickbooks.api.intuit.com/v3/company";

interface QBPayment {
  Id: string;
  TxnDate?: string;
  TotalAmt: number;
  CustomerRef: { value: string; name?: string };
  PaymentMethodRef?: { value: string; name?: string };
  DepositToAccountRef?: { value: string; name?: string };
  PaymentRefNum?: string;
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

    const { companyId, qbPaymentId, realmId, action } = await req.json();

    log("info", "QuickBooks fetch payment request", { companyId, qbPaymentId, realmId, action });

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
    
    // Use provided realmId if available (from webhook)
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

      // Get new tokens
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

    // Handle different actions
    if (action === "fetch-single") {
      // Fetch a specific payment by QB ID
      if (!qbPaymentId) {
        return new Response(
          JSON.stringify({ error: "qbPaymentId is required for fetch-single" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      log("info", `Fetching payment ${qbPaymentId} from QB`);
      
      const paymentRes = await fetch(`${QB_BASE_URL}/${effectiveRealmId}/payment/${qbPaymentId}`, {
        headers: qbHeaders,
      });

      if (!paymentRes.ok) {
        const errText = await paymentRes.text();
        log("error", `Failed to fetch payment from QB`, { status: paymentRes.status, error: errText });
        return new Response(
          JSON.stringify({ error: "Failed to fetch payment from QuickBooks", details: errText }),
          { status: paymentRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const paymentData = await paymentRes.json();
      const qbPayment: QBPayment = paymentData.Payment;
      
      log("info", "Fetched payment from QB", { 
        id: qbPayment.Id, 
        refNum: qbPayment.PaymentRefNum,
        customer: qbPayment.CustomerRef?.name,
        amount: qbPayment.TotalAmt,
        linkedTxns: qbPayment.Line?.flatMap(l => l.LinkedTxn || [])
      });

      // Try to match to a local project via customer mapping or linked invoice
      const customerId = qbPayment.CustomerRef?.value;
      const customerName = qbPayment.CustomerRef?.name;
      
      let projectId: string | null = null;
      let invoiceId: string | null = null;
      let matchMethod: string | null = null;

      // Method 1: Try to match via linked invoice
      const linkedInvoices = qbPayment.Line?.flatMap(l => 
        (l.LinkedTxn || []).filter(txn => txn.TxnType === "Invoice")
      ) || [];

      if (linkedInvoices.length > 0) {
        // Check if we have any of these invoices in our sync log
        const qbInvoiceIds = linkedInvoices.map(li => li.TxnId);
        
        const { data: invoiceSyncLog } = await supabase
          .from("quickbooks_sync_log")
          .select("record_id")
          .eq("company_id", companyId)
          .eq("record_type", "invoice")
          .in("quickbooks_id", qbInvoiceIds)
          .not("record_id", "is", null)
          .limit(1)
          .maybeSingle();

        if (invoiceSyncLog?.record_id) {
          invoiceId = invoiceSyncLog.record_id;
          
          // Get project from invoice
          const { data: invoice } = await supabase
            .from("project_invoices")
            .select("project_id")
            .eq("id", invoiceId)
            .single();

          if (invoice?.project_id) {
            projectId = invoice.project_id;
            matchMethod = "linked_invoice";
            log("info", "Matched via linked invoice", { invoiceId, projectId });
          }
        }
      }

      // Method 2: Check customer mappings (contact UUID -> QBO customer ID)
      if (!projectId && customerId) {
        const { data: customerMapping } = await supabase
          .from("quickbooks_mappings")
          .select("source_value")
          .eq("company_id", companyId)
          .eq("mapping_type", "customer")
          .eq("qbo_id", customerId)
          .maybeSingle();

        if (customerMapping?.source_value) {
          // source_value is a contact UUID, find project for this contact
          const { data: project } = await supabase
            .from("projects")
            .select("id")
            .eq("company_id", companyId)
            .eq("contact_uuid", customerMapping.source_value)
            .maybeSingle();

          if (project) {
            projectId = project.id;
            matchMethod = "customer_mapping";
            log("info", "Matched via customer mapping", { contactUuid: customerMapping.source_value, projectId });
          }
        }
      }

      // Method 3: Try to match by project name or customer name
      if (!projectId && customerName) {
        const { data: projectByName } = await supabase
          .from("projects")
          .select("id")
          .eq("company_id", companyId)
          .or(`project_name.ilike.%${customerName}%,project_address.ilike.%${customerName}%`)
          .maybeSingle();

        if (projectByName) {
          projectId = projectByName.id;
          matchMethod = "name_match";
          log("info", "Matched via name search", { customerName, projectId });
        }
      }

      if (!projectId) {
        log("warn", "Could not match payment to a local project", { customerId, customerName });
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "No matching project found",
            payment: {
              qb_id: qbPayment.Id,
              ref_num: qbPayment.PaymentRefNum,
              customer_name: customerName,
              amount: qbPayment.TotalAmt,
            }
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if payment already exists in our DB
      const { data: existingPayment } = await supabase
        .from("quickbooks_sync_log")
        .select("record_id")
        .eq("company_id", companyId)
        .eq("record_type", "payment")
        .eq("quickbooks_id", qbPayment.Id)
        .maybeSingle();

      if (existingPayment?.record_id) {
        log("info", "Payment already exists locally", { recordId: existingPayment.record_id });
        return new Response(
          JSON.stringify({ 
            success: true, 
            action: "already_exists",
            paymentId: existingPayment.record_id 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Map payment method
      let paymentMethod = "other";
      const qbPaymentMethodName = qbPayment.PaymentMethodRef?.name?.toLowerCase() || "";
      if (qbPaymentMethodName.includes("check")) {
        paymentMethod = "check";
      } else if (qbPaymentMethodName.includes("cash")) {
        paymentMethod = "cash";
      } else if (qbPaymentMethodName.includes("credit") || qbPaymentMethodName.includes("card")) {
        paymentMethod = "credit_card";
      } else if (qbPaymentMethodName.includes("ach") || qbPaymentMethodName.includes("transfer") || qbPaymentMethodName.includes("wire")) {
        paymentMethod = "ach";
      }

      // Create the payment in our database
      const { data: newPayment, error: insertError } = await supabase
        .from("project_payments")
        .insert({
          project_id: projectId,
          company_id: companyId,
          invoice_id: invoiceId, // Link to invoice if we found one
          payment_amount: qbPayment.TotalAmt || 0,
          payment_date: qbPayment.TxnDate || new Date().toISOString().split("T")[0],
          payment_method: paymentMethod,
          payment_reference: qbPayment.PaymentRefNum || null,
          notes: qbPayment.PrivateNote || null,
          bank_name: qbPayment.DepositToAccountRef?.name || null,
        })
        .select()
        .single();

      if (insertError) {
        log("error", "Failed to create payment", { error: insertError.message });
        return new Response(
          JSON.stringify({ error: "Failed to create payment", details: insertError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create sync log entry
      await supabase.from("quickbooks_sync_log").insert({
        company_id: companyId,
        record_type: "payment",
        record_id: newPayment.id,
        quickbooks_id: qbPayment.Id,
        sync_status: "synced",
        last_sync_at: new Date().toISOString(),
      });

      log("info", "Created payment successfully", { paymentId: newPayment.id, matchMethod, invoiceId });

      const duration = Date.now() - startTime;
      return new Response(
        JSON.stringify({ 
          success: true, 
          action: "created",
          paymentId: newPayment.id,
          projectId,
          invoiceId,
          matchMethod,
          duration: `${duration}ms`
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: process-pending - Process all pending payments from sync log
    if (action === "process-pending") {
      log("info", "Processing pending payments from sync log");

      // Find all payments that were created in QB but not yet imported
      const { data: pendingLogs } = await supabase
        .from("quickbooks_sync_log")
        .select("*")
        .eq("company_id", companyId)
        .eq("record_type", "payment")
        .eq("sync_status", "created_in_qb")
        .is("record_id", null);

      if (!pendingLogs || pendingLogs.length === 0) {
        log("info", "No pending payments to process");
        return new Response(
          JSON.stringify({ success: true, processed: 0, failed: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      log("info", `Found ${pendingLogs.length} pending payments to process`);

      let processed = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const log_entry of pendingLogs) {
        try {
          // Recursively call ourselves to fetch and import this payment
          const result = await supabase.functions.invoke("quickbooks-fetch-payment", {
            body: {
              companyId,
              qbPaymentId: log_entry.quickbooks_id,
              action: "fetch-single"
            }
          });

          if (result.error || result.data?.error) {
            failed++;
            errors.push(`Payment ${log_entry.quickbooks_id}: ${result.data?.error || result.error}`);
            
            // Update sync log with error
            await supabase
              .from("quickbooks_sync_log")
              .update({ 
                sync_status: "import_failed",
                error_message: result.data?.error || String(result.error)
              })
              .eq("id", log_entry.id);
          } else {
            processed++;
            
            // Update sync log to mark as processed
            if (result.data?.paymentId) {
              await supabase
                .from("quickbooks_sync_log")
                .update({ 
                  record_id: result.data.paymentId,
                  sync_status: "synced",
                  last_sync_at: new Date().toISOString(),
                  error_message: null
                })
                .eq("id", log_entry.id);
            }
          }
        } catch (err) {
          failed++;
          errors.push(`Payment ${log_entry.quickbooks_id}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      const duration = Date.now() - startTime;
      log("info", `Processed ${processed} payments, ${failed} failed`, { duration: `${duration}ms` });

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
