import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { keyType, apiKey } = await req.json();

    if (!keyType || !apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing keyType or apiKey" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Testing ${keyType} API key...`);

    if (keyType === "openai") {
      // Test OpenAI API key by making a simple models list request
      const response = await fetch("https://api.openai.com/v1/models", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
        },
      });

      if (response.ok) {
        console.log("OpenAI API key is valid");
        return new Response(
          JSON.stringify({ success: true, message: "OpenAI API key is valid" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error("OpenAI API key validation failed:", errorData);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: errorData?.error?.message || "Invalid OpenAI API key" 
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else if (keyType === "resend") {
      // Test Resend API key by fetching API keys list (lightweight check)
      const response = await fetch("https://api.resend.com/api-keys", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
        },
      });

      if (response.ok) {
        console.log("Resend API key is valid");
        return new Response(
          JSON.stringify({ success: true, message: "Resend API key is valid" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error("Resend API key validation failed:", errorData);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: errorData?.message || "Invalid Resend API key" 
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      return new Response(
        JSON.stringify({ success: false, error: "Unknown key type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("Error testing API key:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
