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
    const { contactId, contactUuid, excludeFromSync = true } = await req.json();

    if (!contactId && !contactUuid) {
      return new Response(
        JSON.stringify({ error: "contactId or contactUuid is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Deleting contact ${contactId || contactUuid} (local-only, excludeFromSync: ${excludeFromSync})`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch contact
    let contact = null;
    
    if (contactUuid) {
      const result = await supabase
        .from("contacts")
        .select("id, ghl_id, location_id, contact_name, company_id")
        .eq("id", contactUuid)
        .maybeSingle();
      contact = result.data;
    } else if (contactId) {
      const result = await supabase
        .from("contacts")
        .select("id, ghl_id, location_id, contact_name, company_id")
        .eq("ghl_id", contactId)
        .maybeSingle();
      contact = result.data;
    }

    if (!contact) {
      return new Response(
        JSON.stringify({ error: "Contact not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Add to sync exclusions if requested (prevents re-sync from GHL)
    if (excludeFromSync && contact.ghl_id && contact.location_id) {
      const { error: exclusionError } = await supabase
        .from('ghl_sync_exclusions')
        .upsert({
          ghl_id: contact.ghl_id,
          record_type: 'contact',
          location_id: contact.location_id,
          company_id: contact.company_id,
          reason: `Deleted via app: ${contact.contact_name || 'Unknown'}`,
        }, { onConflict: 'ghl_id,record_type,location_id' });

      if (exclusionError) {
        console.error('Error adding sync exclusion:', exclusionError);
      } else {
        console.log('Added contact to sync exclusions');
      }
    }

    // Delete related records first (those with ON DELETE SET NULL won't cascade)
    // Contact notes have ON DELETE CASCADE, so they'll be deleted automatically
    
    // Count and delete opportunities associated with this contact
    const { data: opportunitiesToDelete } = await supabase
      .from("opportunities")
      .select("id, ghl_id, name")
      .or(`contact_uuid.eq.${contact.id},contact_id.eq.${contact.ghl_id || 'none'}`);
    
    const opportunitiesDeleted = opportunitiesToDelete?.length || 0;
    console.log(`Found ${opportunitiesDeleted} opportunities to delete for contact ${contact.id}`);
    
    if (opportunitiesDeleted > 0) {
      // First update estimates to remove opportunity references
      for (const opp of opportunitiesToDelete || []) {
        await supabase
          .from("estimates")
          .update({ opportunity_id: null, opportunity_uuid: null })
          .or(`opportunity_uuid.eq.${opp.id},opportunity_id.eq.${opp.ghl_id || 'none'}`);
        
        // Update projects to remove opportunity references
        await supabase
          .from("projects")
          .update({ opportunity_id: null, opportunity_uuid: null })
          .or(`opportunity_uuid.eq.${opp.id},opportunity_id.eq.${opp.ghl_id || 'none'}`);
      }
      
      // Delete the opportunities
      const { error: oppDeleteError } = await supabase
        .from("opportunities")
        .delete()
        .or(`contact_uuid.eq.${contact.id},contact_id.eq.${contact.ghl_id || 'none'}`);
      
      if (oppDeleteError) {
        console.error('Error deleting opportunities:', oppDeleteError);
      } else {
        console.log(`Successfully deleted ${opportunitiesDeleted} opportunities`);
      }
    }

    // Update appointments to remove contact reference
    await supabase
      .from("appointments")
      .update({ contact_id: null, contact_uuid: null })
      .eq("contact_uuid", contact.id);

    // Update projects to remove contact reference (those not already handled via opportunity)
    await supabase
      .from("projects")
      .update({ contact_id: null, contact_uuid: null })
      .eq("contact_uuid", contact.id);

    // Update estimates to remove contact reference
    await supabase
      .from("estimates")
      .update({ contact_id: null, contact_uuid: null })
      .eq("contact_uuid", contact.id);

    // Delete or unlink tasks associated with this contact
    const { error: tasksError } = await supabase
      .from("ghl_tasks")
      .delete()
      .eq("contact_uuid", contact.id);

    if (tasksError) {
      console.error("Error deleting tasks for contact:", tasksError);
    } else {
      console.log("Deleted tasks for contact", contact.id);
    }

    // Delete contact notes (FK constraint requires explicit deletion)
    const { error: notesError } = await supabase
      .from("contact_notes")
      .delete()
      .eq("contact_uuid", contact.id);

    if (notesError) {
      console.error("Error deleting notes for contact:", notesError);
    } else {
      console.log("Deleted notes for contact", contact.id);
    }

    // Delete the contact
    const { error: deleteError } = await supabase
      .from("contacts")
      .delete()
      .eq("id", contact.id);

    if (deleteError) {
      console.error("Error deleting contact:", deleteError);
      return new Response(
        JSON.stringify({ error: "Failed to delete contact", details: deleteError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Successfully deleted contact ${contact.id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        deletedContactId: contact.id, 
        excludedFromSync: excludeFromSync,
        opportunitiesDeleted: opportunitiesDeleted,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in delete-ghl-contact:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
