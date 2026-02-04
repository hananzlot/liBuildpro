import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function isUuid(value: string): boolean {
  // Accept canonical UUIDs, including all-zero UUIDs used in seed/test data.
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return json(500, { error: "Server misconfigured" });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return json(400, { error: "Invalid JSON body" });
    }

    const {
      portalToken,
      companyId,
      salespersonId,
      salespersonName,
      // pre-resolved details from the portal UI
      customerName,
      customerEmail,
      customerPhone,
      jobAddress,
      workScope,
      opportunityUuid,
      opportunityGhlId,
      contactId,
      contactUuid,
      leadSource,
    } = body as Record<string, unknown>;

    if (typeof portalToken !== "string" || portalToken.trim().length < 10) {
      return json(400, { error: "portalToken is required" });
    }
    if (typeof companyId !== "string" || !isUuid(companyId)) {
      return json(400, { error: "companyId must be a UUID" });
    }
    if (typeof salespersonId !== "string" || !isUuid(salespersonId)) {
      return json(400, { error: "salespersonId must be a UUID" });
    }
    if (typeof salespersonName !== "string" || salespersonName.trim().length === 0) {
      return json(400, { error: "salespersonName is required" });
    }
    if (typeof workScope !== "string" || workScope.trim().length < 5) {
      return json(400, { error: "workScope is required" });
    }
    if (workScope.length > 10000) {
      return json(400, { error: "workScope too long" });
    }
    if (typeof jobAddress !== "string" || jobAddress.trim().length === 0) {
      return json(400, { error: "jobAddress is required" });
    }
    if (jobAddress.length > 500) {
      return json(400, { error: "jobAddress too long" });
    }

    // Ensure a ZIP code exists before allowing AI estimate generation
    const zipRegex = /\b\d{5}(-\d{4})?\b/;
    if (!zipRegex.test(jobAddress)) {
      return json(400, { error: "Missing ZIP code in job address" });
    }

    // Validate salesperson portal token (must match company + salesperson)
    const { data: tokenRow, error: tokenError } = await supabase
      .from("salesperson_portal_tokens")
      .select("id, company_id, salesperson_id, is_active, expires_at")
      .eq("token", portalToken)
      .eq("is_active", true)
      .maybeSingle();

    if (tokenError) {
      console.error("Token lookup error:", tokenError);
      return json(500, { error: "Token lookup failed" });
    }
    if (!tokenRow) {
      return json(401, { error: "Invalid or expired portal link" });
    }
    if (tokenRow.company_id !== companyId || tokenRow.salesperson_id !== salespersonId) {
      return json(403, { error: "Portal link does not match salesperson/company" });
    }
    if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
      return json(401, { error: "Portal link expired" });
    }

    const safeCustomerName =
      typeof customerName === "string" && customerName.trim().length
        ? customerName.trim().slice(0, 255)
        : "Customer";
    const safeCustomerEmail =
      typeof customerEmail === "string" && customerEmail.trim().length
        ? customerEmail.trim().slice(0, 255)
        : "";
    const safeCustomerPhone =
      typeof customerPhone === "string" && customerPhone.trim().length
        ? customerPhone.trim().slice(0, 50)
        : "";

    const estimateDate = new Date().toISOString().split("T")[0];
    const estimateTitle = `Estimate for ${safeCustomerName}`.slice(0, 255);

    const { data: estimate, error: estimateError } = await supabase
      .from("estimates")
      .insert({
        company_id: companyId,
        customer_name: safeCustomerName,
        customer_email: safeCustomerEmail || null,
        customer_phone: safeCustomerPhone || null,
        job_address: jobAddress.trim(),
        estimate_title: estimateTitle,
        estimate_date: estimateDate,
        status: "draft",
        work_scope_description: workScope.trim(),
        salesperson_name: salespersonName.trim(),
        salesperson_id: salespersonId,
        created_by_source: "salesperson_portal",
        opportunity_uuid:
          typeof opportunityUuid === "string" && isUuid(opportunityUuid)
            ? opportunityUuid
            : null,
        opportunity_id: typeof opportunityGhlId === "string" ? opportunityGhlId : null,
        contact_id: typeof contactId === "string" ? contactId : null,
        contact_uuid:
          typeof contactUuid === "string" && isUuid(contactUuid)
            ? contactUuid
            : null,
        lead_source: typeof leadSource === "string" ? leadSource : null,
        show_details_to_customer: false,
        show_scope_to_customer: true,
        show_line_items_to_customer: true,
      })
      .select("id")
      .single();

    if (estimateError || !estimate) {
      console.error("Estimate insert error:", estimateError);
      return json(500, { error: "Failed to create estimate" });
    }

    const { data: jobData, error: jobError } = await supabase.from("estimate_generation_jobs").insert({
      company_id: companyId,
      estimate_id: estimate.id,
      status: "pending",
      request_params: {
        companyId,
        job_address: jobAddress.trim(),
        customer_name: safeCustomerName,
        work_scope: workScope.trim(),
        created_from: "salesperson_portal",
        salesperson_id: salespersonId,
        salesperson_name: salespersonName,
      },
    }).select("id").single();

    if (jobError || !jobData) {
      console.error("Job insert error:", jobError);
      return json(500, { error: "Estimate created but failed to queue AI job", estimateId: estimate.id });
    }

    // Trigger AI generation (non-blocking)
    // IMPORTANT: generate-estimate-scope expects camelCase params (jobId, companyId, jobAddress, workScopeDescription, ...)
    const triggerPayload = {
      companyId,
      jobId: jobData.id,
      jobAddress: jobAddress.trim(),
      workScopeDescription: workScope.trim(),
      // Portal estimates don't have plans/groups yet; keep a sane default.
      projectType: "General",
      defaultMarkupPercent: 50,
      stagedMode: true,
    };

    console.log("Triggering AI generation for estimate:", estimate.id, "job:", jobData.id);

    const triggerTask = (async () => {
      const { data: invokeData, error: invokeError } = await supabase.functions.invoke(
        "generate-estimate-scope",
        { body: triggerPayload }
      );

      if (invokeError) {
        console.error("Failed to trigger generate-estimate-scope:", invokeError);
      } else {
        console.log("generate-estimate-scope invoked successfully:", invokeData);
      }
    })();

    // @ts-ignore - EdgeRuntime is available in Supabase Edge Functions
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(triggerTask);
    } else {
      // Fallback: fire-and-forget
      triggerTask.catch((err) => console.error("AI trigger task failed:", err));
    }

    return json(200, { success: true, estimateId: estimate.id, jobId: jobData.id });
  } catch (err) {
    console.error("create-portal-estimate unexpected error:", err);
    return json(500, { error: "Unexpected error" });
  }
});
