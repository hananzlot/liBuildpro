import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface GHLCredentials {
  apiKey: string;
  locationId: string;
  companyId: string | null;
  integrationId: string;
}

/**
 * Get GHL credentials from company_integrations table.
 * Throws an error if no credentials are found - NO FALLBACK to env vars.
 */
export async function getGHLCredentials(
  supabase: SupabaseClient,
  locationId: string
): Promise<GHLCredentials> {
  // Query company_integrations for this location
  const { data: integration, error } = await supabase
    .from("company_integrations")
    .select("id, company_id, location_id, api_key_vault_id")
    .eq("provider", "ghl")
    .eq("location_id", locationId)
    .eq("is_active", true)
    .single();

  if (error || !integration) {
    throw new Error(
      `GHL integration not configured for location ${locationId}. ` +
      `Please add the GHL integration in Admin Settings → GHL tab.`
    );
  }

  if (!integration.api_key_vault_id) {
    throw new Error(
      `GHL API key not configured for location ${locationId}. ` +
      `Please update the GHL integration in Admin Settings → GHL tab.`
    );
  }

  // Get decrypted API key from vault
  const { data: apiKey, error: vaultError } = await supabase.rpc(
    "get_ghl_api_key",
    { secret_id: integration.api_key_vault_id }
  );

  if (vaultError || !apiKey) {
    throw new Error(
      `Failed to retrieve GHL API key for location ${locationId}. ` +
      `Vault error: ${vaultError?.message || "Key not found"}`
    );
  }

  return {
    apiKey,
    locationId: integration.location_id,
    companyId: integration.company_id,
    integrationId: integration.id,
  };
}

/**
 * Get GHL credentials for all active integrations.
 * Throws an error if no integrations are configured.
 */
export async function getAllGHLCredentials(
  supabase: SupabaseClient
): Promise<GHLCredentials[]> {
  // Query all active GHL integrations
  const { data: integrations, error } = await supabase
    .from("company_integrations")
    .select("id, company_id, location_id, api_key_vault_id, name")
    .eq("provider", "ghl")
    .eq("is_active", true);

  if (error) {
    throw new Error(`Failed to fetch GHL integrations: ${error.message}`);
  }

  if (!integrations || integrations.length === 0) {
    throw new Error(
      "No GHL integrations configured. " +
      "Please add a GHL integration in Admin Settings → GHL tab."
    );
  }

  const credentials: GHLCredentials[] = [];

  for (const integration of integrations) {
    if (!integration.api_key_vault_id) {
      console.warn(
        `Skipping integration ${integration.name || integration.id}: No API key configured`
      );
      continue;
    }

    // Get decrypted API key from vault
    const { data: apiKey, error: vaultError } = await supabase.rpc(
      "get_ghl_api_key",
      { secret_id: integration.api_key_vault_id }
    );

    if (vaultError || !apiKey) {
      console.warn(
        `Skipping integration ${integration.name || integration.id}: ` +
        `Failed to retrieve API key - ${vaultError?.message || "Key not found"}`
      );
      continue;
    }

    credentials.push({
      apiKey,
      locationId: integration.location_id,
      companyId: integration.company_id,
      integrationId: integration.id,
    });
  }

  if (credentials.length === 0) {
    throw new Error(
      "No valid GHL integrations found. " +
      "All configured integrations are missing API keys or have vault errors."
    );
  }

  return credentials;
}
