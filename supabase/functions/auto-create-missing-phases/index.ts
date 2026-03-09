import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get all active companies
    const { data: companies, error: compErr } = await supabase
      .from("companies")
      .select("id")
      .eq("is_active", true);

    if (compErr) throw compErr;

    let totalCreated = 0;
    const results: { company_id: string; phases_created: number }[] = [];

    for (const company of companies || []) {
      // Check if this company has the setting enabled (default: true)
      const { data: setting } = await supabase
        .from("company_settings")
        .select("setting_value")
        .eq("company_id", company.id)
        .eq("setting_key", "auto_create_missing_phases")
        .maybeSingle();

      // Default is true if no setting exists
      const isEnabled = !setting || setting.setting_value !== "false";
      if (!isEnabled) {
        console.log(`Skipping company ${company.id} - auto_create_missing_phases disabled`);
        continue;
      }

      // Get all agreements for active (non-deleted) projects in this company
      const { data: agreements, error: agErr } = await supabase
        .from("project_agreements")
        .select("id, total_price, project_id")
        .eq("company_id", company.id);

      if (agErr) {
        console.error(`Error fetching agreements for company ${company.id}:`, agErr);
        continue;
      }

      if (!agreements?.length) continue;

      // Get all phases for this company
      const { data: phases, error: phErr } = await supabase
        .from("project_payment_phases")
        .select("id, agreement_id, amount")
        .eq("company_id", company.id);

      if (phErr) {
        console.error(`Error fetching phases for company ${company.id}:`, phErr);
        continue;
      }

      let companyCreated = 0;

      for (const agreement of agreements) {
        const contractTotal = agreement.total_price || 0;
        if (contractTotal <= 0) continue;

        const agreementPhases = (phases || []).filter(
          (p) => p.agreement_id === agreement.id
        );
        const phasesTotal = agreementPhases.reduce(
          (sum, p) => sum + (p.amount || 0),
          0
        );
        const balance = contractTotal - phasesTotal;

        // Only create if missing amount > $0.01
        if (balance > 0.01) {
          const { error: insertErr } = await supabase
            .from("project_payment_phases")
            .insert({
              project_id: agreement.project_id,
              agreement_id: agreement.id,
              phase_name: "System Auto Entry",
              amount: Math.round(balance * 100) / 100,
              company_id: company.id,
            });

          if (insertErr) {
            console.error(
              `Error creating phase for agreement ${agreement.id}:`,
              insertErr
            );
          } else {
            companyCreated++;
            totalCreated++;
          }
        }
      }

      if (companyCreated > 0) {
        results.push({
          company_id: company.id,
          phases_created: companyCreated,
        });
      }
    }

    console.log(
      `Auto-create missing phases completed. Total phases created: ${totalCreated}`
    );

    return new Response(
      JSON.stringify({
        success: true,
        total_phases_created: totalCreated,
        details: results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in auto-create-missing-phases:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
