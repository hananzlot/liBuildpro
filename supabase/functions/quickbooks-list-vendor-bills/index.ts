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
  TotalAmt?: number;
  Balance?: number;
  PrivateNote?: string;
  // NOTE: Bills do not have a top-level CustomerRef. Customer/Project is stored
  // on the expense lines (AccountBasedExpenseLineDetail / ItemBasedExpenseLineDetail).
  Line?: Array<{
    AccountBasedExpenseLineDetail?: {
      CustomerRef?: { value: string; name?: string };
    };
    ItemBasedExpenseLineDetail?: {
      CustomerRef?: { value: string; name?: string };
    };
  }>;
}

interface QBVendor {
  Id: string;
  DisplayName?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { companyId, vendorName, projectId } = await req.json();

    if (!companyId) {
      return new Response(
        JSON.stringify({ error: "companyId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!vendorName) {
      return new Response(
        JSON.stringify({ error: "vendorName is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get QuickBooks tokens
    const { data: tokenData, error: tokenError } = await supabase.rpc("get_quickbooks_tokens", {
      p_company_id: companyId,
    });

    if (tokenError || !tokenData || tokenData.length === 0) {
      return new Response(
        JSON.stringify({ error: "QuickBooks not connected" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

    const getBillCustomerRefs = (bill: QBBill): Array<{ value: string; name?: string }> => {
      const refs: Array<{ value: string; name?: string }> = [];
      for (const line of bill.Line || []) {
        const ref =
          line?.AccountBasedExpenseLineDetail?.CustomerRef ||
          line?.ItemBasedExpenseLineDetail?.CustomerRef;
        if (ref?.value) refs.push(ref);
      }
      return refs;
    };

    const billMatchesCustomer = (bill: QBBill, customerId: string): boolean => {
      return getBillCustomerRefs(bill).some((r) => r.value === customerId);
    };

    // Step 1: Look up project-to-customer mapping if projectId provided
    let qbCustomerId: string | null = null;
    let qbCustomerName: string | null = null;

    if (projectId) {
      console.log(`Looking up QB customer mapping for project: ${projectId}`);
      
      // First check for direct project_customer mapping
      const { data: projectMapping } = await supabase
        .from("quickbooks_mappings")
        .select("qbo_id, qbo_name")
        .eq("company_id", companyId)
        .eq("mapping_type", "project_customer")
        .eq("source_value", projectId)
        .limit(1)
        .single();

      if (projectMapping && projectMapping.qbo_id) {
        qbCustomerId = projectMapping.qbo_id;
        qbCustomerName = projectMapping.qbo_name;
        console.log(`Found project_customer mapping: Project ${projectId} -> QB Customer ${qbCustomerId} (${qbCustomerName})`);
      } else {
        // Fallback: Check if project has a contact with a customer mapping
        const { data: project } = await supabase
          .from("projects")
          .select("contact_uuid, contact_id")
          .eq("id", projectId)
          .single();

        if (project) {
          // Try contact_uuid first
          if (project.contact_uuid) {
            const { data: contactMapping } = await supabase
              .from("quickbooks_mappings")
              .select("qbo_id, qbo_name")
              .eq("company_id", companyId)
              .eq("mapping_type", "customer")
              .eq("source_value", project.contact_uuid)
              .limit(1)
              .single();

            if (contactMapping && contactMapping.qbo_id) {
              qbCustomerId = contactMapping.qbo_id;
              qbCustomerName = contactMapping.qbo_name;
              console.log(`Found contact_uuid customer mapping: ${project.contact_uuid} -> QB Customer ${qbCustomerId} (${qbCustomerName})`);
            }
          }
          
          // Try contact_id (GHL ID) as fallback
          if (!qbCustomerId && project.contact_id) {
            const { data: contactMapping } = await supabase
              .from("quickbooks_mappings")
              .select("qbo_id, qbo_name")
              .eq("company_id", companyId)
              .eq("mapping_type", "customer")
              .eq("source_value", project.contact_id)
              .limit(1)
              .single();

            if (contactMapping && contactMapping.qbo_id) {
              qbCustomerId = contactMapping.qbo_id;
              qbCustomerName = contactMapping.qbo_name;
              console.log(`Found contact_id customer mapping: ${project.contact_id} -> QB Customer ${qbCustomerId} (${qbCustomerName})`);
            }
          }
        }
      }
    }

    // Step 2: Check if there's a mapping for this vendor name (via subcontractor)
    console.log(`Looking up vendor mapping for: "${vendorName}"`);
    
    let vendorId: string | null = null;
    let mappedQbName: string | null = null;

    // Look up subcontractor by name to get their ID
    const { data: subcontractor } = await supabase
      .from("subcontractors")
      .select("id, company_name")
      .eq("company_id", companyId)
      .ilike("company_name", vendorName)
      .limit(1)
      .single();

    if (subcontractor) {
      console.log(`Found subcontractor: ${subcontractor.id} (${subcontractor.company_name})`);
      
      // Check for QB mapping using the subcontractor ID
      const { data: mapping } = await supabase
        .from("quickbooks_mappings")
        .select("qbo_id, qbo_name")
        .eq("company_id", companyId)
        .eq("mapping_type", "vendor")
        .eq("source_value", subcontractor.id)
        .limit(1)
        .single();

      if (mapping && mapping.qbo_id && mapping.qbo_id !== "PENDING_CREATE") {
        vendorId = mapping.qbo_id;
        mappedQbName = mapping.qbo_name;
        console.log(`Found QB mapping: ${vendorName} -> QB Vendor ID ${vendorId} (${mappedQbName})`);
      }
    }

    // If no mapping found, fall back to searching by name in QuickBooks
    if (!vendorId) {
      console.log(`No mapping found, searching QuickBooks for vendor: "${vendorName}"`);
      const escapedVendorName = vendorName.replace(/'/g, "\\'");
      const vendorSearchUrl = `${QB_BASE_URL}/${realm_id}/query?query=${encodeURIComponent(
        `SELECT * FROM Vendor WHERE DisplayName = '${escapedVendorName}'`
      )}`;

      const vendorRes = await fetch(vendorSearchUrl, { headers: qbHeaders });
      
      if (!vendorRes.ok) {
        const errText = await vendorRes.text();
        console.error("Failed to search for vendor:", errText);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "Failed to search for vendor in QuickBooks",
            vendorFound: false,
            vendorId: null,
            bills: [] 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const vendorData = await vendorRes.json();
      const vendors: QBVendor[] = vendorData.QueryResponse?.Vendor || [];

      if (vendors.length === 0) {
        console.log(`Vendor "${vendorName}" not found in QuickBooks`);
        return new Response(
          JSON.stringify({ 
            success: true, 
            vendorFound: false,
            vendorId: null,
            bills: [],
            message: `Vendor "${vendorName}" not found in QuickBooks`
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      vendorId = vendors[0].Id;
    }

    console.log(`Using QB Vendor ID: ${vendorId} for "${mappedQbName || vendorName}"`);
    if (qbCustomerId) {
      console.log(`Filtering bills by QB Customer ID: ${qbCustomerId} (${qbCustomerName})`);
    }

    // Step 3: Build the bill query - NOTE: CustomerRef is NOT a queryable field in QB Bill entity
    // We must fetch all bills for the vendor and filter by customer in JS
    const billQuery = `SELECT * FROM Bill WHERE VendorRef = '${vendorId}' ORDERBY TxnDate DESC MAXRESULTS 100`;

    const billsSearchUrl = `${QB_BASE_URL}/${realm_id}/query?query=${encodeURIComponent(billQuery)}`;
    console.log(`Fetching bills with query: ${billQuery}`);

    const billsRes = await fetch(billsSearchUrl, { headers: qbHeaders });
    
    if (!billsRes.ok) {
      const errText = await billsRes.text();
      console.error("Failed to fetch bills:", errText);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Failed to fetch bills from QuickBooks",
          vendorFound: true,
          vendorId,
          bills: [] 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const billsData = await billsRes.json();
    let rawBills: QBBill[] = billsData.QueryResponse?.Bill || [];

    console.log(`Found ${rawBills.length} total bills for vendor ${vendorId}`);
    
    // Log all bills for debugging (customer refs are on lines)
    rawBills.forEach((bill) => {
      const refs = getBillCustomerRefs(bill);
      console.log(
        `Bill ${bill.Id} (${bill.DocNumber || "no ref"}): TotalAmt=${bill.TotalAmt}, Balance=${bill.Balance}, LineCustomerRefs=${refs.map((r) => r.value).join(",") || "none"}`
      );
    });

    // Filter by customer if we have a mapping (done in JS since QB doesn't support CustomerRef in Bill queries)
    // IMPORTANT: CustomerRef is on the bill lines, not top-level.
    let customerFilterWarning: string | null = null;
    if (qbCustomerId) {
      console.log(`Filtering ${rawBills.length} bills to only those with line CustomerRef=${qbCustomerId}`);
      const matching = rawBills.filter((bill) => billMatchesCustomer(bill, qbCustomerId!));
      console.log(`${matching.length} bills match the customer filter`);

      // If none match, fall back to showing vendor bills (but warn), otherwise we'd incorrectly show “none”
      // for customers whose bills aren’t job-costed/tagged to a customer in QB.
      if (matching.length === 0 && rawBills.length > 0) {
        customerFilterWarning =
          "No QuickBooks bills were tagged to this project customer. Showing all unpaid bills for this vendor instead.";
      } else {
        rawBills = matching;
      }
    }
    
    // Filter to only include bills with a positive balance (unpaid)
    const unpaidBills = rawBills.filter((bill) => (bill.Balance || 0) > 0);
    const paidBills = rawBills.filter((bill) => (bill.Balance || 0) === 0);
    console.log(`${unpaidBills.length} bills have balance > 0, ${paidBills.length} bills are fully paid`);

    // If no unpaid bills but there are paid bills, add a warning
    let paidBillsWarning: string | null = null;
    if (unpaidBills.length === 0 && paidBills.length > 0) {
      paidBillsWarning = `Found ${paidBills.length} bill(s) for this vendor in QuickBooks, but they are all fully paid (Balance = $0). The bill may have already been paid in QuickBooks.`;
    }

    // Map to our response format - include customer info for display (derived from the first line ref)
    const bills = unpaidBills.map((bill) => {
      const refs = getBillCustomerRefs(bill);
      const firstRef = refs[0];
      return {
      qbBillId: bill.Id,
      docNumber: bill.DocNumber || "",
      txnDate: bill.TxnDate || "",
      dueDate: bill.DueDate || null,
      totalAmt: bill.TotalAmt || 0,
      balance: bill.Balance || 0,
      memo: bill.PrivateNote || null,
        customerId: firstRef?.value || null,
        customerName: firstRef?.name || null,
      };
    });

    // If no unpaid bills found, search for existing BillPayments that match the amount
    // This allows linking a local payment to an existing QB payment instead of creating a duplicate
    interface MatchingBillPayment {
      qbBillPaymentId: string;
      txnDate: string;
      totalAmt: number;
      docNumber: string | null;
      payType: string | null;
      billRefs: Array<{ billId: string; billDocNumber: string | null; amount: number }>;
    }
    let matchingBillPayments: MatchingBillPayment[] = [];
    
    if (unpaidBills.length === 0) {
      try {
        // Query BillPayments for this vendor
        const bpQuery = `SELECT * FROM BillPayment WHERE VendorRef = '${vendorId}' ORDERBY TxnDate DESC MAXRESULTS 20`;
        const bpUrl = `${QB_BASE_URL}/${realm_id}/query?query=${encodeURIComponent(bpQuery)}`;
        console.log(`No unpaid bills found - searching for existing BillPayments: ${bpQuery}`);
        
        const bpRes = await fetch(bpUrl, { headers: qbHeaders });
        if (bpRes.ok) {
          const bpData = await bpRes.json();
          const rawBPs = bpData.QueryResponse?.BillPayment || [];
          console.log(`Found ${rawBPs.length} BillPayments for vendor ${vendorId}`);
          
          // deno-lint-ignore no-explicit-any
          matchingBillPayments = rawBPs.map((bp: any) => {
            // Extract bill references from the Line items
            // deno-lint-ignore no-explicit-any
            const billRefs = (bp.Line || [])
              // deno-lint-ignore no-explicit-any
              .filter((line: any) => line.LinkedTxn)
              // deno-lint-ignore no-explicit-any
              .flatMap((line: any) => 
                // deno-lint-ignore no-explicit-any
                (line.LinkedTxn || []).filter((lt: any) => lt.TxnType === "Bill").map((lt: any) => ({
                  billId: lt.TxnId,
                  billDocNumber: null, // We don't have this from the payment record
                  amount: line.Amount || 0,
                }))
              );
            
            return {
              qbBillPaymentId: bp.Id,
              txnDate: bp.TxnDate || "",
              totalAmt: bp.TotalAmt || 0,
              docNumber: bp.DocNumber || null,
              payType: bp.PayType || null,
              billRefs,
            };
          });
          
          console.log(`Returning ${matchingBillPayments.length} BillPayments for potential linking`);
        }
      } catch (err) {
        console.error("Error fetching BillPayments:", err);
        // Non-fatal - just won't show matching payments
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        vendorFound: true,
        vendorId,
        bills,
        matchingBillPayments,
        // Include mapping info for the frontend
        projectCustomerId: qbCustomerId,
        projectCustomerName: qbCustomerName,
        hasProjectMapping: !!qbCustomerId,
        customerFilterWarning,
        paidBillsWarning,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: unknown) {
    console.error("Error in quickbooks-list-vendor-bills:", err);
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
