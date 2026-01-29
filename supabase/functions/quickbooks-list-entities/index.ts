import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const QB_BASE_URL_PROD = "https://quickbooks.api.intuit.com/v3/company";
const QB_BASE_URL_SANDBOX = "https://sandbox-quickbooks.api.intuit.com/v3/company";

const looksLikeEnvMismatchOrAuthFailure = (status: number, errorText: string) => {
  return (
    status === 401 ||
    status === 403 ||
    errorText.includes("ApplicationAuthorizationFailed") ||
    errorText.includes('"code":"3100"') ||
    errorText.includes("errorCode=003100")
  );
};

const fetchWithSandboxFallback = async (
  urlForBase: (baseUrl: string) => string,
  qbHeaders: Record<string, string>
) => {
  // Many Intuit developer setups use Sandbox companies. Those require calling
  // `sandbox-quickbooks.api.intuit.com`. If we call the prod endpoint with a
  // sandbox realm/token, Intuit returns 403/3100 (ApplicationAuthorizationFailed).
  const bases = [QB_BASE_URL_PROD, QB_BASE_URL_SANDBOX];

  let lastErrorText = "";
  let lastStatus = 500;

  for (let i = 0; i < bases.length; i++) {
    const baseUrl = bases[i];
    const url = urlForBase(baseUrl);
    const res = await fetch(url, { headers: qbHeaders });
    if (res.ok) {
      return { res, baseUrl };
    }

    const errorText = await res.text();
    lastErrorText = errorText;
    lastStatus = res.status;

    const isAuthish = looksLikeEnvMismatchOrAuthFailure(res.status, errorText);

    // If the first attempt (prod) looks like auth/env mismatch, try sandbox next.
    if (i === 0 && isAuthish) {
      console.warn("QB API Error on prod endpoint; retrying sandbox...", errorText);
      continue;
    }

    // Otherwise, stop immediately.
    break;
  }

  return { res: null, baseUrl: null, errorText: lastErrorText, status: lastStatus };
};

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

    // If QuickBooks rejects our access token (401/403), we can often recover by refreshing.
    // (Not all 401s are recoverable — e.g. truly revoked tokens — but this reduces false reauth prompts.)
    let didRefreshAfterAuthFailure = false;

    const refreshAndReloadTokens = async () => {
      console.log("Attempting QuickBooks token refresh...");

      const refreshResult = await supabase.functions.invoke("quickbooks-auth", {
        body: { action: "refresh-token", companyId },
      });

      if (refreshResult.error || refreshResult.data?.error) {
        console.error("QuickBooks token refresh failed:", refreshResult.error || refreshResult.data?.error);
        return null;
      }

      // Re-fetch updated tokens from DB.
      const { data: refreshedTokenData, error: refreshedTokenError } = await supabase.rpc(
        "get_quickbooks_tokens",
        { p_company_id: companyId }
      );

      if (refreshedTokenError || !refreshedTokenData || refreshedTokenData.length === 0) {
        console.error("Failed to load refreshed QuickBooks tokens:", refreshedTokenError);
        return null;
      }

      return refreshedTokenData[0] as {
        access_token: string;
        realm_id: string;
        token_expires_at: string;
      };
    };

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

    const qbHeaders: Record<string, string> = {
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
        let companyAttempt = await fetchWithSandboxFallback(
          (baseUrl) => `${baseUrl}/${realm_id}/companyinfo/${realm_id}`,
          qbHeaders
        );

        if (!companyAttempt.res) {
          const authFailed = looksLikeEnvMismatchOrAuthFailure(
            companyAttempt.status ?? 500,
            companyAttempt.errorText ?? ""
          );

          // One recovery attempt: refresh token and retry the call.
          if (authFailed && !didRefreshAfterAuthFailure) {
            didRefreshAfterAuthFailure = true;
            const refreshed = await refreshAndReloadTokens();
            if (refreshed) {
              access_token = refreshed.access_token;
              realm_id = refreshed.realm_id;
              token_expires_at = refreshed.token_expires_at;
              qbHeaders["Authorization"] = `Bearer ${access_token}`;

              companyAttempt = await fetchWithSandboxFallback(
                (baseUrl) => `${baseUrl}/${realm_id}/companyinfo/${realm_id}`,
                qbHeaders
              );
            }
          }

          if (companyAttempt.res) {
            const companyData = await companyAttempt.res.json();
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
          }

          console.error("QB API Error (companyinfo):", companyAttempt.errorText);
          return new Response(
            JSON.stringify({
              error: "Failed to fetch company info",
              needsReauth: authFailed ? true : undefined,
              details: companyAttempt.errorText,
            }),
            {
              status: authFailed ? 401 : 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        const companyData = await companyAttempt.res.json();
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

    let queryAttempt = await fetchWithSandboxFallback(
      (baseUrl) => `${baseUrl}/${realm_id}/query?query=${encodeURIComponent(query)}`,
      qbHeaders
    );

    if (!queryAttempt.res) {
      console.error("QB API Error:", queryAttempt.errorText);

      const authFailed = looksLikeEnvMismatchOrAuthFailure(
        queryAttempt.status ?? 500,
        queryAttempt.errorText ?? ""
      );

      // One recovery attempt: refresh token and retry the query.
      if (authFailed && !didRefreshAfterAuthFailure) {
        didRefreshAfterAuthFailure = true;
        const refreshed = await refreshAndReloadTokens();
        if (refreshed) {
          access_token = refreshed.access_token;
          realm_id = refreshed.realm_id;
          token_expires_at = refreshed.token_expires_at;
          qbHeaders["Authorization"] = `Bearer ${access_token}`;

          queryAttempt = await fetchWithSandboxFallback(
            (baseUrl) => `${baseUrl}/${realm_id}/query?query=${encodeURIComponent(query)}`,
            qbHeaders
          );
        }
      }

      if (queryAttempt.res) {
        const data = await queryAttempt.res.json();
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
      }

      return new Response(
        JSON.stringify({
          error: "Failed to fetch from QuickBooks",
          needsReauth: authFailed ? true : undefined,
          details: queryAttempt.errorText,
        }),
        {
          status: authFailed ? 401 : 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const data = await queryAttempt.res.json();
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
