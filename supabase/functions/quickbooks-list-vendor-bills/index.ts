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
  CustomerRef?: {
    value: string;
    name?: string;
  };
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

    // Step 3: Build the bill query - filter by customer if we have a mapping
    let billQuery = `SELECT * FROM Bill WHERE VendorRef = '${vendorId}'`;
    if (qbCustomerId) {
      billQuery += ` AND CustomerRef = '${qbCustomerId}'`;
    }
    billQuery += ` ORDERBY TxnDate DESC MAXRESULTS 100`;

    const billsSearchUrl = `${QB_BASE_URL}/${realm_id}/query?query=${encodeURIComponent(billQuery)}`;

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
    const rawBills: QBBill[] = billsData.QueryResponse?.Bill || [];

    console.log(`Found ${rawBills.length} total bills for vendor ${vendorId}${qbCustomerId ? ` and customer ${qbCustomerId}` : ""}`);
    
    // Filter to only include bills with a positive balance (unpaid)
    rawBills.forEach((bill) => {
      console.log(`Bill ${bill.Id} (${bill.DocNumber || 'no ref'}): TotalAmt=${bill.TotalAmt}, Balance=${bill.Balance}, CustomerRef=${bill.CustomerRef?.value || 'none'}`);
    });
    
    const unpaidBills = rawBills.filter((bill) => (bill.Balance || 0) > 0);
    console.log(`${unpaidBills.length} bills have balance > 0`);

    // Map to our response format - include customer info for display
    const bills = unpaidBills.map((bill) => ({
      qbBillId: bill.Id,
      docNumber: bill.DocNumber || "",
      txnDate: bill.TxnDate || "",
      dueDate: bill.DueDate || null,
      totalAmt: bill.TotalAmt || 0,
      balance: bill.Balance || 0,
      memo: bill.PrivateNote || null,
      customerId: bill.CustomerRef?.value || null,
      customerName: bill.CustomerRef?.name || null,
    }));

    return new Response(
      JSON.stringify({ 
        success: true, 
        vendorFound: true,
        vendorId,
        bills,
        // Include mapping info for the frontend
        projectCustomerId: qbCustomerId,
        projectCustomerName: qbCustomerName,
        hasProjectMapping: !!qbCustomerId,
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
