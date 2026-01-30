import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const QB_BASE_URL = "https://quickbooks.api.intuit.com/v3/company";

interface QBBill {
  Id: string;
  DocNumber?: string;
  TxnDate?: string;
  DueDate?: string;
  TotalAmt: number;
  Balance?: number;
  VendorRef: { value: string; name?: string };
  APAccountRef?: { value: string; name?: string };
  Line?: Array<{
    Amount: number;
    Description?: string;
    DetailType: string;
    AccountBasedExpenseLineDetail?: {
      AccountRef?: { value: string; name?: string };
      CustomerRef?: { value: string; name?: string };
    };
    ItemBasedExpenseLineDetail?: {
      ItemRef?: { value: string; name?: string };
      CustomerRef?: { value: string; name?: string };
      Qty?: number;
      UnitPrice?: number;
    };
  }>;
  PrivateNote?: string;
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

    const { companyId, qbBillId, realmId, action } = await req.json();

    log("info", "QuickBooks fetch bill request", { companyId, qbBillId, realmId, action });

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
      if (!qbBillId) {
        return new Response(
          JSON.stringify({ error: "qbBillId is required for fetch-single" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      log("info", `Fetching bill ${qbBillId} from QB`);
      
      const billRes = await fetch(`${QB_BASE_URL}/${effectiveRealmId}/bill/${qbBillId}`, {
        headers: qbHeaders,
      });

      if (!billRes.ok) {
        const errText = await billRes.text();
        log("error", `Failed to fetch bill from QB`, { status: billRes.status, error: errText });
        return new Response(
          JSON.stringify({ error: "Failed to fetch bill from QuickBooks", details: errText }),
          { status: billRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const billData = await billRes.json();
      const qbBill: QBBill = billData.Bill;
      
      log("info", "Fetched bill from QB", { 
        id: qbBill.Id, 
        docNumber: qbBill.DocNumber,
        vendor: qbBill.VendorRef?.name,
        amount: qbBill.TotalAmt
      });

      const vendorId = qbBill.VendorRef?.value;
      const vendorName = qbBill.VendorRef?.name;
      
      let projectId: string | null = null;
      let subcontractorId: string | null = null;
      let matchMethod: string | null = null;

      // Method 1: Check vendor mappings (subcontractor ID -> QBO vendor ID)
      if (vendorId) {
        const { data: vendorMapping } = await supabase
          .from("quickbooks_mappings")
          .select("source_value")
          .eq("company_id", companyId)
          .eq("mapping_type", "vendor")
          .eq("qbo_id", vendorId)
          .maybeSingle();

        if (vendorMapping?.source_value) {
          subcontractorId = vendorMapping.source_value;
          matchMethod = "vendor_mapping";
          log("info", "Matched via vendor mapping", { subcontractorId });
        }
      }

      // Method 2: Try to find subcontractor by name match
      if (!subcontractorId && vendorName) {
        const { data: subByName } = await supabase
          .from("subcontractors")
          .select("id")
          .eq("company_id", companyId)
          .ilike("name", `%${vendorName}%`)
          .maybeSingle();

        if (subByName) {
          subcontractorId = subByName.id;
          matchMethod = "name_match";
          log("info", "Matched via name search", { vendorName, subcontractorId });
        }
      }

      // Method 3: Try to find project via CustomerRef in line items (job costing)
      const customerRefs = qbBill.Line?.flatMap(l => {
        const ref = l.AccountBasedExpenseLineDetail?.CustomerRef || l.ItemBasedExpenseLineDetail?.CustomerRef;
        return ref ? [ref] : [];
      }) || [];

      if (customerRefs.length > 0) {
        const customerIds = customerRefs.map(c => c.value);
        
        // Check customer mappings
        const { data: customerMapping } = await supabase
          .from("quickbooks_mappings")
          .select("source_value")
          .eq("company_id", companyId)
          .eq("mapping_type", "customer")
          .in("qbo_id", customerIds)
          .maybeSingle();

        if (customerMapping?.source_value) {
          const { data: project } = await supabase
            .from("projects")
            .select("id")
            .eq("company_id", companyId)
            .eq("contact_uuid", customerMapping.source_value)
            .maybeSingle();

          if (project) {
            projectId = project.id;
            if (!matchMethod) matchMethod = "customer_ref_mapping";
            log("info", "Matched project via CustomerRef", { projectId });
          }
        }

        // Fallback: try name matching on customer
        if (!projectId && customerRefs[0]?.name) {
          const customerName = customerRefs[0].name;
          const { data: projectByName } = await supabase
            .from("projects")
            .select("id")
            .eq("company_id", companyId)
            .or(`project_name.ilike.%${customerName}%,project_address.ilike.%${customerName}%`)
            .maybeSingle();

          if (projectByName) {
            projectId = projectByName.id;
            if (!matchMethod) matchMethod = "customer_ref_name";
            log("info", "Matched project via CustomerRef name", { customerName, projectId });
          }
        }
      }

      // If we found a subcontractor but no project, check if they have a default project assignment
      if (subcontractorId && !projectId) {
        // Get the most recent bill for this subcontractor to default to that project
        const { data: recentBill } = await supabase
          .from("project_bills")
          .select("project_id")
          .eq("company_id", companyId)
          .eq("subcontractor_id", subcontractorId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (recentBill?.project_id) {
          projectId = recentBill.project_id;
          matchMethod = matchMethod ? `${matchMethod}+recent_project` : "recent_project";
          log("info", "Using most recent project for subcontractor", { projectId });
        }
      }

      // Check if bill already exists in our DB
      const { data: existingBill } = await supabase
        .from("quickbooks_sync_log")
        .select("record_id")
        .eq("company_id", companyId)
        .eq("record_type", "bill")
        .eq("quickbooks_id", qbBill.Id)
        .maybeSingle();

      if (existingBill?.record_id) {
        log("info", "Bill already exists locally", { recordId: existingBill.record_id });
        return new Response(
          JSON.stringify({ 
            success: true, 
            action: "already_exists",
            billId: existingBill.record_id 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Build description from line items
      const description = qbBill.Line
        ?.filter(l => l.DetailType === "AccountBasedExpenseLineDetail" || l.DetailType === "ItemBasedExpenseLineDetail")
        ?.map(l => l.Description || l.AccountBasedExpenseLineDetail?.AccountRef?.name || l.ItemBasedExpenseLineDetail?.ItemRef?.name)
        ?.filter(Boolean)
        ?.join("; ") || "";

      // Create the bill in our database
      // Note: project_bills uses installer_company, bill_ref, memo, bill_amount
      // Balance from QB indicates how much is still owed (TotalAmt - payments applied)
      const { data: newBill, error: insertError } = await supabase
        .from("project_bills")
        .insert({
          project_id: projectId, // May be null if no project match
          company_id: companyId,
          installer_company: vendorName || "Unknown Vendor",
          bill_amount: qbBill.TotalAmt || 0,
          balance: qbBill.Balance ?? qbBill.TotalAmt ?? 0, // Use QB Balance, fallback to TotalAmt
          bill_ref: qbBill.DocNumber || null,
          memo: [description, qbBill.PrivateNote].filter(Boolean).join(" | ") || null,
          scheduled_payment_date: qbBill.DueDate || null,
        })
        .select()
        .single();

      if (insertError) {
        log("error", "Failed to create bill", { error: insertError.message });
        return new Response(
          JSON.stringify({ error: "Failed to create bill", details: insertError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create sync log entry
      const { error: syncLogError } = await supabase.from("quickbooks_sync_log").insert({
        company_id: companyId,
        record_type: "bill",
        record_id: newBill.id,
        quickbooks_id: qbBill.Id,
        sync_status: "synced",
        synced_at: new Date().toISOString(),
      });
      
      if (syncLogError) {
        log("error", "Failed to create sync log entry", { error: syncLogError.message });
      }

      log("info", "Created bill successfully", { billId: newBill.id, matchMethod, projectId, subcontractorId });

      const duration = Date.now() - startTime;
      return new Response(
        JSON.stringify({ 
          success: true, 
          action: "created",
          billId: newBill.id,
          projectId,
          subcontractorId,
          matchMethod,
          duration: `${duration}ms`
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: update-existing - Update an existing local bill from QB data
    if (action === "update-existing") {
      if (!qbBillId) {
        return new Response(
          JSON.stringify({ error: "qbBillId is required for update-existing" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      log("info", `Updating existing bill from QB ${qbBillId}`);

      // Find the existing local bill via sync log (primary source of truth)
      const { data: existingSyncLog } = await supabase
        .from("quickbooks_sync_log")
        .select("record_id")
        .eq("company_id", companyId)
        .eq("record_type", "bill")
        .eq("quickbooks_id", qbBillId)
        .maybeSingle();

      let localBillId = existingSyncLog?.record_id;

      // If no sync log entry, try fallback matching
      if (!localBillId) {
        log("info", `No sync log for QB Bill ${qbBillId}, fetching from QB to find match`);

        // Fetch the bill from QuickBooks
        const billRes = await fetch(`${QB_BASE_URL}/${effectiveRealmId}/bill/${qbBillId}`, {
          headers: qbHeaders,
        });

        if (!billRes.ok) {
          const errText = await billRes.text();
          log("error", `Failed to fetch bill from QB`, { status: billRes.status, error: errText });
          return new Response(
            JSON.stringify({ error: "Failed to fetch bill from QuickBooks", details: errText }),
            { status: billRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const billData = await billRes.json();
        const qbBill: QBBill = billData.Bill;

        // Get all bill IDs already synced to a DIFFERENT QB bill
        const { data: alreadySyncedBills } = await supabase
          .from("quickbooks_sync_log")
          .select("record_id")
          .eq("company_id", companyId)
          .eq("record_type", "bill")
          .neq("quickbooks_id", qbBillId)
          .not("record_id", "is", null);
        
        const excludedBillIds = (alreadySyncedBills || []).map(b => b.record_id);
        log("info", "Excluding already-synced bills from fallback match", { 
          excludedCount: excludedBillIds.length 
        });

        // Fallback 1: Try to match by bill_ref (DocNumber)
        if (qbBill.DocNumber) {
          let query = supabase
            .from("project_bills")
            .select("id")
            .eq("company_id", companyId)
            .eq("bill_ref", qbBill.DocNumber);
          
          if (excludedBillIds.length > 0) {
            query = query.not("id", "in", `(${excludedBillIds.join(",")})`);
          }
          
          const { data: existingBill } = await query.maybeSingle();
          
          if (existingBill) {
            localBillId = existingBill.id;
            log("info", "Found bill via bill_ref (fallback)", { localBillId, docNumber: qbBill.DocNumber });
          }
        }

        // Fallback 2: Try to match by vendor name + amount
        if (!localBillId && qbBill.VendorRef?.name) {
          let query = supabase
            .from("project_bills")
            .select("id")
            .eq("company_id", companyId)
            .ilike("installer_company", `%${qbBill.VendorRef.name}%`)
            .eq("bill_amount", qbBill.TotalAmt);
          
          if (excludedBillIds.length > 0) {
            query = query.not("id", "in", `(${excludedBillIds.join(",")})`);
          }
          
          const { data: matchByVendorAmount } = await query.maybeSingle();
          
          if (matchByVendorAmount) {
            localBillId = matchByVendorAmount.id;
            log("info", "Found bill via vendor+amount (fallback)", { localBillId });
          }
        }

        // Fallback 3: Try vendor name + amount only
        if (!localBillId && qbBill.VendorRef?.name) {
          let query = supabase
            .from("project_bills")
            .select("id")
            .eq("company_id", companyId)
            .ilike("installer_company", `%${qbBill.VendorRef.name}%`)
            .eq("bill_amount", qbBill.TotalAmt);
          
          if (excludedBillIds.length > 0) {
            query = query.not("id", "in", `(${excludedBillIds.join(",")})`);
          }
          
          const { data: matchByVendorAmount } = await query.maybeSingle();
          
          if (matchByVendorAmount) {
            localBillId = matchByVendorAmount.id;
            log("info", "Found bill via vendor+amount (fallback)", { localBillId });
          }
        }

        if (!localBillId) {
          log("warn", "Could not find existing bill to update", { qbId: qbBillId, docNumber: qbBill.DocNumber });
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: "No matching bill found to update",
              qbId: qbBillId,
              docNumber: qbBill.DocNumber
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Now update with the QB data
        const { error: updateError } = await supabase
          .from("project_bills")
          .update({
            bill_amount: qbBill.TotalAmt || 0,
            balance: qbBill.Balance ?? qbBill.TotalAmt ?? 0, // Sync balance from QB
            bill_ref: qbBill.DocNumber || undefined,
            memo: qbBill.PrivateNote || undefined,
            scheduled_payment_date: qbBill.DueDate || undefined,
          })
          .eq("id", localBillId);

        if (updateError) {
          log("error", "Failed to update bill", { error: updateError.message });
          return new Response(
            JSON.stringify({ error: "Failed to update bill", details: updateError.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Upsert sync log entry
        await supabase
          .from("quickbooks_sync_log")
          .upsert({
            company_id: companyId,
            record_type: "bill",
            record_id: localBillId,
            quickbooks_id: qbBillId,
            sync_status: "synced",
            synced_at: new Date().toISOString(),
          }, {
            onConflict: "company_id,record_type,quickbooks_id"
          });

        log("info", "Updated bill successfully", { billId: localBillId });

        const duration = Date.now() - startTime;
        return new Response(
          JSON.stringify({ 
            success: true, 
            action: "updated",
            billId: localBillId,
            duration: `${duration}ms`
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // We have a sync log entry, fetch and update
      const billRes = await fetch(`${QB_BASE_URL}/${effectiveRealmId}/bill/${qbBillId}`, {
        headers: qbHeaders,
      });

      if (!billRes.ok) {
        const errText = await billRes.text();
        log("error", `Failed to fetch bill from QB`, { status: billRes.status, error: errText });
        return new Response(
          JSON.stringify({ error: "Failed to fetch bill from QuickBooks", details: errText }),
          { status: billRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const billData = await billRes.json();
      const qbBill: QBBill = billData.Bill;

      const { error: updateError } = await supabase
        .from("project_bills")
        .update({
          bill_amount: qbBill.TotalAmt || 0,
          balance: qbBill.Balance ?? qbBill.TotalAmt ?? 0, // Sync balance from QB
          bill_ref: qbBill.DocNumber || undefined,
          memo: qbBill.PrivateNote || undefined,
          scheduled_payment_date: qbBill.DueDate || undefined,
        })
        .eq("id", localBillId);

      if (updateError) {
        log("error", "Failed to update bill", { error: updateError.message });
        return new Response(
          JSON.stringify({ error: "Failed to update bill", details: updateError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update sync log timestamp
      await supabase
        .from("quickbooks_sync_log")
        .update({ synced_at: new Date().toISOString() })
        .eq("company_id", companyId)
        .eq("record_type", "bill")
        .eq("quickbooks_id", qbBillId);

      log("info", "Updated bill successfully", { billId: localBillId });

      const duration = Date.now() - startTime;
      return new Response(
        JSON.stringify({ 
          success: true, 
          action: "updated",
          billId: localBillId,
          duration: `${duration}ms`
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: process-pending
    if (action === "process-pending") {
      log("info", "Processing pending bills from sync log");

      const { data: pendingLogs } = await supabase
        .from("quickbooks_sync_log")
        .select("*")
        .eq("company_id", companyId)
        .eq("record_type", "bill")
        .eq("sync_status", "created_in_qb")
        .is("record_id", null);

      if (!pendingLogs || pendingLogs.length === 0) {
        log("info", "No pending bills to process");
        return new Response(
          JSON.stringify({ success: true, processed: 0, failed: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      log("info", `Found ${pendingLogs.length} pending bills to process`);

      let processed = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const log_entry of pendingLogs) {
        try {
          const result = await supabase.functions.invoke("quickbooks-fetch-bill", {
            body: {
              companyId,
              qbBillId: log_entry.quickbooks_id,
              action: "fetch-single"
            }
          });

          if (result.error || result.data?.error) {
            failed++;
            errors.push(`Bill ${log_entry.quickbooks_id}: ${result.data?.error || result.error}`);
            
            await supabase
              .from("quickbooks_sync_log")
              .update({ 
                sync_status: "import_failed",
                error_message: result.data?.error || String(result.error)
              })
              .eq("id", log_entry.id);
          } else {
            processed++;
            
            if (result.data?.billId) {
              await supabase
                .from("quickbooks_sync_log")
                .update({ 
                  record_id: result.data.billId,
                  sync_status: "synced",
                  last_sync_at: new Date().toISOString(),
                  error_message: null
                })
                .eq("id", log_entry.id);
            }
          }
        } catch (err) {
          failed++;
          errors.push(`Bill ${log_entry.quickbooks_id}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      const duration = Date.now() - startTime;
      log("info", `Processed ${processed} bills, ${failed} failed`, { duration: `${duration}ms` });

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
