import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getResendApiKey } from "../_shared/get-resend-key.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    const { action, companyId, domain, resendDomainId } = await req.json();

    if (!companyId) {
      return new Response(
        JSON.stringify({ success: false, error: "companyId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const RESEND_API_KEY = await getResendApiKey(supabase);
    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "Platform RESEND_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify caller is admin for this company
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        return new Response(
          JSON.stringify({ success: false, error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    switch (action) {
      case "register": {
        if (!domain) {
          return new Response(
            JSON.stringify({ success: false, error: "domain is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        console.log(`Registering domain ${domain} for company ${companyId}`);

        // Register domain with Resend
        const resendResponse = await fetch("https://api.resend.com/domains", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name: domain }),
        });

        if (!resendResponse.ok) {
          const errorText = await resendResponse.text();
          console.error("Resend domain registration error:", errorText);
          
          // Check for duplicate domain
          if (resendResponse.status === 409) {
            return new Response(
              JSON.stringify({ success: false, error: "This domain is already registered. Try checking verification status instead." }),
              { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          
          return new Response(
            JSON.stringify({ success: false, error: `Failed to register domain: ${errorText}` }),
            { status: resendResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const resendData = await resendResponse.json();
        console.log("Resend domain registered:", JSON.stringify(resendData));

        // Store in database
        const { error: dbError } = await supabase
          .from("company_email_domains")
          .upsert({
            company_id: companyId,
            domain: domain,
            resend_domain_id: resendData.id,
            verified: false,
            dns_records: resendData.records || [],
            from_email: `noreply@${domain}`,
            updated_at: new Date().toISOString(),
          }, { onConflict: "company_id" });

        if (dbError) {
          console.error("DB error:", dbError);
          return new Response(
            JSON.stringify({ success: false, error: `Database error: ${dbError.message}` }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            domain: resendData,
            dns_records: resendData.records || [],
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "verify": {
        if (!resendDomainId) {
          return new Response(
            JSON.stringify({ success: false, error: "resendDomainId is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        console.log(`Checking verification for domain ${resendDomainId}`);

        // Trigger verification
        await fetch(`https://api.resend.com/domains/${resendDomainId}/verify`, {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
        });

        // Get domain status
        const resendResponse = await fetch(`https://api.resend.com/domains/${resendDomainId}`, {
          method: "GET",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
        });

        if (!resendResponse.ok) {
          const errorText = await resendResponse.text();
          return new Response(
            JSON.stringify({ success: false, error: `Failed to check domain: ${errorText}` }),
            { status: resendResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const domainData = await resendResponse.json();
        const isVerified = domainData.status === "verified";

        console.log(`Domain status: ${domainData.status}, verified: ${isVerified}`);

        // Update database
        const updateData: Record<string, unknown> = {
          verified: isVerified,
          dns_records: domainData.records || [],
          updated_at: new Date().toISOString(),
        };
        if (isVerified) {
          updateData.verified_at = new Date().toISOString();
        }

        await supabase
          .from("company_email_domains")
          .update(updateData)
          .eq("company_id", companyId)
          .eq("resend_domain_id", resendDomainId);

        // If verified, also update company_settings for from_email
        if (isVerified) {
          const { data: domainRow } = await supabase
            .from("company_email_domains")
            .select("domain, from_email, from_name")
            .eq("company_id", companyId)
            .single();

          if (domainRow) {
            // Upsert resend_from_email setting
            await supabase
              .from("company_settings")
              .upsert({
                company_id: companyId,
                setting_key: "resend_from_email",
                setting_value: domainRow.from_email || `noreply@${domainRow.domain}`,
                updated_at: new Date().toISOString(),
              }, { onConflict: "company_id,setting_key" });
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            verified: isVerified,
            status: domainData.status,
            dns_records: domainData.records || [],
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "delete": {
        if (!resendDomainId) {
          return new Response(
            JSON.stringify({ success: false, error: "resendDomainId is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        console.log(`Deleting domain ${resendDomainId} for company ${companyId}`);

        // Delete from Resend
        await fetch(`https://api.resend.com/domains/${resendDomainId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
        });

        // Delete from database
        await supabase
          .from("company_email_domains")
          .delete()
          .eq("company_id", companyId);

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ success: false, error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    console.error("Error in manage-email-domain:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
