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
    console.log('Starting auto-abandon PNS opportunities job...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find all opportunities with stage_name containing "PNS" and status not already "abandoned"
    const { data: pnsOpportunities, error: fetchError } = await supabase
      .from('opportunities')
      .select('id, ghl_id, name, stage_name, status')
      .ilike('stage_name', '%PNS%')
      .neq('status', 'abandoned');

    if (fetchError) {
      console.error('Error fetching PNS opportunities:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${pnsOpportunities?.length || 0} PNS opportunities to update`);

    if (!pnsOpportunities || pnsOpportunities.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No PNS opportunities to update',
          updated: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update all PNS opportunities to Abandoned status
    const opportunityIds = pnsOpportunities.map(o => o.id);
    
    const { error: updateError } = await supabase
      .from('opportunities')
      .update({ status: 'abandoned' })
      .in('id', opportunityIds);

    if (updateError) {
      console.error('Error updating opportunities:', updateError);
      throw updateError;
    }

    console.log(`Successfully updated ${pnsOpportunities.length} opportunities to Abandoned status`);
    
    // Log the updated opportunities for debugging
    pnsOpportunities.forEach(opp => {
      console.log(`Updated: ${opp.name} (${opp.ghl_id}) - Stage: ${opp.stage_name}`);
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Updated ${pnsOpportunities.length} PNS opportunities to Abandoned`,
        updated: pnsOpportunities.length,
        opportunities: pnsOpportunities.map(o => ({ id: o.ghl_id, name: o.name, stage: o.stage_name }))
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
