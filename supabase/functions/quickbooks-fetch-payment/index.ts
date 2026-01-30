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
        depositToAccount: qbPayment.DepositToAccountRef?.name || null,
        depositToAccountId: qbPayment.DepositToAccountRef?.value || null,
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

      // Look up mapped local bank from QB deposit account
      // Note: in our mapping system, quickbooks_mappings.source_value for mapping_type="bank" is the LOCAL bank UUID.
      // The app stores both bank_id (normalized FK) and bank_name (for backwards compat).
      let bankId: string | null = null;
      let bankName: string | null = null;
      const qbDepositAccountId = qbPayment.DepositToAccountRef?.value;

      if (qbDepositAccountId) {
        const { data: bankMapping } = await supabase
          .from("quickbooks_mappings")
          .select("source_value")
          .eq("company_id", companyId)
          .eq("mapping_type", "bank")
          .eq("qbo_id", qbDepositAccountId)
          .maybeSingle();

        const localBankId = bankMapping?.source_value;
        if (localBankId) {
          const { data: bankRecord } = await supabase
            .from("banks")
            .select("id, name")
            .eq("company_id", companyId)
            .eq("id", localBankId)
            .maybeSingle();

          if (bankRecord?.name) {
            bankId = bankRecord.id;
            bankName = bankRecord.name;
            log("info", "Mapped QB deposit account to local bank", {
              qbAccountId: qbDepositAccountId,
              qbAccountName: qbPayment.DepositToAccountRef?.name,
              localBankId: bankId,
              localBankName: bankName,
            });
          } else {
            // If mapping points to a bank UUID we can't resolve, fallback to QB account name
            bankName = qbPayment.DepositToAccountRef?.name || null;
            log("warn", "Bank mapping found but local bank ID not resolvable; using QB account name", {
              qbAccountId: qbDepositAccountId,
              qbAccountName: qbPayment.DepositToAccountRef?.name,
              localBankId,
            });
          }
        } else {
          // No mapping found; fallback to QB account name (e.g. "Undeposited Funds")
          bankName = qbPayment.DepositToAccountRef?.name || null;
          log("warn", "No bank mapping found; using QB account name", {
            qbAccountId: qbDepositAccountId,
            qbAccountName: bankName,
          });
        }
      }

      // Create the payment in our database
      const { data: newPayment, error: insertError } = await supabase
        .from("project_payments")
        .insert({
          project_id: projectId,
          company_id: companyId,
          invoice_id: invoiceId, // Link to invoice if we found one
          payment_amount: qbPayment.TotalAmt || 0,
          projected_received_date: qbPayment.TxnDate || new Date().toISOString().split("T")[0],
          payment_status: "Received",
          check_number: qbPayment.PaymentRefNum || null,
          bank_id: bankId,
          bank_name: bankName,
          deposit_verified: true,
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

    // Action: update-existing - Update an existing local payment from QB data
    if (action === "update-existing") {
      if (!qbPaymentId) {
        return new Response(
          JSON.stringify({ error: "qbPaymentId is required for update-existing" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      log("info", `Updating existing payment from QB ${qbPaymentId}`);

      // Find the existing local payment via sync log
      const { data: existingSyncLog } = await supabase
        .from("quickbooks_sync_log")
        .select("record_id")
        .eq("company_id", companyId)
        .eq("record_type", "payment")
        .eq("quickbooks_id", qbPaymentId)
        .maybeSingle();

      let localPaymentId = existingSyncLog?.record_id;

      // If no sync log entry, try to find by fetching QB payment and matching
      if (!localPaymentId) {
        log("info", `No sync log for QB Payment ${qbPaymentId}, fetching from QB to find match`);

        // Fetch the payment from QuickBooks first
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

        // Try to find linked invoice first
        const linkedInvoices = qbPayment.Line?.flatMap(l => 
          (l.LinkedTxn || []).filter(txn => txn.TxnType === "Invoice")
        ) || [];

        if (linkedInvoices.length > 0) {
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
            // Find payment linked to this invoice that matches the QB payment
            // Priority: 1) exact match on amount + date + ref#, 2) amount + date, 3) amount + ref#, 4) amount only, 5) single payment

            // Try exact match: amount + date + check_number
            if (qbPayment.PaymentRefNum) {
              const { data: exactMatch } = await supabase
                .from("project_payments")
                .select("id")
                .eq("company_id", companyId)
                .eq("invoice_id", invoiceSyncLog.record_id)
                .eq("payment_amount", qbPayment.TotalAmt)
                .eq("projected_received_date", qbPayment.TxnDate)
                .eq("check_number", qbPayment.PaymentRefNum)
                .maybeSingle();

              if (exactMatch) {
                localPaymentId = exactMatch.id;
                log("info", "Found local payment via linked invoice (exact match: amount+date+ref#)", { paymentId: localPaymentId });
              }
            }

            // Fallback: amount + date (no ref# match)
            if (!localPaymentId) {
              const { data: dateMatch } = await supabase
                .from("project_payments")
                .select("id")
                .eq("company_id", companyId)
                .eq("invoice_id", invoiceSyncLog.record_id)
                .eq("payment_amount", qbPayment.TotalAmt)
                .eq("projected_received_date", qbPayment.TxnDate);

              if (dateMatch && dateMatch.length === 1) {
                localPaymentId = dateMatch[0].id;
                log("info", "Found local payment via linked invoice (amount+date, single match)", { paymentId: localPaymentId });
              } else if (dateMatch && dateMatch.length > 1) {
                // Multiple matches with same amount+date - try to narrow by check_number
                if (qbPayment.PaymentRefNum) {
                  const refMatch = dateMatch.find(async (p) => {
                    const { data: pmt } = await supabase.from("project_payments").select("check_number").eq("id", p.id).single();
                    return pmt?.check_number === qbPayment.PaymentRefNum;
                  });
                  // Actually query for it properly
                  const { data: refMatchPayment } = await supabase
                    .from("project_payments")
                    .select("id")
                    .eq("company_id", companyId)
                    .eq("invoice_id", invoiceSyncLog.record_id)
                    .eq("payment_amount", qbPayment.TotalAmt)
                    .eq("check_number", qbPayment.PaymentRefNum)
                    .maybeSingle();
                  
                  if (refMatchPayment) {
                    localPaymentId = refMatchPayment.id;
                    log("info", "Found local payment via ref# tiebreaker", { paymentId: localPaymentId });
                  } else {
                    log("warn", "Multiple payments match amount+date but none match ref#, skipping update to avoid data corruption", { 
                      count: dateMatch.length, 
                      qbRefNum: qbPayment.PaymentRefNum 
                    });
                  }
                } else {
                  log("warn", "Multiple payments match amount+date and QB has no ref#, skipping update to avoid data corruption", { count: dateMatch.length });
                }
              }
            }

            // Fallback: amount only (if single match)
            if (!localPaymentId) {
              const { data: amountMatch } = await supabase
                .from("project_payments")
                .select("id")
                .eq("company_id", companyId)
                .eq("invoice_id", invoiceSyncLog.record_id)
                .eq("payment_amount", qbPayment.TotalAmt);

              if (amountMatch && amountMatch.length === 1) {
                localPaymentId = amountMatch[0].id;
                log("info", "Found local payment via linked invoice (amount match, single)", { paymentId: localPaymentId });
              }
            }

            // Last resort: if only one payment exists for this invoice total
            if (!localPaymentId) {
              const { data: allPayments } = await supabase
                .from("project_payments")
                .select("id")
                .eq("company_id", companyId)
                .eq("invoice_id", invoiceSyncLog.record_id);

              if (allPayments && allPayments.length === 1) {
                localPaymentId = allPayments[0].id;
                log("info", "Found local payment via linked invoice (single payment)", { paymentId: localPaymentId });
              }
            }
          }
        }

        // If still not found, try matching by customer and approximate amount
        if (!localPaymentId) {
          const customerId = qbPayment.CustomerRef?.value;
          
          if (customerId) {
            const { data: customerMapping } = await supabase
              .from("quickbooks_mappings")
              .select("source_value")
              .eq("company_id", companyId)
              .eq("mapping_type", "customer")
              .eq("qbo_id", customerId)
              .maybeSingle();

            if (customerMapping?.source_value) {
              // Find project for this contact
              const { data: project } = await supabase
                .from("projects")
                .select("id")
                .eq("company_id", companyId)
                .eq("contact_uuid", customerMapping.source_value)
                .maybeSingle();

              if (project) {
                // Find recent payment with similar amount
                const { data: matchingPayment } = await supabase
                  .from("project_payments")
                  .select("id")
                  .eq("company_id", companyId)
                  .eq("project_id", project.id)
                  .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
                  .order("created_at", { ascending: false })
                  .limit(1)
                  .maybeSingle();

                if (matchingPayment) {
                  localPaymentId = matchingPayment.id;
                  log("info", "Found local payment via customer mapping and recent activity", { paymentId: localPaymentId });
                }
              }
            }
          }
        }

        // If we found a match, create the sync log entry
        if (localPaymentId) {
          await supabase.from("quickbooks_sync_log").insert({
            company_id: companyId,
            record_type: "payment",
            record_id: localPaymentId,
            quickbooks_id: qbPaymentId,
            sync_status: "synced",
          });
          log("info", "Created sync log entry for matched payment", { paymentId: localPaymentId, qbId: qbPaymentId });
        }

        // Now update the payment with the fetched data
        if (localPaymentId) {
          // Look up mapped local bank from QB deposit account
          let bankId: string | null = null;
          let bankName: string | null = null;
          const qbDepositAccountId = qbPayment.DepositToAccountRef?.value;

          if (qbDepositAccountId) {
            const { data: bankMapping } = await supabase
              .from("quickbooks_mappings")
              .select("source_value")
              .eq("company_id", companyId)
              .eq("mapping_type", "bank")
              .eq("qbo_id", qbDepositAccountId)
              .maybeSingle();

            const localBankIdFromMapping = bankMapping?.source_value;
            if (localBankIdFromMapping) {
              const { data: bankRecord } = await supabase
                .from("banks")
                .select("id, name")
                .eq("company_id", companyId)
                .eq("id", localBankIdFromMapping)
                .maybeSingle();

              if (bankRecord?.name) {
                bankId = bankRecord.id;
                bankName = bankRecord.name;
              } else {
                bankName = qbPayment.DepositToAccountRef?.name || null;
              }
            } else {
              bankName = qbPayment.DepositToAccountRef?.name || null;
            }
          }

          // Update the local payment
          const { error: updateError } = await supabase
            .from("project_payments")
            .update({
              payment_amount: qbPayment.TotalAmt || 0,
              projected_received_date: qbPayment.TxnDate || null,
              check_number: qbPayment.PaymentRefNum || null,
              bank_id: bankId,
              bank_name: bankName,
              updated_at: new Date().toISOString(),
            })
            .eq("id", localPaymentId);

          if (updateError) {
            log("error", "Failed to update local payment", { error: updateError.message });
            return new Response(
              JSON.stringify({ error: "Failed to update payment", details: updateError.message }),
              { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          log("info", `✓ Updated local payment ${localPaymentId} from QB (found via fallback match)`, { amount: qbPayment.TotalAmt });

          const duration = Date.now() - startTime;
          return new Response(
            JSON.stringify({
              success: true,
              action: "updated",
              paymentId: localPaymentId,
              amount: qbPayment.TotalAmt,
              matchMethod: "fallback",
              duration: `${duration}ms`,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        log("warn", `Could not find local payment to update for QB Payment ${qbPaymentId}`);
        return new Response(
          JSON.stringify({ success: false, error: "No local payment found to update" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // We have a sync log entry - fetch from QB and update
      const paymentRes = await fetch(`${QB_BASE_URL}/${effectiveRealmId}/payment/${qbPaymentId}`, {
        headers: qbHeaders,
      });

      if (!paymentRes.ok) {
        const errText = await paymentRes.text();
        log("error", `Failed to fetch payment from QB for update`, { status: paymentRes.status, error: errText });
        return new Response(
          JSON.stringify({ error: "Failed to fetch payment from QuickBooks", details: errText }),
          { status: paymentRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const paymentData = await paymentRes.json();
      const qbPayment: QBPayment = paymentData.Payment;

      log("info", "Fetched QB payment for update", {
        id: qbPayment.Id,
        refNum: qbPayment.PaymentRefNum,
        amount: qbPayment.TotalAmt,
        depositToAccountId: qbPayment.DepositToAccountRef?.value || null,
      });

      // Look up mapped local bank from QB deposit account
      let bankId: string | null = null;
      let bankName: string | null = null;
      const qbDepositAccountId = qbPayment.DepositToAccountRef?.value;

      if (qbDepositAccountId) {
        const { data: bankMapping } = await supabase
          .from("quickbooks_mappings")
          .select("source_value")
          .eq("company_id", companyId)
          .eq("mapping_type", "bank")
          .eq("qbo_id", qbDepositAccountId)
          .maybeSingle();

        const localBankId = bankMapping?.source_value;
        if (localBankId) {
          const { data: bankRecord } = await supabase
            .from("banks")
            .select("id, name")
            .eq("company_id", companyId)
            .eq("id", localBankId)
            .maybeSingle();

          if (bankRecord?.name) {
            bankId = bankRecord.id;
            bankName = bankRecord.name;
          } else {
            bankName = qbPayment.DepositToAccountRef?.name || null;
          }
        } else {
          bankName = qbPayment.DepositToAccountRef?.name || null;
        }
      }

      // Update the local payment with new QB data
      const { error: updateError } = await supabase
        .from("project_payments")
        .update({
          payment_amount: qbPayment.TotalAmt || 0,
          projected_received_date: qbPayment.TxnDate || null,
          check_number: qbPayment.PaymentRefNum || null,
          bank_id: bankId,
          bank_name: bankName,
          updated_at: new Date().toISOString(),
        })
        .eq("id", localPaymentId);

      if (updateError) {
        log("error", "Failed to update local payment", { error: updateError.message });
        return new Response(
          JSON.stringify({ error: "Failed to update payment", details: updateError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update sync log
      await supabase
        .from("quickbooks_sync_log")
        .update({
          sync_status: "synced",
          error_message: null,
        })
        .eq("company_id", companyId)
        .eq("record_type", "payment")
        .eq("quickbooks_id", qbPaymentId);

      log("info", `✓ Updated local payment ${localPaymentId} from QB`, { amount: qbPayment.TotalAmt });

      const duration = Date.now() - startTime;
      return new Response(
        JSON.stringify({
          success: true,
          action: "updated",
          paymentId: localPaymentId,
          amount: qbPayment.TotalAmt,
          duration: `${duration}ms`,
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
      JSON.stringify({ error: "Invalid action. Use 'fetch-single', 'update-existing', or 'process-pending'" }),
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
