import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get authorization header for user validation
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the user is an admin
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is admin
    const { data: isAdmin } = await supabase.rpc("is_admin", { _user_id: user.id });
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { action, companyId, dryRun = true } = await req.json();

    if (!companyId) {
      return new Response(
        JSON.stringify({ error: "companyId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Cleanup action: ${action}, companyId: ${companyId}, dryRun: ${dryRun}`);

    if (action === "find-junk-contacts") {
      // Find contacts that are likely junk:
      // - No email AND no phone
      // - No linked projects
      // - No linked opportunities
      // - No linked appointments
      
      const { data: junkContacts, error } = await supabase
        .from("contacts")
        .select(`
          id,
          contact_name,
          email,
          phone,
          source,
          ghl_id,
          created_at
        `)
        .eq("company_id", companyId)
        .is("email", null)
        .is("phone", null)
        .order("contact_name");

      if (error) throw error;

      // Filter out contacts that have projects, opportunities, or appointments
      const contactIds = junkContacts?.map(c => c.id) || [];
      
      if (contactIds.length === 0) {
        return new Response(
          JSON.stringify({ contacts: [], count: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check for linked projects
      const { data: projectContacts } = await supabase
        .from("projects")
        .select("contact_uuid")
        .eq("company_id", companyId)
        .in("contact_uuid", contactIds)
        .not("contact_uuid", "is", null);

      const projectContactIds = new Set((projectContacts || []).map(p => p.contact_uuid));

      // Check for linked opportunities  
      const { data: oppContacts } = await supabase
        .from("opportunities")
        .select("contact_uuid")
        .eq("company_id", companyId)
        .in("contact_uuid", contactIds)
        .not("contact_uuid", "is", null);

      const oppContactIds = new Set((oppContacts || []).map(o => o.contact_uuid));

      // Check for linked appointments
      const { data: apptContacts } = await supabase
        .from("appointments")
        .select("contact_uuid")
        .eq("company_id", companyId)
        .in("contact_uuid", contactIds)
        .not("contact_uuid", "is", null);

      const apptContactIds = new Set((apptContacts || []).map(a => a.contact_uuid));

      // Filter to only truly orphaned contacts
      const orphanedContacts = (junkContacts || []).filter(c => 
        !projectContactIds.has(c.id) && 
        !oppContactIds.has(c.id) && 
        !apptContactIds.has(c.id)
      );

      // Group by contact_name for summary
      const groupedByName: Record<string, number> = {};
      orphanedContacts.forEach(c => {
        const name = c.contact_name?.toLowerCase() || "(no name)";
        groupedByName[name] = (groupedByName[name] || 0) + 1;
      });

      const summary = Object.entries(groupedByName)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);

      return new Response(
        JSON.stringify({ 
          contacts: orphanedContacts.slice(0, 100), // Return first 100 for preview
          count: orphanedContacts.length,
          summary
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "delete-junk-contacts") {
      if (dryRun) {
        return new Response(
          JSON.stringify({ error: "Set dryRun to false to actually delete" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Same logic as find, but delete
      const { data: junkContacts, error } = await supabase
        .from("contacts")
        .select("id")
        .eq("company_id", companyId)
        .is("email", null)
        .is("phone", null);

      if (error) throw error;

      const contactIds = junkContacts?.map(c => c.id) || [];
      
      if (contactIds.length === 0) {
        return new Response(
          JSON.stringify({ deleted: 0, message: "No junk contacts found" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check for linked records
      const { data: projectContacts } = await supabase
        .from("projects")
        .select("contact_uuid")
        .eq("company_id", companyId)
        .in("contact_uuid", contactIds)
        .not("contact_uuid", "is", null);

      const { data: oppContacts } = await supabase
        .from("opportunities")
        .select("contact_uuid")
        .eq("company_id", companyId)
        .in("contact_uuid", contactIds)
        .not("contact_uuid", "is", null);

      const { data: apptContacts } = await supabase
        .from("appointments")
        .select("contact_uuid")
        .eq("company_id", companyId)
        .in("contact_uuid", contactIds)
        .not("contact_uuid", "is", null);

      const linkedIds = new Set([
        ...(projectContacts || []).map(p => p.contact_uuid),
        ...(oppContacts || []).map(o => o.contact_uuid),
        ...(apptContacts || []).map(a => a.contact_uuid),
      ]);

      const toDelete = contactIds.filter(id => !linkedIds.has(id));

      if (toDelete.length === 0) {
        return new Response(
          JSON.stringify({ deleted: 0, message: "All contacts have linked records" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Delete one by one to handle FK constraint errors gracefully
      let totalDeleted = 0;
      let skipped = 0;
      const skippedIds: string[] = [];

      for (const contactId of toDelete) {
        const { error: deleteError } = await supabase
          .from("contacts")
          .delete()
          .eq("id", contactId);

        if (deleteError) {
          // Foreign key constraint error - contact is still referenced
          if (deleteError.code === "23503") {
            console.log(`Skipping contact ${contactId} - still referenced by another table`);
            skipped++;
            skippedIds.push(contactId);
          } else {
            console.error("Delete error:", deleteError);
            throw deleteError;
          }
        } else {
          totalDeleted++;
        }
      }

      console.log(`Deleted ${totalDeleted} junk contacts, skipped ${skipped} (still referenced)`);

      return new Response(
        JSON.stringify({ 
          deleted: totalDeleted, 
          skipped,
          message: skipped > 0 
            ? `Deleted ${totalDeleted} junk contacts. ${skipped} contacts were skipped (still referenced by other records).`
            : `Deleted ${totalDeleted} junk contacts`
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use 'find-junk-contacts' or 'delete-junk-contacts'" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
