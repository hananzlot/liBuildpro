import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the legacy environment variables
    const ghlApiKey1 = Deno.env.get("GHL_API_KEY");
    const ghlLocationId1 = Deno.env.get("GHL_LOCATION_ID");
    const ghlApiKey2 = Deno.env.get("GHL_API_KEY_2");
    const ghlLocationId2 = Deno.env.get("GHL_LOCATION_ID_2");

    const results: { location: string; status: string; message: string }[] = [];

    // Process first location
    if (ghlApiKey1 && ghlLocationId1) {
      const result = await backfillIntegration(supabase, ghlLocationId1, ghlApiKey1, "Location 1");
      results.push(result);
    } else {
      results.push({
        location: "Location 1",
        status: "skipped",
        message: "GHL_API_KEY or GHL_LOCATION_ID not set",
      });
    }

    // Process second location
    if (ghlApiKey2 && ghlLocationId2) {
      const result = await backfillIntegration(supabase, ghlLocationId2, ghlApiKey2, "Location 2");
      results.push(result);
    } else {
      results.push({
        location: "Location 2",
        status: "skipped",
        message: "GHL_API_KEY_2 or GHL_LOCATION_ID_2 not set",
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Backfill completed",
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Backfill error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

async function backfillIntegration(
  supabase: any,
  locationId: string,
  apiKey: string,
  locationName: string
): Promise<{ location: string; status: string; message: string }> {
  try {
    // Check if integration exists for this location
    const { data: integration, error: fetchError } = await supabase
      .from("company_integrations")
      .select("id, api_key_vault_id, name")
      .eq("provider", "ghl")
      .eq("location_id", locationId)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      return {
        location: locationName,
        status: "error",
        message: `Failed to fetch integration: ${fetchError.message}`,
      };
    }

    if (!integration) {
      return {
        location: locationName,
        status: "skipped",
        message: `No integration found for location_id ${locationId}`,
      };
    }

    // Check if already has vault key
    if (integration.api_key_vault_id) {
      return {
        location: locationName,
        status: "skipped",
        message: `Integration "${integration.name}" already has vault key configured`,
      };
    }

    // Store API key in vault
    const { data: vaultId, error: vaultError } = await supabase.rpc(
      "store_ghl_api_key",
      {
        api_key: apiKey,
        integration_name: `GHL API Key - ${integration.name || locationId}`,
      }
    );

    if (vaultError) {
      return {
        location: locationName,
        status: "error",
        message: `Failed to store in vault: ${vaultError.message}`,
      };
    }

    // Update integration with vault ID
    const { error: updateError } = await supabase
      .from("company_integrations")
      .update({ api_key_vault_id: vaultId })
      .eq("id", integration.id);

    if (updateError) {
      return {
        location: locationName,
        status: "error",
        message: `Failed to update integration: ${updateError.message}`,
      };
    }

    return {
      location: locationName,
      status: "success",
      message: `API key stored in vault and linked to integration "${integration.name}"`,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      location: locationName,
      status: "error",
      message: `Unexpected error: ${errorMessage}`,
    };
  }
}
