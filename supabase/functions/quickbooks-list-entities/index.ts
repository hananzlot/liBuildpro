import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const QB_BASE_URL = "https://quickbooks.api.intuit.com/v3/company";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { companyId, entityType } = await req.json();

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
      return new Response(
        JSON.stringify({ error: "QuickBooks not connected" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let { access_token, realm_id, token_expires_at } = tokenData[0];

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

      // IMPORTANT: refresh-token updates the stored tokens, but this function must
      // re-fetch them; otherwise we'd continue using the expired access_token.
      const { data: refreshedTokenData, error: refreshedTokenError } = await supabase.rpc(
        "get_quickbooks_tokens",
        { p_company_id: companyId }
      );

      if (refreshedTokenError || !refreshedTokenData || refreshedTokenData.length === 0) {
        console.error("Failed to load refreshed QuickBooks tokens:", refreshedTokenError);
        return new Response(
          JSON.stringify({ error: "Failed to load refreshed tokens", needsReauth: true }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      access_token = refreshedTokenData[0].access_token;
      realm_id = refreshedTokenData[0].realm_id;
      token_expires_at = refreshedTokenData[0].token_expires_at;
    }

    const qbHeaders = {
      "Authorization": `Bearer ${access_token}`,
      "Accept": "application/json",
      "Content-Type": "application/json",
    };

    let query = "";
    let resultKey = "";

    switch (entityType) {
      case "accounts":
        // Get income and expense accounts
        query = "SELECT * FROM Account WHERE AccountType IN ('Income', 'Other Income', 'Expense', 'Other Expense', 'Cost of Goods Sold') MAXRESULTS 500";
        resultKey = "Account";
        break;
      case "items":
        query = "SELECT * FROM Item WHERE Type IN ('Service', 'NonInventory', 'Inventory') AND Active = true MAXRESULTS 500";
        resultKey = "Item";
        break;
      case "paymentMethods":
        query = "SELECT * FROM PaymentMethod WHERE Active = true MAXRESULTS 100";
        resultKey = "PaymentMethod";
        break;
      case "vendors":
        query = "SELECT * FROM Vendor WHERE Active = true MAXRESULTS 500";
        resultKey = "Vendor";
        break;
      case "customers":
        query = "SELECT * FROM Customer WHERE Active = true MAXRESULTS 500";
        resultKey = "Customer";
        break;
      case "companies":
        // Get company info instead of query
        const companyInfoUrl = `${QB_BASE_URL}/${realm_id}/companyinfo/${realm_id}`;
        const companyRes = await fetch(companyInfoUrl, { headers: qbHeaders });
        if (!companyRes.ok) {
          const errorText = await companyRes.text();
          const authFailed =
            companyRes.status === 401 ||
            companyRes.status === 403 ||
            errorText.includes("ApplicationAuthorizationFailed") ||
            errorText.includes('"code":"3100"') ||
            errorText.includes("errorCode=003100");

          console.error("QB API Error (companyinfo):", errorText);
          return new Response(
            JSON.stringify({
              error: "Failed to fetch company info",
              needsReauth: authFailed ? true : undefined,
              details: errorText,
            }),
            {
              status: authFailed ? 401 : 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        const companyData = await companyRes.json();
        return new Response(
          JSON.stringify({
            entities: [
              {
                Id: realm_id,
                Name: companyData.CompanyInfo?.CompanyName || "Unknown Company",
              },
            ],
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      default:
        return new Response(
          JSON.stringify({ error: "Invalid entityType" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    const queryUrl = `${QB_BASE_URL}/${realm_id}/query?query=${encodeURIComponent(query)}`;
    const response = await fetch(queryUrl, { headers: qbHeaders });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("QB API Error:", errorText);

      const authFailed =
        response.status === 401 ||
        response.status === 403 ||
        errorText.includes("ApplicationAuthorizationFailed") ||
        errorText.includes('"code":"3100"') ||
        errorText.includes("errorCode=003100");

      return new Response(
        JSON.stringify({
          error: "Failed to fetch from QuickBooks",
          needsReauth: authFailed ? true : undefined,
          details: errorText,
        }),
        {
          status: authFailed ? 401 : 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const data = await response.json();
    const entities = data.QueryResponse?.[resultKey] || [];

    // Format response based on entity type
    const formattedEntities = entities.map((entity: any) => ({
      id: entity.Id,
      name: entity.Name || entity.FullyQualifiedName || entity.DisplayName,
      type: entity.AccountType || entity.Type || entityType,
      subType: entity.AccountSubType || null,
    }));

    return new Response(
      JSON.stringify({ entities: formattedEntities }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error listing QB entities:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
