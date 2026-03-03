import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Get the platform Resend API key.
 * First checks app_settings table for a 'resend_api_key' row (managed via Super Admin UI).
 * Falls back to the RESEND_API_KEY environment variable if not found in the database.
 */
export async function getResendApiKey(
  supabase: SupabaseClient,
  _companyId?: string | null
): Promise<string | null> {
  // Try app_settings first (DB-managed via Super Admin UI)
  try {
    const { data } = await supabase
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", "resend_api_key")
      .maybeSingle();

    if (data?.setting_value) {
      console.log("Using Resend API key from app_settings");
      return data.setting_value;
    }
  } catch (err) {
    console.log("Could not read resend_api_key from app_settings:", err);
  }

  // Fallback to environment variable
  const envKey = Deno.env.get("RESEND_API_KEY");
  if (envKey) {
    console.log("Using platform RESEND_API_KEY from env");
  }
  return envKey || null;
}

/**
 * Get the verified email sender for a company.
 * Looks up company_email_domains for a verified domain, then builds the from address.
 * Falls back to company_settings resend_from_email/resend_from_name.
 */
export async function getCompanyEmailSender(
  supabase: SupabaseClient,
  companyId: string
): Promise<{ fromEmail: string; fromName: string } | null> {
  // Try company_email_domains first (new flow)
  try {
    const { data: emailDomain } = await supabase
      .from("company_email_domains")
      .select("domain, from_email, from_name, verified")
      .eq("company_id", companyId)
      .single();

    if (emailDomain?.verified && emailDomain.domain) {
      return {
        fromEmail: emailDomain.from_email || `noreply@${emailDomain.domain}`,
        fromName: emailDomain.from_name || emailDomain.domain,
      };
    }
  } catch (err) {
    console.log(`No company_email_domains entry for ${companyId}`);
  }

  // Fallback to company_settings (legacy flow)
  try {
    const { data: settings } = await supabase
      .from("company_settings")
      .select("setting_key, setting_value")
      .eq("company_id", companyId)
      .in("setting_key", ["resend_from_email", "resend_from_name"]);

    if (settings && settings.length > 0) {
      const map: Record<string, string> = {};
      settings.forEach((s: { setting_key: string; setting_value: string | null }) => {
        if (s.setting_value) map[s.setting_key] = s.setting_value;
      });

      if (map.resend_from_email) {
        return {
          fromEmail: map.resend_from_email,
          fromName: map.resend_from_name || "Notifications",
        };
      }
    }
  } catch (err) {
    console.log(`Error fetching company_settings for ${companyId}: ${err}`);
  }

  return null;
}
