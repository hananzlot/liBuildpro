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

    const { companyId, vendorName } = await req.json();

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

    // Step 1: Find the vendor by name in QuickBooks
    console.log(`Searching for vendor: "${vendorName}"`);
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

    const vendorId = vendors[0].Id;
    console.log(`Found vendor "${vendorName}" with ID: ${vendorId}`);

    // Step 2: Get all unpaid bills for this vendor (Balance > 0)
    const billsSearchUrl = `${QB_BASE_URL}/${realm_id}/query?query=${encodeURIComponent(
      `SELECT * FROM Bill WHERE VendorRef = '${vendorId}' AND Balance > '0' ORDERBY TxnDate DESC MAXRESULTS 100`
    )}`;

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

    console.log(`Found ${rawBills.length} unpaid bills for vendor ${vendorId}`);

    // Map to our response format
    const bills = rawBills.map((bill) => ({
      qbBillId: bill.Id,
      docNumber: bill.DocNumber || "",
      txnDate: bill.TxnDate || "",
      dueDate: bill.DueDate || null,
      totalAmt: bill.TotalAmt || 0,
      balance: bill.Balance || 0,
      memo: bill.PrivateNote || null,
    }));

    return new Response(
      JSON.stringify({ 
        success: true, 
        vendorFound: true,
        vendorId,
        bills 
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
