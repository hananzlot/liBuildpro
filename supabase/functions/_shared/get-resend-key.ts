import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Get Resend API key for a company.
 * First tries to get company-specific encrypted key from company_settings.
 * Falls back to RESEND_API_KEY environment variable if not found.
 */
export async function getResendApiKey(
  supabase: SupabaseClient,
  companyId?: string | null
): Promise<string | null> {
  // Try company-specific encrypted key first
  if (companyId) {
    try {
      const { data: apiKey, error } = await supabase.rpc(
        "get_resend_api_key_encrypted",
        { p_company_id: companyId }
      );

      if (!error && apiKey) {
        console.log(`Using company-specific Resend API key for company ${companyId}`);
        return apiKey;
      }
      
      if (error) {
        console.log(`Could not retrieve company Resend key: ${error.message}`);
      }
    } catch (err) {
      console.log(`Error fetching company Resend key: ${err}`);
    }
  }

  // Fallback to environment variable
  const envKey = Deno.env.get("RESEND_API_KEY");
  if (envKey) {
    console.log("Using RESEND_API_KEY from environment variable (fallback)");
  }
  return envKey || null;
}
