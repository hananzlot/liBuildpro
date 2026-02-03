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

      // Check if bill payment already exists in our DB via sync log
      const { data: existingBillPayment } = await supabase
        .from("quickbooks_sync_log")
        .select("record_id")
        .eq("company_id", companyId)
        .eq("record_type", "bill_payment")
        .eq("quickbooks_id", qbBillPayment.Id)
        .maybeSingle();

      if (existingBillPayment?.record_id) {
        log("info", "Bill payment already exists locally (via sync log)", { recordId: existingBillPayment.record_id });
        return new Response(
          JSON.stringify({ 
            success: true, 
            action: "already_exists",
            billPaymentId: existingBillPayment.record_id 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Also check if a matching local payment already exists (even without sync log)
      // This prevents duplicates when a payment was created locally but not yet synced
      const { data: matchingLocalPayments } = await supabase
        .from("bill_payments")
        .select("id")
        .eq("company_id", companyId)
        .eq("bill_id", billId)
        .eq("payment_amount", qbBillPayment.TotalAmt)
        .eq("payment_date", qbBillPayment.TxnDate || new Date().toISOString().split("T")[0])
        .is("payment_reference", null);
      
      if (matchingLocalPayments && matchingLocalPayments.length > 0) {
        // Found a local payment that matches - update it instead of creating new
        const existingId = matchingLocalPayments[0].id;
        log("info", "Found matching local payment without sync log - updating instead of creating", { existingId });
        
        // Update the local payment with QB data
        const paymentMethod = qbBillPayment.PayType === "Check" ? "check" : 
                              qbBillPayment.PayType === "CreditCard" ? "credit_card" : "other";
        const bankName = qbBillPayment.PayType === "Check" 
          ? qbBillPayment.CheckPayment?.BankAccountRef?.name 
          : qbBillPayment.CreditCardPayment?.CCAccountRef?.name;
        
        await supabase
          .from("bill_payments")
          .update({
            payment_reference: qbBillPayment.DocNumber || null,
            payment_method: paymentMethod,
            bank_name: bankName || undefined,
          })
          .eq("id", existingId);
        
        // Create sync log to link them
        await supabase.from("quickbooks_sync_log").insert({
          company_id: companyId,
          record_type: "bill_payment",
          record_id: existingId,
          quickbooks_id: qbBillPayment.Id,
          qb_doc_number: qbBillPayment.DocNumber || null,
          sync_status: "synced",
          last_sync_at: new Date().toISOString(),
        });
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            action: "updated_existing",
            billPaymentId: existingId,
            billId,
            matchMethod: "local_payment_match"
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

    // Action: update-existing - Update an existing local bill payment from QB data
    if (action === "update-existing") {
      if (!qbBillPaymentId) {
        return new Response(
          JSON.stringify({ error: "qbBillPaymentId is required for update-existing" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      log("info", `Updating existing bill payment from QB ${qbBillPaymentId}`);

      // Find the existing local bill payment via sync log (primary source of truth)
      const { data: existingSyncLog } = await supabase
        .from("quickbooks_sync_log")
        .select("record_id")
        .eq("company_id", companyId)
        .eq("record_type", "bill_payment")
        .eq("quickbooks_id", qbBillPaymentId)
        .maybeSingle();

      let localBillPaymentId = existingSyncLog?.record_id;

      // Fetch the bill payment from QuickBooks
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

      // If no sync log entry, try fallback matching
      if (!localBillPaymentId) {
        log("info", `No sync log for QB BillPayment ${qbBillPaymentId}, attempting fallback matching`);

        // Get all bill payment IDs already synced to a DIFFERENT QB bill payment
        const { data: alreadySyncedBillPayments } = await supabase
          .from("quickbooks_sync_log")
          .select("record_id")
          .eq("company_id", companyId)
          .eq("record_type", "bill_payment")
          .neq("quickbooks_id", qbBillPaymentId)
          .not("record_id", "is", null);
        
        const excludedBillPaymentIds = (alreadySyncedBillPayments || []).map(bp => bp.record_id);
        log("info", "Excluding already-synced bill payments from fallback match", { 
          excludedCount: excludedBillPaymentIds.length 
        });

        // Find linked bill first
        const linkedBills = qbBillPayment.Line?.flatMap(l => 
          (l.LinkedTxn || []).filter(txn => txn.TxnType === "Bill")
        ) || [];

        let billId: string | null = null;

        log("info", "Fallback matching details", {
          linkedBillCount: linkedBills.length,
          qbBillIds: linkedBills.map(lb => lb.TxnId),
          qbAmount: qbBillPayment.TotalAmt,
          qbDate: qbBillPayment.TxnDate,
          qbDocNumber: qbBillPayment.DocNumber,
          vendorName: qbBillPayment.VendorRef?.name,
        });

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
            log("info", "Found linked bill via sync log", { billId, qbBillIds });
          } else {
            log("warn", "No sync log found for linked QB bills", { qbBillIds });
          }
        }

        if (billId) {
          log("info", "Searching for local bill payments", { billId, amount: qbBillPayment.TotalAmt, date: qbBillPayment.TxnDate });
          
          // Fallback 1: Try to match by bill_id + amount + date + null reference
          // (for payments created without a check number that QB later assigned)
          let query = supabase
            .from("bill_payments")
            .select("id, payment_date, payment_reference")
            .eq("company_id", companyId)
            .eq("bill_id", billId)
            .eq("payment_amount", qbBillPayment.TotalAmt)
            .is("payment_reference", null);
          
          if (excludedBillPaymentIds.length > 0) {
            query = query.not("id", "in", `(${excludedBillPaymentIds.join(",")})`);
          }
          
          const { data: nullRefMatches } = await query;
          log("info", "Null reference matches", { count: nullRefMatches?.length, matches: nullRefMatches });
          
          if (nullRefMatches && nullRefMatches.length === 1) {
            // Only one payment with null ref - safe to match
            localBillPaymentId = nullRefMatches[0].id;
            log("info", "Found unique bill payment with null reference", { localBillPaymentId });
          } else if (nullRefMatches && nullRefMatches.length > 1) {
            // Multiple matches - try to match by date
            const dateMatch = nullRefMatches.find(p => p.payment_date === qbBillPayment.TxnDate);
            if (dateMatch) {
              localBillPaymentId = dateMatch.id;
              log("info", "Found bill payment by amount + null ref + date", { localBillPaymentId });
            }
          }

          // Fallback 2: Try bill_id + amount + date + exact reference
          if (!localBillPaymentId && qbBillPayment.DocNumber) {
            let query2 = supabase
              .from("bill_payments")
              .select("id")
              .eq("company_id", companyId)
              .eq("bill_id", billId)
              .eq("payment_amount", qbBillPayment.TotalAmt)
              .eq("payment_reference", qbBillPayment.DocNumber);
            
            if (excludedBillPaymentIds.length > 0) {
              query2 = query2.not("id", "in", `(${excludedBillPaymentIds.join(",")})`);
            }
            
            const { data: refMatch } = await query2.maybeSingle();
            
            if (refMatch) {
              localBillPaymentId = refMatch.id;
              log("info", "Found bill payment via exact reference match", { localBillPaymentId });
            }
          }

          // Fallback 3: Try bill_id + amount + date (regardless of reference)
          if (!localBillPaymentId) {
            let query3 = supabase
              .from("bill_payments")
              .select("id")
              .eq("company_id", companyId)
              .eq("bill_id", billId)
              .eq("payment_amount", qbBillPayment.TotalAmt)
              .eq("payment_date", qbBillPayment.TxnDate);
            
            if (excludedBillPaymentIds.length > 0) {
              query3 = query3.not("id", "in", `(${excludedBillPaymentIds.join(",")})`);
            }
            
            const { data: amountDateMatch } = await query3.maybeSingle();
            
            if (amountDateMatch) {
              localBillPaymentId = amountDateMatch.id;
              log("info", "Found bill payment via amount+date (fallback)", { localBillPaymentId });
            }
          }

          // Fallback 4: Try bill_id + amount only (pick most recent)
          if (!localBillPaymentId) {
            let query4 = supabase
              .from("bill_payments")
              .select("id")
              .eq("company_id", companyId)
              .eq("bill_id", billId)
              .eq("payment_amount", qbBillPayment.TotalAmt)
              .order("created_at", { ascending: false })
              .limit(1);
            
            if (excludedBillPaymentIds.length > 0) {
              query4 = query4.not("id", "in", `(${excludedBillPaymentIds.join(",")})`);
            }
            
            const { data: amountMatches } = await query4;
            
            if (amountMatches && amountMatches.length > 0) {
              localBillPaymentId = amountMatches[0].id;
              log("info", "Found bill payment via amount only (most recent)", { localBillPaymentId });
            }
          }
        }
        
        // Fallback 4: No linked bill found - try matching by vendor name + amount + date
        // This handles the case where the bill was created directly in QB or the bill sync log is missing
        if (!localBillPaymentId && !billId) {
          const vendorName = qbBillPayment.VendorRef?.name;
          log("info", "Attempting vendor-based fallback matching", { vendorName, amount: qbBillPayment.TotalAmt, date: qbBillPayment.TxnDate });
          
          if (vendorName) {
            // Find bills from this vendor
            const { data: vendorBills } = await supabase
              .from("project_bills")
              .select("id")
              .eq("company_id", companyId)
              .ilike("installer_company", `%${vendorName}%`);
            
            if (vendorBills && vendorBills.length > 0) {
              const vendorBillIds = vendorBills.map(b => b.id);
              
              // Try amount + date + null reference (payments created without check #)
              let vendorQuery = supabase
                .from("bill_payments")
                .select("id")
                .eq("company_id", companyId)
                .in("bill_id", vendorBillIds)
                .eq("payment_amount", qbBillPayment.TotalAmt)
                .eq("payment_date", qbBillPayment.TxnDate)
                .is("payment_reference", null);
              
              if (excludedBillPaymentIds.length > 0) {
                vendorQuery = vendorQuery.not("id", "in", `(${excludedBillPaymentIds.join(",")})`);
              }
              
              const { data: vendorMatch } = await vendorQuery.maybeSingle();
              
              if (vendorMatch) {
                localBillPaymentId = vendorMatch.id;
                log("info", "Found bill payment via vendor + amount + date + null ref", { localBillPaymentId, vendorName });
              }
              
              // If no match with null ref, try just amount + date
              if (!localBillPaymentId) {
                let vendorQuery2 = supabase
                  .from("bill_payments")
                  .select("id")
                  .eq("company_id", companyId)
                  .in("bill_id", vendorBillIds)
                  .eq("payment_amount", qbBillPayment.TotalAmt)
                  .eq("payment_date", qbBillPayment.TxnDate);
                
                if (excludedBillPaymentIds.length > 0) {
                  vendorQuery2 = vendorQuery2.not("id", "in", `(${excludedBillPaymentIds.join(",")})`);
                }
                
                const { data: vendorMatch2 } = await vendorQuery2.maybeSingle();
                
                if (vendorMatch2) {
                  localBillPaymentId = vendorMatch2.id;
                  log("info", "Found bill payment via vendor + amount + date", { localBillPaymentId, vendorName });
                }
              }
            }
          }
        }
      }

      if (!localBillPaymentId) {
        log("warn", "Could not find existing bill payment to update", { qbId: qbBillPaymentId });
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "No matching bill payment found to update",
            qbId: qbBillPaymentId
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

      // Get the current bill_id before updating
      const { data: currentPayment } = await supabase
        .from("bill_payments")
        .select("bill_id")
        .eq("id", localBillPaymentId)
        .single();

      const billId = currentPayment?.bill_id;

      // Update the bill payment
      const { error: updateError } = await supabase
        .from("bill_payments")
        .update({
          payment_amount: qbBillPayment.TotalAmt || 0,
          payment_date: qbBillPayment.TxnDate || undefined,
          payment_method: paymentMethod,
          payment_reference: qbBillPayment.DocNumber || undefined,
          bank_name: bankName || undefined,
        })
        .eq("id", localBillPaymentId);

      if (updateError) {
        log("error", "Failed to update bill payment", { error: updateError.message });
        return new Response(
          JSON.stringify({ error: "Failed to update bill payment", details: updateError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Recalculate bill rollup fields (amount_paid, balance, status)
      if (billId) {
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
          const billAmount = bill.bill_amount || 0;
          const newBalance = billAmount - totalPaid;
          const newStatus = totalPaid >= billAmount ? "paid" : (totalPaid > 0 ? "partial" : "unpaid");

          const { error: rollupError } = await supabase
            .from("project_bills")
            .update({
              amount_paid: totalPaid,
              balance: newBalance,
            })
            .eq("id", billId);

          if (rollupError) {
            log("error", "Failed to update bill rollups", { error: rollupError.message });
          }

          log("info", "Recalculated bill rollups", { 
            billId, 
            totalPaid, 
            billAmount, 
            newBalance, 
            newStatus 
          });
        }
      }

      // Upsert sync log entry
      await supabase
        .from("quickbooks_sync_log")
        .upsert({
          company_id: companyId,
          record_type: "bill_payment",
          record_id: localBillPaymentId,
          quickbooks_id: qbBillPaymentId,
          sync_status: "synced",
          synced_at: new Date().toISOString(),
        }, {
          onConflict: "company_id,record_type,quickbooks_id"
        });

      log("info", "Updated bill payment successfully", { billPaymentId: localBillPaymentId, billId });

      const duration = Date.now() - startTime;
      return new Response(
        JSON.stringify({ 
          success: true, 
          action: "updated",
          billPaymentId: localBillPaymentId,
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
