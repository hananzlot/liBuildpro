import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting auto-abandon PNS/Never Answered opportunities job...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find all opportunities with stage_name containing "PNS" and status not already "abandoned"
    const { data: pnsOpportunities, error: pnsFetchError } = await supabase
      .from('opportunities')
      .select('id, ghl_id, name, stage_name, status, contact_id, location_id')
      .ilike('stage_name', '%PNS%')
      .neq('status', 'abandoned');

    if (pnsFetchError) {
      console.error('Error fetching PNS opportunities:', pnsFetchError);
      throw pnsFetchError;
    }

    console.log(`Found ${pnsOpportunities?.length || 0} PNS opportunities to update`);

    // Find all opportunities with stage_name containing "Never Answer" (matches "Never Answers" and "Never Answered")
    const { data: neverAnsweredOpportunities, error: naFetchError } = await supabase
      .from('opportunities')
      .select('id, ghl_id, name, stage_name, status, contact_id, location_id')
      .ilike('stage_name', '%Never Answer%')
      .neq('status', 'abandoned');

    if (naFetchError) {
      console.error('Error fetching Never Answered opportunities:', naFetchError);
      throw naFetchError;
    }

    console.log(`Found ${neverAnsweredOpportunities?.length || 0} Never Answered opportunities to update`);

    // Combine both sets of opportunities (using a Set to avoid duplicates)
    const allOpportunities = [...(pnsOpportunities || []), ...(neverAnsweredOpportunities || [])];
    const uniqueOpportunities = Array.from(
      new Map(allOpportunities.map(o => [o.id, o])).values()
    );

    if (uniqueOpportunities.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No PNS or Never Answered opportunities to update',
          updated: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update all matching opportunities to Abandoned status
    const opportunityIds = uniqueOpportunities.map(o => o.id);
    
    const { error: updateError } = await supabase
      .from('opportunities')
      .update({ status: 'abandoned' })
      .in('id', opportunityIds);

    if (updateError) {
      console.error('Error updating opportunities:', updateError);
      throw updateError;
    }

    console.log(`Successfully updated ${uniqueOpportunities.length} opportunities to Abandoned status`);

    // Create notes for each opportunity that was moved to abandoned
    const notesToInsert = uniqueOpportunities
      .filter(opp => opp.contact_id && opp.location_id)
      .map(opp => {
        const reason = opp.stage_name?.toLowerCase().includes('pns') ? 'PNS' : 'Never Answered';
        return {
          ghl_id: `auto-abandon-${opp.ghl_id}-${Date.now()}`,
          contact_id: opp.contact_id,
          location_id: opp.location_id,
          body: `[SYSTEM] This opportunity "${opp.name}" was automatically moved to Abandoned status because it is marked as ${reason}.`,
          ghl_date_added: new Date().toISOString(),
        };
      });

    if (notesToInsert.length > 0) {
      const { error: notesError } = await supabase
        .from('contact_notes')
        .insert(notesToInsert);

      if (notesError) {
        console.error('Error inserting notes:', notesError);
        // Don't throw - the main update succeeded, just log the note error
      } else {
        console.log(`Successfully created ${notesToInsert.length} notes for abandoned opportunities`);
      }
    }
    
    // Log the updated opportunities for debugging
    uniqueOpportunities.forEach(opp => {
      console.log(`Updated: ${opp.name} (${opp.ghl_id}) - Stage: ${opp.stage_name}`);
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Updated ${uniqueOpportunities.length} PNS/Never Answered opportunities to Abandoned`,
        updated: uniqueOpportunities.length,
        notesCreated: notesToInsert.length,
        opportunities: uniqueOpportunities.map(o => ({ id: o.ghl_id, name: o.name, stage: o.stage_name }))
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in auto-abandon-pns-opportunities:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
