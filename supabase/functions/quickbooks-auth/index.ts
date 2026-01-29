import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const QUICKBOOKS_AUTH_URL = "https://appcenter.intuit.com/connect/oauth2";
const QUICKBOOKS_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const clientId = Deno.env.get("QUICKBOOKS_CLIENT_ID");
    const clientSecret = Deno.env.get("QUICKBOOKS_CLIENT_SECRET");

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ error: "QuickBooks credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { action, companyId, code, realmId, redirectUri } = await req.json();

    if (action === "get-auth-url") {
      // Generate OAuth URL for the user to authorize
      if (!companyId || !redirectUri) {
        return new Response(
          JSON.stringify({ error: "companyId and redirectUri are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const state = btoa(JSON.stringify({ companyId }));
      const scopes = "com.intuit.quickbooks.accounting";
      
      const authUrl = `${QUICKBOOKS_AUTH_URL}?client_id=${clientId}&response_type=code&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;

      return new Response(
        JSON.stringify({ authUrl }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "exchange-code") {
      // Exchange authorization code for tokens
      if (!code || !realmId || !companyId || !redirectUri) {
        return new Response(
          JSON.stringify({ error: "code, realmId, companyId, and redirectUri are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const basicAuth = btoa(`${clientId}:${clientSecret}`);
      
      const tokenResponse = await fetch(QUICKBOOKS_TOKEN_URL, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${basicAuth}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error("Token exchange failed:", errorText);
        return new Response(
          JSON.stringify({ error: "Failed to exchange code for tokens", details: errorText }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const tokens = await tokenResponse.json();
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

      // Store tokens using the helper function
      const { error: storeError } = await supabase.rpc("store_quickbooks_tokens", {
        p_company_id: companyId,
        p_realm_id: realmId,
        p_access_token: tokens.access_token,
        p_refresh_token: tokens.refresh_token,
        p_expires_at: expiresAt,
      });

      if (storeError) {
        console.error("Failed to store tokens:", storeError);
        return new Response(
          JSON.stringify({ error: "Failed to store tokens", details: storeError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: "QuickBooks connected successfully" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "refresh-token") {
      // Refresh access token
      if (!companyId) {
        return new Response(
          JSON.stringify({ error: "companyId is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get current tokens
      const { data: tokenData, error: tokenError } = await supabase.rpc("get_quickbooks_tokens", {
        p_company_id: companyId,
      });

      if (tokenError || !tokenData || tokenData.length === 0) {
        return new Response(
          JSON.stringify({ error: "No QuickBooks connection found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { refresh_token } = tokenData[0];
      const basicAuth = btoa(`${clientId}:${clientSecret}`);

      const refreshResponse = await fetch(QUICKBOOKS_TOKEN_URL, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${basicAuth}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json",
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token,
        }),
      });

      if (!refreshResponse.ok) {
        const errorText = await refreshResponse.text();
        console.error("Token refresh failed:", errorText);
        
        // Mark connection as inactive
        await supabase
          .from("quickbooks_connections")
          .update({ is_active: false, sync_error: "Token refresh failed - reconnection required" })
          .eq("company_id", companyId);

        return new Response(
          JSON.stringify({ error: "Token refresh failed", needsReauth: true }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const newTokens = await refreshResponse.json();
      const expiresAt = new Date(Date.now() + newTokens.expires_in * 1000).toISOString();

      // Update stored tokens
      await supabase.rpc("store_quickbooks_tokens", {
        p_company_id: companyId,
        p_realm_id: tokenData[0].realm_id,
        p_access_token: newTokens.access_token,
        p_refresh_token: newTokens.refresh_token || refresh_token,
        p_expires_at: expiresAt,
      });

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "disconnect") {
      if (!companyId) {
        return new Response(
          JSON.stringify({ error: "companyId is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await supabase
        .from("quickbooks_connections")
        .update({ is_active: false })
        .eq("company_id", companyId);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("QuickBooks auth error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
