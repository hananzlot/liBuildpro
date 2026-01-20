import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getGHLCredentials } from "../_shared/ghl-credentials.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { opportunityId, locationId } = await req.json();

    if (!opportunityId) {
      throw new Error('Missing opportunityId (GHL opportunity ID)');
    }

    // Check if this is a local-only opportunity
    const isLocalOpportunity = opportunityId.startsWith('local_');
    if (isLocalOpportunity) {
      console.log(`Deleting local-only opportunity: ${opportunityId}`);
      
      const { error: deleteError } = await supabase
        .from('opportunities')
        .delete()
        .eq('ghl_id', opportunityId);
      
      if (deleteError) {
        return new Response(
          JSON.stringify({ error: `Failed to delete local opportunity: ${deleteError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          localOnlyMode: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If locationId not provided, look it up from the database
    let effectiveLocationId = locationId;
    if (!effectiveLocationId) {
      const { data: oppData } = await supabase
        .from('opportunities')
        .select('location_id')
        .eq('ghl_id', opportunityId)
        .single();
      
      effectiveLocationId = oppData?.location_id;
    }

    if (!effectiveLocationId) {
      throw new Error('Could not determine location_id for opportunity');
    }

    // Get GHL credentials from vault
    const credentials = await getGHLCredentials(supabase, effectiveLocationId);

    console.log(`Deleting GHL opportunity (location: ${effectiveLocationId}): ${opportunityId}`);

    // Delete opportunity in GHL
    const ghlResponse = await fetch(`https://services.leadconnectorhq.com/opportunities/${opportunityId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${credentials.apiKey}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json',
      },
    });

    if (!ghlResponse.ok) {
      const errorText = await ghlResponse.text();
      console.error('GHL API Error:', errorText);
      throw new Error(`GHL API Error: ${ghlResponse.status} - ${errorText}`);
    }

    console.log('GHL opportunity deleted successfully');

    // Delete from Supabase
    const { error: deleteError } = await supabase
      .from('opportunities')
      .delete()
      .eq('ghl_id', opportunityId);

    if (deleteError) {
      console.error('Supabase delete error:', deleteError);
      // Don't throw - GHL deletion was successful
    } else {
      console.log('Opportunity deleted from Supabase');
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Opportunity deleted'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error deleting opportunity:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
