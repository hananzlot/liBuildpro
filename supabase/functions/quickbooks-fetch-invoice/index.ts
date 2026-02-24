import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const QB_BASE_URL = "https://quickbooks.api.intuit.com/v3/company";

interface QBInvoice {
  Id: string;
  DocNumber?: string;
  TxnDate?: string;
  DueDate?: string;
  TotalAmt: number;
  Balance?: number;
  CustomerRef: { value: string; name?: string };
  Line: Array<{
    Amount: number;
    Description?: string;
    DetailType: string;
    SalesItemLineDetail?: {
      ItemRef?: { value: string; name?: string };
      Qty?: number;
      UnitPrice?: number;
    };
  }>;
  PrivateNote?: string;
  CustomerMemo?: { value: string };
  BillEmail?: { Address: string };
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

    const { companyId, qbInvoiceId, realmId, action } = await req.json();

    log("info", "QuickBooks fetch invoice request", { companyId, qbInvoiceId, realmId, action });

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
      // Fetch a specific invoice by QB ID
      if (!qbInvoiceId) {
        return new Response(
          JSON.stringify({ error: "qbInvoiceId is required for fetch-single" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      log("info", `Fetching invoice ${qbInvoiceId} from QB`);
      
      const invoiceRes = await fetch(`${QB_BASE_URL}/${effectiveRealmId}/invoice/${qbInvoiceId}`, {
        headers: qbHeaders,
      });

      if (!invoiceRes.ok) {
        const errText = await invoiceRes.text();
        log("error", `Failed to fetch invoice from QB`, { status: invoiceRes.status, error: errText });
        return new Response(
          JSON.stringify({ error: "Failed to fetch invoice from QuickBooks", details: errText }),
          { status: invoiceRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const invoiceData = await invoiceRes.json();
      const qbInvoice: QBInvoice = invoiceData.Invoice;
      
      log("info", "Fetched invoice from QB", { 
        id: qbInvoice.Id, 
        docNumber: qbInvoice.DocNumber,
        customer: qbInvoice.CustomerRef?.name,
        amount: qbInvoice.TotalAmt
      });

      // Try to match to a local project via customer mapping
      const customerId = qbInvoice.CustomerRef?.value;
      const customerName = qbInvoice.CustomerRef?.name;
      
      let projectId: string | null = null;
      let matchMethod: string | null = null;

      // Method 1: Check customer mappings (contact UUID -> QBO customer ID)
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

      // Method 2: Try to match by project name or customer name
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
        log("warn", "Could not match invoice to a local project — saving as unlinked", { customerId, customerName });
      }

      // Check if invoice already exists in our DB
      const { data: existingInvoice } = await supabase
        .from("quickbooks_sync_log")
        .select("record_id")
        .eq("company_id", companyId)
        .eq("record_type", "invoice")
        .eq("quickbooks_id", qbInvoice.Id)
        .maybeSingle();

      if (existingInvoice?.record_id) {
        log("info", "Invoice already exists locally", { recordId: existingInvoice.record_id });
        return new Response(
          JSON.stringify({ 
            success: true, 
            action: "already_exists",
            invoiceId: existingInvoice.record_id 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create the invoice in our database
      // Calculate open balance from QB data
      const openBalance = qbInvoice.Balance ?? qbInvoice.TotalAmt ?? 0;
      const paymentsReceived = (qbInvoice.TotalAmt || 0) - openBalance;

      const { data: newInvoice, error: insertError } = await supabase
        .from("project_invoices")
        .insert({
          project_id: projectId,
          company_id: companyId,
          invoice_number: qbInvoice.DocNumber || `QB-${qbInvoice.Id}`,
          amount: qbInvoice.TotalAmt || 0,
          invoice_date: qbInvoice.TxnDate || new Date().toISOString().split("T")[0],
          total_expected: qbInvoice.TotalAmt || 0,
          payments_received: paymentsReceived,
          open_balance: openBalance,
        })
        .select()
        .single();

      if (insertError) {
        log("error", "Failed to create invoice", { error: insertError.message });
        return new Response(
          JSON.stringify({ error: "Failed to create invoice", details: insertError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create sync log entry
      const { error: syncLogError } = await supabase.from("quickbooks_sync_log").insert({
        company_id: companyId,
        record_type: "invoice",
        record_id: newInvoice.id,
        quickbooks_id: qbInvoice.Id,
        sync_status: "synced",
        synced_at: new Date().toISOString(),
      });
      
      if (syncLogError) {
        log("warn", "Failed to create sync log entry", { error: syncLogError.message });
      }

      log("info", "Created invoice successfully", { invoiceId: newInvoice.id, matchMethod });

      const duration = Date.now() - startTime;
      return new Response(
        JSON.stringify({ 
          success: true, 
          action: "created",
          invoiceId: newInvoice.id,
          projectId,
          matchMethod,
          duration: `${duration}ms`
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: update-existing - Update an existing invoice from QB data
    if (action === "update-existing") {
      if (!qbInvoiceId) {
        return new Response(
          JSON.stringify({ error: "qbInvoiceId is required for update-existing" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      log("info", `Fetching invoice ${qbInvoiceId} from QB for update`);
      
      const invoiceRes = await fetch(`${QB_BASE_URL}/${effectiveRealmId}/invoice/${qbInvoiceId}`, {
        headers: qbHeaders,
      });

      if (!invoiceRes.ok) {
        const errText = await invoiceRes.text();
        log("error", `Failed to fetch invoice from QB`, { status: invoiceRes.status, error: errText });
        return new Response(
          JSON.stringify({ error: "Failed to fetch invoice from QuickBooks", details: errText }),
          { status: invoiceRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const invoiceData = await invoiceRes.json();
      const qbInvoice: QBInvoice = invoiceData.Invoice;
      
      log("info", "Fetched invoice from QB for update", { 
        id: qbInvoice.Id, 
        docNumber: qbInvoice.DocNumber,
        customer: qbInvoice.CustomerRef?.name,
        amount: qbInvoice.TotalAmt
      });

      // Find existing invoice by looking up sync log first (primary source of truth)
      let invoiceId: string | null = null;
      
      // Check sync log - this is the ONLY definitive way to match
      const { data: syncLog } = await supabase
        .from("quickbooks_sync_log")
        .select("record_id")
        .eq("company_id", companyId)
        .eq("record_type", "invoice")
        .eq("quickbooks_id", qbInvoice.Id)
        .maybeSingle();
      
      if (syncLog?.record_id) {
        invoiceId = syncLog.record_id;
        log("info", "Found invoice via sync log", { invoiceId });
      } else {
        // No sync log entry - try fallback matching but exclude already-synced invoices
        log("info", `No sync log for QB Invoice ${qbInvoice.Id}, attempting fallback matching`);
        
        // Get all invoice IDs already synced to a DIFFERENT QB invoice
        const { data: alreadySyncedInvoices } = await supabase
          .from("quickbooks_sync_log")
          .select("record_id")
          .eq("company_id", companyId)
          .eq("record_type", "invoice")
          .neq("quickbooks_id", qbInvoice.Id)
          .not("record_id", "is", null);
        
        const excludedInvoiceIds = (alreadySyncedInvoices || []).map(i => i.record_id);
        log("info", "Excluding already-synced invoices from fallback match", { 
          excludedCount: excludedInvoiceIds.length 
        });
        
        // Fallback: Try to find by invoice number
        if (qbInvoice.DocNumber) {
          let query = supabase
            .from("project_invoices")
            .select("id")
            .eq("company_id", companyId)
            .eq("invoice_number", qbInvoice.DocNumber);
          
          if (excludedInvoiceIds.length > 0) {
            query = query.not("id", "in", `(${excludedInvoiceIds.join(",")})`);
          }
          
          const { data: existingInvoice } = await query.maybeSingle();
          
          if (existingInvoice) {
            invoiceId = existingInvoice.id;
            log("info", "Found invoice via invoice number (fallback)", { invoiceId, docNumber: qbInvoice.DocNumber });
          }
        }
        
        // Fallback 2: Try to match by amount and date
        if (!invoiceId) {
          let query = supabase
            .from("project_invoices")
            .select("id")
            .eq("company_id", companyId)
            .eq("amount", qbInvoice.TotalAmt)
            .eq("invoice_date", qbInvoice.TxnDate);
          
          if (excludedInvoiceIds.length > 0) {
            query = query.not("id", "in", `(${excludedInvoiceIds.join(",")})`);
          }
          
          const { data: matchByAmountDate } = await query.maybeSingle();
          
          if (matchByAmountDate) {
            invoiceId = matchByAmountDate.id;
            log("info", "Found invoice via amount+date (fallback)", { invoiceId });
          }
        }
      }

      if (!invoiceId) {
        log("warn", "Could not find existing invoice to update", { qbId: qbInvoice.Id, docNumber: qbInvoice.DocNumber });
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "No matching invoice found to update",
            qbId: qbInvoice.Id,
            docNumber: qbInvoice.DocNumber
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Calculate values from QB data
      const openBalance = qbInvoice.Balance ?? qbInvoice.TotalAmt ?? 0;
      const paymentsReceived = (qbInvoice.TotalAmt || 0) - openBalance;

      // Update the invoice
      const { error: updateError } = await supabase
        .from("project_invoices")
        .update({
          amount: qbInvoice.TotalAmt || 0,
          invoice_date: qbInvoice.TxnDate || undefined,
          total_expected: qbInvoice.TotalAmt || 0,
          payments_received: paymentsReceived,
          open_balance: openBalance,
        })
        .eq("id", invoiceId);

      if (updateError) {
        log("error", "Failed to update invoice", { error: updateError.message });
        return new Response(
          JSON.stringify({ error: "Failed to update invoice", details: updateError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Upsert sync log entry to ensure mapping exists
      const { error: syncLogError } = await supabase
        .from("quickbooks_sync_log")
        .upsert({
          company_id: companyId,
          record_type: "invoice",
          record_id: invoiceId,
          quickbooks_id: qbInvoice.Id,
          sync_status: "synced",
          synced_at: new Date().toISOString(),
        }, {
          onConflict: "company_id,record_type,quickbooks_id"
        });
      
      if (syncLogError) {
        log("warn", "Failed to upsert sync log entry", { error: syncLogError.message });
      }

      log("info", "Updated invoice successfully", { invoiceId });

      const duration = Date.now() - startTime;
      return new Response(
        JSON.stringify({ 
          success: true, 
          action: "updated",
          invoiceId,
          duration: `${duration}ms`
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: process-pending - Process all pending invoices from sync log
    if (action === "process-pending") {
      log("info", "Processing pending invoices from sync log");

      // Find all invoices that were created in QB but not yet imported
      const { data: pendingLogs } = await supabase
        .from("quickbooks_sync_log")
        .select("*")
        .eq("company_id", companyId)
        .eq("record_type", "invoice")
        .eq("sync_status", "created_in_qb")
        .is("record_id", null);

      if (!pendingLogs || pendingLogs.length === 0) {
        log("info", "No pending invoices to process");
        return new Response(
          JSON.stringify({ success: true, processed: 0, failed: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      log("info", `Found ${pendingLogs.length} pending invoices to process`);

      let processed = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const log_entry of pendingLogs) {
        try {
          // Recursively call ourselves to fetch and import this invoice
          const result = await supabase.functions.invoke("quickbooks-fetch-invoice", {
            body: {
              companyId,
              qbInvoiceId: log_entry.quickbooks_id,
              action: "fetch-single"
            }
          });

          if (result.error || result.data?.error) {
            failed++;
            errors.push(`Invoice ${log_entry.quickbooks_id}: ${result.data?.error || result.error}`);
            
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
            if (result.data?.invoiceId) {
              await supabase
                .from("quickbooks_sync_log")
                .update({ 
                  record_id: result.data.invoiceId,
                  sync_status: "synced",
                  last_sync_at: new Date().toISOString(),
                  error_message: null
                })
                .eq("id", log_entry.id);
            }
          }
        } catch (err) {
          failed++;
          errors.push(`Invoice ${log_entry.quickbooks_id}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      const duration = Date.now() - startTime;
      log("info", `Processed ${processed} invoices, ${failed} failed`, { duration: `${duration}ms` });

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
