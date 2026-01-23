import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface StoreResendKeyRequest {
  apiKey: string;
  companyId: string;
  testOnly?: boolean;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { apiKey, companyId, testOnly }: StoreResendKeyRequest = await req.json();

    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "API key is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!companyId) {
      return new Response(
        JSON.stringify({ success: false, error: "Company ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Test the API key with Resend first
    console.log("Testing Resend API key...");
    const testResponse = await fetch("https://api.resend.com/domains", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (testResponse.status === 401) {
      console.log("Resend API key is invalid (401)");
      return new Response(
        JSON.stringify({ success: false, error: "Invalid Resend API key" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (testResponse.status === 429) {
      // Rate limited but key is likely valid
      console.log("Resend API rate limited - key appears valid");
    } else if (!testResponse.ok) {
      const errorData = await testResponse.text();
      console.error("Resend API error:", errorData);
      return new Response(
        JSON.stringify({ success: false, error: `Resend API error: ${testResponse.status}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If testOnly, just return success without storing
    if (testOnly) {
      return new Response(
        JSON.stringify({ success: true, message: "Resend API key is valid" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Store the encrypted API key using service role
    console.log(`Storing Resend API key for company ${companyId}`);
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    const { data, error } = await supabase.rpc("store_resend_api_key_encrypted", {
      p_api_key: apiKey,
      p_company_id: companyId,
    });

    if (error) {
      console.error("Error storing Resend API key:", error);
      return new Response(
        JSON.stringify({ success: false, error: `Failed to store API key: ${error.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Resend API key stored successfully");
    return new Response(
      JSON.stringify({ success: true, message: "Resend API key saved successfully" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in store-resend-key:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
