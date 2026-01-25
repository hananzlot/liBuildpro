import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { dryRun = true } = await req.json().catch(() => ({ dryRun: true }));

    console.log(`Running opportunity name cleanup (dryRun: ${dryRun})...`);

    // Find opportunities with bad names that have valid contact names
    const { data: badOpportunities, error: fetchError } = await supabase
      .from("opportunities")
      .select(`
        id,
        ghl_id,
        name,
        contact_id,
        contact_uuid
      `)
      .or(
        "name.ilike.%decline%," +
        "name.ilike.%accepted%," +
        "name.ilike.%tentative%," +
        "name.like.%@%"
      );

    if (fetchError) {
      console.error("Error fetching opportunities:", fetchError);
      throw fetchError;
    }

    console.log(`Found ${badOpportunities?.length || 0} potentially bad opportunity names`);

    // Also check for phone number patterns manually
    const phonePattern = /^\+?[\d\-\(\)\s]{7,}$/;
    const parenPattern = /^\([^)]+\)$/;

    const toFix: Array<{
      id: string;
      ghl_id: string;
      oldName: string;
      newName: string;
    }> = [];

    for (const opp of badOpportunities || []) {
      const name = opp.name || "";
      
      // Check if name is invalid
      const isInvalid =
        name.toLowerCase().includes("decline") ||
        name.toLowerCase().includes("accepted") ||
        name.toLowerCase().includes("tentative") ||
        name.includes("@") ||
        phonePattern.test(name) ||
        parenPattern.test(name);

      if (!isInvalid) continue;

      // Try to find contact name
      let contactName: string | null = null;

      if (opp.contact_uuid) {
        const { data: contact } = await supabase
          .from("contacts")
          .select("contact_name, first_name, last_name")
          .eq("id", opp.contact_uuid)
          .maybeSingle();

        if (contact) {
          contactName = contact.contact_name ||
            `${contact.first_name || ""} ${contact.last_name || ""}`.trim() ||
            null;
        }
      }

      if (!contactName && opp.contact_id) {
        const { data: contact } = await supabase
          .from("contacts")
          .select("contact_name, first_name, last_name")
          .eq("ghl_id", opp.contact_id)
          .maybeSingle();

        if (contact) {
          contactName = contact.contact_name ||
            `${contact.first_name || ""} ${contact.last_name || ""}`.trim() ||
            null;
        }
      }

      // Check if contact name is valid
      if (
        contactName &&
        !contactName.includes("@") &&
        !phonePattern.test(contactName) &&
        !parenPattern.test(contactName) &&
        contactName.length > 1
      ) {
        toFix.push({
          id: opp.id,
          ghl_id: opp.ghl_id,
          oldName: name,
          newName: contactName,
        });
      }
    }

    console.log(`Found ${toFix.length} opportunities to fix`);

    if (!dryRun && toFix.length > 0) {
      let updated = 0;
      let failed = 0;

      for (const item of toFix) {
        const { error } = await supabase
          .from("opportunities")
          .update({ name: item.newName })
          .eq("id", item.id);

        if (error) {
          console.error(`Failed to update ${item.id}:`, error);
          failed++;
        } else {
          console.log(`Updated "${item.oldName}" -> "${item.newName}"`);
          updated++;
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Updated ${updated} opportunities, ${failed} failed`,
          updated,
          failed,
          details: toFix,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        dryRun: true,
        message: `Found ${toFix.length} opportunities to fix`,
        toFix,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
